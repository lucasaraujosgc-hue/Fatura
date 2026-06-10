import React, { useState, useEffect } from 'react';
import { fetchPeople, fetchMonths, fetchCategories } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { UploadForm, ManualTransactionForm, PeopleManager, CategoryManager } from './components/Forms';
import { CategoryChart } from './components/CategoryChart';
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
            <span className="text-sm font-medium text-slate-400 whitespace-nowrap">Fatura:</span>
            
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner">
              <button 
                onClick={() => {
                  const sorted = [...months].sort();
                  const idx = sorted.indexOf(currentMonth);
                  if (idx > 0) {
                    setCurrentMonth(sorted[idx - 1]);
                  } else {
                    // Try to generate previous month
                    if (currentMonth) {
                      const [y, m] = currentMonth.split('-');
                      let ny = parseInt(y), nm = parseInt(m) - 1;
                      if (nm === 0) { ny--; nm = 12; }
                      setCurrentMonth(`${ny}-${nm.toString().padStart(2, '0')}`);
                    }
                  }
                  triggerRefresh();
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Mês Anterior"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              
              <div className="flex items-center gap-1 px-2 overflow-hidden w-[220px] justify-center relative">
                {(() => {
                  const sorted = [...months].sort();
                  const idx = sorted.indexOf(currentMonth);
                  
                  // Simple generation of months to show if they don't exist in array
                  const getMonthString = (offset) => {
                    if (!currentMonth) return "";
                    const [y, m] = currentMonth.split('-');
                    let ny = parseInt(y), nm = parseInt(m) + offset;
                    while (nm > 12) { ny++; nm -= 12; }
                    while (nm < 1) { ny--; nm += 12; }
                    return `${ny}-${nm.toString().padStart(2, '0')}`;
                  };

                  const prevMonth = (idx > 0 && sorted[idx-1]) || getMonthString(-1);
                  const nextMonth = (idx >= 0 && idx < sorted.length - 1 && sorted[idx+1]) || getMonthString(1);

                  const formatM = (iso) => {
                     const d = new Date(iso + "-01");
                     const text = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                     return text.charAt(0).toUpperCase() + text.slice(1);
                  };

                  return (
                    <div className="flex items-center w-full justify-between">
                       <div className="w-[60px] text-center text-xs font-semibold text-slate-500 opacity-60 truncate cursor-not-allowed hidden sm:block">
                          {formatM(prevMonth)}
                       </div>
                       
                       <div className="px-4 py-1.5 bg-slate-800/80 border border-slate-600 shadow-md rounded-xl text-sm font-bold text-slate-100 min-w-[90px] text-center">
                          {formatM(currentMonth)} {currentMonth.split('-')[0]}
                       </div>
                       
                       <div className="w-[60px] text-center text-xs font-semibold text-slate-500 opacity-60 truncate cursor-not-allowed hidden sm:block">
                          {formatM(nextMonth)}
                       </div>
                    </div>
                  );
                })()}
              </div>

              <button 
                onClick={() => {
                  const sorted = [...months].sort();
                  const idx = sorted.indexOf(currentMonth);
                  if (idx !== -1 && idx < sorted.length - 1) {
                    setCurrentMonth(sorted[idx + 1]);
                  } else {
                    if (currentMonth) {
                      const [y, m] = currentMonth.split('-');
                      let ny = parseInt(y), nm = parseInt(m) + 1;
                      if (nm > 12) { ny++; nm = 1; }
                      setCurrentMonth(`${ny}-${nm.toString().padStart(2, '0')}`);
                    }
                  }
                  triggerRefresh();
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Próximo Mês"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
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
              className="text-xs font-semibold text-slate-400 bg-white/5 border border-white/5 px-2.5 py-2.5 rounded-xl hover:text-slate-100 hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all duration-300 cursor-pointer"
              title="Pular para mês..."
            >
              <Calendar size={16} />
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
            <CategoryChart currentMonth={currentMonth} categories={categories} refreshKey={refreshKey} />
            <ManualTransactionForm currentMonth={currentMonth} peopleList={people} categoriesList={categories} onSuccess={triggerRefresh} />
            <PeopleManager peopleList={people} onUpdate={triggerRefresh} />
            <CategoryManager categoriesList={categories} onUpdate={triggerRefresh} />
          </div>

        </div>
      </main>
    </div>
  );
}
