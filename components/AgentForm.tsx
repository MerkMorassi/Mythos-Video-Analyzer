
import React, { useState, useCallback, useRef } from 'react';
import { Agent, getAvailableVoices } from '../services/agentService';
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
  const [name, setName] = useState(agent?.name || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [voice, setVoice] = useState(agent?.voice || getAvailableVoices()[0].name);
  const [avatar, setAvatar] = useState<string | undefined>(agent?.avatar);
  const [tags, setTags] = useState(agent?.tags?.join(', ') || '');
  const [speakingRate, setSpeakingRate] = useState(agent?.speakingRate ?? 1.0);
  const [autoPlayAudio, setAutoPlayAudio] = useState(agent?.autoPlayAudio ?? false);
  const [knowledgeBaseUrl, setKnowledgeBaseUrl] = useState(agent?.knowledgeBaseUrl || '');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [kbUrlError, setKbUrlError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);


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
    });
  };

  return (
    <div className="fixed inset-0 bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-secondary border border-accent rounded-lg p-6 w-full max-w-lg space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-text-primary">{agent ? 'Edit Agent' : 'Create New Agent'}</h2>
        
        {formError && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">
              {formError}
          </div>
        )}

        <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Agent Avatar (Optional)</label>
            <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
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
                    <label htmlFor="avatar-upload" className="px-3 py-2 text-xs bg-primary border border-accent rounded-md cursor-pointer hover:bg-accent/50 transition-colors">
                        Upload Image
                    </label>
                    <input id="avatar-upload" ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    {avatar && (
                        <button type="button" onClick={handleRemoveAvatar} className="p-2 text-text-secondary hover:text-red-400 transition-colors" aria-label="Remove Avatar">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div>
          <label htmlFor="agent-name" className="block text-sm font-medium text-text-primary mb-1">Agent Name</label>
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 'Cinematography Expert'"
            className="w-full p-2 bg-primary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="agent-prompt" className="block text-sm font-medium text-text-primary mb-1">System Prompt</label>
          <textarea
            id="agent-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Define the agent's persona and instructions..."
            className="w-full h-32 p-2 bg-primary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none resize-none"
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
            className="w-full p-2 bg-primary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </div>
         <div>
          <label htmlFor="agent-kb-url" className="block text-sm font-medium text-text-primary mb-1">Knowledge Base URL (Optional)</label>
          <input
            id="agent-kb-url"
            type="text"
            value={knowledgeBaseUrl}
            onChange={handleKbUrlChange}
            placeholder="e.g., http://localhost:8000/search"
            className={`w-full p-2 bg-primary border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
              kbUrlError ? 'border-red-500/50 focus:ring-red-500' : 'border-accent focus:ring-brand'
            }`}
          />
          {kbUrlError ? (
            <p className="text-xs text-red-400 px-1 mt-1">{kbUrlError}</p>
          ) : (
            <p className="text-xs text-text-secondary px-1 mt-1">
              Must be a POST endpoint. Expects <code className="text-xs bg-primary p-0.5 rounded">{'{\'query\': \'...\'}'}</code>. Returns <code className="text-xs bg-primary p-0.5 rounded">{'{\'results\': [...]}'}</code>.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="agent-voice" className="block text-sm font-medium text-text-primary mb-1">Voice Preference</label>
          <select
            id="agent-voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full p-2 bg-primary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none"
          >
            {getAvailableVoices().map(v => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
        </div>
        
        <div className="pt-2 space-y-3">
           <div>
                <label htmlFor="speaking-rate" className="block text-sm font-medium text-text-primary mb-1">
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
            </div>

            <div className="flex items-center">
                <input
                    id="auto-play-audio"
                    type="checkbox"
                    checked={autoPlayAudio}
                    onChange={(e) => setAutoPlayAudio(e.target.checked)}
                    className="h-4 w-4 rounded border-accent bg-primary text-brand focus:ring-2 focus:ring-offset-2 focus:ring-offset-secondary focus:ring-brand"
                />
                <label htmlFor="auto-play-audio" className="ml-3 block text-sm text-text-primary">
                    Auto-play audio on completion
                </label>
            </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-accent text-text-primary rounded-lg hover:bg-accent/70 transition-colors">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-brand text-text-primary rounded-lg hover:bg-brand-hover transition-colors">Save Agent</button>
        </div>
      </form>
    </div>
  );
};
