const fs = require('fs');
let code = fs.readFileSync('src/components/Forms.tsx', 'utf-8');

code = code.replace(
  'const [notes, setNotes] = useState("");',
  'const [notes, setNotes] = useState("");\n  const [isFixed, setIsFixed] = useState(false);'
);

code = code.replace(
  'notes: notes || null',
  'notes: notes || null,\n        is_fixed: isFixed ? 1 : 0'
);

const checkboxHtml = `
          {/* Fixo Toggle */}
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 md:col-span-2">
            <input 
              type="checkbox" 
              id="isFixedManual" 
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
              className="w-4 h-4 rounded border-white/15 text-blue-500 focus:ring-blue-500/50 bg-black/20 accent-blue-500"
            />
            <label htmlFor="isFixedManual" className="text-sm font-medium text-slate-300 cursor-pointer">
              Lançamento Fixo (Repete todo mês)
            </label>
          </div>
`;

code = code.replace(
  '          <div className="md:col-span-2 space-y-4">',
  checkboxHtml + '\n          <div className="md:col-span-2 space-y-4">'
);

fs.writeFileSync('src/components/Forms.tsx', code);
