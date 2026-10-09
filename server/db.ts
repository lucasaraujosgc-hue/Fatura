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

  try {
    await db.exec(`ALTER TABLE transactions ADD COLUMN is_fixed INTEGER DEFAULT 0;`);
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

  const getDDMM = (d: string) => {
     if (!d) return "";
     if (d.includes("-")) {
        const parts = d.split("-");
        if (parts[0].length === 4) return `${parts[2]}/${parts[1]}`;
     }
     if (d.includes("/")) {
        const parts = d.split("/");
        if (parts[0].length === 2) return `${parts[0]}/${parts[1]}`;
     }
     return d.substring(0, 5);
  };

  // Find all fixed transactions from before this month
  const fixedTxRows = await db.all(`
    SELECT * FROM transactions 
    WHERE is_fixed = 1 
    AND billed_month < ?
    ORDER BY billed_month DESC
  `, [month]);

  const fixedTxMap = new Map();
  for (const tx of fixedTxRows) {
    const key = getDDMM(tx.original_date) + "_" + tx.description.toLowerCase().trim();
    if (!fixedTxMap.has(key)) {
      fixedTxMap.set(key, tx);
    }
  }

  for (const tx of fixedTxMap.values()) {
    projectedTx.push({
      ...tx,
      id: tx.id + "_proj_fixed",
      billed_month: month,
      is_imported: 0,
      is_projected: true,
    });
  }

  const safeProjected = projectedTx.filter(ptx => {
    return !explicitTx.some(etx => {
      // Allow minor variations in amount due to parsing
      const sameAmount = Math.abs(etx.amount - ptx.amount) <= 0.05;
      const sameDate = getDDMM(etx.original_date) === getDDMM(ptx.original_date);
      return sameAmount && sameDate;
    });
  });

  return [...explicitTx, ...safeProjected];
}


export async function addManualTransaction(data: any) {
  const { billed_month, original_date, description, amount, current_installment, total_installment, person_id, category_id, notes, is_fixed } = data;
  
  const current = current_installment || 1;
  const total = total_installment || 1;
  
  const [startYearStr, startMonthStr] = billed_month.split('-');
  let currY = parseInt(startYearStr);
  let currM = parseInt(startMonthStr);

  const insertedIds = [];

  for (let i = current; i <= total; i++) {
    const id = uuidv4();
    const currentBilledMonth = `${currY}-${currM.toString().padStart(2, '0')}`;
    
    await db.run(`
      INSERT INTO transactions 
      (id, billed_month, original_date, description, amount, current_installment, total_installment, person_id, is_imported, category_id, notes, is_fixed) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `, [
      id, 
      currentBilledMonth, 
      original_date, 
      description, 
      amount, 
      i, 
      total, 
      person_id || null,
      category_id || null,
      notes || null,
      is_fixed || 0
    ]);

    insertedIds.push(id);

    // increment month
    currM++;
    if (currM > 12) {
      currM = 1;
      currY++;
    }
  }

  // Return the first one as representative
  return await db.get("SELECT * FROM transactions WHERE id = ?", [insertedIds[0]]);
}

export async function deleteTransaction(id: string) {
  await db.run("DELETE FROM transactions WHERE id = ?", [id]);
}

export async function deleteImportedInvoice(month: string) {
  // Delete all imported transactions for this month
  await db.run("DELETE FROM transactions WHERE billed_month = ? AND is_imported = 1", [month]);
}



