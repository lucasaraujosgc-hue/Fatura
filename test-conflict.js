import { setupDb, getTransactionsForMonth, importTransactions } from './server/db.js';

async function main() {
  await setupDb();
  
  // Let's create a fake transaction in June
  const txs = [{
    date: "15/05",
    description: "LOJA COMPRA 01/05",
    amount: 100.00,
    current_installment: 1,
    total_installments: 5,
    category_id: "cat1",
    person_id: "person1"
  }];
  await importTransactions("2026-06", txs, true);
  
  const existingTxs = await getTransactionsForMonth("2026-07");
  console.log("Existing Tx for 2026-07:", existingTxs);
  const projectedExisting = existingTxs.filter(tx => tx.is_projected);
  console.log("Projected Tx for 2026-07:", projectedExisting);
}
main();
