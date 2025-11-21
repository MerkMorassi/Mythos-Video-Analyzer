
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MediaInput } from './components/MediaInput';
import { AnalysisResult } from './components/AnalysisResult';
import { Loader } from './components/Loader';
import { analyzeVideo, analyzeImage, generateSpeech, createChat } from './services/geminiService';
import { extractFramesFromVideo } from './utils/video';
import { FramePreview } from './components/FramePreview';
import { decode, decodeAudioData } from './utils/audio';
import { WarningIcon } from './components/icons/WarningIcon';
import { getAgents, saveAgent, deleteAgent, Agent, getDefaultAgentId, setDefaultAgentId } from './services/agentService';
import { AgentsView } from './components/AgentsView';
import { AnalyzerIcon } from './components/icons/AnalyzerIcon';
import { AgentsIcon } from './components/icons/AgentsIcon';
import { Chat } from '@google/genai';
import { ChatInterface } from './components/ChatInterface';
import { UserIcon } from './components/icons/UserIcon';


const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const fetchKnowledgeBaseContext = async (url: string, query: string): Promise<{context: string; warning: string | null}> => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) {
            const warning = `Knowledge base at ${url} returned status ${response.status}.`;
            console.warn(warning);
            return { context: '', warning };
        }
        const data = await response.json();
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            const context = `Context from knowledge base:\n- ${data.results.join('\n- ')}\n\n`;
            return { context, warning: null };
        }
        return { context: '', warning: null }; // Success, but no results
    } catch (error) {
        console.error(`Error fetching from knowledge base at ${url}:`, error);
        const warning = `Could not connect to the knowledge base at ${url}. Proceeding with standard analysis.`;
        return { context: '', warning };
    }
};


