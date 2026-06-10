import React, { useState, useEffect } from "react";
import { updateTransactionConfig } from "../lib/api";
import { X, Plus, Trash2 } from "lucide-react";

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
        // Validate total amount matches (optional but good practice)
        const totalSplit = splits.reduce((acc, s) => acc + (parseFloat(s.amount.replace(',','.')) || 0), 0);
        
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Editar Responsável</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg text-sm mb-4">
            <p className="font-medium text-gray-900">{transaction.description}</p>
            <p className="text-gray-500 mt-1">Valor total: <span className="font-medium">R$ {transaction.amount.toFixed(2)}</span></p>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={!isSplit} onChange={() => setIsSplit(false)} className="text-slate-600 focus:ring-slate-500" />
              Responsável Único
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={isSplit} onChange={() => setIsSplit(true)} className="text-slate-600 focus:ring-slate-500" />
              Dividir Valor
            </label>
          </div>

          {!isSplit ? (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Responsável</label>
              <select value={personId} onChange={e=>setPersonId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-slate-500 bg-white">
                <option value="">Sem categoria</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              {splits.map((split, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Pessoa</label>
                    <select 
                      value={split.person_id} 
                      onChange={e=>handleUpdateSplit(idx, 'person_id', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md outline-none focus:border-slate-500 bg-white text-sm"
                    >
                      <option value="">Ninguém</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
                    <input 
                      type="text" 
                      value={split.amount}
                      onChange={e=>handleUpdateSplit(idx, 'amount', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md outline-none focus:border-slate-500 text-sm"
                    />
                  </div>
                  <button onClick={() => handleRemoveSplit(idx)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md mb-[1px]">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button onClick={handleAddSplit} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2">
                <Plus size={14} /> Adicionar divisão
              </button>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 mr-2"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>
      </div>
    </div>
  )
}
