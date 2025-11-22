import React from 'react';
import { UserIcon } from './icons/UserIcon';
import { Agent } from '../services/agentService';
import { PaperclipIcon } from './icons/PaperclipIcon';

interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface ChatMessageProps {
  message: { role: 'user' | 'model'; parts: ChatMessagePart[] };
  agent: Agent | null;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, agent }) => {
  const { role, parts } = message;
  const isUser = role === 'user';

  const name = isUser ? "You" : agent?.name || "Model";
  const avatar = isUser ? null : agent?.avatar;

  return (
    <div className="bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm w-full animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
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
      <div className="prose prose-invert prose-base max-w-none flex-grow leading-loose space-y-4 prose-p:my-4">
        {parts.map((part, partIndex) => (
          <div key={partIndex}>
             {part.inlineData && (
               <div className="mb-2">
                 {part.inlineData.mimeType.startsWith('image/') ? (
                   <img 
                     src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                     alt="Uploaded content" 
                     className="max-w-md rounded-lg max-h-64 object-cover border border-white/20"
                   />
                 ) : (
                   <div className="bg-primary/50 p-2 rounded text-sm flex items-center gap-2 max-w-sm">
                     <PaperclipIcon className="w-4 h-4" />
                     <span>Attached Media ({part.inlineData.mimeType})</span>
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
