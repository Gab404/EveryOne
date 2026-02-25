import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown"; 
import remarkBreaks from "remark-breaks"; // <-- NOUVEL IMPORT POUR LES SAUTS DE LIGNE
import { sendChatMessage, ingestSinglePdf } from "./api";
import brandLogo from "./assets/Logo.png"; 

export default function ChatInterface({ selectedModel, uploadedFiles = [], onNavigate }) {
  const [messages, setMessages] = useState([{
    role: "slm", content: `System ready. Connected to ${selectedModel.name}.`, sources: []
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [contextFiles, setContextFiles] = useState(uploadedFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages, isLoading]); 

  // --- LOGIQUE D'UPLOAD DE FICHIERS ---
  const handleProcessFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) return alert("Please upload PDF files only.");

    setIsUploading(true);
    
    for (const file of pdfFiles) {
      try {
        const res = await ingestSinglePdf(file);
        setContextFiles(prev => [...prev, { name: file.name, ...res }]);
      } catch (err) { 
        alert(`Error with ${file.name}: ${err.message}`); 
      }
    }
    setIsUploading(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleProcessFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    handleProcessFiles(e.target.files);
    e.target.value = ""; 
  };
  // ------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendChatMessage({
        message: userMsg.content,
        selectedModel: selectedModel.name,
        selectedModelId: selectedModel.id,
        documentIds: contextFiles.map(f => f.documentId), 
      });
      setMessages(prev => [...prev, { role: "slm", content: res.answer, sources: res.sources }]);
    } catch (err) { 
      alert(err.message); 
    }
    setIsLoading(false);
  };

  return (
    <div 
      className="relative flex h-screen flex-col text-[var(--ink)]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {isDragging && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm border-4 border-dashed border-[var(--brand-purple)] m-4 rounded-3xl">
          <div className="text-center text-white">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-3xl font-bold">Drop PDF to add to context</h2>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--brand-line)] bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          
          <button 
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2 px-3 py-2 -ml-3 rounded-lg text-xs font-bold uppercase tracking-widest text-[var(--muted-ink)] hover:text-white hover:bg-white/5 transition-all"
          >
            <span className="text-lg leading-none mb-0.5">←</span> Back Home
          </button>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
            <img 
              src={brandLogo} 
              alt="EveryOne logo" 
              className="h-8 w-8 object-contain" 
            />
            <div className="flex flex-col items-start text-left hidden sm:flex">
              <h1 className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-xl font-black leading-none tracking-[-0.03em] text-transparent">
                EveryOne
              </h1>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted-ink)] mt-0.5">
                Model: <span className="text-white">{selectedModel.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 hidden md:flex">
            <button 
              onClick={() => onNavigate("your-models")} 
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-ink)] hover:text-white transition-colors"
            >
              Your Library
            </button>
            <div className="h-3 w-px bg-[var(--brand-line)]"></div>
            <button 
              onClick={() => onNavigate("discover")} 
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-ink)] hover:text-white transition-colors"
            >
              Discover
            </button>
          </div>

        </div>
      </header>

      {/* --- ZONE DE MESSAGES --- */}
      <main className="relative z-10 flex-1 overflow-y-auto py-12">
        <div className="mx-auto max-w-3xl space-y-8 px-6">
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            
            return (
              <div key={i} className={`smooth-fade-in flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                
                {/* Libellé du rôle */}
                <div className={`text-[10px] uppercase tracking-[0.2em] text-[var(--muted-ink)] mb-2 px-1`}>
                  {isUser ? "Researcher" : "Assistant"}
                </div>
                
                {/* Bulle de message avec contour */}
                <div 
                  className={`relative max-w-[85%] rounded-2xl px-6 py-5 text-[15px] leading-relaxed font-light ${
                    isUser 
                      ? "bg-white/5 border border-white/10 text-slate-100 rounded-tr-sm" 
                      : "bg-transparent border border-[var(--brand-line)] text-slate-200 rounded-tl-sm shadow-lg bg-black/20"
                  }`}
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    /* --- DESIGN AVANCÉ POUR LE MARKDOWN --- */
                    <div className="prose prose-invert max-w-none 
                                    prose-p:leading-relaxed prose-p:mb-4 last:prose-p:mb-0
                                    prose-headings:text-white prose-headings:font-semibold 
                                    prose-h1:text-2xl prose-h1:mb-4 
                                    prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 
                                    prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                                    prose-strong:text-white prose-strong:font-bold 
                                    prose-em:italic prose-em:text-slate-300
                                    prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                                    prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4
                                    prose-li:my-1.5 prose-li:text-slate-200
                                    prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl">
                      <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  
                  {/* Sources attachées à la bulle de l'IA */}
                  {msg.sources?.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                      {msg.sources.map((s, si) => (
                        <span key={si} className="text-[9px] border border-blue-500/30 px-2 py-1 rounded text-blue-200/80 bg-blue-500/10 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                          {s.title} (p.{s.page})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className="smooth-fade-in flex flex-col items-start">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-ink)] mb-2 px-1">
                Assistant
              </div>
              <div className="relative rounded-2xl rounded-tl-sm border border-[var(--brand-line)] bg-black/20 px-6 py-5 text-[15px] leading-relaxed font-light text-slate-200/50 shadow-lg flex items-center gap-3">
                Thinking
                <span className="flex gap-1 h-3 items-center mt-1">
                  <span className="w-1 h-1 bg-[var(--brand-purple)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-[var(--brand-purple)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-[var(--brand-purple)] rounded-full animate-bounce"></span>
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="relative z-10 p-8 pb-10 border-t border-[var(--brand-line)] bg-[var(--brand-panel-soft)]/50">
        <div className="mx-auto max-w-3xl">
          
          {contextFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-ink)] flex items-center mr-2">
                Context:
              </span>
              {contextFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/10 rounded-md text-[10px] text-white/90 shadow-sm">
                  <span className="text-green-400">✓</span>
                  <span className="truncate max-w-[150px]">{file.name || `Doc #${file.documentId}`}</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex items-center shadow-xl">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInput} 
              className="hidden" 
              accept=".pdf" 
              multiple 
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Upload PDF"
              className="absolute left-3 z-20 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted-ink)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )}
            </button>

            <input
              className="w-full bg-[#111] border border-white/10 rounded-2xl py-5 pl-14 pr-7 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-500 text-white shadow-inner"
              placeholder="Type your inquiry or drop a PDF..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
          </form>
        </div>
      </footer>
    </div>
  );
}