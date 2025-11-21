
import React, { useRef, useEffect } from 'react';
import { SendIcon } from './icons/SendIcon';

interface ChatInterfaceProps {
  history: { role: 'user' | 'model'; parts: { text: string }[] }[];
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: () => void;
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [history, isLoading]);
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
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
              <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed tracking-wide">
                {msg.parts[0].text}
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
      <div className="mt-6 flex items-center space-x-3">
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
          onClick={onSendMessage}
          disabled={isLoading || !message.trim()}
          className="p-4 bg-brand text-text-primary rounded-xl hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
          aria-label="Send message"
        >
          <SendIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