export async function updateTransactionConfig(
  id: string,
  person_id_or_data: any,
  split_data?: any | null,
  category_id?: string | null,
  notes?: string | null,
  is_fixed?: number | boolean
) {
  // Support either (id, dataObject) or (id, person_id, split_data, category_id, notes, is_fixed)
  let data: any = {};
  if (typeof person_id_or_data === "object" && person_id_or_data !== null && !Array.isArray(person_id_or_data)) {
    data = { ...person_id_or_data };
  } else {
    data = {
      person_id: person_id_or_data,
      split_data,
      category_id,
      notes,
      is_fixed: typeof is_fixed === "boolean" ? (is_fixed ? 1 : 0) : (is_fixed ?? 0)
    };
  }

  // Handle projected transaction materialization
  if (id.includes("_proj")) {
    const newId = uuidv4();
    await db.run(`
      INSERT INTO transactions 
      (id, billed_month, original_date, description, amount, current_installment, total_installment, person_id, is_imported, category_id, notes, is_fixed, split_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `, [
      newId,
      data.billed_month || "",
      data.original_date || new Date().toISOString().slice(0, 10),
      data.description || "Lançamento",
      data.amount !== undefined ? Number(data.amount) : 0,
      data.current_installment || 1,
      data.total_installment || 1,
      data.person_id || null,
      data.category_id || null,
      data.notes || null,
      data.is_fixed ? 1 : 0,
      data.split_data ? (typeof data.split_data === "string" ? data.split_data : JSON.stringify(data.split_data)) : null
    ]);
    return { id: newId };
  }

  // Build dynamic update query
  const sets: string[] = [];
  const params: any[] = [];

  if (data.person_id !== undefined) {
    sets.push("person_id = ?");
    params.push(data.person_id || null);
  }
  if (data.split_data !== undefined) {
    sets.push("split_data = ?");
    params.push(data.split_data ? (typeof data.split_data === "string" ? data.split_data : JSON.stringify(data.split_data)) : null);
  }
  if (data.category_id !== undefined) {
    sets.push("category_id = ?");
    params.push(data.category_id || null);
  }
  if (data.notes !== undefined) {
    sets.push("notes = ?");
    params.push(data.notes || null);
  }
  if (data.is_fixed !== undefined) {
    sets.push("is_fixed = ?");
    params.push(data.is_fixed ? 1 : 0);
  }
  if (data.billed_month !== undefined) {
    sets.push("billed_month = ?");
    params.push(data.billed_month);
  }
  if (data.original_date !== undefined) {
    sets.push("original_date = ?");
    params.push(data.original_date);
  }
  if (data.description !== undefined) {
    sets.push("description = ?");
    params.push(data.description);
  }
  if (data.amount !== undefined) {
    sets.push("amount = ?");
    params.push(Number(data.amount));
  }
  if (data.current_installment !== undefined) {
    sets.push("current_installment = ?");
    params.push(Number(data.current_installment));
  }
  if (data.total_installment !== undefined) {
    sets.push("total_installment = ?");
    params.push(Number(data.total_installment));
  }

  if (sets.length > 0) {
    params.push(id);
    await db.run(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`, params);
  }
  return { id };
}

export async function batchMoveTransactions(ids: string[], target_month: string) {
  if (!ids || ids.length === 0 || !target_month) return { count: 0 };
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.run(
    `UPDATE transactions SET billed_month = ? WHERE id IN (${placeholders})`,
    [target_month, ...ids]
  );
  return { count: result.changes || ids.length };
}

export async function batchDeleteTransactions(ids: string[]) {
  if (!ids || ids.length === 0) return { count: 0 };
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.run(`DELETE FROM transactions WHERE id IN (${placeholders})`, ids);
  return { count: result.changes || ids.length };
}

export async function shiftTransactionsByDate(options: {
  from_month: string;
  to_month: string;
  start_date?: string;
  end_date?: string;
  from_day?: number;
  to_day?: number;
  ids?: string[];
}) {
  const { from_month, to_month, start_date, end_date, from_day, to_day, ids } = options;
  if (!from_month || !to_month) {
    throw new Error("from_month e to_month são obrigatórios.");
  }

  let query = "SELECT * FROM transactions WHERE billed_month = ?";
  const params: any[] = [from_month];

  if (ids && ids.length > 0) {
    query += ` AND id IN (${ids.map(() => "?").join(",")})`;
    params.push(...ids);
  }

  const txs = await db.all(query, params);
  
  // Filter by dates/days in JS for resilient parsing of different date formats
  const parseDay = (dStr: string) => {
    if (!dStr) return 0;
    if (dStr.includes("-")) {
      const parts = dStr.split("-");
      if (parts.length === 3) return parseInt(parts[2], 10);
    }
    if (dStr.includes("/")) {
      const parts = dStr.split("/");
      return parseInt(parts[0], 10);
    }
    return 0;
  };

  const toIsoDate = (dStr: string) => {
    if (!dStr) return "";
    if (dStr.includes("-") && dStr.length >= 10) return dStr.slice(0, 10);
    if (dStr.includes("/")) {
      const parts = dStr.split("/");
      if (parts.length === 3) {
        const dd = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        const yyyy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return dStr;
  };

  const matchingIds: string[] = [];

  for (const tx of txs) {
    let match = true;
    const day = parseDay(tx.original_date);
    const isoDate = toIsoDate(tx.original_date);

    if (from_day !== undefined && day < from_day) {
      match = false;
    }
    if (to_day !== undefined && day > to_day) {
      match = false;
    }
    if (start_date && isoDate && isoDate < start_date) {
      match = false;
    }
    if (end_date && isoDate && isoDate > end_date) {
      match = false;
    }

    if (match) {
      matchingIds.push(tx.id);
    }
  }

  if (matchingIds.length > 0) {
    const placeholders = matchingIds.map(() => "?").join(",");
    await db.run(`UPDATE transactions SET billed_month = ? WHERE id IN (${placeholders})`, [to_month, ...matchingIds]);
  }

  return { movedCount: matchingIds.length, movedIds: matchingIds };
}

export async function getDuplicateCandidates(month: string) {
  // Find transactions for this month and adjacent months
  const [yearStr, monthStr] = month.split("-");
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);

  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;

  const prevMonthStr = `${prevY}-${prevM.toString().padStart(2, "0")}`;
  const nextMonthStr = `${nextY}-${nextM.toString().padStart(2, "0")}`;

  const currentTxs = await db.all("SELECT * FROM transactions WHERE billed_month = ?", [month]);
  const otherTxs = await db.all(
    "SELECT * FROM transactions WHERE billed_month IN (?, ?)",
    [prevMonthStr, nextMonthStr]
  );

  const cleanDesc = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

  const candidates: Array<{
    currentTx: any;
    matchingTx: any;
    matchType: string;
  }> = [];

  // Check 1: Same month duplicates
  for (let i = 0; i < currentTxs.length; i++) {
    for (let j = i + 1; j < currentTxs.length; j++) {
      const a = currentTxs[i];
      const b = currentTxs[j];
      const sameAmount = Math.abs(a.amount - b.amount) <= 0.05;
      const sameDesc = cleanDesc(a.description) === cleanDesc(b.description);
      const sameDate = a.original_date === b.original_date;

      if (sameAmount && sameDesc) {
        candidates.push({
          currentTx: a,
          matchingTx: b,
          matchType: sameDate ? "Mesmo valor, data e descrição na mesma fatura" : "Mesmo valor e descrição na mesma fatura"
        });
      }
    }
  }

  // Check 2: Cross month duplicates (often caused by transitional invoice with shifted due date)
  for (const cur of currentTxs) {
    for (const oth of otherTxs) {
      const sameAmount = Math.abs(cur.amount - oth.amount) <= 0.05;
      const sameDesc = cleanDesc(cur.description) === cleanDesc(oth.description);
      if (sameAmount && sameDesc) {
        candidates.push({
          currentTx: cur,
          matchingTx: oth,
          matchType: `Repetido entre fatura ${cur.billed_month} e ${oth.billed_month}`
        });
      }
    }
  }

  return candidates;
}

export async function batchUpdateTransactions(ids: string[], person_id?: string | null, category_id?: string | null, target_month?: string | null) {
  for (const id of ids) {
    const updates: string[] = [];
    const params: any[] = [];
    if (person_id !== undefined) {
      updates.push("person_id = ?");
      params.push(person_id);
    }
    if (category_id !== undefined) {
      updates.push("category_id = ?");
      params.push(category_id);
    }
    if (target_month !== undefined && target_month !== null && target_month !== "") {
      updates.push("billed_month = ?");
      params.push(target_month);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.run(`UPDATE transactions SET ${updates.join(", ")} WHERE id = ?`, params);
    }
  }
}

export async function getAllTransactions() {
  return await db.all("SELECT * FROM transactions ORDER BY billed_month DESC");
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
    (id, billed_month, original_date, description, amount, current_installment, total_installment, is_imported, category_id, person_id, split_data, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `);

  for (const tx of extractedTx) {
    await stmt.run([
      uuidv4(),
      month,
      tx.date,
      tx.description,
      tx.amount,
      tx.current_installment,
      tx.total_installments,
      tx.category_id || null,
      tx.person_id || null,
      tx.split_data || null,
      tx.notes || null
    ]);
  }
  await stmt.finalize();
}
