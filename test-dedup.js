import { setupDb, getTransactionsForMonth, importTransactions } from './server/db.js';

async function main() {
  await setupDb();
  // ...
  const existingTxs = await getTransactionsForMonth("2026-07");
  console.log(existingTxs);
}
main();
