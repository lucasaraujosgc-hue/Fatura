const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data/database.sqlite');
db.exec('ALTER TABLE transactions ADD COLUMN is_fixed INTEGER DEFAULT 0;', (err) => {
  if (err) console.error(err);
  else console.log('is_fixed added');
});
