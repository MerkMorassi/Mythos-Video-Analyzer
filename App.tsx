import React, { useState, useCallback } from 'react';
import { VideoInput } from './components/VideoInput';
import { AnalysisResult } from './components/AnalysisResult';
import { Loader } from './components/Loader';
import { analyzeVideo } from './services/geminiService';
import { extractFramesFromVideo } from './utils/video';
import { FramePreview } from './components/FramePreview';

export default function App() {
  const [videoSource, setVideoSource] = useState<File | string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<string[]>([]);

  const handleVideoChange = useCallback((source: File | string | null) => {
    setVideoSource(source);
    setAnalysisResult(null);
    setError(null);
    setExtractedFrames([]);
  }, []);

  const handleAnalyzeClick = async () => {
    if (!videoSource || !prompt.trim()) {
      setError('Please select a video and provide an analysis prompt.');
      return;
    }
    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);
    setExtractedFrames([]);

    let videoUrl = '';
    let isObjectURL = false;

    try {
      if (videoSource instanceof File) {
        videoUrl = URL.createObjectURL(videoSource);
        isObjectURL = true;
      } else {
        videoUrl = videoSource;
      }

      setProgressMessage('Extracting frames from video... (this may take a moment)');
      const frames = await extractFramesFromVideo(videoUrl);
      setExtractedFrames(frames);

      if (frames.length === 0) {
        throw new Error('Could not extract any frames from the video. Please check the video file or URL.');
      }

      setProgressMessage(`Analyzing ${frames.length} frames with Gemini...`);
      const result = await analyzeVideo(prompt, frames);

      setAnalysisResult(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Analysis Failed: ${errorMessage}`);
      console.error(err);
    } finally {
      if (isObjectURL && videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      setIsLoading(false);
      setProgressMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-primary text-text-primary font-sans">
      <main className="container mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-hover">
            MythOS Video Analyzer
          </h1>
          <p className="mt-2 text-lg text-text-secondary">
            Unlock insights from your videos with the power of Gemini Pro.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* --- CONTROLS COLUMN --- */}
          <div className="flex flex-col space-y-6">
            <VideoInput onVideoChange={handleVideoChange} />

            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-text-primary mb-2">
                2. What do you want to analyze?
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Summarize this video', 'What is the main activity happening?', 'Describe the objects on the table.'"
                className="w-full h-32 p-3 bg-secondary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading || !videoSource || !prompt.trim()}
              className="w-full bg-brand text-text-primary font-bold py-3 px-4 rounded-lg hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 flex items-center justify-center"
            >
              {isLoading ? 'Analyzing...' : '✨ Analyze Video'}
            </button>
          </div>

          {/* --- RESULTS COLUMN --- */}
          <div className="bg-secondary/50 border border-accent rounded-lg p-6 min-h-[400px] flex flex-col justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center w-full">
                {extractedFrames.length > 0 && <FramePreview frames={extractedFrames} />}
                <div className={extractedFrames.length > 0 ? 'mt-4' : ''}>
                  <Loader message={progressMessage} />
                </div>
              </div>
            ) : error ? (
              <div className="text-center text-red-400">
                <h3 className="text-lg font-semibold mb-2">Error</h3>
                <p>{error}</p>
              </div>
            ) : analysisResult ? (
              <AnalysisResult result={analysisResult} />
            ) : (
              <div className="text-center text-text-secondary">
                <h3 className="text-lg font-semibold">Your analysis will appear here</h3>
                <p>Upload a video and enter a prompt to get started.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}