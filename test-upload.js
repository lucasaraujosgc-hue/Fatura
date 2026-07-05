import { setupDb, getTransactionsForMonth } from './server/db.js';

async function main() {
  await setupDb();
  
  const existingTxs = await getTransactionsForMonth("2026-07");
  const projectedExisting = existingTxs.filter((tx) => tx.is_projected);
  const manualExisting = existingTxs.filter((tx) => tx.is_imported === 0 && !tx.is_projected);

  // simulate extracted transaction from PDF for July
  const extTx = {
    date: "15/05",
    description: "LOJA COMPRA 02/05", // Slightly different description maybe? Let's try exact
    amount: 100.00,
    current_installment: 2,
    total_installments: 5,
  };

  const getDDMM = (d) => {
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

  const conflict = manualExisting.find((ex) => {
     const sameDate = getDDMM(ex.original_date) === getDDMM(extTx.date);
     const amountDiff = Math.abs(ex.amount - extTx.amount);
     const descMatch = ex.description.trim().substring(0, 8).toLowerCase() === extTx.description.trim().substring(0, 8).toLowerCase();
     return (sameDate && amountDiff <= 0.05) || (sameDate && descMatch);
  }) || projectedExisting.find((ex) => {
     const sameDate = getDDMM(ex.original_date) === getDDMM(extTx.date);
     const amountDiff = Math.abs(ex.amount - extTx.amount);
     const descMatch = ex.description.trim().substring(0, 8).toLowerCase() === extTx.description.trim().substring(0, 8).toLowerCase();
     return (sameDate && amountDiff <= 0.05) || (sameDate && descMatch);
  });
  
  console.log("Conflict found:", conflict);
}
main();
