
import React, { useState, useEffect, useRef } from 'react';
import { vectorDb, VectorRecord } from '../services/vectorDbService';
import { chunkText, generateEmbeddingsForChunks } from '../services/embeddingService';
import { TELEPORTER } from '../utils/numMarkX';
import { fetchModels, generateText } from '../services/geminiService';
import { Agent } from '../services/agentService';
import { UploadIcon } from './icons/UploadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { WandIcon } from './icons/WandIcon';
import { getApiKey, saveApiKey } from '../services/apiKeyService';
import { WarningIcon } from './icons/WarningIcon';

interface KnowledgeViewProps {
    onRunAnalysis: (type: 'SUMMARY' | 'QUESTIONS') => void;
    agent: Agent;
    onSaveSettings: (settings: Partial<Agent>) => void;
    onApiKeyUpdate: () => void;
    hasApiKey: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

const CollapsibleSection: React.FC<{ title: string; number: string; children: React.ReactNode, startOpen?: boolean }> = ({ title, number, children, startOpen = false }) => {
    const [isOpen, setIsOpen] = useState(startOpen);
    return (
        <div className="bg-secondary/30 border border-accent rounded-xl">
            <div className="flex justify-between items-center cursor-pointer p-4" onClick={() => setIsOpen(!isOpen)}>
                <h3 className="text-sm uppercase tracking-wider font-bold text-text-secondary">{number} / {title}</h3>
                <span className="text-text-secondary text-lg">{isOpen ? '−' : '+'}</span>
            </div>
            {isOpen && (
                <div className="p-4 border-t border-accent animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({ onRunAnalysis, agent, onSaveSettings, onApiKeyUpdate, hasApiKey }) => {
    const [vectorCount, setVectorCount] = useState<number>(0);
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [sources, setSources] = useState<string[]>([]);
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]);
    
    const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
    const [protectedWords, setProtectedWords] = useState(agent.protectedWords || '');
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
    const [apiKeyInput, setApiKeyInput] = useState('');
    
    const [keySaveStatus, setKeySaveStatus] = useState<SaveStatus>('idle');
    const [personaSavaStatus, setPersonaSaveStatus] = useState<SaveStatus>('idle');
    const [glossarySaveStatus, setGlossarySaveStatus] = useState<SaveStatus>('idle');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const glossaryInputRef = useRef<HTMLInputElement>(null);

    const refreshStats = async () => {
        const allVectors = await vectorDb.getAllVectors();
        setVectorCount(allVectors.length);
        const uniqueSources = Array.from(new Set(allVectors.map(v => v.source)));
        setSources(uniqueSources);
        TELEPORTER.rebuildIndex(allVectors);
    };

    useEffect(() => {
        refreshStats();
        if (hasApiKey) handleFetchModels();
    }, [hasApiKey]);

    const handleFetchModels = async () => {
        try {
            const models = await fetchModels();
            setAvailableModels(models);
        } catch (error) {
            console.error("Failed to fetch models:", error);
        }
    };
    
    const handleSaveWithFeedback = (saveFn: () => void, setStatus: React.Dispatch<React.SetStateAction<SaveStatus>>) => {
        setStatus('saving');
        saveFn();
        setTimeout(() => {
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        }, 500);
    };

    // Fix: Add handleSaveKey function definition
    const handleSaveKey = () => {
        if (!apiKeyInput.trim()) return;
        handleSaveWithFeedback(() => {
            saveApiKey(apiKeyInput);
            onApiKeyUpdate();
        }, setKeySaveStatus);
    };

    const processJsonContent = (json: any): string => {
        // This function is for extracting text from arbitrary JSON for embedding, not for restoring backups.
        if (typeof json === 'string') return json;
        if (typeof json === 'number' || typeof json === 'boolean') return String(json);
        if (Array.isArray(json)) return json.map(item => processJsonContent(item)).join('\n\n');
        if (typeof json === 'object' && json !== null) {
            return Object.entries(json).map(([key, val]) => `${key}: ${processJsonContent(val)}`).join('\n');
        }
        return '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        const smartIngest = (document.getElementById('smartIngest') as HTMLInputElement)?.checked;
        setIsIngesting(true);
        setProgress(0);
        setStatusMessage('Initializing...');
        
        try {
            let totalChunks = 0;
            const filesAndChunks = await Promise.all(files.map(async file => {
                let text = await file.text();
                // Handle JSON as content, not backup
                if(file.name.toLowerCase().endsWith('.json')) {
                   try {
                     const jsonData = JSON.parse(text);
                      // Check if it's a backup file
                      if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0]?.vector) {
                         setStatusMessage(`Restoring backup: ${file.name}`);
                         await vectorDb.addVectors(jsonData as VectorRecord[]);
                         return null; // Skip further processing for this file
                      }
                      text = processJsonContent(jsonData);
                   } catch(e) { /* treat as text */ }
                }

                if (smartIngest) {
                    setStatusMessage(`AI Cleaning ${file.name}...`);
                    const prompt = `TASK: Clean and structure this text. Fix typos, improve grammar. DO NOT CHANGE THESE WORDS: ${agent.protectedWords || 'None'}. Text: ${text.substring(0, 30000)}`;
                    text = await generateText(prompt);
                }
                const chunks = chunkText(text);
                totalChunks += chunks.length;
                return { file, chunks };
            }));

            let processedChunks = 0;
            for (const fileData of filesAndChunks) {
                if (!fileData) continue; // Skip backup files that were already processed
                const { file, chunks } = fileData;
                const newVectors: VectorRecord[] = [];
                for (let i = 0; i < chunks.length; i++) {
                    setStatusMessage(`Vectorizing ${file.name} (${i + 1}/${chunks.length})`);
                    const embeddedResult = await generateEmbeddingsForChunks([chunks[i]]);
                    if (embeddedResult.length > 0) {
                        newVectors.push({
                            id: Date.now() + Math.random(),
                            text: embeddedResult[0].text,
                            vector: embeddedResult[0].vector,
                            source: file.name,
                            timestamp: Date.now()
                        });
                    }
                    processedChunks++;
                    setProgress((processedChunks / totalChunks) * 100);
                }
                if (newVectors.length > 0) await vectorDb.addVectors(newVectors);
            }
            await refreshStats();
            setStatusMessage('Ingestion complete!');
        } catch (error) {
            setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setTimeout(() => setIsIngesting(false), 3000);
            if (e.target) e.target.value = '';
        }
    };
    
