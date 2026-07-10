const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

code = code.replace(
  '{tx.notes && (',
  `{tx.is_fixed === 1 && (
    <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded leading-none flex items-center gap-1" title="Lançamento Fixo (Recorrente)">
      Fixo
    </span>
  )}
  {tx.notes && (`
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
