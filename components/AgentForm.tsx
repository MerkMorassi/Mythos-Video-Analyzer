
import React, { useState, useCallback, useRef } from 'react';
import { Agent, getAvailableVoices } from '../services/agentService';
import { testKnowledgeBase, RagTestResult } from '../services/ragService';
import { UserIcon } from './icons/UserIcon';
import { TrashIcon } from './icons/TrashIcon';

interface AgentFormProps {
  agent?: Agent | null;
  onSave: (agent: Omit<Agent, 'id' | 'isCustom'> & { id?: string }) => void;
  onCancel: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

export const AgentForm: React.FC<AgentFormProps> = ({ agent, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'persona' | 'voice' | 'knowledge'>('profile');
  
  const [name, setName] = useState(agent?.name || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [voice, setVoice] = useState(agent?.voice || getAvailableVoices()[0].name);
  const [avatar, setAvatar] = useState<string | undefined>(agent?.avatar);
  const [tags, setTags] = useState(agent?.tags?.join(', ') || '');
  const [speakingRate, setSpeakingRate] = useState(agent?.speakingRate ?? 1.0);
  const [autoPlayAudio, setAutoPlayAudio] = useState(agent?.autoPlayAudio ?? false);
  const [knowledgeBaseUrl, setKnowledgeBaseUrl] = useState(agent?.knowledgeBaseUrl || '');
  const [enableLocalRag, setEnableLocalRag] = useState(agent?.enableLocalRag ?? false);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [kbUrlError, setKbUrlError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });


  const validateKbUrl = useCallback((url: string): boolean => {
    if (!url) {
        setKbUrlError(null);
        return true;
    }
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            setKbUrlError("URL must start with http:// or https://");
            return false;
        }
        setKbUrlError(null);
        return true;
    } catch (_) {
        setKbUrlError("Please enter a valid URL format.");
        return false;
    }
  }, []);

