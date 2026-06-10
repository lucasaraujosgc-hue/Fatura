import React, { useState, useEffect } from "react";
import { formatCurrency, formatMonth } from "../lib/utils";
import { fetchTransactions, deleteTransaction, fetchPeople } from "../lib/api";
import { Trash2, TrendingUp, Users, Tag } from "lucide-react";

export function Dashboard({ currentMonth, peopleMap }: { currentMonth: string, peopleMap: Record<string, any> }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMonth) return;
    setLoading(true);
    fetchTransactions(currentMonth)
      .then((data) => {
        setTransactions(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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
    const pId = tx.person_id || 'none';
    if (!acc[pId]) acc[pId] = 0;
    acc[pId] += Number(tx.amount);
    return acc;
  }, {});

  if (loading) {
    return <div className="text-gray-500 animate-pulse py-8">Carregando dados de {formatMonth(currentMonth)}...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total da Fatura</p>
            <h3 className="text-3xl font-semibold text-gray-900 mt-1">{formatCurrency(totalAmount)}</h3>
          </div>
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2"><Users size={16}/> Divisão de Gastos</p>
          <div className="space-y-2">
            {Object.entries(byPerson).map(([pId, amountVal]) => {
              const amount = amountVal as number;
              const person = peopleMap[pId] || { name: 'Sem Categoria', color: '#9ca3af' };
              const percent = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
              return (
                <div key={pId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: person.color }}></span>
                      {person.name}
                    </span>
                    <span className="font-medium text-gray-900">{formatCurrency(amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${percent}%`, backgroundColor: person.color }}></div>
                  </div>
                </div>
              );
            })}
            {Object.keys(byPerson).length === 0 && <span className="text-sm text-gray-400">Nenhum gasto registrado.</span>}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Lançamentos</h3>
          <span className="text-sm text-gray-500">{transactions.length} registros</span>
        </div>
        
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Nenhum lançamento encontrado para {formatMonth(currentMonth)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Descrição</th>
                  <th className="px-6 py-3 font-medium text-center">Parcela</th>
                  <th className="px-6 py-3 font-medium">Responsável</th>
                  <th className="px-6 py-3 text-right font-medium">Valor</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const isProjected = tx.is_projected;
                  const person = tx.person_id ? peopleMap[tx.person_id] : null;

                  return (
                    <tr key={tx.id} className={isProjected ? "bg-amber-50/30" : "bg-white hover:bg-gray-50 transition-colors"}>
                      <td className="px-6 py-4 text-gray-500">{tx.original_date}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{tx.description}</div>
                        <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                          {tx.is_imported === 1 ? 'Importado' : isProjected ? 'Projetado (Gasto Mensal)' : 'Manual'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {tx.current_installment} / {tx.total_installment}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {person ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border" style={{ borderColor: person.color, color: person.color }}>
                            <Tag size={12} />
                            {person.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(tx.id, isProjected)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir Lançamento"
                        >
                          <Trash2 size={16} />
                        </button>
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
