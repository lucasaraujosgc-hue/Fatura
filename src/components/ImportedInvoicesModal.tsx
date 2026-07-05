import React, { useState, useEffect, useRef } from "react";
import { X, FileText, Trash2, MessageSquare, Send, Paperclip } from "lucide-react";

interface Invoice {
  month: string;
  filename: string;
  fullPath: string;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  attachment?: string;
}

export function ImportedInvoicesModal({ isOpen, onClose, onUpdate }: { isOpen: boolean, onClose: () => void, onUpdate: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Olá! Como posso ajudar você com a análise das suas faturas?' }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadInvoices();
    }
  }, [isOpen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (month: string) => {
    if (!confirm(`Tem certeza que deseja excluir a fatura e os lançamentos de ${month}?`)) return;
    
    try {
      const res = await fetch(`/api/invoices/${month}`, { method: 'DELETE' });
      if (res.ok) {
        setInvoices(invoices.filter(i => i.month !== month));
        onUpdate();
      }
    } catch (err) {
      alert("Erro ao excluir fatura.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !selectedFile) return;

    const userMsg = chatInput;
    const userFile = selectedFile ? selectedFile.name : undefined;

    setMessages(prev => [...prev, { role: 'user', text: userMsg, attachment: userFile }]);
    setChatInput("");
    setIsChatting(true);

    try {
      const formData = new FormData();
      formData.append("message", userMsg);
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const res = await fetch("/api/chat", {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'ai', text: data.reply || "Desculpe, ocorreu um erro." }]);
      setSelectedFile(null);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Erro ao comunicar com a IA." }]);
    } finally {
      setIsChatting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0b0d1b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl flex overflow-hidden max-h-[85vh]">
        
        {/* Left Side: Invoices List */}
        <div className="w-1/3 border-r border-white/10 flex flex-col bg-slate-900/50">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-white">Faturas Importadas</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhuma fatura importada.</p>
            ) : (
              invoices.map((inv) => (
                <div key={inv.month} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-slate-200 truncate">{inv.month}</p>
                      <p className="text-xs text-slate-400 truncate">{inv.filename}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(inv.month)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Chat */}
        <div className="w-2/3 flex flex-col bg-[#0b0d1b]">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-400" />
              <h2 className="text-lg font-display font-semibold text-white">Assistente IA</h2>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'
                }`}>
                  {msg.attachment && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-black/20 rounded-lg text-xs font-medium">
                      <Paperclip size={12} /> {msg.attachment}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {isChatting && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/5 text-slate-400 rounded-2xl rounded-tl-none p-3 text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-white/10 bg-slate-900/50">
            {selectedFile && (
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-300 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 inline-flex">
                <FileText size={14} />
                {selectedFile.name}
                <button onClick={() => setSelectedFile(null)} className="ml-2 hover:text-white"><X size={14} /></button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <label className="cursor-pointer p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0">
                <Paperclip size={20} />
                <input 
                  type="file" 
                  className="hidden" 
                  accept="application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </label>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                disabled={isChatting}
              />
              <button
                type="submit"
                disabled={isChatting || (!chatInput.trim() && !selectedFile)}
                className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
