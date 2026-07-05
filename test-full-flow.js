import { setupDb, getTransactionsForMonth, importTransactions, deleteImportedInvoice } from './server/db.js';

async function main() {
  await setupDb();
  
  // clear DB
  await importTransactions("2026-06", [], true);
  await deleteImportedInvoice("2026-06");
  await importTransactions("2026-07", [], true);
  await deleteImportedInvoice("2026-07");
  
  const extTxJune = [{
    date: "2026-05-15",
    description: "LOJA TESTE COMPRA",
    amount: 150.00,
    current_installment: 1,
    total_installments: 3,
    category_id: "cat1",
    person_id: "p1"
  }];
  await importTransactions("2026-06", extTxJune, true);
  
  // Now simulate upload for July
  const julyTxsBefore = await getTransactionsForMonth("2026-07");
  console.log("July before upload:", julyTxsBefore.length, "transactions (should be 1 projected)");
  
  // Simulate extTx for July
  const extTxJuly = {
    date: "2026-05-15",
    description: "LOJA TESTE COMPRA",
    amount: 150.00,
    current_installment: 2,
    total_installments: 3,
  };
  
  // Resolve with ignore
  extTxJuly.category_id = julyTxsBefore[0].category_id;
  extTxJuly.person_id = julyTxsBefore[0].person_id;
  
  // import to DB
  await importTransactions("2026-07", [extTxJuly], true);
  
  const julyTxsAfter = await getTransactionsForMonth("2026-07");
  console.log("July after upload:", julyTxsAfter.length, "transactions (should be 1 imported, 0 projected)");
  console.log(julyTxsAfter.map(t => `${t.description} | proj: ${t.is_projected} | imp: ${t.is_imported}`));
}
main();
