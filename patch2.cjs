const fs = require('fs');
let code = fs.readFileSync('server/db.ts', 'utf-8');

const replacement = `
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
      const baseTx = await db.all(\`
        SELECT * FROM transactions 
        WHERE is_imported = 1 
        AND billed_month = ?
        AND total_installment > current_installment
      \`, [lastImportedMonth]);

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
        if (parts[0].length === 4) return \`\${parts[2]}/\${parts[1]}\`;
     }
     if (d.includes("/")) {
        const parts = d.split("/");
        if (parts[0].length === 2) return \`\${parts[0]}/\${parts[1]}\`;
     }
     return d.substring(0, 5);
  };

  // Find all fixed transactions from before this month
  const fixedTxRows = await db.all(\`
    SELECT * FROM transactions 
    WHERE is_fixed = 1 
    AND billed_month < ?
    ORDER BY billed_month DESC
  \`, [month]);

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
`;

code = code.replace(/export async function getTransactionsForMonth[\s\S]*?return \[\.\.\.explicitTx, \.\.\.safeProjected\];\n\}/, replacement);
fs.writeFileSync('server/db.ts', code);
