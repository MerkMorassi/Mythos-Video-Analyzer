
import React, { useState } from 'react';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { SpeakerOffIcon } from './icons/SpeakerOffIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { WandIcon } from './icons/WandIcon';
import { WarningIcon } from './icons/WarningIcon';

interface AudioState {
    isGenerating?: boolean;
    isPlaying?: boolean;
    buffer?: AudioBuffer | null;
    error?: string | null;
}

interface AnalysisResultProps {
  result: string;
  audioState?: AudioState;
  onPlayAudio: () => void;
  onStopAudio: () => void;
  onGenerateAudio: () => void;
  onReEngineerPrompt: () => void;
  isReEngineering: boolean;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  result,
  audioState,
  onPlayAudio,
  onStopAudio,
  onGenerateAudio,
  onReEngineerPrompt,
  isReEngineering,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = result;
    const text = tempDiv.innerText || tempDiv.textContent || '';
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasAudio = !!audioState?.buffer;
  const isSpeaking = !!audioState?.isPlaying;
  const isAudioGenerating = !!audioState?.isGenerating;
  const audioError = audioState?.error;


  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-brand-hover">Analysis Result</h3>
        
        <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand flex items-center gap-2 group"
              title="Copy analysis text"
            >
                <ClipboardIcon className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
                {copied && <span className="text-xs font-medium text-brand-hover animate-fade-in">Copied!</span>}
            </button>

            <div className="h-4 w-px bg-accent mx-1"></div>

            <button
                onClick={onReEngineerPrompt}
                disabled={isReEngineering}
                className="p-2 rounded-xl hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate an optimized prompt for SDXL based on this analysis"
            >
                <WandIcon className="w-5 h-5 text-text-secondary" />
                <span className="text-xs font-medium text-text-secondary">Generate Prompt</span>
            </button>

            <div className="h-4 w-px bg-accent mx-1"></div>

            {hasAudio ? (
                <button
                    onClick={isSpeaking ? onStopAudio : onPlayAudio}
                    className="p-2 rounded-xl hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand flex items-center gap-2"
                    aria-label={isSpeaking ? 'Stop speech' : 'Read result aloud'}
                >
                    {isSpeaking ? (
                        <><SpeakerOffIcon className="w-5 h-5 text-brand-hover" /><span className="text-xs font-medium text-brand-hover">Stop</span></>
                    ) : (
                        <><SpeakerIcon className="w-5 h-5 text-text-primary" /><span className="text-xs font-medium text-text-secondary">Read Aloud</span></>
                    )}
                </button>
            ) : (
                <button
                    onClick={onGenerateAudio}
                    disabled={isAudioGenerating}
                    className="p-2 rounded-xl hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Generate audio"
                    title="Generate audio for this analysis"
                >
                    {isAudioGenerating ? (
                        <svg className="animate-spin h-5 w-5 text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                         <SpeakerIcon className="w-5 h-5 text-text-secondary" />
                    )}
                    <span className="text-xs font-medium text-text-secondary">{isAudioGenerating ? 'Generating...' : 'Generate Audio'}</span>
                </button>
            )}
        </div>
      </div>
      {audioError && (
          <div className="mb-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg flex items-start gap-2 text-orange-200 animate-fade-in text-xs">
              <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{audioError}</p>
          </div>
      )}
      <div
        className="prose prose-invert prose-base max-w-none flex-grow overflow-y-auto bg-primary/50 p-6 rounded-lg prose-headings:text-brand-hover prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-4 prose-strong:text-text-primary prose-blockquote:border-l-accent prose-li:marker:text-brand leading-loose space-y-6 prose-p:my-6"
        dangerouslySetInnerHTML={{ __html: result }}
      />
    </div>
  );
};