export default function App() {
  const [mediaSource, setMediaSource] = useState<File | string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [prompt, setPrompt] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ragWarning, setRagWarning] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [clearKey, setClearKey] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(16);

  // Agent management state
  const [activeTab, setActiveTab] = useState<'analyzer' | 'agents'>('analyzer');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [defaultAgentId, setDefaultAgentIdState] = useState<string | null>(null);
  
  // Chat state
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);


  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Load agents and default agent setting on initial render
  useEffect(() => {
    const loadedAgents = getAgents();
    setAgents(loadedAgents);

    let currentDefaultId = getDefaultAgentId();
    if (!currentDefaultId || !loadedAgents.some(a => a.id === currentDefaultId)) {
        currentDefaultId = loadedAgents.length > 0 ? loadedAgents[0].id : null;
        if(currentDefaultId) {
            setDefaultAgentId(currentDefaultId);
        }
    }
    setDefaultAgentIdState(currentDefaultId);
  }, []);

  const activeAgent = agents.find(a => a.id === defaultAgentId) || agents[0];

  // Update system prompt in UI if it's not a custom agent
  useEffect(() => {
    if (activeAgent && !activeAgent.isCustom) {
      // Allow manual override for default agents
    } else if (activeAgent?.isCustom) {
      setSystemPrompt(activeAgent.systemPrompt);
    }
  }, [activeAgent]);


  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };
  
  const playAudio = useCallback(() => {
    if (!audioBuffer || isSpeaking) return;

    const audioCtx = getAudioContext();
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = () => {
      setIsSpeaking(false);
      audioSourceRef.current = null;
    };
    source.start();
    setIsSpeaking(true);
    audioSourceRef.current = source;
  }, [audioBuffer, isSpeaking]);


  useEffect(() => {
    if (activeAgent?.autoPlayAudio && audioBuffer && !isSpeaking) {
      playAudio();
    }
  }, [audioBuffer, isSpeaking, playAudio, activeAgent]);

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }
  }, []);
  
  const resetState = useCallback(() => {
    setMediaSource(null);
    setMediaType('video');
    setPrompt('');
    setAnalysisResult(null);
    setError(null);
    setAudioError(null);
    setRagWarning(null);
    setExtractedFrames([]);
    setAudioBuffer(null);
    stopAudio();
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');
    setClearKey(prevKey => prevKey + 1); // Force re-mount of MediaInput
  }, [stopAudio]);

  const handleMediaChange = useCallback((media: { type: 'video' | 'image'; source: File | string | null }) => {
    setMediaType(media.type);
    setMediaSource(media.source);
    setAnalysisResult(null);
    setError(null);
    setAudioError(null);
    setRagWarning(null);
    setExtractedFrames([]);
    setAudioBuffer(null);
    stopAudio();
    // Reset chat
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');
  }, [stopAudio]);

  const handleAnalyzeClick = async () => {
    if (!mediaSource || !prompt.trim()) {
      setError(`Please select a ${mediaType} and provide an analysis prompt.`);
      return;
    }
    if (!activeAgent) {
        setError('No default agent selected. Please select a default agent in the Agents tab.');
        return;
    }
    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);
    setAudioError(null);
    setRagWarning(null);
    setExtractedFrames([]);
    stopAudio();
    setAudioBuffer(null);
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');


    // Determine the final system prompt to use
    const finalSystemPrompt = activeAgent?.isCustom ? activeAgent.systemPrompt : systemPrompt;
    const knowledgeBaseUrl = activeAgent?.isCustom ? activeAgent.knowledgeBaseUrl : undefined;
    let analysisPrompt = prompt;

    try {
      if (knowledgeBaseUrl) {
        setProgressMessage('Searching knowledge base...');
        const { context, warning } = await fetchKnowledgeBaseContext(knowledgeBaseUrl, prompt);
        if (warning) {
          setRagWarning(warning);
        }
        if (context) {
          analysisPrompt = `${context}Based on the context above, please answer the user's request: ${prompt}`;
        }
      }
      
      let resultText: string;

      if (mediaType === 'image' && mediaSource instanceof File) {
        setProgressMessage('Preparing image for analysis...');
        const imageBase64 = await fileToBase64(mediaSource);
        setExtractedFrames([imageBase64]);

        setProgressMessage('Analyzing image with Gemini...');
        resultText = await analyzeImage(analysisPrompt, imageBase64, mediaSource.type, finalSystemPrompt);

      } else if (mediaType === 'video') {
        let videoUrl = '';
        let isObjectURL = false;
        try {
          if (mediaSource instanceof File) {
            videoUrl = URL.createObjectURL(mediaSource);
            isObjectURL = true;
          } else {
            videoUrl = mediaSource as string;
          }

          setProgressMessage('Extracting frames from video...');
          const frames = await extractFramesFromVideo(videoUrl, frameCount);
          setExtractedFrames(frames);
          if (frames.length === 0) {
            throw new Error('Could not extract any frames from the video. Please check the video file or URL.');
          }

          setProgressMessage(`Analyzing ${frames.length} frames with Gemini...`);
          resultText = await analyzeVideo(analysisPrompt, frames, finalSystemPrompt);
        } finally {
          if (isObjectURL && videoUrl) {
            URL.revokeObjectURL(videoUrl);
          }
        }
      } else {
        throw new Error('Invalid media type or source provided.');
      }
      
      if (!resultText) {
        throw new Error('Analysis returned an empty result. The model may not have been able to process the request.');
      }

      setAnalysisResult(resultText);
      
      // Clean text for chat history and speech (remove HTML tags)
      const plainTextResult = resultText.replace(/<[^>]*>?/gm, '');

      // --- Initialize Chat Session ---
      const initialHistory = [
        { role: 'user' as const, parts: [{ text: `My prompt for this ${mediaType} was: "${prompt}"` }] },
        { role: 'model' as const, parts: [{ text: plainTextResult }] },
      ];
      
      // Append instruction for plain text chat
      const chatSystemInstruction = (finalSystemPrompt || "") + "\nIMPORTANT: Provide all responses in plain text. Do not use Markdown formatting (no bold, italics, lists, etc). Do not use HTML.";
      const chat = createChat(chatSystemInstruction, initialHistory);
      setChatSession(chat);
      setChatHistory(initialHistory);
      // --- End Chat Initialization ---


      try {
        setProgressMessage('Generating audio for the result...');

        if (plainTextResult.trim()) {
          const agentVoice = activeAgent?.voice || 'Kore';
          const agentSpeakingRate = activeAgent?.speakingRate ?? 1.0;
          const audioData = await generateSpeech(plainTextResult, agentVoice, agentSpeakingRate);
          const audioCtx = getAudioContext();
          const decodedBytes = decode(audioData);
          const buffer = await decodeAudioData(decodedBytes, audioCtx, 24000, 1);
          setAudioBuffer(buffer);
        } else {
          setAudioError("Analysis result contains no text to speak.");
        }
      } catch (audioErr) {
        const audioErrorMessage = audioErr instanceof Error ? audioErr.message : 'An unknown error occurred while generating speech.';
        setAudioError(audioErrorMessage);
        console.error("Audio Generation Error:", audioErr);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  };
  
  const handleSendChatMessage = async () => {
    if (!chatMessage.trim() || !chatSession || isChatLoading) return;

    const newUserMessage = { role: 'user' as const, parts: [{ text: chatMessage }] };
    setChatHistory(prev => [...prev, newUserMessage]);
    setChatMessage('');
    setIsChatLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: chatMessage });
      const modelResponseText = response.text;
      const modelResponse = { role: 'model' as const, parts: [{ text: modelResponseText }] };
      setChatHistory(prev => [...prev, modelResponse]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const errorResponse = { role: 'model' as const, parts: [{ text: `Sorry, I encountered an error: ${errorMessage}` }] };
      setChatHistory(prev => [...prev, errorResponse]);
      console.error("Chat Error:", err);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSaveAgent = (agentData: Omit<Agent, 'id' | 'isCustom'> & { id?: string }) => {
    saveAgent(agentData);
    setAgents(getAgents());
  };

  const handleDeleteAgent = (agentId: string) => {
    deleteAgent(agentId);
    const updatedAgents = getAgents();
    setAgents(updatedAgents);
    if (defaultAgentId === agentId && updatedAgents.length > 0) {
      const newDefault = updatedAgents[0].id;
      setDefaultAgentId(newDefault);
      setDefaultAgentIdState(newDefault);
    }
  };

  const handleSetDefaultAgent = (agentId: string) => {
    setDefaultAgentId(agentId);
    setDefaultAgentIdState(agentId);
  };


  return (
    <div className="min-h-screen bg-primary text-text-primary font-sans">
      <main className="container mx-auto px-4 py-8">
        <header className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-hover">
            Video & Image Analyzer
          </h1>
          <p className="mt-2 text-lg text-text-secondary">
            Unlock insights from your visual media with the power of Gemini.
          </p>
        </header>

        <div className="mb-8 flex justify-center border-b border-accent">
          <button onClick={() => setActiveTab('analyzer')} className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors ${activeTab === 'analyzer' ? 'text-text-primary border-b-2 border-brand' : 'text-text-secondary hover:text-text-primary'}`}>
            <AnalyzerIcon className="w-5 h-5" /> Analyzer
          </button>
          <button onClick={() => setActiveTab('agents')} className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors ${activeTab === 'agents' ? 'text-text-primary border-b-2 border-brand' : 'text-text-secondary hover:text-text-primary'}`}>
            <AgentsIcon className="w-5 h-5" /> Agents
          </button>
        </div>
        
        {activeTab === 'analyzer' && (
           <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
            {/* --- CONTROLS SECTION --- */}
            <div className="flex flex-col space-y-6">
              <MediaInput key={clearKey} onMediaChange={handleMediaChange} />

              {mediaType === 'video' && (
                <div>
                    <label htmlFor="frame-count" className="block text-sm font-medium text-text-primary mb-2">
                        Frame Extraction Detail ({frameCount} frames)
                    </label>
                    <input
                        id="frame-count"
                        type="range"
                        min="4"
                        max="32"
                        step="4"
                        value={frameCount}
                        onChange={(e) => setFrameCount(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-brand"
                        disabled={isLoading}
                    />
                    <div className="flex justify-between text-xs text-text-secondary mt-1 px-1">
                        <span>Less Detail</span>
                        <span>More Detail</span>
                    </div>
                </div>
              )}

              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-text-primary mb-2">
                  2. What do you want to analyze?
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mediaType === 'video'
                      ? "e.g., 'Summarize this video', 'What is the main activity happening?', 'Describe the objects on the table.'"
                      : "e.g., 'Describe this image in detail', 'What objects are in this picture?', 'Generate a creative caption.'"
                  }
                  className="w-full h-32 p-3 bg-secondary border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70"
                  disabled={isLoading}
                />
                <button
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors mt-2 px-1"
                  aria-expanded={showSystemPrompt}
                >
                  {showSystemPrompt ? '− Hide System Prompt' : '+ Add System Prompt (Optional)'}
                </button>
                {showSystemPrompt && (
                  <div className="mt-2">
                    <textarea
                      id="system-prompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Define the agent's persona or provide specific instructions. e.g., 'You are a helpful assistant who is an expert in cinematography.'"
                      className="w-full h-24 p-3 bg-secondary/50 border border-accent rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70 text-sm"
                      disabled={isLoading || (activeAgent?.isCustom ?? false)}
                    />
                    {activeAgent?.isCustom && (
                        <p className="text-xs text-brand-hover px-1 mt-1">System prompt is controlled by the selected custom agent.</p>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  3. Active Agent
                </label>
                {activeAgent ? (
                    <div className="flex items-center gap-3 p-3 bg-secondary border border-accent rounded-lg">
                    {activeAgent.isCustom && (
                        activeAgent.avatar ? (
                        <img src={activeAgent.avatar} alt={activeAgent.name} className="w-10 h-10 rounded-full object-cover bg-accent" />
                        ) : (
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-6 h-6 text-text-secondary"/>
                        </div>
                        )
                    )}
                    <span className={`font-semibold ${!activeAgent.isCustom ? 'pl-2' : ''}`}>{activeAgent.name}</span>
                    </div>
                ) : (
                    <div className="p-3 bg-secondary border border-accent rounded-lg text-text-secondary">
                        No agent available. Please create one in the Agents tab.
                    </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleAnalyzeClick}
                  disabled={isLoading || !mediaSource || !prompt.trim()}
                  className="w-full bg-brand text-text-primary font-bold py-3 px-4 rounded-lg hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 flex items-center justify-center"
                >
                  {isLoading ? 'Analyzing...' : `✨ Analyze ${mediaType === 'video' ? 'Video' : 'Image'}`}
                </button>
                 <button
                  onClick={resetState}
                  disabled={isLoading}
                  className="px-4 py-3 bg-accent text-text-secondary font-semibold rounded-lg hover:bg-accent/70 transition-colors"
                  aria-label="Clear all inputs and results"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* --- RESULTS SECTION --- */}
            <div className="bg-secondary/50 border border-accent rounded-lg p-6 min-h-[400px] flex flex-col justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center w-full">
                  {extractedFrames.length > 0 && (
                     <FramePreview 
                       frames={extractedFrames} 
                       title={mediaType === 'video' ? 'Extracted Frames for Analysis:' : 'Image for Analysis:'}
                     />
                  )}
                  <div className={extractedFrames.length > 0 ? 'mt-4' : ''}>
                    <Loader message={progressMessage} mediaType={mediaType} />
                  </div>
                </div>
              ) : error ? (
                <div className="text-center text-red-400">
                  <h3 className="text-lg font-semibold mb-2">Error</h3>
                  <p>{error}</p>
                </div>
              ) : analysisResult ? (
                <>
                  {ragWarning && (
                     <div className="mb-4 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-900/20 p-3 text-sm text-yellow-400">
                      <WarningIcon className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Knowledge Base Warning</p>
                        <p className="text-xs opacity-80">{ragWarning}</p>
                      </div>
                    </div>
                  )}
                  <AnalysisResult
                    result={analysisResult}
                    onPlayAudio={playAudio}
                    onStopAudio={stopAudio}
                    isSpeaking={isSpeaking}
                    hasAudio={!!audioBuffer}
                  />
                   {audioError && (
                    <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">
                      <WarningIcon className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Audio Error</p>
                        <p className="text-xs opacity-80">{audioError}</p>
                      </div>
                    </div>
                  )}
                  {chatHistory.length > 0 && (
                    <ChatInterface
                        history={chatHistory}
                        message={chatMessage}
                        onMessageChange={setChatMessage}
                        onSendMessage={handleSendChatMessage}
                        isLoading={isChatLoading}
                    />
                  )}
                </>
              ) : (
                <div className="text-center text-text-secondary">
                  <h3 className="text-lg font-semibold">Your analysis will appear here</h3>
                  <p>Upload a video or image and enter a prompt to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'agents' && (
          <AgentsView
            agents={agents}
            onSaveAgent={handleSaveAgent}
            onDeleteAgent={handleDeleteAgent}
            defaultAgentId={defaultAgentId}
            onSetDefaultAgent={handleSetDefaultAgent}
          />
        )}
      </main>
    </div>
  );
}
