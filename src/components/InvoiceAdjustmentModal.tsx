import React, { useState, useEffect } from "react";
import { 
  X, 
  ArrowRightLeft, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ArrowRight, 
  Layers, 
  Check, 
  RefreshCw 
} from "lucide-react";
import { formatCurrency, formatMonth } from "../lib/utils";
import { 
  fetchTransactions, 
  shiftTransactionsByDate, 
  fetchDuplicateCandidates, 
  deleteTransaction, 
  batchMoveTransactions 
} from "../lib/api";

interface InvoiceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
  availableMonths: string[];
  peopleMap: Record<string, any>;
  onSuccess: () => void;
}

export function InvoiceAdjustmentModal({
  isOpen,
  onClose,
  currentMonth,
  availableMonths,
  peopleMap,
  onSuccess
}: InvoiceAdjustmentModalProps) {
  const [activeTab, setActiveTab] = useState<"cutoff" | "duplicates" | "manual">("cutoff");
  const [sourceMonth, setSourceMonth] = useState(currentMonth);
  const [targetMonth, setTargetMonth] = useState("");
  const [filterMode, setFilterMode] = useState<"from_day" | "to_day" | "range" | "all">("from_day");
  const [cutoffDay, setCutoffDay] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Duplicates state
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // Initialize targetMonth to next month of sourceMonth
  useEffect(() => {
    if (sourceMonth && sourceMonth.includes("-")) {
      const [y, m] = sourceMonth.split("-");
      let year = parseInt(y, 10);
      let month = parseInt(m, 10) + 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      setTargetMonth(`${year}-${month.toString().padStart(2, "0")}`);
    }
  }, [sourceMonth]);

  // Load transactions when modal opens or sourceMonth changes
  useEffect(() => {
    if (isOpen && sourceMonth) {
      loadSourceTransactions();
      if (activeTab === "duplicates") {
        loadDuplicates();
      }
    }
  }, [isOpen, sourceMonth, activeTab]);

  const loadSourceTransactions = async () => {
    setLoading(true);
    try {
      const txs = await fetchTransactions(sourceMonth);
      // Filter out purely projected ones as they dynamically recalculate
      const realTxs = txs.filter((t: any) => !t.is_projected);
      setTransactions(realTxs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDuplicates = async () => {
    setLoadingDuplicates(true);
    try {
      const res = await fetchDuplicateCandidates(sourceMonth);
      setDuplicates(res.duplicates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  // Helper to parse day and iso
  const parseDay = (dStr: string) => {
    if (!dStr) return 0;
    if (dStr.includes("-")) {
      const parts = dStr.split("-");
      if (parts.length === 3) return parseInt(parts[2], 10);
    }
    if (dStr.includes("/")) {
      const parts = dStr.split("/");
      return parseInt(parts[0], 10);
    }
    return 0;
  };

  const toIsoDate = (dStr: string) => {
    if (!dStr) return "";
    if (dStr.includes("-") && dStr.length >= 10) return dStr.slice(0, 10);
    if (dStr.includes("/")) {
      const parts = dStr.split("/");
      if (parts.length === 3) {
        const dd = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        const yyyy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return dStr;
  };

  // Compute matching transactions for cutoff tab
  const matchingTransactions = transactions.filter((tx) => {
    if (filterMode === "all") return true;
    const day = parseDay(tx.original_date);
    const isoDate = toIsoDate(tx.original_date);

    if (filterMode === "from_day") {
      return day >= cutoffDay;
    }
    if (filterMode === "to_day") {
      return day <= cutoffDay;
    }
    if (filterMode === "range") {
      let match = true;
      if (startDate && isoDate && isoDate < startDate) match = false;
      if (endDate && isoDate && isoDate > endDate) match = false;
      return match;
    }
    return true;
  });

  // When criteria change, preselect matching transactions
  useEffect(() => {
    setSelectedTxIds(matchingTransactions.map((t) => t.id));
  }, [filterMode, cutoffDay, startDate, endDate, transactions]);

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTxIds(matchingTransactions.map((t) => t.id));
    } else {
      setSelectedTxIds([]);
    }
  };

  const handleExecuteMove = async () => {
    if (selectedTxIds.length === 0) {
      alert("Selecione pelo menos um lançamento para mover.");
      return;
    }
    if (!targetMonth) {
      alert("Selecione o mês da fatura de destino.");
      return;
    }
    if (sourceMonth === targetMonth) {
      alert("O mês de destino deve ser diferente do mês de origem.");
      return;
    }

    if (
      !confirm(
        `Deseja transferir ${selectedTxIds.length} lançamento(s) da fatura de ${formatMonth(
          sourceMonth
        )} para a fatura de ${formatMonth(targetMonth)}?`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await batchMoveTransactions(selectedTxIds, targetMonth);
      alert(
        `Sucesso! ${selectedTxIds.length} lançamento(s) foram movidos para a fatura de ${formatMonth(
          targetMonth
        )}.`
      );
      onSuccess();
      await loadSourceTransactions();
      setSelectedTxIds([]);
    } catch (err: any) {
      alert("Erro ao transferir lançamentos: " + (err.message || "Erro interno"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDuplicate = async (txId: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento duplicado?")) return;
    try {
      await deleteTransaction(txId);
      setDuplicates((prev) =>
        prev.filter((d) => d.currentTx.id !== txId && d.matchingTx.id !== txId)
      );
      onSuccess();
      loadSourceTransactions();
    } catch (e) {
      alert("Erro ao excluir duplicado.");
    }
  };

  const totalSelectedAmount = transactions
    .filter((t) => selectedTxIds.includes(t.id))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b0e26] rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col ring-1 ring-white/10">
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
                Ajustar Vencimento & Reorganizar Faturas
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Reorganize compras que se misturaram devido à mudança da data de fechamento ou vencimento do cartão.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/40 border-b border-white/5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("cutoff")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "cutoff"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Filter size={14} />
            Mover por Data de Corte
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "duplicates"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <AlertCircle size={14} />
            Detectar Duplicados {duplicates.length > 0 && `(${duplicates.length})`}
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "manual"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Layers size={14} />
            Seleção Manual
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="px-5 py-3 bg-slate-900/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Fatura de Origem:</span>
            <select
              value={sourceMonth}
              onChange={(e) => setSourceMonth(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-slate-100 font-bold outline-none focus:border-blue-400"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-[#0b0e26] text-white">
                  {formatMonth(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ArrowRight size={14} className="text-slate-500" />
            <span className="text-slate-400 font-medium">Mover para Fatura de Destino:</span>
            <div className="flex items-center gap-1">
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-cyan-500/30 rounded-xl text-cyan-300 font-bold outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!targetMonth) return;
                  const [y, m] = targetMonth.split("-");
                  let month = parseInt(m, 10) + 1;
                  let year = parseInt(y, 10);
                  if (month > 12) {
                    month = 1;
                    year += 1;
                  }
                  setTargetMonth(`${year}-${month.toString().padStart(2, "0")}`);
                }}
                className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[11px] font-semibold"
                title="+1 Mês"
              >
                +1 Mês
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "cutoff" && (
            <div className="space-y-4">
              {/* Explanation Banner */}
              <div className="p-3.5 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                <Calendar size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">
                    Como funciona a mudança de vencimento:
                  </span>{" "}
                  Quando você altera a data de vencimento do cartão (ex: do dia 10 para o dia 25), a data de fechamento também muda. As compras feitas após o novo fechamento pertencem à fatura seguinte.
                </div>
              </div>

              {/* Filter Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFilterMode("from_day")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    filterMode === "from_day"
                      ? "bg-blue-600/20 border-blue-400 text-white shadow-sm"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <p className="text-xs font-bold text-white mb-1">A partir do dia X</p>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Compras realizadas do dia X até o fim do mês vão para o próximo mês.
                  </p>
                  {filterMode === "from_day" && (
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-slate-300">Dia:</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={cutoffDay}
                        onChange={(e) => setCutoffDay(parseInt(e.target.value, 10) || 1)}
                        className="w-16 px-2 py-1 bg-slate-950 border border-white/20 rounded-lg text-white font-bold text-center text-xs"
                      />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode("to_day")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    filterMode === "to_day"
                      ? "bg-blue-600/20 border-blue-400 text-white shadow-sm"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <p className="text-xs font-bold text-white mb-1">Até o dia X</p>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Compras dos primeiros X dias do mês vão para o mês anterior.
                  </p>
                  {filterMode === "to_day" && (
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-slate-300">Dia:</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={cutoffDay}
                        onChange={(e) => setCutoffDay(parseInt(e.target.value, 10) || 1)}
                        className="w-16 px-2 py-1 bg-slate-950 border border-white/20 rounded-lg text-white font-bold text-center text-xs"
                      />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode("range")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    filterMode === "range"
                      ? "bg-blue-600/20 border-blue-400 text-white shadow-sm"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <p className="text-xs font-bold text-white mb-1">Intervalo de Datas</p>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Definir período exato da compra.
                  </p>
                  {filterMode === "range" && (
                    <div className="space-y-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-950 border border-white/20 rounded-lg text-white text-[11px]"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-950 border border-white/20 rounded-lg text-white text-[11px]"
                      />
                    </div>
                  )}
                </button>
              </div>

              {/* Transactions Preview Table */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="p-3 bg-slate-900/60 border-b border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        matchingTransactions.length > 0 &&
                        selectedTxIds.length === matchingTransactions.length
                      }
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-500 accent-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">
                      {matchingTransactions.length} lançamento(s) correspondem ao critério
                    </span>
                  </div>
                  <span className="text-cyan-400 font-bold">
                    Total: {formatCurrency(totalSelectedAmount)}
                  </span>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                    Carregando lançamentos...
                  </div>
                ) : matchingTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Nenhum lançamento encontrado nesta fatura com os critérios selecionados.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-white/5 sticky top-0">
                        <tr>
                          <th className="p-2.5 w-8"></th>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Descrição</th>
                          <th className="p-2.5">Responsável</th>
                          <th className="p-2.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {matchingTransactions.map((tx) => {
                          const isChecked = selectedTxIds.includes(tx.id);
                          const person = tx.person_id ? peopleMap[tx.person_id] : null;
                          return (
                            <tr
                              key={tx.id}
                              onClick={() => toggleSelectTx(tx.id)}
                              className={`cursor-pointer transition-colors ${
                                isChecked ? "bg-blue-600/10 hover:bg-blue-600/15" : "hover:bg-white/5"
                              }`}
                            >
                              <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelectTx(tx.id)}
                                  className="w-3.5 h-3.5 rounded text-blue-500 accent-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                                {tx.original_date}
                              </td>
                              <td className="p-2.5 text-slate-200 font-medium">
                                {tx.description}
                                {tx.total_installment > 1 && (
                                  <span className="ml-2 text-[10px] text-slate-400 font-mono">
                                    ({tx.current_installment}/{tx.total_installment})
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-400">
                                {person ? (
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{
                                      backgroundColor: `${person.color}25`,
                                      color: person.color,
                                    }}
                                  >
                                    {person.name}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-100">
                                {formatCurrency(tx.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "duplicates" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Verificação de Duplicidades:</span>{" "}
                  Quando o vencimento é alterado, o banco às vezes repete lançamentos na fatura transitória. Aqui você pode revisar lançamentos de mesmo valor e descrição na mesma fatura ou em faturas vizinhas e remover duplicados com 1 clique.
                </div>
              </div>

              {loadingDuplicates ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Verificando possíveis duplicidades...
                </div>
              ) : duplicates.length === 0 ? (
                <div className="p-8 text-center text-xs bg-white/5 border border-white/5 rounded-xl text-emerald-400 flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 size={28} />
                  <span>Nenhum lançamento duplicado encontrado entre as faturas!</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {duplicates.map((dup, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-950/60 border border-amber-500/30 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-amber-300 font-semibold text-[11px]">
                        <span>{dup.matchType}</span>
                        <span className="font-bold text-white text-xs">
                          {formatCurrency(dup.currentTx.amount)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="p-2 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-200">
                              {dup.currentTx.description}
                            </p>
                            <p className="text-slate-400">
                              Fatura: {dup.currentTx.billed_month} • Data: {dup.currentTx.original_date}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteDuplicate(dup.currentTx.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Excluir este lançamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="p-2 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-200">
                              {dup.matchingTx.description}
                            </p>
                            <p className="text-slate-400">
                              Fatura: {dup.matchingTx.billed_month} • Data: {dup.matchingTx.original_date}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteDuplicate(dup.matchingTx.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Excluir este lançamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "manual" && (
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
                Selecione manualmente os lançamentos da fatura de <strong>{formatMonth(sourceMonth)}</strong> que você deseja transferir para <strong>{formatMonth(targetMonth)}</strong>:
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="p-3 bg-slate-900/60 border-b border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={transactions.length > 0 && selectedTxIds.length === transactions.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTxIds(transactions.map((t) => t.id));
                        else setSelectedTxIds([]);
                      }}
                      className="w-4 h-4 rounded text-blue-500 accent-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">
                      {selectedTxIds.length} de {transactions.length} selecionado(s)
                    </span>
                  </div>
                  <span className="text-cyan-400 font-bold">
                    Total: {formatCurrency(totalSelectedAmount)}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-white/5">
                      {transactions.map((tx) => {
                        const isChecked = selectedTxIds.includes(tx.id);
                        return (
                          <tr
                            key={tx.id}
                            onClick={() => toggleSelectTx(tx.id)}
                            className={`cursor-pointer transition-colors ${
                              isChecked ? "bg-blue-600/10 hover:bg-blue-600/15" : "hover:bg-white/5"
                            }`}
                          >
                            <td className="p-2.5 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectTx(tx.id)}
                                className="w-3.5 h-3.5 rounded text-blue-500 accent-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 text-slate-400 font-mono text-[11px] w-24">
                              {tx.original_date}
                            </td>
                            <td className="p-2.5 text-slate-200 font-medium">
                              {tx.description}
                              {tx.total_installment > 1 && (
                                <span className="ml-2 text-[10px] text-slate-400 font-mono">
                                  ({tx.current_installment}/{tx.total_installment})
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-100 w-28">
                              {formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {selectedTxIds.length > 0 ? (
              <span>
                <strong className="text-white">{selectedTxIds.length}</strong> selecionado(s) (
                {formatCurrency(totalSelectedAmount)})
              </span>
            ) : (
              <span>Nenhum lançamento selecionado</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={actionLoading || selectedTxIds.length === 0}
              onClick={handleExecuteMove}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {actionLoading ? "Transferindo..." : `Transferir para ${formatMonth(targetMonth)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
