import React, { useState, useEffect } from 'react';
import { fetchPeople, fetchMonths } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { UploadForm, ManualTransactionForm, PeopleManager } from './components/Forms';
import { CreditCard, Calendar } from 'lucide-react';

export default function App() {
  const [people, setPeople] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = async () => {
    try {
      const [ppl, mnts] = await Promise.all([fetchPeople(), fetchMonths()]);
      setPeople(ppl);
      
      const distinctMonths = mnts.length > 0 ? mnts : [new Date().toISOString().slice(0, 7)];
      
      // Ensure currentMonth is in the list or set to latest
      if (!distinctMonths.includes(currentMonth) && currentMonth !== "") {
        distinctMonths.push(currentMonth);
        distinctMonths.sort().reverse();
      }
      
      setMonths(distinctMonths);
      if (!currentMonth) {
        setCurrentMonth(distinctMonths[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const triggerRefresh = () => setRefreshKey(k => k + 1);

  const peopleMap = people.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded-xl shadow-sm">
              <CreditCard size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">FaturaX</h1>
              <p className="text-xs text-gray-500 font-medium">Gerenciador de Cartão de Crédito</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Mês de Referência:</span>
            <div className="relative">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-slate-500 focus:border-slate-500 block w-full pl-3 pr-10 py-2.5 font-medium outline-none cursor-pointer hover:bg-gray-100 transition-colors"
              >
                {months.map(m => (
                  <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>
                ))}
              </select>
              <Calendar size={16} className="absolute right-3 top-3 pointer-events-none text-gray-400" />
            </div>
            <button 
              onClick={() => {
                const year = prompt("Digite o ano (YYYY):", new Date().getFullYear().toString());
                const month = prompt("Digite o mês (MM) - 01 a 12:", (new Date().getMonth()+1).toString().padStart(2, '0'));
                if (year && month) {
                    setCurrentMonth(`${year}-${month}`);
                    triggerRefresh();
                }
              }}
              className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Novo Mês
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Dashboard */}
          <div className="lg:col-span-2">
            <Dashboard currentMonth={currentMonth} peopleMap={peopleMap} />
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-6">
            <UploadForm currentMonth={currentMonth} onUploadSuccess={triggerRefresh} />
            <ManualTransactionForm currentMonth={currentMonth} peopleList={people} onSuccess={triggerRefresh} />
            <PeopleManager peopleList={people} onUpdate={triggerRefresh} />
          </div>

        </div>
      </main>
    </div>
  );
}
