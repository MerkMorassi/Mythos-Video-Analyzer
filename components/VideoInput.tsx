import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoIcon } from './icons/VideoIcon';

interface VideoInputProps {
  onVideoChange: (source: File | string | null) => void;
}

export const VideoInput: React.FC<VideoInputProps> = ({ onVideoChange }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlLoading, setIsUrlLoading] = useState<boolean>(false);
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
        setUrlError(null);
      }
    },
    [onVideoChange, videoSrc]
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) {
      setUrlError('Please enter a video URL.');
      return;
    }
    setUrlError(null);
    setIsUrlLoading(true);

    if (videoSrc && videoSrc.startsWith('blob:')) {
      URL.revokeObjectURL(videoSrc);
    }

    try {
      // Pre-flight check to see if video metadata can be loaded, catching CORS issues early.
      await new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoad);
          video.removeEventListener('error', onError);
          video.src = ''; // Detach source to prevent memory leaks
        };

        const onLoad = () => {
          cleanup();
          resolve(true);
        };

        const onError = () => {
          cleanup();
          reject(new Error('This is often due to CORS (Cross-Origin Resource Sharing) restrictions on the server hosting the video. Please try downloading the video and uploading it directly.'));
        };

        video.addEventListener('loadedmetadata', onLoad);
        video.addEventListener('error', onError);
        video.src = urlInput;
      });

      // If promise resolves, the video is likely loadable
      setVideoSrc(urlInput);
      onVideoChange(urlInput);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setUrlError(`Could not load video. ${errorMessage}`);
      setVideoSrc(null);
      onVideoChange(null);
    } finally {
      setIsUrlLoading(false);
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
        setUrlError(null);
      }
    },
    [onVideoChange, videoSrc]
  );

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleTabChange = (type: 'upload' | 'url') => {
    setInputType(type);
    setUrlError(null); // Clear errors when switching tabs
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-text-primary">1. Provide a Video</h2>
      <div className="flex space-x-2 p-1 bg-secondary rounded-lg">
        <button
          onClick={() => handleTabChange('upload')}
          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${
            inputType === 'upload' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          Upload
        </button>
        <button
          onClick={() => handleTabChange('url')}
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
        <div className="space-y-2">
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
              disabled={isUrlLoading}
              className="bg-brand text-text-primary font-semibold px-4 rounded-lg hover:bg-brand-hover transition-colors disabled:bg-accent disabled:cursor-wait"
            >
              {isUrlLoading ? 'Loading...' : 'Load'}
            </button>
          </div>
           <p className="text-xs text-text-secondary px-1">
            <b>Note:</b> The video must be publicly accessible (CORS enabled) to be loaded from a URL.
          </p>
          {urlError && (
            <div className="mt-2 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30">
              <p className="font-semibold">URL Error</p>
              <p>{urlError}</p>
            </div>
          )}
        </div>
      )}

      {videoSrc && (
        <div className="mt-4">
          <p className="text-sm font-medium text-text-secondary mb-2">Video Preview:</p>
          <video key={videoSrc} controls className="w-full rounded-lg max-h-64 bg-black">
            <source src={videoSrc} />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  );
};
