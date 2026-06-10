import React, { useState, useEffect } from "react";
import { formatCurrency, formatMonth } from "../lib/utils";
import { fetchTransactions, deleteTransaction, fetchPeople } from "../lib/api";
import { Trash2, TrendingUp, Users, Tag, Edit2 } from "lucide-react";
import { TransactionEditModal } from "./TransactionEditModal";

export function Dashboard({ currentMonth, peopleMap }: { currentMonth: string, peopleMap: Record<string, any> }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTx, setEditingTx] = useState<any | null>(null);

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
  }, [currentMonth]);

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
                <div key={pId} className="group">
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
            {transactions.length} registros
          </span>
        </div>
        
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            Nenhum lançamento encontrado para {formatMonth(currentMonth)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/60 border-b border-white/10 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Data</th>
                  <th className="px-6 py-3.5">Descrição</th>
                  <th className="px-6 py-3.5 text-center">Parcela</th>
                  <th className="px-6 py-3.5">Responsável</th>
                  <th className="px-6 py-3.5 text-right">Valor</th>
                  <th className="px-6 py-3.5 w-[100px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((tx) => {
                  const isProjected = tx.is_projected;
                  const person = tx.person_id ? peopleMap[tx.person_id] : null;

                  return (
                    <tr key={tx.id} className={isProjected ? "bg-purple-500/5 hover:bg-purple-500/10 transition-colors" : "hover:bg-white/5 transition-colors"}>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{tx.original_date}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-100">{tx.description}</div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1 flex gap-2">
                          {tx.is_imported === 1 ? (
                            <span className="text-blue-400">Importado</span>
                          ) : isProjected ? (
                            <span className="text-purple-400">Projetado (Mensal)</span>
                          ) : (
                            <span className="text-emerald-400">Manual</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-white/5 text-slate-300 border border-white/10">
                          {tx.current_installment} / {tx.total_installment}
                        </span>
                      </td>
                      <td className="px-6 py-4">
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border bg-white/5" style={{ borderColor: person.color, color: person.color, boxShadow: `0 0 10px ${person.color}15` }}>
                                <Tag size={12} />
                                {person.name}
                              </span>
                            )
                          }
                          
                          return <span className="text-xs text-slate-500">-</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-white">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isProjected && (
                            <button 
                              onClick={() => setEditingTx(tx)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-white/5 rounded-xl transition-all duration-300 cursor-pointer"
                              title="Editar Responsável"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(tx.id, isProjected)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all duration-300 cursor-pointer"
                            title="Excluir Lançamento"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
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
