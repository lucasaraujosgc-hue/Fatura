import React, { useState, useEffect } from "react";
import { updateTransactionConfig } from "../lib/api";
import { X, Plus, Trash2, Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { formatMonth } from "../lib/utils";

export function TransactionEditModal({ 
  transaction, 
  people, 
  categories = [],
  onClose, 
  onSave 
}: { 
  transaction: any, 
  people: any[], 
  categories: any[],
  onClose: () => void, 
  onSave: () => void 
}) {
  const [description, setDescription] = useState<string>(transaction.description || "");
  const [amount, setAmount] = useState<string>(transaction.amount !== undefined ? transaction.amount.toString() : "");
  const [billedMonth, setBilledMonth] = useState<string>(transaction.billed_month || "");
  const [originalDate, setOriginalDate] = useState<string>(transaction.original_date || "");
  const [currentInstallment, setCurrentInstallment] = useState<number>(transaction.current_installment || 1);
  const [totalInstallment, setTotalInstallment] = useState<number>(transaction.total_installment || 1);
  const [personId, setPersonId] = useState<string>(transaction.person_id || "");
  const [categoryId, setCategoryId] = useState<string>(transaction.category_id || "");
  const [notes, setNotes] = useState<string>(transaction.notes || "");
  const [splits, setSplits] = useState<{person_id: string, amount: string}[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFixed, setIsFixed] = useState(transaction.is_fixed === 1);

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

  const handleShiftMonth = (direction: -1 | 1) => {
    if (!billedMonth || !billedMonth.includes("-")) return;
    const [y, m] = billedMonth.split("-");
    let year = parseInt(y, 10);
    let month = parseInt(m, 10) + direction;
    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }
    setBilledMonth(`${year}-${month.toString().padStart(2, "0")}`);
  };

  const handleAddSplit = () => {
    setSplits([...splits, { person_id: "", amount: "" }]);
  };

  const handleRemoveSplit = (idx: number) => {
    setSplits(splits.filter((_, i) => i !== idx));
  };

  const handleUpdateSplit = (idx: number, field: string, val: string) => {
    const newSplits = [...splits];
    const parsedAmount = parseFloat(amount.replace(",", ".")) || Number(transaction.amount) || 0;
    if (field === 'amount' && val.endsWith('%')) {
      const percentage = parseFloat(val.replace('%', '').replace(',', '.'));
      if (!isNaN(percentage)) {
        val = ((parsedAmount * percentage) / 100).toFixed(2);
      }
    }
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

      const numAmount = parseFloat(amount.replace(",", ".")) || Number(transaction.amount) || 0;

      await updateTransactionConfig(transaction.id, {
        description,
        amount: numAmount,
        billed_month: billedMonth,
        original_date: originalDate,
        current_installment: Number(currentInstallment) || 1,
        total_installment: Number(totalInstallment) || 1,
        person_id: finalPersonId,
        split_data: finalSplitData,
        category_id: categoryId || null,
        notes: notes || null,
        is_fixed: isFixed ? 1 : 0
      });
      onSave();
    } catch (err) {
      alert("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0b0d1b] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto ring-1 ring-white/5 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/40 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-slate-100 text-base">Editar Lançamento</h3>
            {transaction.is_projected && (
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                Projetado
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 space-y-4.5 flex-1">
          {/* Main Info Box */}
          <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Descrição
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/60 border border-white/10 rounded-xl text-white font-medium text-sm outline-none focus:border-blue-500/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-white/10 rounded-xl text-blue-400 font-bold text-sm outline-none focus:border-blue-500/60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Data da Compra
                </label>
                <input
                  type="text"
                  placeholder="AAAA-MM-DD ou DD/MM/AAAA"
                  value={originalDate}
                  onChange={(e) => setOriginalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 text-sm outline-none focus:border-blue-500/60"
                />
              </div>
            </div>
          </div>

          {/* Fatura / Mês de Cobrança - Highlighted for Due Date Changes */}
          <div className="bg-gradient-to-r from-blue-950/30 via-indigo-950/20 to-purple-950/30 p-3.5 rounded-xl border border-blue-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" />
                Mês da Fatura de Cobrança
              </label>
              <span className="text-[11px] text-blue-300/80 font-medium">
                {billedMonth ? formatMonth(billedMonth) : "Não definido"}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Se você alterou a data de vencimento do cartão, mude a fatura aqui para reposicionar a compra no mês correto.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                title="Mover para mês anterior"
              >
                <ArrowLeft size={13} /> -1 Mês
              </button>

              <input
                type="month"
                value={billedMonth}
                onChange={(e) => setBilledMonth(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-950/70 border border-blue-500/30 rounded-xl text-slate-100 text-xs font-bold text-center outline-none focus:border-blue-400"
              />

              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                title="Mover para mês seguinte"
              >
                +1 Mês <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Parcelas */}
          <div className="bg-white/5 p-3 rounded-xl border border-white/5 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Parcela Atual
              </label>
              <input
                type="number"
                min="1"
                max={totalInstallment}
                value={currentInstallment}
                onChange={(e) => setCurrentInstallment(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-1.5 bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Total de Parcelas
              </label>
              <input
                type="number"
                min="1"
                value={totalInstallment}
                onChange={(e) => setTotalInstallment(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-1.5 bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 text-xs outline-none focus:border-blue-500/60"
              />
            </div>
          </div>

          {/* Responsável Único vs Dividir */}
          <div className="pt-1">
            <div className="flex items-center gap-6 py-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
                <input 
                  type="radio" 
                  checked={!isSplit} 
                  onChange={() => setIsSplit(false)} 
                  className="w-4 h-4 text-blue-600 bg-white/5 border-white/15 focus:ring-blue-500/50" 
                />
                Responsável Único
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
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
              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Responsável</label>
                <select 
                  value={personId} 
                  onChange={e=>setPersonId(e.target.value)} 
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 text-xs transition-all duration-300"
                >
                  <option value="" className="bg-[#0b0d1b] text-slate-400">Sem categoria / Ninguém</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                {splits.map((split, idx) => (
                  <div key={idx} className="flex items-end gap-2 bg-white/[0.02] border border-white/5 p-2.5 rounded-xl">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Pessoa</label>
                      <select 
                        value={split.person_id} 
                        onChange={e=>handleUpdateSplit(idx, 'person_id', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 text-xs"
                      >
                        <option value="" className="bg-[#0b0d1b] text-slate-400">Ninguém</option>
                        {people.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Valor (R$ ou %)</label>
                      <input 
                        type="text" 
                        value={split.amount}
                        placeholder="0.00 ou 50%"
                        onChange={e=>handleUpdateSplit(idx, 'amount', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 text-xs"
                      />
                    </div>
                    <button 
                      onClick={() => handleRemoveSplit(idx)} 
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-xl mb-0.5 transition-all duration-300 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={handleAddSplit} 
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 mt-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} /> Adicionar divisão
                </button>
              </div>
            )}
          </div>

          {/* Fixo Toggle */}
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <input 
              type="checkbox" 
              id="isFixed" 
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
              className="w-4 h-4 rounded border-white/15 text-blue-500 focus:ring-blue-500/50 bg-black/20 accent-blue-500 cursor-pointer"
            />
            <label htmlFor="isFixed" className="text-xs font-semibold text-slate-300 cursor-pointer">
              Lançamento Fixo (Repete todo mês automaticamente)
            </label>
          </div>

          {/* Categoria Selection */}
          <div className="pt-2 border-t border-white/5">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Categoria</label>
            <select 
              value={categoryId} 
              onChange={e=>setCategoryId(e.target.value)} 
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 transition-all duration-300 text-xs"
            >
              <option value="" className="bg-[#0b0d1b] text-slate-400">Sem categoria</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Observações / Notas */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Observações / Notas</label>
            <textarea 
              value={notes} 
              onChange={e=>setNotes(e.target.value)} 
              placeholder="Adicione observações ou detalhes extras..."
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/50 placeholder-slate-500 transition-all duration-300 text-xs"
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end bg-slate-950/30 sticky bottom-0 z-10 backdrop-blur-md">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white mr-2 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-semibold text-xs shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all duration-300 active:scale-95 cursor-pointer"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
