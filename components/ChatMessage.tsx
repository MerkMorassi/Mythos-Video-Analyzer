import React, { useState } from 'react';
import { UserIcon } from './icons/UserIcon';
import { Agent } from '../services/agentService';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { SpeakerOffIcon } from './icons/SpeakerOffIcon';
import { WarningIcon } from './icons/WarningIcon';
import { FileIcon } from './icons/FileIcon';

interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
    fileName?: string;
  };
}

interface AudioState {
    isGenerating?: boolean;
    isPlaying?: boolean;
    buffer?: AudioBuffer | null;
    error?: string | null;
}

interface ChatMessageProps {
  message: { id: string; role: 'user' | 'model'; parts: ChatMessagePart[] };
  agent: Agent | null;
  audioState?: AudioState;
  onPlayAudio: () => void;
  onStopAudio: () => void;
  onGenerateAudio: (text: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, agent, audioState, onPlayAudio, onStopAudio, onGenerateAudio }) => {
  const { role, parts } = message;
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const name = isUser ? "You" : agent?.name || "Model";
  const avatar = isUser ? null : agent?.avatar;
  const fullText = parts.map(p => p.text || '').join(' ');
  
  const hasAudio = !!audioState?.buffer;
  const isSpeaking = !!audioState?.isPlaying;
  const isAudioGenerating = !!audioState?.isGenerating;
  const audioError = audioState?.error;


  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = fullText;
    const textToCopy = tempDiv.innerText || tempDiv.textContent || '';
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm w-full animate-fade-in">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
            {isUser ? (
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-text-secondary"/>
            </div>
            ) : (
            avatar ? (
                <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover bg-accent flex-shrink-0" />
            ) : (
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-text-secondary"/>
                </div>
            )
            )}
            <h3 className="font-semibold text-text-primary">{name}</h3>
        </div>
        
        {!isUser && (
            <div className="flex items-center gap-1">
                 <button
                    onClick={handleCopy}
                    className="p-2 rounded-xl hover:bg-accent transition-colors flex items-center gap-1 group"
                    title="Copy text"
                >
                    <ClipboardIcon className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
                    {copied && <span className="text-xs font-medium text-brand-hover animate-fade-in">Copied!</span>}
                </button>
                <div className="h-4 w-px bg-accent mx-1"></div>
                {hasAudio ? (
                    <button
                        onClick={isSpeaking ? onStopAudio : onPlayAudio}
                        className="p-2 rounded-xl hover:bg-accent transition-colors"
                        aria-label={isSpeaking ? 'Stop speech' : 'Read aloud'}
                    >
                        {isSpeaking ? 
                            <SpeakerOffIcon className="w-4 h-4 text-brand-hover" /> : 
                            <SpeakerIcon className="w-4 h-4 text-text-primary" />
                        }
                    </button>
                ) : (
                    <button
                        onClick={() => onGenerateAudio(fullText)}
                        disabled={isAudioGenerating}
                        className="p-2 rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
                        aria-label="Generate audio"
                    >
                        {isAudioGenerating ? (
                            <div className="animate-spin h-4 w-4 border-2 border-brand border-t-transparent rounded-full"></div>
                        ) : (
                            <SpeakerIcon className="w-4 h-4 text-text-secondary" />
                        )}
                    </button>
                )}
            </div>
        )}
      </div>

       {audioError && (
          <div className="mb-4 p-2 bg-orange-900/20 border border-orange-500/30 rounded-lg flex items-start gap-2 text-orange-200 text-xs">
              <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{audioError}</p>
          </div>
      )}
      
      <div className="prose prose-invert prose-base max-w-none flex-grow leading-loose space-y-4 prose-p:my-4">
        {parts.map((part, partIndex) => (
          <div key={partIndex}>
             {part.inlineData && (
                <div className="mb-2">
                    {part.inlineData.mimeType.startsWith('image/') ? (
                    <img
                        src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                        alt={part.inlineData.fileName || 'Uploaded image'}
                        className="max-w-md rounded-lg max-h-64 object-cover border border-accent"
                    />
                    ) : (
                    <div className="bg-primary/50 p-3 rounded-lg border border-accent/50 text-sm flex items-center gap-3 max-w-sm">
                        <FileIcon className="w-6 h-6 text-text-secondary flex-shrink-0" />
                        <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-text-primary truncate">{part.inlineData.fileName || 'Attached File'}</span>
                        <span className="text-xs text-text-secondary">{part.inlineData.mimeType}</span>
                        </div>
                    </div>
                    )}
                </div>
            )}
            {part.text && (
              <div dangerouslySetInnerHTML={{ __html: part.text }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};