import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoIcon } from './icons/VideoIcon';

interface VideoInputProps {
  onVideoChange: (source: File | string | null) => void;
}

export const VideoInput: React.FC<VideoInputProps> = ({ onVideoChange }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (videoSrc && videoSrc.startsWith('blob:')) {
          URL.revokeObjectURL(videoSrc);
        }
        const newSrc = URL.createObjectURL(file);
        setVideoSrc(newSrc);
        onVideoChange(file);
      }
    },
    [onVideoChange, videoSrc]
  );

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
      setVideoSrc(urlInput);
      onVideoChange(urlInput);
    }
  }, [onVideoChange, urlInput, videoSrc]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files?.[0];
      if (file && file.type.startsWith('video/')) {
        if (videoSrc && videoSrc.startsWith('blob:')) {
          URL.revokeObjectURL(videoSrc);
        }
        const newSrc = URL.createObjectURL(file);
        setVideoSrc(newSrc);
        onVideoChange(file);
      }
    },
    [onVideoChange, videoSrc]
  );

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-text-primary">1. Provide a Video</h2>
      <div className="flex space-x-2 p-1 bg-secondary rounded-lg">
        <button
          onClick={() => setInputType('upload')}
          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${
            inputType === 'upload' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          Upload
        </button>
        <button
          onClick={() => setInputType('url')}
          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${
            inputType === 'url' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          URL
        </button>
      </div>

      {inputType === 'upload' && (
        <div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
          <label
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-accent border-dashed rounded-lg cursor-pointer bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <VideoIcon className="w-10 h-10 mb-3 text-text-secondary" />
              <p className="mb-2 text-sm text-text-secondary">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-text-secondary">MP4, MOV, AVI, etc.</p>
            </div>
          </label>
        </div>
      )}

      {inputType === 'url' && (
        <div className="flex space-x-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter direct video URL (e.g., .../video.mp4)"
            className="w-full p-2 bg-secondary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition placeholder-text-secondary/70"
          />
          <button
            onClick={handleUrlSubmit}
            className="bg-brand text-text-primary font-semibold px-4 rounded-lg hover:bg-brand-hover transition-colors"
          >
            Load
          </button>
        </div>
      )}

      {videoSrc && (
        <div className="mt-4">
          <p className="text-sm font-medium text-text-secondary mb-2">Video Preview:</p>
          <video src={videoSrc} controls className="w-full rounded-lg max-h-64 bg-black"></video>
          <p className="text-xs text-text-secondary mt-2">
            Note: For URLs, the video must be publicly accessible (CORS enabled).
          </p>
        </div>
      )}
    </div>
  );
};
