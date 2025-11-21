
import React, { useRef, useEffect, useState } from 'react';
import { SendIcon } from './icons/SendIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';

interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface ChatInterfaceProps {
  history: { role: 'user' | 'model'; parts: ChatMessagePart[] }[];
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: (files?: File[]) => void;
  isLoading: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  history,
  message,
  onMessageChange,
  onSendMessage,
  isLoading,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [history, isLoading, selectedFiles]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendClick = () => {
    if ((!message.trim() && selectedFiles.length === 0) || isLoading) return;
    onSendMessage(selectedFiles);
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full flex flex-col mt-6 border-t border-accent pt-6">
      <h3 className="text-lg font-semibold text-brand-hover mb-4">Follow-up Conversation</h3>
      <div className="flex-grow overflow-y-auto h-80 bg-primary/30 border border-accent/50 p-4 rounded-lg space-y-6 shadow-inner">
        {history.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-5 py-3 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-brand/90 text-white'
                  : 'bg-secondary border border-accent/50 text-text-primary'
              }`}
            >
              <div className="font-sans text-sm leading-relaxed tracking-wide space-y-2">
                {msg.parts.map((part, partIndex) => (
                  <div key={partIndex}>
                    {part.inlineData && (
                       <div className="mb-2">
                         {part.inlineData.mimeType.startsWith('image/') ? (
                           <img 
                             src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                             alt="User upload" 
                             className="max-w-full rounded-lg max-h-48 object-cover border border-white/20"
                           />
                         ) : (
                           <div className="bg-black/20 p-2 rounded text-xs flex items-center gap-2">
                             <PaperclipIcon className="w-4 h-4" />
                             <span>Attached Media ({part.inlineData.mimeType})</span>
                           </div>
                         )}
                       </div>
                    )}
                    {part.text && (
                      <div 
                        className={`prose prose-invert prose-sm max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 ${msg.role === 'user' ? 'text-white prose-headings:text-white prose-strong:text-white' : 'text-text-primary'}`} 
                        dangerouslySetInnerHTML={{ __html: part.text }} 
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="max-w-[85%] rounded-xl px-5 py-4 bg-secondary border border-accent/50 text-text-primary shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 bg-text-secondary rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-text-secondary rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-text-secondary rounded-full animate-pulse"></span>
              </div>
            </div>
          </div>
        )}
         <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview Area */}
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-2 px-1">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group flex-shrink-0">
              <div className="w-16 h-16 rounded-lg bg-secondary border border-accent flex items-center justify-center overflow-hidden">
                {file.type.startsWith('image/') ? (
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="preview" 
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" 
                  />
                ) : (
                   <span className="text-xs text-text-secondary p-1 text-center break-words">{file.name.slice(0, 8)}...</span>
                )}
              </div>
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center space-x-3">
        <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,application/pdf,text/plain"
        />
        <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-4 bg-secondary border border-accent text-text-secondary rounded-xl hover:text-text-primary hover:border-brand transition-colors"
            title="Attach files"
        >
            <PaperclipIcon className="w-6 h-6" />
        </button>

        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          className="w-full p-4 bg-secondary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70 shadow-sm"
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSendClick}
          disabled={isLoading || (!message.trim() && selectedFiles.length === 0)}
          className="p-4 bg-brand text-text-primary rounded-xl hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
          aria-label="Send message"
        >
          <SendIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
