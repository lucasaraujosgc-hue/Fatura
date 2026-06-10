import React, { useState } from "react";
import { uploadInvoice, createTransaction, createPerson, deletePerson } from "../lib/api";
import { Upload, Plus, Trash2, Users } from "lucide-react";

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
    <form onSubmit={handleUpload} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
        <Upload size={18} className="text-gray-500" />
        Importar Fatura PDF
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF da Fatura</label>
          <input 
            type="file" 
            accept="application/pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-md"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        <button 
          disabled={!file || loading}
          className="w-full bg-slate-900 text-white rounded-lg py-2.5 px-4 font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Processando e Importando..." : "Enviar PDF"}
        </button>
        <p className="text-xs text-gray-500 text-center">Para o mês selecionado: {currentMonth}</p>
      </div>
    </form>
  )
}

export function ManualTransactionForm({ currentMonth, peopleList, onSuccess }: { currentMonth: string, peopleList: any[], onSuccess: () => void }) {
  const [description, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInst] = useState("1");
  const [personId, setPersonId] = useState("");
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
        person_id: personId || null
      });
      onSuccess();
      setDesc(""); setAmount(""); setInst("1"); setPersonId("");
    } catch (err) {
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
        <Plus size={18} className="text-gray-500" />
        Lançamento Manual
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Descrição</label>
          <input required value={description} onChange={e=>setDesc(e.target.value)} type="text" placeholder="Ex: Supermercado" className="w-full px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-slate-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Valor (R$)</label>
            <input required value={amount} onChange={e=>setAmount(e.target.value)} type="number" step="0.01" placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-slate-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Parcelas</label>
            <input required value={installments} onChange={e=>setInst(e.target.value)} type="text" placeholder="Ex: 1/10 ou 1" className="w-full px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-slate-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Responsável</label>
          <select value={personId} onChange={e=>setPersonId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-slate-500 bg-white">
            <option value="">Sem categoria</option>
            {peopleList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button disabled={loading} className="w-full bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 rounded-lg py-2.5 px-4 font-medium transition-colors">
          Adicionar Gasto
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
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
        <Users size={18} className="text-gray-500" />
        Gerenciar Pessoas
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          {peopleList.length === 0 && <p className="text-sm text-gray-400 italic">Nenhuma pessoa cadastrada.</p>}
          {peopleList.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></span>
                {p.name}
              </span>
              <button type="button" onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-gray-100">
          <input 
            type="color" 
            value={color} 
            onChange={e=>setColor(e.target.value)}
            className="w-10 h-10 p-1 rounded border border-gray-200 cursor-pointer"
          />
          <input 
            type="text" 
            placeholder="Nome da pessoa" 
            value={name} 
            onChange={e=>setName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-slate-500"
            required
          />
          <button className="bg-slate-900 text-white px-3 py-2 rounded-md font-medium text-sm hover:bg-slate-800 transition-colors">
            Adicionar
          </button>
        </form>
      </div>
    </div>
  )
}
