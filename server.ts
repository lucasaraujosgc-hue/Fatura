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

  app.get("/api/invoices", async (req, res) => {
    try {
      const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
      const pdfsDir = path.join(dataDir, "pdfs");
      if (!fs.existsSync(pdfsDir)) {
        return res.json([]);
      }
      
      const files = fs.readdirSync(pdfsDir);
      const invoices = files.map(file => {
        // file format: "YYYY-MM-original_name.pdf"
        const match = file.match(/^(\d{4}-\d{2})-(.+)$/);
        if (match) {
           return { month: match[1], filename: match[2], fullPath: file };
        }
        return { month: "Unknown", filename: file, fullPath: file };
      });
      
      // sort by month desc
      invoices.sort((a, b) => b.month.localeCompare(a.month));
      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/invoices/:month", async (req, res) => {
    try {
      const { month } = req.params;
      
      // 1. Delete from DB
      const { deleteImportedInvoice } = await import("./server/db.js");
      await deleteImportedInvoice(month);
      
      // 2. Delete PDF
      const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
      const pdfsDir = path.join(dataDir, "pdfs");
      if (fs.existsSync(pdfsDir)) {
        const files = fs.readdirSync(pdfsDir);
        for (const file of files) {
           if (file.startsWith(`${month}-`)) {
             fs.unlinkSync(path.join(pdfsDir, file));
           }
        }
      }
      
      res.json({ success: true });
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
      
      const { invoiceMonth, overwrite, resolutions } = req.body;
      if (!invoiceMonth) {
        return res.status(400).json({ error: "invoiceMonth (YYYY-MM) is required" });
      }

      console.log(`Extracting data for month ${invoiceMonth}...`);
      let extractedTransactions = await parseInvoicePDF(req.file.path, invoiceMonth);

      // Check for conflicts
      const { getTransactionsForMonth, deleteTransaction, importTransactions, getAllTransactions } = await import("./server/db.js");
      const existingTxs = await getTransactionsForMonth(invoiceMonth);

      // Fetch all transactions to learn historical category/person associations
      const allTxs = await getAllTransactions();
      const knowledge: Record<string, any> = {};
      
      // Sort oldest to newest so newest associations take precedence
      allTxs.sort((a, b) => a.billed_month.localeCompare(b.billed_month));
      for (const tx of allTxs) {
        if (!tx.is_projected && tx.description) {
           knowledge[tx.description.trim().toLowerCase()] = {
             category_id: tx.category_id,
             person_id: tx.person_id,
             split_data: tx.split_data,
             notes: tx.notes
           };
        }
      }

      // Separate explicit existing into manual and imported
      const explicitExisting = existingTxs.filter((tx: any) => !tx.is_projected);
      const manualExisting = explicitExisting.filter((tx: any) => tx.is_imported === 0);
      const importedExisting = explicitExisting.filter((tx: any) => tx.is_imported === 1);
      const projectedExisting = existingTxs.filter((tx: any) => tx.is_projected);
      
      // If overwrite is false, prevent upload if imported data already exists
      if (overwrite !== "true" && importedExisting.length > 0) {
         try { fs.unlinkSync(req.file.path); } catch(e) {}
         return res.status(400).json({ error: "Este mês já possui dados importados. Marque a opção de sobrescrever para atualizar a fatura." });
      }

      let conflicts: any[] = [];
      let parsedResolutions: Record<string, string> = {};
      
      if (resolutions) {
         try {
           parsedResolutions = JSON.parse(resolutions);
         } catch (e) {}
      }

      const txsToImport = [];

      for (let i = 0; i < extractedTransactions.length; i++) {
        const extTx = extractedTransactions[i];
        
        // 1. Learn from history based on description matching
        const matchKey = extTx.description.trim().toLowerCase();
        const learned = knowledge[matchKey];
        if (learned) {
            extTx.category_id = learned.category_id;
            extTx.person_id = learned.person_id;
            extTx.split_data = learned.split_data;
            extTx.notes = learned.notes;
        }

        // 2. Overwrite from exactly matching previous imported transaction in SAME month (takes precedence if they tweaked the split on this specific month)
        if (overwrite === "true") {
           // Auto-match with old imported transactions to preserve categories
           const oldMatched = importedExisting.find((old: any) => 
               old.original_date === extTx.date && 
               Math.abs(old.amount - extTx.amount) <= 0.05
           );
           if (oldMatched) {
               extTx.category_id = oldMatched.category_id;
               extTx.person_id = oldMatched.person_id;
               extTx.split_data = oldMatched.split_data;
               extTx.notes = oldMatched.notes;
           }
        }
        
        // Helper to get DD/MM from various date formats
        const getDDMM = (d: string) => {
           if (!d) return "";
           if (d.includes("-")) {
              const parts = d.split("-");
              if (parts[0].length === 4) return `${parts[2]}/${parts[1]}`; // YYYY-MM-DD
           }
           if (d.includes("/")) {
              const parts = d.split("/");
              if (parts[0].length === 2) return `${parts[0]}/${parts[1]}`; // DD/MM/YYYY
           }
           return d.substring(0, 5);
        };

        // Find if there's a conflict with manual OR projected transactions
        const normalizeDesc = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8);
        const conflict = manualExisting.find((ex: any) => {
           const sameDate = getDDMM(ex.original_date) === getDDMM(extTx.date);
           const amountDiff = Math.abs(ex.amount - extTx.amount);
           const descMatch = normalizeDesc(ex.description) === normalizeDesc(extTx.description);
           return sameDate && amountDiff <= 0.05 && descMatch;
        }) || projectedExisting.find((ex: any) => {
           const sameDate = getDDMM(ex.original_date) === getDDMM(extTx.date);
           const amountDiff = Math.abs(ex.amount - extTx.amount);
           const descMatch = normalizeDesc(ex.description) === normalizeDesc(extTx.description);
           return sameDate && amountDiff <= 0.05 && descMatch;
        });


        if (conflict) {
           const conflictId = `conflict_${i}`;
           
           if (!parsedResolutions[conflictId]) {
              conflicts.push({
                 conflictId,
                 extracted: extTx,
                 existing: conflict
              });
           } else {
              const resValue = parsedResolutions[conflictId];
              if (resValue === 'replace') {
                 txsToImport.push(extTx);
                 if (!conflict.is_projected) {
                     await deleteTransaction(conflict.id);
                 }
              } else if (resValue === 'ignore') {
                 if (conflict.is_projected) {
                     // For projected: "Manter" means keep the previous month's configuration (person, category, splits)
                     extTx.category_id = conflict.category_id;
                     extTx.person_id = conflict.person_id;
                     extTx.split_data = conflict.split_data;
                     extTx.notes = conflict.notes;
                     extTx.current_installment = conflict.current_installment;
                     extTx.total_installment = conflict.total_installment;
                     txsToImport.push(extTx);
                 } else {
                     // skip manual conflict
                 }
              }
           }
        } else {
           txsToImport.push(extTx);
        }
      }

      // If we found conflicts and haven't resolved them all, return them to client
      if (conflicts.length > 0) {
          // Delete temp PDF
          try { fs.unlinkSync(req.file.path); } catch (e) {}
          
          return res.json({ 
             success: false, 
             requireResolution: true, 
             conflicts 
          });
      }

      console.log(`Importing ${txsToImport.length} transactions for ${invoiceMonth}...`);
      await importTransactions(invoiceMonth, txsToImport, overwrite === "true");

      // Save PDF to backup directory instead of deleting
      const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
      const pdfsDir = path.join(dataDir, "pdfs");
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }
      
      const targetPath = path.join(pdfsDir, `${invoiceMonth}-${req.file.originalname}`);
      fs.copyFileSync(req.file.path, targetPath);
      fs.unlinkSync(req.file.path);

      res.json({ success: true, count: txsToImport.length });
    } catch (err: any) {
      console.error(err);
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chat", upload.single("file"), async (req, res) => {
    try {
      const { message } = req.body;
      
      let fileText = "";
      if (req.file) {
        if (req.file.mimetype === "application/pdf") {
          const pdfParse = (await import("pdf-parse")).default;
          const pdfParserClass = (pdfParse as any).PDFParse;
          if (pdfParserClass) {
            const dataBuffer = fs.readFileSync(req.file.path);
            const parserInstance = new pdfParserClass({ data: dataBuffer });
            const textResult = await parserInstance.getText();
            fileText = textResult.text;
            await parserInstance.destroy();
          }
        }
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ reply: "GEMINI_API_KEY environment variable is missing." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let promptText = message || "";
      if (fileText) {
         promptText += "\n\n=== CONTEÚDO DO ARQUIVO ===\n" + fileText.substring(0, 15000); // limit to 15k chars for safety
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction: "Você é um assistente financeiro do FaturaX. Seu papel é ajudar o usuário a analisar faturas e corrigir lançamentos. Seja conciso, direto e amigável.",
          temperature: 0.7,
        }
      });

      res.json({ reply: response.text });
    } catch (err: any) {
      console.error(err);
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
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
