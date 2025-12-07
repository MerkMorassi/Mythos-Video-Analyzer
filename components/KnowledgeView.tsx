
import React, { useState, useEffect, useRef } from 'react';
import { vectorDb, VectorRecord } from '../services/vectorDbService';
import { chunkText, generateEmbeddingsForChunks } from '../services/embeddingService';
import { TELEPORTER } from '../utils/numMarkX';
import { fetchModels, generateText } from '../services/geminiService';
import { Agent } from '../services/agentService';
import { UploadIcon } from './icons/UploadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { WandIcon } from './icons/WandIcon';

interface KnowledgeViewProps {
    onRunAnalysis: (type: 'SUMMARY' | 'QUESTIONS') => void;
    agent: Agent;
    onSaveSettings: (settings: Partial<Agent>) => void;
}

// A simple utility to format numbers
const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({ onRunAnalysis, agent, onSaveSettings }) => {
    const [vectorCount, setVectorCount] = useState<number>(0);
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [sources, setSources] = useState<string[]>([]);
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]);
    
    // Local state for configuration panel to avoid re-rendering App on every keystroke
    const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
    const [protectedWords, setProtectedWords] = useState(agent.protectedWords || '');
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash'); // Default model

    const fileInputRef = useRef<HTMLInputElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    const refreshStats = async () => {
        const count = await vectorDb.getVectorCount();
        setVectorCount(count);
        const vectors = await vectorDb.getAllVectors();
        const uniqueSources = Array.from(new Set(vectors.map(v => v.source)));
        setSources(uniqueSources);
        TELEPORTER.rebuildIndex(vectors); // Always keep teleporter in sync
    };

    useEffect(() => {
        refreshStats();
        handleFetchModels();
    }, []);

    const handleFetchModels = async () => {
        try {
            const models = await fetchModels();
            setAvailableModels(models);
        } catch (error) {
            console.error("Failed to fetch models:", error);
        }
    };

    const handleSavePersona = () => {
        onSaveSettings({ systemPrompt });
        // Optionally add a "saved" confirmation message
    };
    
    const handleSaveGlossary = () => {
        onSaveSettings({ protectedWords });
    };

    const processJsonContent = (json: any): string => {
        // This function recursively traverses a JSON object/array and flattens it into text.
        if (typeof json === 'string') return json;
        if (typeof json === 'number' || typeof json === 'boolean') return String(json);
        if (Array.isArray(json)) {
            return json.map(item => processJsonContent(item)).join('\n\n');
        }
        if (typeof json === 'object' && json !== null) {
            return Object.entries(json).map(([key, val]) => `${key}: ${processJsonContent(val)}`).join('\n');
        }
        return '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const smartIngest = (document.getElementById('smartIngest') as HTMLInputElement)?.checked;
        
        setIsIngesting(true);
        setProgress(0);
        setStatusMessage('Initializing...');
        
        const files: File[] = Array.from(e.target.files);
        let allNewVectors: VectorRecord[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file: File = files[i];
                let textToChunk = await file.text();
                
                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        const jsonData = JSON.parse(textToChunk);
                        // FIX: Added more robust type checking for JSON restore files.
                        if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0] && typeof jsonData[0] === 'object' && jsonData[0] !== null && 'vector' in jsonData[0]) {
                            setStatusMessage(`Restoring backup: ${file.name}`);
                            await vectorDb.addVectors(jsonData as VectorRecord[]);
                            await refreshStats();
                            continue; // Skip to next file
                        } else {
                            textToChunk = processJsonContent(jsonData);
                        }
                    } catch (err) {
                        console.error(`Could not parse JSON from ${file.name}. Treating as text.`, err);
                        setStatusMessage(`Could not parse JSON from ${file.name}. Treating as text.`);
                    }
                }
                
                if (smartIngest) {
                    const CLEAN_BATCH = 30000; // Character limit per cleaning batch
                    const batches = [];
                    for(let c=0; c < textToChunk.length; c += CLEAN_BATCH) {
                        batches.push(textToChunk.slice(c, c + CLEAN_BATCH));
                    }

                    const cleanedBatches = [];
                    for(let j=0; j<batches.length; j++) {
                        setStatusMessage(`AI Cleaning ${file.name} (Batch ${j+1}/${batches.length})`);
                        const prompt = `TASK: Clean and structure this text. Fix typos, improve grammar. DO NOT CHANGE THESE WORDS: ${agent.protectedWords || 'None'}. Text: ${batches[j]}`;
                        const cleaned = await generateText(prompt);
                        cleanedBatches.push(cleaned);
                        setProgress((i / files.length) * 50 + ((j+1)/batches.length) * (50 / files.length));
                    }
                    textToChunk = cleanedBatches.join(" ");
                }

                const chunks = chunkText(textToChunk);
                for (let j = 0; j < chunks.length; j++) {
                    const cleaningProgress = smartIngest ? 50 : 0;
                    setStatusMessage(`Vectorizing ${file.name} (Chunk ${j+1}/${chunks.length})`);
                    // FIX: Deconstructed variable `embedded` could be of `unknown` type if type inference fails.
                    // Split into two lines for clarity and safer type handling.
                    const embeddedResult = await generateEmbeddingsForChunks([chunks[j]]);
                    const embedded = embeddedResult[0];

                    if (embedded) {
                        allNewVectors.push({
                            id: Date.now() + Math.random(),
                            text: embedded.text,
                            vector: embedded.vector,
                            source: file.name,
                            timestamp: Date.now()
                        });
                    }
                    setProgress(cleaningProgress + (i / files.length) * (100-cleaningProgress) + ((j+1)/chunks.length) * ((100-cleaningProgress) / files.length));
                }
            }
            if (allNewVectors.length > 0) {
                 await vectorDb.addVectors(allNewVectors);
            }

            await refreshStats();
            setStatusMessage('Ingestion complete!');
        } catch (error) {
            console.error("Ingestion error:", error);
            // FIX: Add type guard for `error` which is of type `unknown` in a catch block.
            if (error instanceof Error) {
                setStatusMessage(`Error during ingestion: ${error.message}. Check console.`);
            } else {
                setStatusMessage('Error during ingestion. Check console.');
            }
        } finally {
            setTimeout(() => {
                setIsIngesting(false);
                setProgress(0);
                setStatusMessage('');
            }, 3000);
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
        const blob = new Blob([JSON.stringify(vectors, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mythos_vault_backup_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-text-primary">Knowledge Base (Mythos Vault)</h2>
                <p className="text-text-secondary">Manage the agent's "digital soul" — its memories and operational protocols.</p>
            </div>
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Configuration & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* 01 / Configuration */}
                    <div className="bg-secondary/30 border border-accent rounded-xl p-4">
                        <h3 className="text-sm uppercase tracking-wider font-bold text-text-secondary border-b border-accent pb-2 mb-4">01 / Configuration</h3>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button onClick={handleFetchModels} className="flex-1 text-xs uppercase font-bold bg-secondary border border-accent text-text-secondary hover:text-white hover:border-brand-hover p-2 rounded-xl transition-all">Fetch Models</button>
                                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="flex-[2] bg-primary border border-accent text-text-primary p-2 rounded-xl outline-none cursor-pointer text-xs">
                                    {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary mb-1 block">System Instructions (Persona)</label>
                                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} className="w-full bg-primary border border-accent p-2 rounded-xl text-text-primary focus:border-brand outline-none resize-y text-xs"></textarea>
                                <button onClick={handleSavePersona} className="w-full mt-1 bg-secondary border border-accent text-text-secondary hover:text-white p-1.5 rounded-xl text-xs uppercase font-bold transition-all">Save Persona</button>
                            </div>
                             <div>
                                <label className="text-xs text-text-secondary mb-1 block">Protected Words (Glossary)</label>
                                <textarea value={protectedWords} onChange={e => setProtectedWords(e.target.value)} rows={3} className="w-full bg-primary border border-accent p-2 rounded-xl text-text-primary focus:border-brand outline-none resize-y text-xs"></textarea>
                                <button onClick={handleSaveGlossary} className="w-full mt-1 bg-secondary border border-accent text-text-secondary hover:text-white p-1.5 rounded-xl text-xs uppercase font-bold transition-all">Save Glossary</button>
                            </div>
                            <div className="text-xs text-text-secondary pt-2 border-t border-accent">
                                Database: {formatNumber(vectorCount)} vectors
                            </div>
                        </div>
                    </div>
                    {/* Database Actions */}
                    <div className="bg-secondary/30 border border-accent rounded-xl p-4">
                        <h3 className="text-sm uppercase tracking-wider font-bold text-text-secondary border-b border-accent pb-2 mb-4">Database Actions</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="file" ref={restoreInputRef} accept=".json" className="hidden" onChange={handleFileSelect} />
                            <button onClick={() => restoreInputRef.current?.click()} className="flex items-center justify-center gap-2 bg-secondary border border-accent text-text-secondary hover:text-white p-2 rounded-xl text-xs uppercase font-bold"><UploadIcon className="w-3 h-3"/> Import</button>
                            <button onClick={handleExport} className="bg-secondary border border-accent text-text-secondary hover:text-white p-2 rounded-xl text-xs uppercase font-bold">Export</button>
                            <button onClick={handlePurge} className="col-span-2 flex items-center justify-center gap-2 bg-red-900/20 border border-red-900/50 text-red-400 hover:bg-red-900/40 p-2 rounded-xl text-xs uppercase font-bold transition-all"><TrashIcon className="w-3 h-3"/> Purge All</button>
                        </div>
                    </div>
                </div>

                {/* Right Column - Ingestion & Analytics */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 02 / Knowledge Ingestion */}
                     <div className="bg-secondary/30 border border-accent rounded-xl p-4">
                        <h3 className="text-sm uppercase tracking-wider font-bold text-text-secondary border-b border-accent pb-2 mb-4">02 / Knowledge Ingestion</h3>
                        <div className="space-y-4">
                            <input type="file" ref={fileInputRef} multiple accept=".txt,.json,.md,.csv" className="hidden" onChange={handleFileSelect} />
                             <button onClick={() => !isIngesting && fileInputRef.current?.click()} disabled={isIngesting} className="w-full border-2 border-dashed border-accent p-6 rounded-xl text-text-secondary hover:border-brand hover:text-brand transition-all text-center disabled:cursor-wait">
                                <span id="fileLabel">Click to select files (.txt, .json, .md)</span>
                            </button>
                            <div className="flex items-center gap-2 p-2 border border-accent rounded-xl bg-primary/30">
                                <input type="checkbox" id="smartIngest" className="accent-brand cursor-pointer w-4 h-4" />
                                <label htmlFor="smartIngest" className="text-xs text-text-secondary cursor-pointer select-none">Smart Ingest (AI Clean & Structure Data)</label>
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
                    </div>
                    {/* 04 / AI Analytics */}
                    <div className="bg-secondary/30 border border-accent rounded-xl p-4">
                        <h3 className="text-sm uppercase tracking-wider font-bold text-text-secondary border-b border-accent pb-2 mb-4">04 / AI Analytics</h3>
                         <p className="text-xs text-text-secondary mb-4">Run analysis on a sample of the entire knowledge base to get insights.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => onRunAnalysis('SUMMARY')} className="flex items-center justify-center gap-2 bg-secondary border border-accent text-text-secondary hover:text-white p-3 rounded-xl text-xs uppercase font-bold"><WandIcon className="w-4 h-4"/> Summarize</button>
                            <button onClick={() => onRunAnalysis('QUESTIONS')} className="flex items-center justify-center gap-2 bg-secondary border border-accent text-text-secondary hover:text-white p-3 rounded-xl text-xs uppercase font-bold"><WandIcon className="w-4 h-4"/> Suggest Q's</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
