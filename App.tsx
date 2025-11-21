
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MediaInput } from './components/MediaInput';
import { AnalysisResult } from './components/AnalysisResult';
import { Loader } from './components/Loader';
import { analyzeVideo, analyzeImage, generateSpeech, createChat } from './services/geminiService';
import { extractFramesFromVideo } from './utils/video';
import { FramePreview } from './components/FramePreview';
import { WarningIcon } from './components/icons/WarningIcon';
// Fixed: Imported saveAgent and deleteAgent which were missing
import { getAgents, Agent, getDefaultAgentId, setDefaultAgentId, saveAgent, deleteAgent } from './services/agentService';
import { AgentsView } from './components/AgentsView';
import { AnalyzerIcon } from './components/icons/AnalyzerIcon';
import { AgentsIcon } from './components/icons/AgentsIcon';
import { Chat, Part, Content } from '@google/genai';
import { ChatInterface } from './components/ChatInterface';


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

const CINEMATOGRAPHY_SUGGESTIONS = {
  video: [
    "Analyze camera movement: Identify tracking shots, push-ins, pans, and establishing shots.",
    "Estimate technical details: Lens focal length, aperture, shutter angle, and depth of field.",
    "Break down the scene: Lighting ratios, blocking, and color grading palette.",
    "Describe the visual narrative: Mood, tone, and storytelling techniques.",
    "Reverse Engineer Prompt: Create a detailed generative video prompt to replicate this sequence, focusing on cinematography and style."
  ],
  image: [
    "Analyze lighting: Key ratios, color temperature, and grading style.",
    "Estimate camera settings: Focal length, aperture, and probable lens choice.",
    "Break down composition: Framing, rule of thirds, and visual balance.",
    "Describe the visual style: Mood, tone, and photographic aesthetic.",
    "Reverse Engineer Prompt: Create a detailed generative image prompt to replicate this shot, focusing on cinematography and lighting."
  ]
};

interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}


