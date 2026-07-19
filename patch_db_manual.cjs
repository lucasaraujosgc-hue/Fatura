const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

const replacement = `export async function addManualTransaction(data: any) {
  const { billed_month, original_date, description, amount, current_installment, total_installment, person_id, category_id, notes, is_fixed } = data;
  
  const current = current_installment || 1;
  const total = total_installment || 1;
  
  const [startYearStr, startMonthStr] = billed_month.split('-');
  let currY = parseInt(startYearStr);
  let currM = parseInt(startMonthStr);

  const insertedIds = [];

  for (let i = current; i <= total; i++) {
    const id = uuidv4();
    const currentBilledMonth = \`\${currY}-\${currM.toString().padStart(2, '0')}\`;
    
    await db.run(\`
      INSERT INTO transactions 
      (id, billed_month, original_date, description, amount, current_installment, total_installment, person_id, is_imported, category_id, notes, is_fixed) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    \`, [
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
`;

code = code.replace(/export async function addManualTransaction[\s\S]*?notes \|\| null\n    \]\);/, replacement);
fs.writeFileSync('server/db.ts', code);
