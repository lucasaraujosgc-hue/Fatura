import React, { useState, useEffect } from "react";
import { updateTransactionConfig } from "../lib/api";
import { X, Plus, Trash2, Tag } from "lucide-react";

export function TransactionEditModal({ 
  transaction, 
  people, 
  onClose, 
  onSave 
}: { 
  transaction: any, 
  people: any[], 
  onClose: () => void, 
  onSave: () => void 
}) {
  const [personId, setPersonId] = useState<string>(transaction.person_id || "");
  const [splits, setSplits] = useState<{person_id: string, amount: string}[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction.split_data) {
      try {
        const parsed = JSON.parse(transaction.split_data);
        if (parsed && parsed.length > 0) {
          setIsSplit(true);
          setSplits(parsed.map((s: any) => ({ ...s, amount: s.amount.toString() })));
        }
      } catch (e) {}
    }
  }, [transaction]);

  const handleAddSplit = () => {
    setSplits([...splits, { person_id: "", amount: "" }]);
  };

  const handleRemoveSplit = (idx: number) => {
    setSplits(splits.filter((_, i) => i !== idx));
  };

  const handleUpdateSplit = (idx: number, field: string, val: string) => {
    const newSplits = [...splits];
    newSplits[idx] = { ...newSplits[idx], [field]: val };
    setSplits(newSplits);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let finalPersonId = null;
      let finalSplitData = null;

      if (isSplit) {
        finalSplitData = splits.map(s => ({
          person_id: s.person_id,
          amount: parseFloat(s.amount.replace(',', '.')) || 0
        })).filter(s => s.amount > 0);
        
        if (finalSplitData.length === 0) finalSplitData = null;
      } else {
        finalPersonId = personId || null;
      }

      await updateTransactionConfig(transaction.id, finalPersonId, finalSplitData);
      onSave();
    } catch (err) {
      alert("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0b0d1b]/95 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ring-1 ring-white/5 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/20">
          <h3 className="font-display font-bold text-slate-100 text-base">Editar Responsável</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-5 flex-1">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-sm">
            <p className="font-semibold text-white">{transaction.description}</p>
            <p className="text-slate-400 mt-1 flex items-center gap-1.5">
              Valor total: <span className="font-bold text-blue-400">R$ {transaction.amount.toFixed(2)}</span>
            </p>
          </div>

          <div className="flex items-center gap-6 py-1">
            <label className="flex items-center gap-2 text-sm text-slate-300 font-medium cursor-pointer">
              <input 
                type="radio" 
                checked={!isSplit} 
                onChange={() => setIsSplit(false)} 
                className="w-4 h-4 text-blue-600 bg-white/5 border-white/15 focus:ring-blue-500/50" 
              />
              Responsável Único
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 font-medium cursor-pointer">
              <input 
                type="radio" 
                checked={isSplit} 
                onChange={() => setIsSplit(true)} 
                className="w-4 h-4 text-blue-600 bg-white/5 border-white/15 focus:ring-blue-500/50" 
              />
              Dividir Valor
            </label>
          </div>

          {!isSplit ? (
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-1.5">Responsável</label>
              <select 
                value={personId} 
                onChange={e=>setPersonId(e.target.value)} 
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 transition-all duration-300"
              >
                <option value="" className="bg-[#0b0d1b] text-slate-400">Sem categoria</option>
                {people.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-4">
              {splits.map((split, idx) => (
                <div key={idx} className="flex items-end gap-2 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Pessoa</label>
                    <select 
                      value={split.person_id} 
                      onChange={e=>handleUpdateSplit(idx, 'person_id', e.target.value)}
                      className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 text-sm"
                    >
                      <option value="" className="bg-[#0b0d1b] text-slate-400">Ninguém</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Valor (R$)</label>
                    <input 
                      type="text" 
                      value={split.amount}
                      placeholder="0.00"
                      onChange={e=>handleUpdateSplit(idx, 'amount', e.target.value)}
                      className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 text-sm"
                    />
                  </div>
                  <button 
                    onClick={() => handleRemoveSplit(idx)} 
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-xl mb-0.5 transition-all duration-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button 
                onClick={handleAddSplit} 
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 mt-2 cursor-pointer transition-colors"
              >
                <Plus size={14} /> Adicionar divisão
              </button>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-white/10 flex justify-end bg-slate-950/10">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white mr-2 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-50 text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all duration-300 active:scale-95 cursor-pointer"
          >
            {loading ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>
      </div>
    </div>
  )
}
