import "dotenv/config";
import express from "express";
import path from "path";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { setupDb } from "./server/db.js";
import { parseInvoicePDF } from "./server/parser.js";
import {
  getPeople,
  createPerson,
  deletePerson,
  updatePerson,
  getTransactionsForMonth,
  addManualTransaction,
  deleteTransaction,
  importTransactions,
  getAvailableMonths,
} from "./server/db.js";
import { createServer as createViteServer } from "vite";

const upload = multer({ dest: "uploads/" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize DB
  await setupDb();

  // ----- API Routes -----

  // People
  app.get("/api/people", async (req, res) => {
    try {
      const people = await getPeople();
      res.json(people);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/people", async (req, res) => {
    try {
      const { name, color } = req.body;
      const person = await createPerson(name, color);
      res.json(person);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/people/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      const person = await updatePerson(id, name, color);
      res.json(person);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/people/:id", async (req, res) => {
    try {
      await deletePerson(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const { getCategories } = await import("./server/db.js");
      const categories = await getCategories();
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const { name, color, icon } = req.body;
      const { createCategory } = await import("./server/db.js");
      const category = await createCategory(name, color, icon);
      res.json(category);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color, icon } = req.body;
      const { updateCategory } = await import("./server/db.js");
      const category = await updateCategory(id, name, color, icon);
      res.json(category);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { deleteCategory } = await import("./server/db.js");
      await deleteCategory(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Transactions
  app.get("/api/transactions/:month", async (req, res) => {
    try {
      const month = req.params.month; // YYYY-MM
      const transactions = await getTransactionsForMonth(month);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/months", async (req, res) => {
    try {
      const months = await getAvailableMonths();
      res.json(months);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const tx = await addManualTransaction(req.body);
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      await deleteTransaction(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/transactions/batch-assign", async (req, res) => {
    try {
      const { ids, person_id, category_id } = req.body;
      const { batchUpdateTransactions } = await import("./server/db.js");
      await batchUpdateTransactions(ids, person_id, category_id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/transactions/:id/config", async (req, res) => {
    try {
      const { id } = req.params;
      const { person_id, split_data, category_id, notes } = req.body;
      const { updateTransactionConfig } = await import("./server/db.js");
      await updateTransactionConfig(id, person_id, split_data, category_id, notes);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PDF Upload & Extraction
  app.post("/api/upload", upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { invoiceMonth, overwrite } = req.body;
      if (!invoiceMonth) {
        return res.status(400).json({ error: "invoiceMonth (YYYY-MM) is required" });
      }

      console.log(`Extracting data for month ${invoiceMonth}...`);
      const extractedTransactions = await parseInvoicePDF(req.file.path, invoiceMonth);

      console.log(`Importing ${extractedTransactions.length} transactions for ${invoiceMonth}...`);
      await importTransactions(invoiceMonth, extractedTransactions, overwrite === "true");

      // Save PDF to backup directory instead of deleting
      const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
      const pdfsDir = path.join(dataDir, "pdfs");
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }
      
      const targetPath = path.join(pdfsDir, `${invoiceMonth}-${req.file.originalname}`);
      fs.copyFileSync(req.file.path, targetPath);
      fs.unlinkSync(req.file.path);

      res.json({ success: true, count: extractedTransactions.length });
    } catch (err: any) {
      console.error(err);
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
