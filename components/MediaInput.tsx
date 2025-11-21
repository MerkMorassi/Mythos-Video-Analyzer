import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { ImageIcon } from './icons/ImageIcon';

interface MediaInputProps {
  onMediaChange: (media: { type: 'video' | 'image'; source: File | string | null }) => void;
}

export const MediaInput: React.FC<MediaInputProps> = ({ onMediaChange }) => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'upload' | 'url'>('upload');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlLoading, setIsUrlLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (mediaSrc && mediaSrc.startsWith('blob:')) {
        URL.revokeObjectURL(mediaSrc);
      }
    };
  }, [mediaSrc]);
  
  const resetSource = useCallback(() => {
    if (mediaSrc && mediaSrc.startsWith('blob:')) {
      URL.revokeObjectURL(mediaSrc);
    }
    setMediaSrc(null);
    setUrlInput('');
    setUrlError(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [mediaSrc]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        resetSource();
        const newSrc = URL.createObjectURL(file);
        setMediaSrc(newSrc);
        onMediaChange({ type: mediaType, source: file });
        setUrlError(null);
      }
    },
    [onMediaChange, resetSource, mediaType]
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) {
      setUrlError('Please enter a video URL.');
      return;
    }
    setUrlError(null);
    setIsUrlLoading(true);
    resetSource();

    try {
      await new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        const onError = () => {
          video.remove();
          reject(new Error('This is often due to CORS restrictions. Please try downloading the video and uploading it directly.'));
        };
        video.addEventListener('loadedmetadata', () => { video.remove(); resolve(true); });
        video.addEventListener('error', onError);
        video.src = urlInput;
      });
      setMediaSrc(urlInput);
      onMediaChange({ type: 'video', source: urlInput });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setUrlError(`Could not load video. ${errorMessage}`);
      setMediaSrc(null);
      onMediaChange({ type: 'video', source: null });
    } finally {
      setIsUrlLoading(false);
    }
  }, [onMediaChange, urlInput, resetSource]);


  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files?.[0];
      if (file && file.type.startsWith(`${mediaType}/`)) {
        resetSource();
        const newSrc = URL.createObjectURL(file);
        setMediaSrc(newSrc);
        onMediaChange({ type: mediaType, source: file });
        setUrlError(null);
      }
    },
    [onMediaChange, resetSource, mediaType]
  );

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleMediaTypeChange = (type: 'video' | 'image') => {
    if(type === mediaType) return;
    setMediaType(type);
    resetSource();
    onMediaChange({ type, source: null });
  };

  const renderUploadArea = () => (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={`${mediaType}/*`} className="hidden" />
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center w-full h-48 border-2 border-accent border-dashed rounded-lg cursor-pointer bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {mediaType === 'video' ? <VideoIcon className="w-10 h-10 mb-3 text-text-secondary" /> : <ImageIcon className="w-10 h-10 mb-3 text-text-secondary" />}
          <p className="mb-2 text-sm text-text-secondary">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-text-secondary">{mediaType === 'video' ? 'MP4, MOV, AVI, etc.' : 'JPEG, PNG, WEBP, etc.'}</p>
        </div>
      </label>
    </div>
  );

  const renderUrlArea = () => (
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
        <b>Note:</b> URL input is for videos only and they must be publicly accessible (CORS enabled). If you encounter errors, please download the video and use the 'Upload' tab instead.
      </p>
      {urlError && (
        <div className="mt-2 text-sm text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30">
          <p className="font-semibold">URL Error</p>
          <p>{urlError}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-text-primary">1. Provide a Video or Image</h2>
      
      <div className="flex space-x-2 p-1 bg-secondary rounded-lg">
         <button
          onClick={() => handleMediaTypeChange('video')}
          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${
            mediaType === 'video' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          <VideoIcon className="w-4 h-4" /> Video
        </button>
        <button
          onClick={() => handleMediaTypeChange('image')}
          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${
            mediaType === 'image' ? 'bg-brand text-text-primary' : 'text-text-secondary hover:bg-accent'
          }`}
        >
          <ImageIcon className="w-4 h-4" /> Image
        </button>
      </div>

      {mediaType === 'video' && (
        <div className="flex space-x-2 p-1 bg-secondary/50 rounded-lg">
          <button onClick={() => setInputType('upload')} className={`w-full py-1 text-xs font-semibold rounded-md transition-colors ${inputType === 'upload' ? 'bg-accent text-text-primary' : 'text-text-secondary hover:bg-accent/50'}`}>Upload</button>
          <button onClick={() => setInputType('url')} className={`w-full py-1 text-xs font-semibold rounded-md transition-colors ${inputType === 'url' ? 'bg-accent text-text-primary' : 'text-text-secondary hover:bg-accent/50'}`}>URL</button>
        </div>
      )}

      {inputType === 'upload' || mediaType === 'image' ? renderUploadArea() : renderUrlArea()}

      {mediaSrc && (
        <div className="mt-4">
          <p className="text-sm font-medium text-text-secondary mb-2">Preview:</p>
          {mediaType === 'video' ? (
            <video key={mediaSrc} controls className="w-full rounded-lg max-h-64 bg-black">
              <source src={mediaSrc} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <img src={mediaSrc} alt="Preview" className="w-full rounded-lg max-h-64 object-contain bg-black" />
          )}
        </div>
      )}
    </div>
  );
};