  const handleKbUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newUrl = e.target.value;
      setKnowledgeBaseUrl(newUrl);
      validateKbUrl(newUrl);
      setTestStatus({ type: 'idle', message: '' });
  };

  const handleTestConnection = async () => {
    if (kbUrlError) return;
    setTestStatus({ type: 'testing', message: 'Testing...' });
    const result: RagTestResult = await testKnowledgeBase(knowledgeBaseUrl);
    if (result.success) {
        setTestStatus({ type: 'success', message: result.message });
    } else {
        setTestStatus({ type: 'error', message: result.message });
    }
  };


  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormError(null);
      if (file.size > MAX_AVATAR_SIZE) {
        setFormError("Avatar image must be less than 2MB.");
        return;
      }
      setIsUploading(true);
      try {
        const base64 = await fileToBase64(file);
        setAvatar(base64);
      } catch (error) {
        console.error("Error converting file to base64:", error);
        setFormError("Failed to process image. Please try another file.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(undefined);
    if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isKbUrlValid = validateKbUrl(knowledgeBaseUrl);

    if (!name.trim() || !systemPrompt.trim() || !isKbUrlValid) {
        if (!name.trim() || !systemPrompt.trim()) {
            setFormError("Agent Name and System Prompt cannot be empty.");
            // Force switch to profile/persona if there are errors there
            if (!name.trim()) setActiveTab('profile');
            else if (!systemPrompt.trim()) setActiveTab('persona');
        }
        return;
    }
    setFormError(null);
    onSave({
      id: agent?.id,
      name,
      systemPrompt,
      voice,
      avatar,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      speakingRate,
      autoPlayAudio,
      knowledgeBaseUrl,
      enableLocalRag,
    });
  };

  return (
    <div className="fixed inset-0 bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-secondary border border-accent rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-accent flex justify-between items-center bg-secondary sticky top-0">
             <h2 className="text-xl font-bold text-text-primary">Configure Agent Persona</h2>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-accent bg-secondary/50">
            <button type="button" onClick={() => setActiveTab('profile')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'profile' ? 'text-text-primary border-b-2 border-brand' : 'text-text-secondary hover:text-text-primary hover:bg-accent/50'}`}>Profile</button>
            <button type="button" onClick={() => setActiveTab('persona')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'persona' ? 'text-text-primary border-b-2 border-brand' : 'text-text-secondary hover:text-text-primary hover:bg-accent/50'}`}>Persona</button>
            <button type="button" onClick={() => setActiveTab('voice')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'voice' ? 'text-text-primary border-b-2 border-brand' : 'text-text-secondary hover:text-text-primary hover:bg-accent/50'}`}>Voice</button>
            <button type="button" onClick={() => setActiveTab('knowledge')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'knowledge' ? 'text-text-primary border-b-2 border-brand' : 'text-text-secondary hover:text-text-primary hover:bg-accent/50'}`}>Knowledge</button>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-grow space-y-4">
             {formError && (
                <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-4">
                    {formError}
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">Agent Avatar</label>
                        <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 flex-shrink-0">
                                {avatar ? (
                                    <img src={avatar} alt="Avatar Preview" className="w-16 h-16 rounded-full object-cover bg-accent" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                                        <UserIcon className="w-8 h-8 text-text-secondary"/>
                                    </div>
                                )}
                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                        <div className="animate-spin h-6 w-6 border-2 border-text-primary border-t-transparent rounded-full"></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="avatar-upload" className="px-4 py-2 text-sm font-semibold bg-secondary border border-accent text-text-secondary rounded-xl cursor-pointer hover:bg-accent hover:text-text-primary transition-colors">
                                    Upload Image
                                </label>
                                <input id="avatar-upload" ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                                {avatar && (
                                    <button type="button" onClick={handleRemoveAvatar} className="p-2 text-text-secondary hover:text-red-400 rounded-xl hover:bg-red-900/20 transition-colors" aria-label="Remove Avatar">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="agent-name" className="block text-sm font-medium text-text-primary mb-1">Agent Name <span className="text-red-400">*</span></label>
                        <input
                            id="agent-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., 'Cinematography Expert'"
                            className="w-full p-2 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="agent-tags" className="block text-sm font-medium text-text-primary mb-1">Specialty Tags (comma-separated)</label>
                        <input
                            id="agent-tags"
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="e.g., cinematography, botany, history"
                            className="w-full p-2 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none"
                        />
                    </div>
                </div>
            )}

            {activeTab === 'persona' && (
                <div className="space-y-4 animate-fade-in h-full flex flex-col">
                     <div className="flex-grow flex flex-col">
                        <label htmlFor="agent-prompt" className="block text-sm font-medium text-text-primary mb-1">System Prompt <span className="text-red-400">*</span></label>
                        <textarea
                            id="agent-prompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="Define the agent's persona and instructions..."
                            className="w-full flex-grow min-h-[250px] p-4 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none resize-none font-mono text-sm leading-relaxed"
                            required
                        />
                         <p className="text-xs text-text-secondary mt-2">
                             This prompt defines the core personality and expertise of your agent. Be specific about the role (e.g., "You are an expert DoP").
                         </p>
                    </div>
                </div>
            )}

            {activeTab === 'voice' && (
                 <div className="space-y-6 animate-fade-in">
                    <div>
                        <label htmlFor="agent-voice" className="block text-sm font-medium text-text-primary mb-1">Voice Preference</label>
                        <select
                            id="agent-voice"
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                            className="w-full p-2 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none"
                        >
                            {getAvailableVoices().map(v => (
                            <option key={v.name} value={v.name}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="speaking-rate" className="block text-sm font-medium text-text-primary mb-2">
                            Speaking Rate ({speakingRate.toFixed(1)}x)
                        </label>
                        <input
                            id="speaking-rate"
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={speakingRate}
                            onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                            className="w-full h-2 bg-primary rounded-lg appearance-none cursor-pointer"
                        />
                         <div className="flex justify-between text-xs text-text-secondary mt-1">
                             <span>Slow (0.5x)</span>
                             <span>Normal (1.0x)</span>
                             <span>Fast (2.0x)</span>
                         </div>
                    </div>

                    <div className="flex items-center p-3 bg-primary/30 rounded-xl border border-accent/50">
                        <input
                            id="auto-play-audio"
                            type="checkbox"
                            checked={autoPlayAudio}
                            onChange={(e) => setAutoPlayAudio(e.target.checked)}
                            className="h-4 w-4 rounded border-accent bg-primary text-brand focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-brand"
                        />
                        <label htmlFor="auto-play-audio" className="ml-3 block text-sm text-text-primary cursor-pointer select-none">
                            Auto-play audio on completion
                        </label>
                    </div>
                 </div>
            )}
            
            {activeTab === 'knowledge' && (
                 <div className="space-y-6 animate-fade-in">
                    <div className="bg-primary/30 p-4 rounded-xl border border-accent/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-text-primary">Mythos Vault (Local RAG)</h3>
                            <input
                                id="enable-local-rag"
                                type="checkbox"
                                checked={enableLocalRag}
                                onChange={(e) => setEnableLocalRag(e.target.checked)}
                                className="h-4 w-4 rounded border-accent bg-primary text-brand focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-brand"
                            />
                        </div>
                        <p className="text-xs text-text-secondary">
                            Enable the local vector database. The agent will prioritize information ingested in the 'Knowledge' tab.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="agent-kb-url" className="block text-sm font-medium text-text-primary">External Knowledge Base (Optional)</label>
                        <p className="text-xs text-text-secondary mb-2">Connect to a remote API for additional context.</p>
                        
                        <div className="flex items-start gap-2">
                            <div className="flex-grow">
                                <input
                                    id="agent-kb-url"
                                    type="text"
                                    value={knowledgeBaseUrl}
                                    onChange={handleKbUrlChange}
                                    placeholder="e.g., http://localhost:8000/search"
                                    className={`w-full p-2 bg-primary border rounded-xl focus:ring-2 focus:outline-none transition-colors ${
                                    kbUrlError ? 'border-red-500/50 focus:ring-red-500' : 'border-accent focus:ring-brand'
                                    }`}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={!knowledgeBaseUrl || !!kbUrlError || testStatus.type === 'testing'}
                                className="px-4 py-2 text-sm font-semibold bg-secondary border border-accent text-text-secondary rounded-xl hover:bg-accent hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            >
                                {testStatus.type === 'testing' ? 'Testing...' : 'Test'}
                            </button>
                        </div>
                        {kbUrlError && <p className="text-xs text-red-400 px-1">{kbUrlError}</p>}
                        {testStatus.type !== 'idle' && testStatus.type !== 'testing' && (
                            <p className={`text-xs px-1 ${testStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                {testStatus.message}
                            </p>
                        )}
                    </div>
                 </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-accent bg-secondary rounded-b-xl flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="px-6 py-3 bg-secondary border border-accent text-text-secondary font-semibold rounded-xl hover:bg-accent hover:text-text-primary transition-colors">Cancel</button>
          <button type="submit" className="px-6 py-3 bg-brand text-text-primary font-semibold rounded-xl hover:bg-brand-hover transition-all shadow-lg hover:shadow-xl active:scale-95">
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};
