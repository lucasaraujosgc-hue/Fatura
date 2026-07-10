const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionEditModal.tsx', 'utf-8');

// 1. Add state for isFixed
code = code.replace(
  'const [loading, setLoading] = useState(false);',
  'const [loading, setLoading] = useState(false);\n  const [isFixed, setIsFixed] = useState(transaction.is_fixed === 1);'
);

// 2. Add isFixed to updateTransactionConfig
code = code.replace(
  'await updateTransactionConfig(transaction.id, finalPersonId, finalSplitData, categoryId || null, notes || null);',
  'await updateTransactionConfig(transaction.id, finalPersonId, finalSplitData, categoryId || null, notes || null, isFixed);'
);

// 3. Add checkbox in UI
const checkboxHtml = `
          {/* Fixo Toggle */}
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <input 
              type="checkbox" 
              id="isFixed" 
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
              className="w-4 h-4 rounded border-white/15 text-blue-500 focus:ring-blue-500/50 bg-black/20 accent-blue-500"
            />
            <label htmlFor="isFixed" className="text-sm font-medium text-slate-300 cursor-pointer">
              Lançamento Fixo (Repete todo mês)
            </label>
          </div>
`;
code = code.replace(
  '          <div className="space-y-2">',
  checkboxHtml + '\n          <div className="space-y-2">'
);

fs.writeFileSync('src/components/TransactionEditModal.tsx', code);