export default function App() {
  const [mediaSource, setMediaSource] = useState<File | string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [prompt, setPrompt] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [ragWarning, setRagWarning] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isAudioGenerating, setIsAudioGenerating] = useState<boolean>(false);
  const [playAudioOnLoad, setPlayAudioOnLoad] = useState<boolean>(false);
  const [clearKey, setClearKey] = useState<number>(0);
  
  // Agent management state
  const [activeTab, setActiveTab] = useState<'analyzer' | 'agents'>('analyzer');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [defaultAgentId, setDefaultAgentIdState] = useState<string | null>(null);
  
  // Chat state
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; parts: ChatMessagePart[] }[]>([]);
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

  // Update system prompt in UI
  useEffect(() => {
    if (activeAgent) {
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
    if (audioBuffer && playAudioOnLoad && !isSpeaking) {
      playAudio();
      setPlayAudioOnLoad(false);
    }
  }, [audioBuffer, playAudioOnLoad, isSpeaking, playAudio]);

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
    setIsAudioGenerating(false);
    setPlayAudioOnLoad(false);
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
    setIsAudioGenerating(false);
    stopAudio();
    // Reset chat
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');
  }, [stopAudio]);

  const handleGenerateAudio = async (textToSpeak: string) => {
    if (!activeAgent?.voice) return;

    setIsAudioGenerating(true);
    setAudioError(null);

    try {
        // Strip HTML tags for TTS
        const plainText = textToSpeak.replace(/<[^>]*>/g, '');
        const audioData = await generateSpeech(plainText, activeAgent.voice, activeAgent.speakingRate || 1.0);
        const audioBytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
        const audioCtx = getAudioContext();
        const buffer = await audioCtx.decodeAudioData(audioBytes.buffer);
        
        setAudioBuffer(buffer);
        setPlayAudioOnLoad(true); // Automatically play after manual generation
    } catch (audioErr) {
         console.error("Audio generation failed", audioErr);
         setAudioError("Audio generation failed. Please try again.");
    } finally {
        setIsAudioGenerating(false);
    }
  };

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
    setIsAudioGenerating(false);
    setPlayAudioOnLoad(false);
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
             analysisPrompt = `Context from Knowledge Base:\n${context}\n\nUser Prompt: ${prompt}`;
        }
      }

      let resultText = '';
      let historyParts: Part[] = [];

      if (mediaType === 'video') {
        setProgressMessage('Extracting frames...');
        let frames: string[] = [];
        
        if (typeof mediaSource === 'string') {
          frames = await extractFramesFromVideo(mediaSource, 16);
        } else if (mediaSource instanceof File) {
          const objectUrl = URL.createObjectURL(mediaSource);
          try {
            frames = await extractFramesFromVideo(objectUrl, 16);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }
        
        setExtractedFrames(frames);
        setProgressMessage('Analyzing video content...');
        resultText = await analyzeVideo(analysisPrompt, frames, finalSystemPrompt);
        
        // Prepare history for chat
        historyParts = [
            { text: analysisPrompt },
            ...frames.map(f => ({ inlineData: { mimeType: 'image/jpeg', data: f } }))
        ];

      } else {
        setProgressMessage('Processing image...');
        let base64Image = '';
        
        if (mediaSource instanceof File) {
          base64Image = await fileToBase64(mediaSource);
        } else if (typeof mediaSource === 'string') {
             try {
                const response = await fetch(mediaSource);
                const blob = await response.blob();
                base64Image = await fileToBase64(new File([blob], "image.jpg", { type: blob.type }));
             } catch (e) {
                 throw new Error("Could not process image URL. Please upload the file directly.");
             }
        }
        
        setProgressMessage('Analyzing image...');
        resultText = await analyzeImage(analysisPrompt, base64Image, 'image/jpeg', finalSystemPrompt);
        setExtractedFrames([base64Image]); // Show preview

        // Prepare history for chat
        historyParts = [
            { text: analysisPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
        ];
      }

      setAnalysisResult(resultText);

      // Initialize Chat Session with the context of the analysis
      const initialHistory: Content[] = [
          {
              role: 'user',
              parts: historyParts
          },
          {
              role: 'model',
              parts: [{ text: resultText }]
          }
      ];
      
      const newChat = createChat(finalSystemPrompt, initialHistory);
      setChatSession(newChat);
      setChatHistory([]); 

      // Auto-generate audio only if explicitly requested by agent settings
      if (activeAgent && activeAgent.voice && activeAgent.autoPlayAudio) {
          // Trigger generation without blocking the UI
          handleGenerateAudio(resultText);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  };

  const handleSendMessage = async (files?: File[]) => {
    if (!chatSession || (!chatMessage.trim() && (!files || files.length === 0))) return;

    setIsChatLoading(true);
    const currentMessage = chatMessage; 
    setChatMessage(''); 

    try {
        const parts: Part[] = [];
        
        // Add uploaded files to parts
        if (files && files.length > 0) {
            for (const file of files) {
                const base64 = await fileToBase64(file);
                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64
                    }
                });
            }
        }
        
        // Add text to parts
        if (currentMessage.trim()) {
            parts.push({ text: currentMessage });
        }

        // Optimistic update for UI
        const newHistoryEntry = { 
            role: 'user' as const, 
            parts: parts.map(p => ({
                text: p.text,
                inlineData: p.inlineData ? {
                    mimeType: p.inlineData.mimeType,
                    data: p.inlineData.data
                } : undefined
            }))
        };
        
        setChatHistory(prev => [...prev, newHistoryEntry]);

        // Send to Gemini
        const result = await chatSession.sendMessage({ message: parts });
        const responseText = result.text;
        
        if (responseText) {
             setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        }

    } catch (err) {
        console.error("Chat error:", err);
        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I encountered an error processing your message. Please try again." }] }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-primary text-text-primary font-sans selection:bg-brand selection:text-white">
       {/* Tab Navigation */}
      <div className="border-b border-accent bg-secondary/30 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex">
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'analyzer' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <AnalyzerIcon className="w-5 h-5" />
            Analyzer
            {activeTab === 'analyzer' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand animate-fade-in"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('agents')}
             className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'agents' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <AgentsIcon className="w-5 h-5" />
            Agents
             {activeTab === 'agents' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand animate-fade-in"></span>
            )}
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto p-6 pb-20">
        {activeTab === 'analyzer' ? (
          <div className="flex flex-col space-y-8 animate-fade-in">
            {/* Header */}
            <div className="text-center space-y-2">
               <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">
                AI Media Analyzer
              </h1>
              <p className="text-text-secondary">
                Upload media for detailed cinematography & visual analysis.
              </p>
               {/* Active Agent - Hidden from visual layout but logically present, can be shown as badge if needed */}
               <div className="hidden">
                   Active Agent: {activeAgent?.name}
               </div>
            </div>

            {/* Media Input */}
            <div className="bg-secondary/30 p-6 rounded-xl border border-accent shadow-sm">
              <MediaInput key={clearKey} onMediaChange={handleMediaChange} />
            </div>

            {/* Analysis Controls */}
            <div className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-text-secondary mb-2">
                  2. Analysis Prompt
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={mediaType === 'video' ? "Describe the video content, ask about cinematography, or request a summary..." : "Describe the image, ask about lighting, composition, or details..."}
                  className="w-full h-28 p-4 bg-secondary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70 shadow-inner text-base"
                />
              </div>
              
              {/* Suggestions */}
               <div className="flex flex-wrap gap-2">
                {CINEMATOGRAPHY_SUGGESTIONS[mediaType].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full bg-accent/50 hover:bg-brand hover:text-white border border-accent transition-colors text-text-secondary text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              
              <div className="flex space-x-4 items-stretch pt-2">
                <button
                  onClick={handleAnalyzeClick}
                  disabled={isLoading || !mediaSource || !prompt.trim()}
                  className="flex-1 py-3 bg-brand text-text-primary font-semibold rounded-xl hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95 text-base flex items-center justify-center"
                >
                  {isLoading ? 'Analyzing...' : 'Analyze'}
                </button>
                <button
                  onClick={resetState}
                  className="px-6 py-3 bg-secondary border border-accent text-text-secondary font-semibold rounded-xl hover:bg-accent hover:text-text-primary transition-colors flex items-center justify-center"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Errors & Warnings */}
            {(error || audioError || ragWarning) && (
                <div className="space-y-3">
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200 animate-fade-in">
                            <WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    {ragWarning && (
                        <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-start gap-3 text-yellow-200 animate-fade-in">
                            <WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{ragWarning}</p>
                        </div>
                    )}
                     {audioError && (
                        <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-xl flex items-start gap-3 text-orange-200 animate-fade-in">
                            <WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{audioError}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Loader */}
            {isLoading && (
              <div className="py-12 animate-fade-in">
                <Loader message={progressMessage} mediaType={mediaType} />
              </div>
            )}

            {/* Results */}
            {!isLoading && (analysisResult || extractedFrames.length > 0) && (
              <div className="space-y-8 animate-fade-in">
                <div className="border-t border-accent pt-8">
                    <FramePreview frames={extractedFrames} title={mediaType === 'video' ? 'Extracted Keyframes' : 'Analyzed Image'} />
                </div>
                
                {analysisResult && (
                  <div className="bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm">
                     <AnalysisResult
                        result={analysisResult}
                        onPlayAudio={playAudio}
                        onStopAudio={stopAudio}
                        isSpeaking={isSpeaking}
                        hasAudio={!!audioBuffer}
                        onGenerateAudio={() => handleGenerateAudio(analysisResult)}
                        isAudioGenerating={isAudioGenerating}
                      />
                  </div>
                )}
                
                {/* Chat Interface */}
                <ChatInterface 
                    history={chatHistory}
                    message={chatMessage}
                    onMessageChange={setChatMessage}
                    onSendMessage={handleSendMessage}
                    isLoading={isChatLoading}
                />
              </div>
            )}
          </div>
        ) : (
          <AgentsView
            agents={agents}
            onSaveAgent={(agent) => {
              saveAgent(agent);
              setAgents(getAgents());
            }}
            onDeleteAgent={(id) => {
              deleteAgent(id);
              setAgents(getAgents());
            }}
            defaultAgentId={defaultAgentId}
            onSetDefaultAgent={(id) => {
                setDefaultAgentId(id);
                setDefaultAgentIdState(id);
            }}
          />
        )}
      </main>
    </div>
  );
}
