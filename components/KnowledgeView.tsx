
import React, { useState, useEffect, useRef } from 'react';
import { vectorDb, VectorRecord } from '../services/vectorDbService';
import { chunkText, generateEmbeddingsForChunks } from '../services/embeddingService';
import { TELEPORTER } from '../utils/numMarkX';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { getAvailableModels } from '../services/geminiService';

export const KnowledgeView: React.FC = () => {
    const [vectorCount, setVectorCount] = useState<number>(0);
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [sources, setSources] = useState<string[]>([]);
    const [availableModels, setAvailableModels] = useState<{ displayName: string, name: string }[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshStats = async () => {
        const count = await vectorDb.getVectorCount();
        setVectorCount(count);
        const vectors = await vectorDb.getAllVectors();
        const uniqueSources = Array.from(new Set(vectors.map(v => v.source)));
        setSources(uniqueSources);
    };

    useEffect(() => {
        refreshStats();
        // Check for available models on load
        getAvailableModels().then(models => {
            setAvailableModels(models);
        }).catch(err => console.error("Failed to fetch models", err));
    }, []);

    // Helper to extract text from arbitrary JSON
    const processJsonContent = (json: any): string => {
        if (typeof json === 'string') return json;
        if (typeof json === 'number' || typeof json === 'boolean') return String(json);
        if (Array.isArray(json)) {
            return json.map(item => processJsonContent(item)).join('\n');
        }
        if (typeof json === 'object' && json !== null) {
            return Object.values(json).map(val => processJsonContent(val)).join('\n');
        }
        return '';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        setIsIngesting(true);
        setProgress(0);
        setStatusMessage('Initializing ingestion...');
        
        const files = Array.from(e.target.files);
        const totalFiles = files.length;
        
        try {
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                setStatusMessage(`Processing ${file.name} (${i + 1}/${totalFiles})...`);
                
                const rawText = await file.text();
                // Basic check for empty or non-text files
                if (!rawText.trim()) continue;

                let textToChunk = rawText;
                let isVectorBackup = false;

                // SPECIAL HANDLING FOR JSON
                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        const jsonData = JSON.parse(rawText);
                        
                        // Check if this is a DB Backup (Array of VectorRecords)
                        // A simple heuristic: check if the first item has 'vector' and 'text' keys
                        if (Array.isArray(jsonData) && jsonData.length > 0 && 'vector' in jsonData[0] && 'text' in jsonData[0]) {
                             setStatusMessage(`Restoring Vector Backup from ${file.name}...`);
                             const records = jsonData as VectorRecord[];
                             await vectorDb.addVectors(records);
                             TELEPORTER.rebuildIndex(records);
                             isVectorBackup = true; // Skip embedding
                        } else {
                            // Treat as structured data source - flatten to text
                            setStatusMessage(`Parsing structured data from ${file.name}...`);
                            textToChunk = processJsonContent(jsonData);
                        }

                    } catch (err) {
                        console.warn(`Failed to parse JSON from ${file.name}, treating as plain text.`);
                    }
                }

                if (isVectorBackup) {
                    setProgress(((i + 1) / totalFiles) * 100);
                    continue; // Skip the chunking/embedding pipeline
                }

                const chunks = chunkText(textToChunk);
                
                setStatusMessage(`Embedding ${chunks.length} segments from ${file.name}...`);
                
                const embeddedChunks = await generateEmbeddingsForChunks(chunks);
                
                const records: VectorRecord[] = embeddedChunks.map(ec => ({
                    id: Date.now() + Math.random(),
                    text: ec.text,
                    vector: ec.vector,
                    source: file.name,
                    timestamp: Date.now()
                }));
                
                if (records.length > 0) {
                    await vectorDb.addVectors(records);
                    TELEPORTER.rebuildIndex(records); 
                }
                
                setProgress(((i + 1) / totalFiles) * 100);
            }
            setStatusMessage('Ingestion complete!');
            setTimeout(() => {
                setIsIngesting(false);
                setStatusMessage('');
                setProgress(0);
            }, 2000);
            await refreshStats();
        } catch (error) {
            console.error("Ingestion error:", error);
            setStatusMessage('Error during ingestion. Check console.');
            setIsIngesting(false);
        } finally {
             if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePurge = async () => {
        if (window.confirm("Are you sure you want to purge the entire Knowledge Base? This cannot be undone.")) {
            await vectorDb.clearVectors();
            TELEPORTER.rebuildIndex([]);
            await refreshStats();
        }
    };

    const handleExportBackup = async () => {
        const vectors = await vectorDb.getAllVectors();
        if (vectors.length === 0) {
            alert("Database is empty. Nothing to export.");
            return;
        }
        const blob = new Blob([JSON.stringify(vectors)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mythos_vault_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Knowledge Base (Mythos Vault)</h2>
                    <p className="text-text-secondary">Ingest text documents to create a local, private RAG memory for your agents.</p>
                </div>
                <div className="bg-secondary/50 border border-accent rounded-xl px-4 py-2 flex items-center gap-3">
                    <DatabaseIcon className="w-5 h-5 text-brand" />
                    <div>
                         <div className="text-xs text-text-secondary uppercase tracking-wider font-bold">Total Vectors</div>
                         <div className="text-xl font-bold text-text-primary">{vectorCount}</div>
                    </div>
                </div>
            </div>

            {/* System Status - Models */}
             <div className="bg-secondary/20 border border-accent rounded-xl p-4 flex items-center justify-between text-xs">
                 <span className="font-semibold text-text-secondary">System Status:</span>
                 <div className="flex gap-4">
                     <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-text-primary">Reasoning: Gemini 3.0 Pro</span>
                     </span>
                     <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="text-text-primary">Fast: Gemini 2.5 Flash</span>
                     </span>
                 </div>
             </div>

            {/* Ingestion Area */}
            <div className="bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Ingest Data</h3>
                <div className="border-2 border-dashed border-accent rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors hover:bg-secondary/50">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        multiple 
                        accept=".txt,.md,.json,.csv" 
                        onChange={handleFileSelect} 
                        className="hidden" 
                    />
                    <button 
                        onClick={() => !isIngesting && fileInputRef.current?.click()}
                        disabled={isIngesting}
                        className="flex flex-col items-center gap-2 group cursor-pointer disabled:cursor-wait"
                    >
                         <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center border border-accent group-hover:border-brand transition-colors">
                             <PaperclipIcon className="w-6 h-6 text-text-secondary group-hover:text-brand" />
                         </div>
                         <div className="space-y-1">
                             <p className="text-sm font-semibold text-text-primary">Click to select files</p>
                             <p className="text-xs text-text-secondary">Supported: .txt, .md, .json (Parses content or restores backup)</p>
                         </div>
                    </button>
                </div>

                {isIngesting && (
                    <div className="mt-6 space-y-2">
                         <div className="flex justify-between text-xs text-text-secondary">
                             <span>{statusMessage}</span>
                             <span>{Math.round(progress)}%</span>
                         </div>
                         <div className="w-full bg-primary rounded-full h-2 overflow-hidden">
                             <div 
                                className="bg-brand h-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                             ></div>
                         </div>
                    </div>
                )}
            </div>

            {/* Stats & Management */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-secondary/30 border border-accent rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Active Sources</h3>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                        {sources.length > 0 ? (
                            sources.map((src, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-primary border border-accent rounded text-text-secondary">
                                    {src}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-text-secondary italic">No sources loaded.</span>
                        )}
                    </div>
                </div>

                <div className="bg-secondary/30 border border-accent rounded-xl p-6 flex flex-col justify-between">
                     <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-2">Database Actions</h3>
                        <p className="text-sm text-text-secondary">Manage the local IndexedDB storage.</p>
                     </div>
                     
                     <div className="space-y-3 mt-4">
                        <button 
                            onClick={handleExportBackup}
                            className="w-full py-3 border border-accent bg-primary text-text-secondary hover:text-text-primary hover:bg-secondary rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            <DatabaseIcon className="w-4 h-4" />
                            Export Knowledge Base (JSON)
                        </button>

                        <button 
                            onClick={handlePurge}
                            className="w-full py-3 border border-red-900/50 text-red-400 bg-red-900/10 hover:bg-red-900/20 rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Purge Knowledge Base
                        </button>
                     </div>
                </div>
            </div>
        </div>
    );
};
