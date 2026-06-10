import React, { useState, useEffect } from 'react';
import { fetchPeople, fetchMonths, fetchCategories } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { UploadForm, ManualTransactionForm, PeopleManager, CategoryManager } from './components/Forms';
import { CreditCard, Calendar } from 'lucide-react';

export default function App() {
  const [people, setPeople] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = async () => {
    try {
      const [ppl, mnts, cats] = await Promise.all([fetchPeople(), fetchMonths(), fetchCategories()]);
      setPeople(ppl);
      setCategories(cats || []);
      
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
    <div className="min-h-screen bg-[#060814] text-slate-100 font-sans relative overflow-x-hidden pb-12">
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-15%] w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[180px] pointer-events-none z-0"></div>
      <div className="absolute top-[40%] left-[30%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="bg-slate-950/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-600 text-white flex items-center justify-center rounded-xl shadow-lg shadow-blue-500/25">
              <CreditCard size={20} />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                FaturaX
              </h1>
              <p className="text-xs text-slate-400 font-medium">Controle de Fatura Compartilhada</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 z-10">
            <span className="text-sm font-medium text-slate-400 whitespace-nowrap">Mês de Referência:</span>
            <div className="relative">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 text-slate-100 text-sm rounded-xl focus:ring-blue-500/50 focus:border-blue-500/50 block w-full pl-3 pr-10 py-2.5 font-medium outline-none cursor-pointer hover:bg-white/10 transition-all duration-300"
              >
                {months.map(m => (
                  <option key={m} value={m} className="bg-[#0b0d1b] text-slate-100 font-medium">
                    {new Date(m + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
              <Calendar size={16} className="absolute right-3 top-3.5 pointer-events-none text-slate-400" />
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
              className="text-xs font-semibold text-slate-100 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              Novo Mês
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Dashboard */}
          <div className="lg:col-span-2">
            <Dashboard currentMonth={currentMonth} peopleMap={peopleMap} categories={categories} />
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-6">
            <UploadForm currentMonth={currentMonth} onUploadSuccess={triggerRefresh} />
            <ManualTransactionForm currentMonth={currentMonth} peopleList={people} categoriesList={categories} onSuccess={triggerRefresh} />
            <PeopleManager peopleList={people} onUpdate={triggerRefresh} />
            <CategoryManager categoriesList={categories} onUpdate={triggerRefresh} />
          </div>

        </div>
      </main>
    </div>
  );
}
