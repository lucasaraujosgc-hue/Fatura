import React, { useState, useEffect } from "react";
import { formatCurrency, formatMonth } from "../lib/utils";
import { fetchTransactions, deleteTransaction, fetchPeople, batchAssignTransactions } from "../lib/api";
import { Trash2, TrendingUp, Users, Tag, Edit2, FileText } from "lucide-react";
import { TransactionEditModal } from "./TransactionEditModal";
import { CategoryIcon } from "../lib/iconsList";

export function Dashboard({ 
  currentMonth, 
  peopleMap, 
  categories = [] 
}: { 
  currentMonth: string, 
  peopleMap: Record<string, any>, 
  categories?: any[] 
}) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetPersonId, setTargetPersonId] = useState<string>("");
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>("all");
  const [searchDesc, setSearchDesc] = useState<string>("");
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});
  const [batchLoading, setBatchLoading] = useState(false);

  const categoriesMap = (categories || []).reduce((acc: Record<string, any>, c) => ({ ...acc, [c.id]: c }), {});

  const loadTxs = () => {
    if (!currentMonth) return;
    setLoading(true);
    fetchTransactions(currentMonth)
      .then((data) => {
        setTransactions(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTxs();
    setSelectedIds([]); // Reset select items when month changes
    setExpandedTxIds({});
  }, [currentMonth]);

  const filteredTransactions = transactions.filter(tx => {
    let catMatch = selectedCategoryFilter === "all" || tx.category_id === selectedCategoryFilter;
    
    let personMatch = selectedPersonFilter === "all";
    if (!personMatch) {
      let splits = [];
      if (tx.split_data) {
        try { splits = JSON.parse(tx.split_data); } catch(e) {}
      }
      if (splits.length > 0) {
        if (splits.some((s: any) => (s.person_id || 'none') === selectedPersonFilter)) {
          personMatch = true;
        }
      } else {
        if ((tx.person_id || 'none') === selectedPersonFilter) {
          personMatch = true;
        }
      }
    }

    let searchMatch = searchDesc === "" || tx.description.toLowerCase().includes(searchDesc.toLowerCase());

    return catMatch && personMatch && searchMatch;
  });

  const selectableTxs = filteredTransactions.filter(tx => !tx.is_projected);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(selectableTxs.map(tx => tx.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectTx = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };

  const handleBatchAssign = async () => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    try {
      await batchAssignTransactions(
        selectedIds, 
        targetPersonId || null, 
        targetCategoryId || null
      );
      setSelectedIds([]);
      setTargetPersonId("");
      setTargetCategoryId("");
      loadTxs();
    } catch (e) {
      alert("Erro ao atribuir em lote.");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDelete = async (id: string, isProjected: boolean) => {
    if (isProjected) {
      alert("Não é possível deletar um lançamento projetado (forecast). Delete a fatura original.");
      return;
    }
    if (confirm("Tem certeza que deseja deletar este lançamento manual? Lançamentos importados da fatura voltarão a aparecer no próximo import.")) {
      await deleteTransaction(id);
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  // Group by person
  const byPerson = transactions.reduce((acc: Record<string, number>, tx) => {
    let splits = [];
    if (tx.split_data) {
       try { splits = JSON.parse(tx.split_data); } catch(e) {}
    }

    if (splits.length > 0) {
      for (const split of splits) {
        const pId = split.person_id || 'none';
        if (!acc[pId]) acc[pId] = 0;
        acc[pId] += Number(split.amount) || 0;
      }
    } else {
      const pId = tx.person_id || 'none';
      if (!acc[pId]) acc[pId] = 0;
      acc[pId] += Number(tx.amount);
    }

    return acc;
  }, {});

  if (loading) {
    return <div className="text-slate-400 animate-pulse py-12 text-center text-sm font-medium">Carregando dados de {formatMonth(currentMonth)}...</div>;
  }

  return (
    <div className="space-y-6">
      {editingTx && (
        <TransactionEditModal 
          transaction={editingTx} 
          people={Object.values(peopleMap)}
          categories={categories}
          onClose={() => setEditingTx(null)}
          onSave={() => {
            setEditingTx(null);
            loadTxs();
          }}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-950/45 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between ring-1 ring-white/5">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-400">TOTAL DA FATURA</p>
            <h3 className="text-3xl font-display font-extrabold text-white mt-1">
              {formatCurrency(totalAmount)}
            </h3>
          </div>
          <div className="h-12 w-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/10">
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="bg-slate-950/45 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl flex flex-col justify-center ring-1 ring-white/5">
          <p className="text-sm font-semibold tracking-wide text-slate-300 mb-4 flex items-center gap-2">
            <Users size={16} className="text-purple-400" /> DIVISÃO DE GASTOS
          </p>
          <div className="space-y-3.5">
            {Object.entries(byPerson).map(([pId, amountVal]) => {
              const amount = amountVal as number;
              const person = peopleMap[pId] || { name: 'Sem Categoria', color: '#64748b' };
              const percent = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
              return (
                <div 
                  key={pId} 
                  className={`group cursor-pointer rounded-xl p-2.5 -m-2.5 transition-all duration-300 ${
                    selectedPersonFilter === pId ? 'bg-white/10 ring-1 ring-white/20 shadow-lg' : 'hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedPersonFilter(prev => prev === pId ? "all" : pId)}
                  title={`Filtrar lançamentos de ${person.name}`}
                >
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 text-slate-300 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: person.color, boxShadow: `0 0 8px ${person.color}dd` }}></span>
                      {person.name}
                    </span>
                    <span className="font-semibold text-slate-100">{formatCurrency(amount)}</span>
                  </div>
                  <div className="w-full bg-white/5 border border-white/5 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 group-hover:brightness-110" 
                      style={{ 
                        width: `${percent}%`, 
                        backgroundColor: person.color,
                        boxShadow: `0 0 8px ${person.color}`
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {Object.keys(byPerson).length === 0 && <span className="text-sm text-slate-400">Nenhum gasto registrado.</span>}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-slate-950/45 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden ring-1 ring-white/5">
        <div className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-slate-950/30">
          <h3 className="font-display font-bold text-slate-100 text-lg">Lançamentos</h3>
          <span className="text-xs font-semibold px-2.5 py-1 bg-white/5 text-slate-400 border border-white/5 rounded-xl">
            {filteredTransactions.length} registros
          </span>
        </div>

        {/* Categories filtration row */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4.5 bg-slate-950/20 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-2 tracking-wider">Filtrar por Categoria:</span>
            <button
              onClick={() => setSelectedCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedCategoryFilter === "all"
                  ? "bg-blue-600/30 border border-blue-500/80 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                  : "bg-white/5 border border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10"
              }`}
            >
              Todas
            </button>
            {categories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  selectedCategoryFilter === c.id
                    ? "text-white scale-105"
                    : "bg-white/5 border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/10"
                }`}
                style={{
                  borderColor: selectedCategoryFilter === c.id ? c.color : undefined,
                  backgroundColor: selectedCategoryFilter === c.id ? `${c.color}25` : undefined,
                  color: selectedCategoryFilter === c.id ? c.color : undefined,
                  boxShadow: selectedCategoryFilter === c.id ? `0 0 10px ${c.color}33` : undefined,
                }}
              >
                <CategoryIcon name={c.icon} size={13} className="shrink-0" />
                {c.name}
              </button>
            ))}
          </div>

          {selectedPersonFilter !== "all" && (
            <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full">
              <span className="text-xs font-semibold text-purple-300">
                Pessoa: {selectedPersonFilter === 'none' ? 'Sem Categoria' : peopleMap[selectedPersonFilter]?.name}
              </span>
              <button onClick={() => setSelectedPersonFilter("all")} className="text-purple-400 hover:text-purple-200 ml-1">
                &times;
              </button>
            </div>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-[#0b0e26] px-6 py-3.5 border-b border-cyan-500/20 flex flex-col md:flex-row items-center justify-between gap-3 shadow-inner bg-gradient-to-r from-cyan-950/10 via-indigo-950/30 to-purple-950/10">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                {selectedIds.length} selecionado(s) para lote
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <select
                value={targetPersonId}
                onChange={(e) => setTargetPersonId(e.target.value)}
                className="flex-1 sm:flex-initial text-xs bg-slate-950/60 border border-white/10 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-400/50"
              >
                <option value="" className="bg-[#0b0d1b] text-slate-400">Pessoa (Sem alteração / can)</option>
                {Object.values(peopleMap).map((p: any) => (
                  <option key={p.id} value={p.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                    Atribuir a {p.name}
                  </option>
                ))}
              </select>

              <select
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="flex-1 sm:flex-initial text-xs bg-slate-950/60 border border-white/10 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-400/50"
              >
                <option value="" className="bg-[#0b0d1b] text-slate-400">Categoria (Sem alteração)</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                    Categoria: {c.name}
                  </option>
                ))}
              </select>
              
              <button
                onClick={handleBatchAssign}
                disabled={batchLoading}
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:brightness-110 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-cyan-400/20 shadow-lg shadow-cyan-500/15 cursor-pointer flex items-center gap-1 transition-all"
              >
                {batchLoading ? "Processando..." : "Jogar em Lote"}
              </button>
              
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        
        {filteredTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            Nenhum lançamento encontrado para {formatMonth(currentMonth)} com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/60 border-b border-white/10 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-[40px] text-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectableTxs.length > 0 && selectedIds.length === selectableTxs.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-white/15 text-cyan-500 focus:ring-cyan-500/50 bg-white/5 cursor-pointer accent-cyan-500"
                    />
                  </th>
                  <th className="px-5 py-3.5">Data</th>
                  <th className="px-5 py-3.5">Descrição</th>
                  <th className="px-5 py-3.5 text-center">Parcela</th>
                  <th className="px-5 py-3.5">Responsável</th>
                  <th className="px-5 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5 w-[80px]"></th>
                </tr>
                {/* Search / Filter Row */}
                <tr className="bg-slate-950/40 border-b border-white/5">
                  <th className="px-4 py-2 border-r border-white/5"></th>
                  <th className="px-5 py-2 border-r border-white/5"></th>
                  <th className="px-5 py-2 border-r border-white/5">
                    <input 
                      type="text"
                      placeholder="Pesquisar descrição..."
                      value={searchDesc}
                      onChange={(e) => setSearchDesc(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-md px-2 py-1.5 text-[11px] font-normal text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 transition-all font-sans"
                    />
                  </th>
                  <th colSpan={4} className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.map((tx) => {
                  const isProjected = tx.is_projected;
                  const person = tx.person_id ? peopleMap[tx.person_id] : null;
                  const isSelected = selectedIds.includes(tx.id);
                  const isExpanded = !!expandedTxIds[tx.id];

                  return (
                    <React.Fragment key={tx.id}>
                      <tr 
                        onClick={() => setExpandedTxIds(prev => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                        className={`cursor-pointer transition-colors ${
                          isProjected 
                            ? "bg-purple-500/5 hover:bg-purple-500/10" 
                            : (isSelected 
                              ? "bg-cyan-500/5 hover:bg-cyan-500/10" 
                              : "hover:bg-white/5")
                        }`}
                      >
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {!isProjected && (
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectTx(tx.id, e.target.checked)}
                              className="w-4 h-4 rounded border-white/15 text-cyan-500 focus:ring-cyan-500/50 bg-white/5 cursor-pointer accent-cyan-500"
                            />
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400 font-mono text-[11px]">{tx.original_date}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {/* Category logo/icon rendered nicely circular inside neon glow */}
                            {(() => {
                              const cat = tx.category_id ? categoriesMap[tx.category_id] : null;
                              if (cat) {
                                return (
                                  <div 
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" 
                                    style={{ 
                                      backgroundColor: cat.color, 
                                      boxShadow: `0 0 10px ${cat.color}66` 
                                    }}
                                    title={`Categoria: ${cat.name}`}
                                  >
                                    <CategoryIcon name={cat.icon} size={13} />
                                  </div>
                                );
                              }
                              return (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800/40 border border-white/5 text-slate-500 shrink-0" title="Sem categoria">
                                  <CategoryIcon name="Tag" size={13} />
                                </div>
                              );
                            })()}
                            
                            <div>
                              <div className="font-bold text-slate-100 flex items-center gap-1.5 leading-tight text-xs">
                                {tx.description}
                                {tx.notes && (
                                  <span className="text-[9px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 py-0.5 rounded leading-none flex items-center gap-1">
                                    Nota
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] uppercase font-bold tracking-wider text-slate-450 mt-0.5 flex gap-2">
                                {tx.is_imported === 1 ? (
                                  <span className="text-blue-400">Importado</span>
                                ) : isProjected ? (
                                  <span className="text-purple-400">Projetado (Mensal)</span>
                                ) : (
                                  <span className="text-emerald-400">Manual</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white/5 text-slate-300 border border-white/10">
                            {tx.current_installment}/{tx.total_installment}
                          </span>
                        </td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            let splits = [];
                            if (tx.split_data) {
                              try { splits = JSON.parse(tx.split_data); } catch(e) {}
                            }
                            if (splits.length > 0) {
                              return (
                                <div className="flex flex-col gap-1.5">
                                  {splits.map((s: any, idx: number) => {
                                    const p = peopleMap[s.person_id];
                                    return (
                                      <span key={idx} className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                                        {p ? (
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}aa` }}></span>
                                        ) : <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>}
                                        {p ? p.name : "Ninguém"} ({formatCurrency(s.amount)})
                                      </span>
                                    )
                                  })}
                                </div>
                              )
                            }
                            
                            if (person) {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border bg-white/5 select-none" style={{ borderColor: person.color, color: person.color, boxShadow: `0 0 10px ${person.color}15` }}>
                                  <Users size={11} />
                                  {person.name}
                                </span>
                              )
                            }
                            
                            return <span className="text-xs text-slate-500">-</span>;
                          })()}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-white">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {!isProjected && (
                              <button 
                                onClick={() => setEditingTx(tx)}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-lg transition-all duration-300 cursor-pointer"
                                title="Editar Responsável e Categoria"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(tx.id, isProjected)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all duration-300 cursor-pointer"
                              title="Excluir Lançamento"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded drawer details showing note */}
                      {isExpanded && (
                        <tr className="bg-slate-950/25">
                          <td colSpan={7} className="px-6 py-4 border-t border-b border-white/5">
                            <div className="space-y-2.5 animate-fadeIn">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                                <FileText size={12} className="text-blue-400" />
                                Detalhes do Lançamento
                              </p>
                              
                              {tx.notes ? (
                                <div className="bg-[#0e1124] p-4 rounded-xl border border-white/10 shadow-lg">
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Observações:</span>
                                  <p className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                                    {tx.notes}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic px-2">
                                  Nenhuma observação ou detalhes adicionais registrados para este lançamento. Use o botão de editar para adicionar.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
