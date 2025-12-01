import React, { useState } from 'react';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { WarningIcon } from './icons/WarningIcon';

interface KnowledgeBaseContextProps {
  context: string;
  warning: string | null;
  url: string;
}

export const KnowledgeBaseContext: React.FC<KnowledgeBaseContextProps> = ({ context, warning, url }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-secondary/30 border border-accent rounded-xl shadow-sm animate-fade-in">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex justify-between items-center w-full p-4 text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <DatabaseIcon className="w-5 h-5 text-brand-hover" />
          <div>
            <h3 className="font-semibold text-text-primary">Retrieved from Knowledge Base</h3>
            <p className="text-xs text-text-secondary truncate max-w-xs">{url}</p>
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 animate-fade-in">
            <div className="border-t border-accent pt-4 space-y-3">
                {warning && (
                    <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg flex items-start gap-3 text-yellow-200 text-sm">
                        <WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p>{warning}</p>
                    </div>
                )}
                 {context ? (
                    <div className="prose prose-invert prose-sm max-w-none bg-primary/50 p-3 rounded-lg">
                        <ul className="pl-5 space-y-1">
                            {context.split('\n').map((item, index) => (
                                <li key={index} className="marker:text-brand">{item.replace(/^- /, '')}</li>
                            ))}
                        </ul>
                    </div>
                 ) : (
                    !warning && <p className="text-sm text-text-secondary italic">No context was added to the prompt.</p>
                 )}
            </div>
        </div>
      )}
    </div>
  );
};
