const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

const replacement = `
export async function updateTransactionConfig(
  id: string,
  person_id: string | null,
  split_data: any | null,
  category_id: string | null = undefined,
  notes: string | null = undefined,
  is_fixed: number = 0
) {
  if (category_id !== undefined && notes !== undefined) {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, category_id = ?, notes = ?, is_fixed = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, category_id, notes, is_fixed, id]
    );
  } else if (category_id !== undefined) {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, category_id = ?, is_fixed = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, category_id, is_fixed, id]
    );
  } else if (notes !== undefined) {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, notes = ?, is_fixed = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, notes, is_fixed, id]
    );
  } else {
    await db.run(
      "UPDATE transactions SET person_id = ?, split_data = ?, is_fixed = ? WHERE id = ?",
      [person_id, split_data ? JSON.stringify(split_data) : null, is_fixed, id]
    );
  }
}
`;

code = code.replace(/export async function updateTransactionConfig[\s\S]*?\}\n/m, replacement);
fs.writeFileSync('server/db.ts', code);
