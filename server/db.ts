import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

let db: Database;

export async function setupDb() {
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
  const dbPath = path.resolve(dataDir);
  
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  db = await open({
    filename: path.join(dbPath, "database.sqlite"),
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      billed_month TEXT NOT NULL,
      original_date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      current_installment INTEGER DEFAULT 1,
      total_installment INTEGER DEFAULT 1,
      person_id TEXT,
      is_imported INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (person_id) REFERENCES people(id)
    );
  `);

  try {
    await db.exec(`ALTER TABLE transactions ADD COLUMN split_data TEXT;`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    await db.exec(`ALTER TABLE transactions ADD COLUMN category_id TEXT;`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    await db.exec(`ALTER TABLE transactions ADD COLUMN notes TEXT;`);
  } catch (e) {
    // Ignore if column already exists
  }

  // Populate default categories if empty
  try {
    const countRow = await db.get("SELECT COUNT(*) as count FROM categories");
    if (!countRow || countRow.count === 0) {
      const defaultCategories = [
        { id: uuidv4(), name: "Academias", color: "#4ade80", icon: "Dumbbell" },
        { id: uuidv4(), name: "Alimentação", color: "#ec4899", icon: "Utensils" },
        { id: uuidv4(), name: "Assinaturas e Serviços", color: "#a855f7", icon: "CreditCard" },
        { id: uuidv4(), name: "Bares e restaurantes", color: "#3b82f6", icon: "Wine" },
        { id: uuidv4(), name: "Casa", color: "#06b6d4", icon: "Home" },
        { id: uuidv4(), name: "Casamento / Viagem", color: "#f43f5e", icon: "Heart" },
        { id: uuidv4(), name: "Compras", color: "#ec4899", icon: "ShoppingBag" },
        { id: uuidv4(), name: "Educação", color: "#6366f1", icon: "GraduationCap" },
        { id: uuidv4(), name: "Mercado", color: "#f97316", icon: "ShoppingCart" },
        { id: uuidv4(), name: "Pets", color: "#eab308", icon: "PawPrint" },
        { id: uuidv4(), name: "Lazer e hobbies", color: "#84cc16", icon: "Smile" },
        { id: uuidv4(), name: "Outros", color: "#64748b", icon: "List" }
      ];
      for (const cat of defaultCategories) {
        await db.run("INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)", [cat.id, cat.name, cat.color, cat.icon]);
      }
    }
  } catch (err) {
    console.error("Error seeding categories:", err);
  }
}

export async function getCategories() {
  return await db.all("SELECT * FROM categories");
}

export async function createCategory(name: string, color: string, icon: string) {
  const id = uuidv4();
  await db.run("INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)", [id, name, color, icon]);
  return { id, name, color, icon };
}

export async function updateCategory(id: string, name: string, color: string, icon: string) {
  await db.run("UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?", [name, color, icon, id]);
  return { id, name, color, icon };
}

export async function deleteCategory(id: string) {
  await db.run("DELETE FROM categories WHERE id = ?", [id]);
  await db.run("UPDATE transactions SET category_id = NULL WHERE category_id = ?", [id]);
}

export async function getPeople() {
  return await db.all("SELECT * FROM people");
}

export async function createPerson(name: string, color: string) {
  const id = uuidv4();
  await db.run("INSERT INTO people (id, name, color) VALUES (?, ?, ?)", [id, name, color]);
  return { id, name, color };
}

export async function updatePerson(id: string, name: string, color: string) {
  await db.run("UPDATE people SET name = ?, color = ? WHERE id = ?", [name, color, id]);
  return { id, name, color };
}

export async function deletePerson(id: string) {
  await db.run("DELETE FROM people WHERE id = ?", [id]);
  await db.run("UPDATE transactions SET person_id = NULL WHERE person_id = ?", [id]);
}

export async function getAvailableMonths() {
  const rows = await db.all("SELECT DISTINCT billed_month FROM transactions ORDER BY billed_month DESC");
  return rows.map((r) => r.billed_month);
}

export async function getTransactionsForMonth(month: string) {
  // First, get all explicit transactions for this month (imported or manual)
  const explicitTx = await db.all("SELECT * FROM transactions WHERE billed_month = ?", [month]);

  // Next, identify the latest imported month that is older than this month
  // This is used to project future installments
  const lastImportRow = await db.get(
    "SELECT billed_month FROM transactions WHERE is_imported = 1 AND billed_month < ? ORDER BY billed_month DESC LIMIT 1",
    [month]
  );

  let projectedTx: any[] = [];
  
  if (lastImportRow) {
    const lastImportedMonth = lastImportRow.billed_month;
    
    // Calculate the difference in months
    const d1 = new Date(lastImportedMonth + "-01");
    const d2 = new Date(month + "-01");
    const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());

    if (diffMonths > 0) {
      // Find all imported transactions from the last imported month that have remaining installments
      const baseTx = await db.all(`
        SELECT * FROM transactions 
        WHERE is_imported = 1 
        AND billed_month = ?
        AND total_installment > current_installment
      `, [lastImportedMonth]);

      for (const tx of baseTx) {
        const projectedCurrent = tx.current_installment + diffMonths;
        if (projectedCurrent <= tx.total_installment) {
          projectedTx.push({
            ...tx,
            id: tx.id + "_proj", // Give it a temporary ID
            billed_month: month,
            current_installment: projectedCurrent,
            is_imported: 0,
            is_projected: true, // Flag as projected for the frontend
          });
        }
      }
    }
  }

  // If this month HAS imported transactions, we ignore the projected ones from earlier months.
  // Because the actual PDF represents reality.
  // Exception: Manual transactions are always kept.
  const hasImportedTx = explicitTx.some((tx) => tx.is_imported === 1);
  
  if (hasImportedTx) {
    return explicitTx;
  }

  // If there are no imported transactions for this month, combine manual tx with projected tx.
  return [...explicitTx, ...projectedTx];
}

export async function addManualTransaction(data: any) {
  const { billed_month, original_date, description, amount, current_installment, total_installment, person_id, category_id, notes } = data;
  const id = uuidv4();
  await db.run(`
    INSERT INTO transactions 
    (id, billed_month, original_date, description, amount, current_installment, total_installment, person_id, is_imported, category_id, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    id, 
    billed_month, 
    original_date, 
    description, 
    amount, 
    current_installment || 1, 
    total_installment || 1, 
    person_id || null,
    category_id || null,
    notes || null
  ]);
  
  return await db.get("SELECT * FROM transactions WHERE id = ?", [id]);
}

