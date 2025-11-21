import React from 'react';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { SpeakerOffIcon } from './icons/SpeakerOffIcon';

interface AnalysisResultProps {
  result: string;
  onPlayAudio: () => void;
  onStopAudio: () => void;
  isSpeaking: boolean;
  hasAudio: boolean;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  result,
  onPlayAudio,
  onStopAudio,
  isSpeaking,
  hasAudio,
}) => {
  return (
    <div className="w-full h-full flex flex-col mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-brand-hover">Analysis Result</h3>
        {hasAudio && (
          <button
            onClick={isSpeaking ? onStopAudio : onPlayAudio}
            className="p-2 rounded-full hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label={isSpeaking ? 'Stop speech' : 'Read result aloud'}
          >
            {isSpeaking ? (
              <SpeakerOffIcon className="w-5 h-5 text-text-primary" />
            ) : (
              <SpeakerIcon className="w-5 h-5 text-text-primary" />
            )}
          </button>
        )}
      </div>
      <div
        className="prose prose-invert prose-sm max-w-none flex-grow overflow-y-auto bg-primary/50 p-4 rounded-md prose-headings:text-brand-hover prose-strong:text-text-primary prose-blockquote:border-l-accent prose-li:marker:text-brand"
        dangerouslySetInnerHTML={{ __html: result }}
      />
    </div>
  );
};