    const handleRestoreGlossary = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            let newWords: string[] = [];
            if(file.name.endsWith('.json')) {
                const data = JSON.parse(text);
                const extractStrings = (obj: any): string[] => {
                   if (typeof obj === 'string') return [obj];
                   if (Array.isArray(obj)) return obj.flatMap(extractStrings);
                   if (typeof obj === 'object' && obj !== null) return Object.values(obj).flatMap(extractStrings);
                   return [];
                }
                newWords = extractStrings(data);
            } else {
                newWords = text.split(/[\n,;]/).map(w => w.trim()).filter(Boolean);
            }
            const currentWords = protectedWords.split(/[\n,;]/).map(w => w.trim()).filter(Boolean);
            const merged = Array.from(new Set([...currentWords, ...newWords]));
            setProtectedWords(merged.join(', '));
        } catch (err) {
            console.error("Failed to import glossary", err);
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const handlePurge = async () => {
        if (window.confirm("Purge Knowledge Base? This will delete all ingested vectors.")) {
            await vectorDb.clearVectors();
            await refreshStats();
        }
    };
    
    const handleExport = async () => {
        const vectors = await vectorDb.getAllVectors();
        if (vectors.length === 0) return alert("Knowledge Base is empty.");

        try {
            // @ts-ignore - for showSaveFilePicker
            if (window.showSaveFilePicker) {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: `mythos_vault_backup_${Date.now()}.json`,
                    types: [{ description: 'JSON Archive', accept: { 'application/json': ['.json'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write('[\n');
                for (let i = 0; i < vectors.length; i++) {
                    await writable.write(JSON.stringify(vectors[i]));
                    if (i < vectors.length - 1) await writable.write(',\n');
                }
                await writable.write('\n]');
                await writable.close();
            } else { // Fallback for older browsers
                const blob = new Blob([JSON.stringify(vectors)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `mythos_vault_backup_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error("Export failed:", err);
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-widest text-text-secondary">MYTHOS VAULT</h1>
                <p className="text-xs text-text-secondary/70">NOETIC SOVEREIGNTY ENGINE</p>
            </div>
            {!hasApiKey && <WarningBanner />}

            <CollapsibleSection number="01" title="Configuration" startOpen={true}>
                <div className="space-y-4">
                     {/* API KEY, MODELS, PERSONA, GLOSSARY */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs text-text-secondary mb-1 block">Gemini API Key</label>
                           <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Paste Key & Save" className="w-full bg-primary border border-accent p-2 rounded-xl text-xs" />
                           <button onClick={handleSaveKey} disabled={!apiKeyInput.trim() || keySaveStatus !== 'idle'} className="w-full bg-secondary border border-accent text-text-secondary hover:text-white p-1.5 rounded-xl text-xs uppercase font-bold disabled:opacity-50">
                                {keySaveStatus === 'idle' ? 'Save Key' : (keySaveStatus === 'saving' ? '...' : '✓ Saved!')}
                           </button>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-text-secondary mb-1 block">Model Selection</label>
                            <div className="flex gap-2">
                                <button onClick={handleFetchModels} disabled={!hasApiKey} className="flex-1 text-xs uppercase font-bold bg-secondary border border-accent text-text-secondary hover:text-white p-2 rounded-xl disabled:opacity-50">Fetch Models</button>
                                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!hasApiKey} className="flex-[2] bg-primary border border-accent text-text-primary p-2 rounded-xl text-xs disabled:opacity-50">
                                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-text-secondary mb-1 block">System Instructions (Persona)</label>
                            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} className="w-full bg-primary border border-accent p-2 rounded-xl text-xs resize-y"></textarea>
                            <button onClick={() => handleSaveWithFeedback(() => onSaveSettings({ systemPrompt }), setPersonaSaveStatus)} disabled={personaSavaStatus !== 'idle'} className="w-full mt-1 bg-secondary border border-accent text-text-secondary hover:text-white p-1.5 rounded-xl text-xs uppercase font-bold disabled:opacity-50">
                                {personaSavaStatus === 'idle' ? 'Save Persona' : (personaSavaStatus === 'saving' ? '...' : '✓ Saved!')}
                            </button>
                        </div>
                         <div>
                            <label className="text-xs text-text-secondary mb-1 block">Protected Words (Glossary)</label>
                            <textarea value={protectedWords} onChange={e => setProtectedWords(e.target.value)} rows={4} className="w-full bg-primary border border-accent p-2 rounded-xl text-xs resize-y"></textarea>
                             <div className="flex gap-2 mt-1">
                                <button onClick={() => handleSaveWithFeedback(() => onSaveSettings({ protectedWords }), setGlossarySaveStatus)} disabled={glossarySaveStatus !== 'idle'} className="flex-1 bg-secondary border border-accent text-text-secondary hover:text-white p-1.5 rounded-xl text-xs uppercase font-bold disabled:opacity-50">
                                     {glossarySaveStatus === 'idle' ? 'Save Glossary' : (glossarySaveStatus === 'saving' ? '...' : '✓ Saved!')}
                                </button>
                                <input type="file" ref={glossaryInputRef} accept=".txt,.json" className="hidden" onChange={handleRestoreGlossary} />
                                <button onClick={() => glossaryInputRef.current?.click()} className="flex-1 bg-secondary border border-accent text-text-secondary hover:text-white p-1.5 rounded-xl text-xs uppercase font-bold">Import Glossary</button>
                             </div>
                        </div>
                     </div>
                     <div className="flex justify-between items-center text-xs text-text-secondary pt-2 border-t border-accent">
                        <span>DB: {vectorCount.toLocaleString()} vectors</span>
                        <span>{hasApiKey ? 'API Key: Loaded' : 'API Key: Not Set'}</span>
                    </div>
                     <div className="grid grid-cols-3 gap-2">
                        <input type="file" ref={restoreInputRef} accept=".json" className="hidden" onChange={handleFileSelect} />
                        <button onClick={() => restoreInputRef.current?.click()} className="flex items-center justify-center gap-2 bg-secondary border border-accent text-text-secondary hover:text-white p-2 rounded-xl text-xs uppercase font-bold"><UploadIcon className="w-3 h-3"/> Import DB</button>
                        <button onClick={handleExport} className="bg-secondary border border-accent text-text-secondary hover:text-white p-2 rounded-xl text-xs uppercase font-bold">Export DB</button>
                        <button onClick={handlePurge} className="flex items-center justify-center gap-2 bg-red-900/20 border border-red-900/50 text-red-400 hover:bg-red-900/40 p-2 rounded-xl text-xs uppercase font-bold"><TrashIcon className="w-3 h-3"/> Purge DB</button>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection number="02" title="Knowledge Ingestion (Forge)">
                 <div className="space-y-4">
                    <input type="file" ref={fileInputRef} multiple accept=".txt,.json,.md,.csv" className="hidden" onChange={handleFileSelect} />
                     <button onClick={() => !isIngesting && fileInputRef.current?.click()} disabled={isIngesting || !hasApiKey} className="w-full border-2 border-dashed border-accent p-6 rounded-xl text-text-secondary hover:border-brand hover:text-brand transition-all text-center disabled:cursor-wait disabled:opacity-50">
                        <span>Click to select files (.txt, .json, .md)</span>
                    </button>
                    <div className="flex items-center gap-2 p-2 border border-accent rounded-xl bg-primary/30">
                        <input type="checkbox" id="smartIngest" className="accent-brand cursor-pointer w-4 h-4" disabled={!hasApiKey} />
                        <label htmlFor="smartIngest" className={`text-xs cursor-pointer select-none ${!hasApiKey ? 'text-text-secondary/50' : 'text-text-secondary'}`}>Smart Ingest (AI Clean & Structure Data)</label>
                    </div>
                    {isIngesting && (
                        <div className="w-full bg-primary border border-accent h-6 rounded-lg relative overflow-hidden">
                            <div className="h-full bg-brand/50 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-wider">{statusMessage}</div>
                        </div>
                    )}
                    <div>
                        <h4 className="text-xs text-text-secondary mb-2">Active Sources:</h4>
                        <div className="flex flex-wrap gap-2 min-h-[24px]">
                            {sources.length > 0 ? sources.map(s => <span key={s} className="bg-secondary border border-accent text-text-secondary text-[10px] px-2 py-1 rounded-md">{s}</span>) : <span className="text-xs text-text-secondary/50 italic">No sources loaded</span>}
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection number="04" title="AI Analytics">
                 <p className="text-xs text-text-secondary mb-4">Run analysis on a sample of the entire knowledge base to get insights.</p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => onRunAnalysis('SUMMARY')} disabled={!hasApiKey || vectorCount === 0} className="flex items-center justify-center gap-2 bg-secondary border border-accent text-text-secondary hover:text-white p-3 rounded-xl text-xs uppercase font-bold disabled:opacity-50"><WandIcon className="w-4 h-4"/> Summarize</button>
                    <button onClick={() => onRunAnalysis('QUESTIONS')} disabled={!hasApiKey || vectorCount === 0} className="flex items-center justify-center gap-2 bg-secondary border border-accent text-text-secondary hover:text-white p-3 rounded-xl text-xs uppercase font-bold disabled:opacity-50"><WandIcon className="w-4 h-4"/> Suggest Q's</button>
                </div>
            </CollapsibleSection>
        </div>
    );
};

const WarningBanner = () => (
     <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-start gap-3 text-yellow-200 animate-fade-in">
        <WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-sm">
            <span className="font-bold">Action Required:</span> Most features are disabled. Please set your Gemini API Key in the Configuration panel below to proceed.
        </p>
    </div>
);
