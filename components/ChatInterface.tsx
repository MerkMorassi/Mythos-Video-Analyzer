import React, { useRef, useState } from 'react';
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
  message,
  onMessageChange,
  onSendMessage,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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
    // Also reset file input so the same file can be re-added
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
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
    <div className="w-full bg-secondary/80 backdrop-blur-md border border-accent rounded-xl p-3 shadow-2xl">
      {/* Attachments Preview Area */}
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 px-1 border-b border-accent mb-3">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group flex-shrink-0">
              <div className="w-16 h-16 rounded-lg bg-primary border border-accent flex items-center justify-center overflow-hidden">
                {file.type.startsWith('image/') ? (
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="preview" 
                    className="w-full h-full object-cover" 
                    onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  />
                ) : (
                   <div className="p-1 text-center">
                        <PaperclipIcon className="w-6 h-6 mx-auto text-text-secondary"/>
                        <span className="text-[10px] text-text-secondary break-all">{file.name.split('.').pop()}</span>
                   </div>
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

      <div className="flex items-center space-x-2">
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
            className="p-3 bg-primary border border-accent text-text-secondary rounded-xl hover:text-text-primary hover:border-brand transition-colors"
            title="Attach files"
        >
            <PaperclipIcon className="w-5 h-5" />
        </button>

        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          className="w-full p-3 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70 shadow-sm"
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSendClick}
          disabled={isLoading || (!message.trim() && selectedFiles.length === 0)}
          className="p-3 bg-brand text-text-primary rounded-xl hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
          aria-label="Send message"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
