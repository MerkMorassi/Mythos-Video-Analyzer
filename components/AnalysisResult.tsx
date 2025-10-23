import React from 'react';

interface AnalysisResultProps {
  result: string;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ result }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <h3 className="text-lg font-semibold text-brand-hover mb-4">Analysis Result</h3>
      <div className="prose prose-invert prose-sm max-w-none flex-grow overflow-y-auto bg-primary/50 p-4 rounded-md">
        {/* Using a div with whitespace-pre-wrap for simplicity. For full markdown, a library like 'react-markdown' would be used. */}
        <p className="whitespace-pre-wrap font-sans">{result}</p>
      </div>
    </div>
  );
};
