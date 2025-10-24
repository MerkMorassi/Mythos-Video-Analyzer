import React from 'react';

interface FramePreviewProps {
  frames: string[];
}

export const FramePreview: React.FC<FramePreviewProps> = ({ frames }) => {
  if (frames.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-text-secondary mb-2 text-center">Extracted Frames for Analysis:</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 bg-primary/50 rounded-md border border-accent">
        {frames.map((frame, index) => (
          <img
            key={index}
            src={`data:image/jpeg;base64,${frame}`}
            alt={`Frame ${index + 1}`}
            className="w-full h-auto object-cover rounded aspect-video bg-accent"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
};