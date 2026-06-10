import React, { useState } from "react";
import { uploadInvoice, createTransaction, createPerson, deletePerson, createCategory, updateCategory, deleteCategory } from "../lib/api";
import { Upload, Plus, Trash2, Users, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { CategoryIcon, CATEGORY_ICONS } from "../lib/iconsList";

export function UploadForm({ currentMonth, onUploadSuccess }: { currentMonth: string, onUploadSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (!confirm(`Deseja importar a fatura para o mês referencial ${currentMonth}?\nIsso processará o PDF usando IA e pode demorar alguns segundos.`)) {
      return;
    }

    const overwrite = confirm("Deseja SOBRESCREVER dados anteriores importados desse mês? (Recomendado se você está atualizando a fatura deste mês)");
    
    setLoading(true);
    setError("");
    try {
      await uploadInvoice(file, currentMonth, overwrite);
      onUploadSuccess();
      setFile(null);
      alert("Fatura importada com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="bg-slate-950/40 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
      <h3 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Upload size={18} className="text-blue-400" />
        Importar Fatura PDF
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Arquivo PDF da Fatura</label>
          <input 
            type="file" 
            accept="application/pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 border border-white/10 rounded-xl bg-white/5 cursor-pointer"
            required
          />
        </div>
        {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
        <button 
          disabled={!file || loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 px-4 font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all duration-300 active:scale-98 cursor-pointer"
        >
          {loading ? "Processando e Importando..." : "Enviar PDF"}
        </button>
        <p className="text-xs text-slate-400 text-center">Mês selecionado: <span className="font-mono text-blue-400 font-medium">{currentMonth}</span></p>
      </div>
    </form>
  )
}

export function ManualTransactionForm({ 
  currentMonth, 
  peopleList, 
  categoriesList = [], 
  onSuccess 
}: { 
  currentMonth: string, 
  peopleList: any[], 
  categoriesList: any[], 
  onSuccess: () => void 
}) {
  const [description, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInst] = useState("1");
  const [personId, setPersonId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parts = installments.split('/');
      const current = parts.length > 1 ? parseInt(parts[0]) : 1;
      const total = parts.length > 1 ? parseInt(parts[1]) : parseInt(installments);

      await createTransaction({
        billed_month: currentMonth,
        original_date: new Date().toISOString().split('T')[0],
        description,
        amount: parseFloat(amount.replace(',', '.')),
        current_installment: current || 1,
        total_installment: total || 1,
        person_id: personId || null,
        category_id: categoryId || null,
        notes: notes || null
      });
      onSuccess();
      setDesc(""); setAmount(""); setInst("1"); setPersonId(""); setCategoryId(""); setNotes(""); setShowNotes(false);
    } catch (err) {
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-950/40 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
      <h3 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Plus size={18} className="text-emerald-400" />
        Lançamento Manual
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
          <input 
            required 
            value={description} 
            onChange={e=>setDesc(e.target.value)} 
            type="text" 
            placeholder="Ex: Supermercado" 
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 placeholder-slate-500 transition-all duration-300" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Valor (R$)</label>
            <input 
              required 
              value={amount} 
              onChange={e=>setAmount(e.target.value)} 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 placeholder-slate-500 transition-all duration-300" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Parcelas</label>
            <input 
              required 
              value={installments} 
              onChange={e=>setInst(e.target.value)} 
              type="text" 
              placeholder="Ex: 1/10 ou 1" 
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 placeholder-slate-500 transition-all duration-300" 
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Responsável</label>
            <select 
              value={personId} 
              onChange={e=>setPersonId(e.target.value)} 
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 transition-all duration-300 text-sm"
            >
              <option value="" className="bg-[#0b0d1b] text-slate-400">Sem categoria</option>
              {peopleList.map(p => (
                <option key={p.id} value={p.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Categoria</label>
            <select 
              value={categoryId} 
              onChange={e=>setCategoryId(e.target.value)} 
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 transition-all duration-300 text-sm"
            >
              <option value="" className="bg-[#0b0d1b] text-slate-400">Sem categoria</option>
              {categoriesList.map(c => (
                <option key={c.id} value={c.id} className="bg-[#0b0d1b] text-slate-100 font-medium">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Collapsible Options */}
        <div className="space-y-2 pt-1">
          <button 
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1"
          >
            {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showNotes ? "Menos opções" : "Mais opções"}
          </button>
          
          {showNotes && (
            <div className="space-y-1 bg-white/[0.02] p-3 rounded-xl border border-white/5 animate-fadeIn">
              <label className="block text-xs font-semibold text-slate-400">Observações</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Insira detalhes ou observações deste gasto..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-950/40 border border-white/10 rounded-xl text-slate-200 outline-none focus:border-blue-500/65 placeholder-slate-500 transition-all"
              />
            </div>
          )}
        </div>

        <button 
          disabled={loading} 
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl py-2.5 px-4 font-semibold shadow-lg shadow-blue-500/10 transition-all duration-300 active:scale-98 cursor-pointer text-sm"
        >
          {loading ? "Salvando..." : "Adicionar Gasto"}
        </button>
      </div>
    </form>
  )
}

export function PeopleManager({ peopleList, onUpdate }: { peopleList: any[], onUpdate: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await createPerson(name, color);
    setName("");
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deletar esta pessoa? Os lançamentos dela ficarão sem categoria.")) {
      await deletePerson(id);
      onUpdate();
    }
  };

  return (
    <div className="bg-slate-950/40 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
      <h3 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <Users size={18} className="text-purple-400" />
        Gerenciar Pessoas
      </h3>
      <div className="space-y-4">
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {peopleList.length === 0 && <p className="text-sm text-slate-400 italic">Nenhuma pessoa cadastrada.</p>}
          {peopleList.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 px-3 py-2.5 rounded-xl border border-white/5 transition-all duration-300">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}aa` }}></span>
                {p.name}
              </span>
              <button 
                type="button" 
                onClick={() => handleDelete(p.id)} 
                className="text-slate-400 hover:text-red-400 transition-colors p-1 hover:bg-white/5 rounded-lg"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-white/10">
          <input 
            type="color" 
            value={color} 
            onChange={e=>setColor(e.target.value)}
            className="w-10 h-10 p-1.5 rounded-xl border border-white/10 bg-white/5 cursor-pointer transition-all duration-300 hover:scale-105"
          />
          <input 
            type="text" 
            placeholder="Nome da pessoa" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 placeholder-slate-500 transition-all duration-300"
            required
          />
          <button className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-xl font-semibold text-sm shadow-lg shadow-purple-600/25 active:scale-95 transition-all duration-300 cursor-pointer">
            Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}

export function CategoryManager({ 
  categoriesList = [], 
  onUpdate 
}: { 
  categoriesList: any[], 
  onUpdate: () => void 
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [selectedIcon, setIcon] = useState("Tag");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAddOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    try {
      if (editingId) {
        await updateCategory(editingId, name, color, selectedIcon);
        setEditingId(null);
      } else {
        await createCategory(name, color, selectedIcon);
      }
      
      setName("");
      setColor("#3b82f6");
      setIcon("Tag");
      onUpdate();
    } catch (err) {
      alert("Erro ao salvar categoria.");
    }
  };

  const handleStartEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color || "#3b82f6");
    setIcon(cat.icon || "Tag");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setColor("#3b82f6");
    setIcon("Tag");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deletar esta categoria? Os lançamentos vinculados a ela ficarão sem categoria.")) {
      try {
        await deleteCategory(id);
        onUpdate();
      } catch (err) {
        alert("Erro ao excluir categoria.");
      }
    }
  };

  return (
    <div className="bg-slate-950/40 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
      <h3 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <span className="text-blue-450"><CategoryIcon name="Tag" size={18} /></span>
        Gerenciar Categorias
      </h3>
      <div className="space-y-4">
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {categoriesList.length === 0 && <p className="text-sm text-slate-400 italic">Nenhuma categoria cadastrada.</p>}
          {categoriesList.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/5 transition-all duration-350">
              <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
                <span 
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0" 
                  style={{ backgroundColor: c.color, boxShadow: `0 0 10px ${c.color}55` }}
                >
                  <CategoryIcon name={c.icon} size={14} />
                </span>
                {c.name}
              </span>
              <div className="flex items-center gap-1">
                <button 
                  type="button" 
                  onClick={() => handleStartEdit(c)} 
                  className="text-slate-400 hover:text-blue-400 transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                  title="Editar"
                >
                  <CategoryIcon name="Edit" size={13} />
                </button>
                <button 
                  type="button" 
                  onClick={() => handleDelete(c.id)} 
                  className="text-slate-400 hover:text-red-400 transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddOrEdit} className="space-y-3.5 pt-3 border-t border-white/10">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            {editingId ? "Editar Categoria" : "Nova Categoria"}
          </p>

          <div className="flex gap-2">
            <input 
              type="color" 
              value={color} 
              onChange={e=>setColor(e.target.value)}
              className="w-10 h-10 p-1 rounded-xl border border-white/10 bg-white/5 cursor-pointer transition-all duration-300 hover:scale-105 shrink-0"
            />
            <input 
              type="text" 
              placeholder="Ex: Assinaturas, Mercado" 
              value={name} 
              onChange={e=>setName(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-100 outline-none focus:border-blue-500/60 placeholder-slate-500 transition-all duration-300"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">Escolha o Ícone</label>
            <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-white/5">
              {Object.keys(CATEGORY_ICONS).map(iconName => (
                <button
                  type="button"
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  title={iconName}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                    selectedIcon === iconName 
                      ? "bg-blue-600 border border-blue-400 text-white scale-105" 
                      : "bg-white/5 border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <CategoryIcon name={iconName} size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {editingId && (
              <button 
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-3 rounded-xl font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2.5 px-3 rounded-xl font-semibold shadow-lg shadow-blue-600/25 active:scale-95 transition-all cursor-pointer">
              {editingId ? "Atualizar" : "Salvar Categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
