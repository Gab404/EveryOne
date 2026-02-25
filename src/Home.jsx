import React, { useEffect, useMemo, useRef, useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";
import { 
  ingestSinglePdf, 
  initializeBackend, 
  downloadFinetunedModel, 
  startFinetuning,
  checkFinetuneStatus,
  cancelFinetuneJob
} from "./api";

export default function Home({ onNavigate, onStartChat }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  
  const [isTraining, setIsTraining] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modalStatus, setModalStatus] = useState("");

  const [ftJob, setFtJob] = useState(() => {
    const saved = localStorage.getItem("finetune_job");
    return saved ? JSON.parse(saved) : null;
  });
  
  const fileInputRef = useRef(null);

  useEffect(() => { initializeBackend().catch(() => {}); }, []);

  useEffect(() => {
    let intervalId;

    if (ftJob?.status === 'running' && ftJob?.id) {
      intervalId = setInterval(async () => {
        try {
          const statusData = await checkFinetuneStatus(ftJob.id);
          
          setFtJob((prevJob) => {
            if (!prevJob) return null;
            
            const currentProgress = statusData.progress || 0;
            
            if (statusData.status === 'completed' || currentProgress >= 100) {
              const completedJob = { ...prevJob, status: 'completed', progress: 100 };
              localStorage.setItem("finetune_job", JSON.stringify(completedJob));
              setModalStatus("✅ Training complete! Ready to download.");
              clearInterval(intervalId);
              return completedJob;
            } else {
              const updatedJob = { ...prevJob, progress: currentProgress };
              localStorage.setItem("finetune_job", JSON.stringify(updatedJob));
              setModalStatus(`⚙️ Training in progress... ${currentProgress}%`);
              return updatedJob;
            }
          });
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 3000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [ftJob?.id, ftJob?.status]);

  const visibleModels = useMemo(() => SLM_DOWNLOADS.slice(0, 3), []);

  const handleProcessFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) return alert("Please upload PDF files only.");

    setIsIngesting(true);
    
    for (const file of pdfFiles) {
      try {
        const res = await ingestSinglePdf(file);
        setUploadedFiles(prev => [...prev, { name: file.name, ...res }]);
      } catch (err) { 
        alert(`Error with ${file.name}: ${err.message}`); 
      }
    }
    setIsIngesting(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleProcessFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    handleProcessFiles(e.target.files);
    e.target.value = ""; 
  };

  const handleStartFinetune = async () => {
    if (!selectedModel) return;
    setIsTraining(true);
    setModalStatus("🚀 Initializing containers...");
    
    try {
      const data = await startFinetuning({ datasetName: "cybersec" });
      if (data.job_id) {
        const newJob = { id: data.job_id, status: 'running', progress: 0 };
        setFtJob(newJob);
        localStorage.setItem("finetune_job", JSON.stringify(newJob));
        setModalStatus(`⚙️ Training in progress`);
      }
    } catch (err) {
      setModalStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  const handleSyncFinetune = async () => {
    const name = prompt("Name of the model to download from Modal:", "my-finetuned-model");
    if (!name) return;
    
    setIsDownloading(true);
    setModalStatus("⬇️ Downloading GGUF...");
    try {
      await downloadFinetunedModel({ customName: name });
      setModalStatus(`✅ Available in 'Your Models'.`);
      
      const updatedJob = { ...ftJob, status: 'completed' };
      setFtJob(updatedJob);
      localStorage.setItem("finetune_job", JSON.stringify(updatedJob));
    } catch (err) {
      setModalStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClearJob = async () => {
    if (ftJob && ftJob.id && ftJob.status === 'running') {
      try {
        setModalStatus("🛑 Cancelling job...");
        await cancelFinetuneJob(ftJob.id);
      } catch (err) {
        console.error("Error cancelling:", err);
      }
    }
    setFtJob(null);
    localStorage.removeItem("finetune_job");
    setModalStatus("🚫 Job cancelled.");
    setTimeout(() => {
      setModalStatus((prev) => prev === "🚫 Job cancelled." ? "" : prev);
    }, 3000);
  };
  
  return (
    <BrandShell activePage="home" onNavigate={onNavigate} primaryLabel="Your Library" onPrimaryAction={() => onNavigate("your-models")}>
      {/* NOUVEAU : onClick sur le main pour tout désélectionner quand on clique dans le vide */}
      <main 
        className="mx-auto max-w-5xl px-6 py-20 relative z-10"
        onClick={() => setSelectedModel(null)}
      >
        
        <section className="text-center mb-16 smooth-fade-in">
          <h1 className="text-6xl font-medium tracking-tighter mb-6">
            Local Intelligence. <span className="text-[var(--muted-ink)]">Studio.</span>
          </h1>
          <p className="text-[var(--muted-ink)] text-lg max-w-xl mx-auto font-light">
            Train, deploy, and chat with private models in a single workspace.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-start">
          {visibleModels.map((model) => {
            const isSelected = selectedModel?.id === model.id;

            return (
              <article
                key={model.id}
                // NOUVEAU : e.stopPropagation() pour éviter que le clic ne remonte au <main>
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedModel(model);
                }}
                className={`flex flex-col p-8 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected 
                    ? "border-white bg-white/[0.04] shadow-[0_0_30px_rgba(255,255,255,0.05)] ring-1 ring-white/10" 
                    : "border-[var(--brand-line)] hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/5">
                    <img 
                      src={MODEL_LOGOS[model.id]} 
                      alt={`${model.family} logo`} 
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted-ink)]">{model.family}</p>
                </div>

                <h3 className="text-xl font-medium mb-2">{model.name}</h3>
                <p className={`text-sm text-[var(--muted-ink)] font-light ${isSelected ? "mb-6" : "line-clamp-2"}`}>
                  {model.description}
                </p>

                {isSelected && (
                  <div 
                    className="flex flex-col gap-3 mt-auto border-t border-white/10 pt-6 animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <button 
                      onClick={() => onStartChat(selectedModel, uploadedFiles)}
                      className="w-full bg-white text-black py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:scale-[1.02] transition-transform shadow-lg"
                    >
                      Open Workspace →
                    </button>

                    {/* Zone Fine-Tuning */}
                    {!ftJob ? (
                      <button 
                        onClick={handleStartFinetune}
                        disabled={isTraining}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          isTraining ? "border-purple-500 text-purple-500 animate-pulse bg-purple-500/10" : "border-white/10 hover:bg-white/10 hover:text-white text-[var(--muted-ink)]"
                        }`}
                      >
                        {isTraining ? "Starting Job..." : "⚙️ Fine-Tune Model"}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-3 px-4 py-2.5 border border-orange-500/30 bg-orange-500/5 rounded-xl">
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[9px] font-bold uppercase text-orange-400">
                                {ftJob.status === 'running' ? "Training" : "Complete"}
                              </span>
                              <span className="text-[9px] font-bold text-orange-300">{ftJob.progress || 0}%</span>
                            </div>
                            <div className="h-1 w-full bg-orange-500/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(249,115,22,0.8)]"
                                style={{ width: `${ftJob.progress || 0}%` }}
                              ></div>
                            </div>
                          </div>
                          <button onClick={handleClearJob} className="text-white/40 hover:text-red-400 transition" title="Clear Job">✖</button>
                        </div>

                        <button 
                          onClick={handleSyncFinetune}
                          disabled={isDownloading}
                          className="w-full mt-1 text-[10px] font-bold uppercase tracking-widest border border-blue-500/30 bg-blue-500/10 py-2.5 rounded-xl hover:bg-blue-500 hover:text-white transition-colors"
                        >
                          {isDownloading ? "Downloading..." : "⬇️ Download GGUF"}
                        </button>
                      </div>
                    )}

                    {modalStatus && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="h-1 w-1 rounded-full bg-white animate-ping" />
                        <p className="text-[9px] text-[var(--muted-ink)] uppercase tracking-widest truncate">{modalStatus}</p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {/* NOUVEAU : e.stopPropagation() sur la zone de drop pour que cliquer dessus ne désélectionne pas le modèle, 
            si tu préfères que cliquer sur la zone de drop DÉSÉLECTIONNE le modèle, enlève simplement le onClick ci-dessous */}
        <div onClick={(e) => e.stopPropagation()}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              dragActive ? "border-white bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "border-[var(--brand-line)] hover:border-[var(--muted-ink)]"
            }`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" accept=".pdf" multiple />
            
            <div className="text-4xl mb-4">{isIngesting ? "⏳" : "📄"}</div>
            <p className="text-base font-medium text-white">
              {isIngesting ? "Indexing your documents..." : "Drag & Drop PDFs to update context"}
            </p>
            <p className="text-xs text-[var(--muted-ink)] mt-2">Or click to browse files from your computer</p>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-6 p-4 rounded-xl border border-[var(--brand-line)] bg-white/[0.02]">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted-ink)] mb-3">
                Context Loaded ({uploadedFiles.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs">
                    <span className="text-green-400">✓</span>
                    <span className="truncate max-w-[200px] text-white/90">
                      {file.name || `Document #${file.documentId}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </BrandShell>
  );
}