export async function deleteTransaction(id: string) {
  await db.run("DELETE FROM transactions WHERE id = ?", [id]);
}

export async function updateTransactionConfig(
  id: string,
  person_id: string | null,
  split_data: any | null,
  category_id: string | null = undefined,
  notes: string | null = undefined
) {
  if (category_id !== undefined && notes !== undefined) {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, category_id = ?, notes = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, category_id, notes, id]
    );
  } else if (category_id !== undefined) {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, category_id = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, category_id, id]
    );
  } else if (notes !== undefined) {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, notes = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, notes, id]
    );
  } else {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, id]
    );
  }
}

export async function batchUpdateTransactions(ids: string[], person_id?: string | null, category_id?: string | null) {
  for (const id of ids) {
    if (person_id !== undefined && category_id !== undefined) {
      await db.run("UPDATE transactions SET person_id = ?, category_id = ? WHERE id = ?", [person_id, category_id, id]);
    } else if (person_id !== undefined) {
      await db.run("UPDATE transactions SET person_id = ? WHERE id = ?", [person_id, id]);
    } else if (category_id !== undefined) {
      await db.run("UPDATE transactions SET category_id = ? WHERE id = ?", [category_id, id]);
    }
  }
}

export async function importTransactions(month: string, extractedTx: any[], overwrite: boolean) {
  if (overwrite) {
    await db.run("DELETE FROM transactions WHERE billed_month = ? AND is_imported = 1", [month]);
  } else {
    // If we don't overwrite, check if we already have imported transactions for this month
    const existing = await db.get("SELECT 1 FROM transactions WHERE billed_month = ? AND is_imported = 1 LIMIT 1", [month]);
    if (existing) {
      throw new Error("This month already has imported data. Use overwrite to replace it.");
    }
  }

  const stmt = await db.prepare(`
    INSERT INTO transactions 
    (id, billed_month, original_date, description, amount, current_installment, total_installment, is_imported) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const tx of extractedTx) {
    await stmt.run([
      uuidv4(),
      month,
      tx.date,
      tx.description,
      tx.amount,
      tx.current_installment,
      tx.total_installments
    ]);
  }
  await stmt.finalize();
}
