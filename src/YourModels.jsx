import React, { useCallback, useEffect, useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";
import { fetchLocalModels, deleteLocalModel } from "./api"; 

function normalize(text = "") {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "Unknown size";
  const gib = sizeBytes / (1024 ** 3);
  if (gib >= 1) return `${gib.toFixed(2)} GB`;
  const mib = sizeBytes / (1024 ** 2);
  return `${mib.toFixed(1)} MB`;
}

function matchCatalogModel(localModel) {
  const normalizedKey = normalize(localModel.key || "");
  const normalizedPath = normalize(localModel.path || "");

  return (
    SLM_DOWNLOADS.find((entry) => {
      const normalizedId = normalize(entry.id);
      return (
        normalizedPath.includes(normalizedId) ||
        normalizedKey.includes(normalizedId)
      );
    }) || null
  );
}

export default function YourModels({ onNavigate, onStartChat }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadModels = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const localModels = await fetchLocalModels();
      setModels(localModels);
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load local models.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleDelete = async (e, modelKey, modelName) => {
    e.stopPropagation(); 
    
    const confirmDelete = window.confirm(`Are you sure you want to delete ${modelName} from your disk?`);
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteLocalModel(modelKey);
      await loadModels();
    } catch (err) {
      alert(`Error deleting model: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BrandShell activePage="your-models" onNavigate={onNavigate} primaryLabel="Discover models" onPrimaryAction={() => onNavigate("discover")}>
      <main className="mx-auto max-w-5xl px-6 py-20 relative z-10">
        
        {/* Header style "Studio" */}
        <section className="text-center mb-16 smooth-fade-in">
          <h1 className="text-6xl font-medium tracking-tighter mb-6">
            Your <span className="text-[var(--muted-ink)]">Library.</span>
          </h1>
          <p className="text-[var(--muted-ink)] text-lg max-w-xl mx-auto font-light">
            Manage your downloaded and fine-tuned models directly from your local storage.
          </p>
          
          <div className="mt-8 flex justify-center gap-4">
            {/* Bouton Refresh Minimaliste avec icône SVG */}
            <button
              type="button"
              onClick={loadModels}
              disabled={loading || isDeleting}
              title="Refresh models list"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[var(--muted-ink)] transition-all hover:bg-white hover:text-black hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent disabled:hover:text-[var(--muted-ink)]"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className={loading ? "animate-spin" : ""}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          </div>

          {error && (
            <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100 max-w-lg mx-auto">
              {error}
            </p>
          )}
        </section>

        {/* État vide */}
        {!loading && models.length === 0 ? (
          <section className="mt-8 border border-dashed border-white/20 rounded-2xl p-16 text-center text-[var(--muted-ink)] bg-white/5 smooth-fade-in">
            <div className="text-4xl mb-4">🗄️</div>
            <p className="text-base font-medium text-white">Your library is empty</p>
            <p className="text-sm mt-2">Go to 'Discover models' to download or fine-tune your first SLM.</p>
          </section>
        ) : (
          /* Grille des modèles */
          <section className="grid gap-6 md:grid-cols-3 smooth-fade-in">
            {models.map((localModel) => {
              const catalogModel = matchCatalogModel(localModel);
              const cardId = localModel.path || localModel.key || localModel.fileName;
              
              const modelToChat = {
                id: catalogModel?.id || localModel.key,
                name: catalogModel?.name || localModel.fileName
              };

              return (
                <article
                  key={cardId}
                  className="group relative flex flex-col p-8 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-panel)] transition-all hover:bg-white/[0.02] hover:border-white/20"
                >
                  <button
                    onClick={(e) => handleDelete(e, localModel.key, modelToChat.name)}
                    disabled={isDeleting}
                    className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                    title="Delete model from disk"
                  >
                    ✖
                  </button>

                  {/* Logo + Status côte à côte, alignés à gauche */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/5">
                      {catalogModel && MODEL_LOGOS[catalogModel.id] ? (
                        <img src={MODEL_LOGOS[catalogModel.id]} alt="logo" className="h-6 w-6 object-contain" />
                      ) : (
                        <span className="text-lg">⚙️</span>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${
                        localModel.isLoaded ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-[var(--muted-ink)]"
                      }`}
                    >
                      {localModel.isLoaded ? "● Loaded" : "Offline"}
                    </span>
                  </div>
                  
                  {/* Middle: Info (Aligné à gauche) */}
                  <div className="flex-1">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-ink)] mb-2">
                      {catalogModel ? `${catalogModel.family} • ${catalogModel.size}` : "Custom GGUF"}
                    </p>
                    <h2 className="text-xl font-medium text-white mb-2 leading-tight">
                      {modelToChat.name}
                    </h2>
                    <p className="text-xs text-[var(--muted-ink)] font-light truncate mb-1" title={localModel.fileName}>
                      {localModel.fileName}
                    </p>
                    <p className="text-xs text-[var(--brand-purple-soft)] font-medium">
                      {formatSize(localModel.sizeBytes)}
                    </p>
                  </div>

                  {/* Bottom: Action */}
                  <button
                    type="button"
                    onClick={() => onStartChat && onStartChat(modelToChat, [])}
                    className="mt-6 w-full rounded-xl bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[var(--brand-purple)]"
                  >
                    Start Workspace →
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </BrandShell>
  );
}