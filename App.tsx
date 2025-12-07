
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MediaInput } from './components/MediaInput';
import { AnalysisResult } from './components/AnalysisResult';
import { Loader } from './components/Loader';
import { analyzeVideo, analyzeImage, generateSpeech, createChat, generateSdxlPrompt, getEmbeddings, generateText } from './services/geminiService';
import { extractFramesFromVideo } from './utils/video';
import { decode, decodeAudioData } from './utils/audio';
import { FramePreview } from './components/FramePreview';
import { WarningIcon } from './components/icons/WarningIcon';
import { getAgent, saveAgent, Agent } from './services/agentService';
import { AgentForm } from './components/AgentForm';
import { AnalyzerIcon } from './components/icons/AnalyzerIcon';
import { Chat, Part, Content } from '@google/genai';
import { ChatInterface } from './components/ChatInterface';
import { DatabaseIcon } from './components/icons/DatabaseIcon';
import { UserIcon } from './components/icons/UserIcon';
import { ChatMessage } from './components/ChatMessage';
import { BookmarkIcon } from './components/icons/BookmarkIcon';
import { PromptTemplatesView } from './components/PromptTemplatesView';
import { getDefaultPromptTemplate } from './services/promptTemplateService';
import { ReEngineeredPrompt, ReEngineeredPromptLoader } from './components/ReEngineeredPrompt';
import { fetchKnowledgeBaseContext } from './services/ragService';
import { KnowledgeBaseContext } from './components/KnowledgeBaseContext';
import { KnowledgeView } from './components/KnowledgeView';
import { vectorDb } from './services/vectorDbService';
import { TELEPORTER } from './utils/numMarkX';
import { cosineSimilarity } from './services/embeddingService';
import { PencilIcon } from './components/icons/PencilIcon';
import { ChatIcon } from './components/icons/ChatIcon';
import { AgentChatView } from './components/AgentChatView';
import { getApiKey } from './services/apiKeyService';
import { htmlToMarkdown } from './utils/htmlToMarkdown';


const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

interface Suggestion {
  label: string;
  prompt: string;
}

const CINEMATOGRAPHY_SUGGESTIONS: { video: Suggestion[]; image: Suggestion[] } = {
  video: [
    { label: "Camera Movement", prompt: "Analyze camera movement: Identify tracking shots, push-ins, pans, and establishing shots." },
    { label: "Lens & Settings", prompt: "Analyze the probable lens used, aperture, and other camera settings for this video, including camera model, ISO, and shutter angle." },
    { label: "Scene Breakdown", prompt: "Break down the scene: Lighting ratios, blocking, and color grading palette." },
    { label: "Narrative", prompt: "Describe the visual narrative: Mood, tone, and storytelling techniques." },
    { label: "Reverse Engineer", prompt: "Reverse Engineer Prompt: Create a detailed generative video prompt to replicate this sequence, focusing on cinematography and style." }
  ],
  image: [
    { label: "Lighting", prompt: "Analyze lighting: Key ratios, color temperature, and grading style." },
    { label: "Lens & Settings", prompt: "Analyze the probable lens used, aperture, depth of field, and other camera settings for this image." },
    { label: "Composition", prompt: "Break down composition: Framing, rule of thirds, and visual balance." },
    { label: "Visual Style", prompt: "Describe the visual style: Mood, tone, and photographic aesthetic." },
    { label: "Reverse Engineer", prompt: "Reverse Engineer Prompt: Create a detailed generative image prompt to replicate this shot, focusing on cinematography and lighting." }
  ]
};


interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
    fileName?: string;
  };
}


export default function App() {
  const [mediaSource, setMediaSource] = useState<File | string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('image');
  const [prompt, setPrompt] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [messageAudioStates, setMessageAudioStates] = useState<Record<string, {
    isGenerating: boolean;
    isPlaying: boolean;
    buffer: AudioBuffer | null;
    error: string | null;
  }>>({});
  
  const [ragWarning, setRagWarning] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<string[]>([]);
  
  const [clearKey, setClearKey] = useState<number>(0);
  
  const [activeTab, setActiveTab] = useState<'analyzer' | 'chat' | 'knowledge' | 'templates'>('analyzer');
  
  // Single Agent State
  const [agent, setAgent] = useState<Agent>(getAgent());
  const [isAgentSettingsOpen, setIsAgentSettingsOpen] = useState(false);
  
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<{ id: string; role: 'user' | 'model'; parts: ChatMessagePart[] }[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isChatVisible, setIsChatVisible] = useState(false);

  const [isReEngineering, setIsReEngineering] = useState<boolean>(false);
  const [reEngineeredPrompt, setReEngineeredPrompt] = useState<string | null>(null);
  const [retrievedContext, setRetrievedContext] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!getApiKey());


  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRefs = useRef<Record<string, AudioBufferSourceNode | null>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollTriggerRef = useRef<HTMLDivElement>(null);

  // Initialize Local RAG System
  useEffect(() => {
      const initRag = async () => {
          try {
              const allVectors = await vectorDb.getAllVectors();
              TELEPORTER.rebuildIndex(allVectors);
          } catch (e) {
              console.error("Failed to initialize local RAG index:", e);
          }
      };
      initRag();
  }, []);

  useEffect(() => {
    if (chatHistory.length > 0 || isChatLoading) {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chatHistory, isChatLoading]);

  useEffect(() => {
    if (!analysisResult || isChatVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsChatVisible(true);
          observer.disconnect();
        }
      },
      { root: null, threshold: 1.0 }
    );

    if (scrollTriggerRef.current) {
      observer.observe(scrollTriggerRef.current);
    }

    return () => observer.disconnect();
  }, [analysisResult, isChatVisible]);

  const refreshAgent = useCallback(() => {
    setAgent(getAgent());
  }, []);

  useEffect(() => {
    refreshAgent();
  }, [refreshAgent]);

  const handleApiKeyUpdate = useCallback(() => {
    setHasApiKey(!!getApiKey());
  }, []);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const playAudio = useCallback((messageId: string) => {
    const audioState = messageAudioStates[messageId];
    if (!audioState?.buffer || audioState.isPlaying) return;

    const audioCtx = getAudioContext();
    const source = audioCtx.createBufferSource();
    source.buffer = audioState.buffer;
    source.connect(audioCtx.destination);
    source.onended = () => {
      setMessageAudioStates(prev => ({...prev, [messageId]: {...prev[messageId], isPlaying: false}}));
      audioSourceRefs.current[messageId] = null;
    };
    source.start();
    setMessageAudioStates(prev => ({...prev, [messageId]: {...prev[messageId], isPlaying: true}}));
    audioSourceRefs.current[messageId] = source;
  }, [messageAudioStates]);

  const stopAudio = useCallback((messageId: string) => {
    if (audioSourceRefs.current[messageId]) {
      audioSourceRefs.current[messageId]?.stop();
    }
  }, []);
  
  const stopAllAudio = useCallback(() => {
    Object.keys(audioSourceRefs.current).forEach(id => {
        if (audioSourceRefs.current[id]) {
            audioSourceRefs.current[id]?.stop();
        }
    });
  }, []);
  
  const resetState = useCallback(() => {
    setMediaSource(null);
    setMediaType('image');
    setPrompt('');
    setAnalysisResult(null);
    setError(null);
    setRagWarning(null);
    setRetrievedContext(null);
    setExtractedFrames([]);
    setMessageAudioStates({});
    stopAllAudio();
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');
    setIsChatVisible(false);
    setReEngineeredPrompt(null);
    setIsReEngineering(false);
    setClearKey(prevKey => prevKey + 1); 
  }, [stopAllAudio]);

  const handleMediaChange = useCallback((media: { type: 'video' | 'image'; source: File | string | null }) => {
    setMediaType(media.type);
    setMediaSource(media.source);
    setAnalysisResult(null);
    setError(null);
    setRagWarning(null);
    setRetrievedContext(null);
    setExtractedFrames([]);
    setMessageAudioStates({});
    stopAllAudio();
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');
    setIsChatVisible(false);
    setReEngineeredPrompt(null);
    setIsReEngineering(false);
  }, [stopAllAudio]);

  const handleGenerateAudio = async (textToSpeak: string, messageId: string) => {
    if (!agent?.voice) return;

    setMessageAudioStates(prev => ({...prev, [messageId]: { ...prev[messageId], isGenerating: true, error: null }}));

    try {
        const plainText = textToSpeak.replace(/<[^>]*>/g, '');
        const audioData = await generateSpeech(plainText, agent.voice, agent.speakingRate || 1.0);
        const audioBytes = decode(audioData);
        const audioCtx = getAudioContext();
        const buffer = await decodeAudioData(audioBytes, audioCtx, 24000, 1);
        
        setMessageAudioStates(prev => ({
            ...prev,
            [messageId]: { ...prev[messageId], isGenerating: false, buffer, isPlaying: false }
        }));
        playAudio(messageId);
    } catch (audioErr) {
         console.error("Audio generation failed", audioErr);
         setMessageAudioStates(prev => ({
            ...prev,
            [messageId]: { ...prev[messageId], isGenerating: false, error: "Audio generation failed. Please try again." }
        }));
    }
  };

  const handleAnalyzeClick = async () => {
    if (!hasApiKey) {
        setError("API Key not set. Please go to the Knowledge tab to configure your API Key.");
        setActiveTab('knowledge');
        return;
    }
    if (!mediaSource || !prompt.trim() || !agent) {
      setError(mediaSource && prompt.trim() ? 'Agent configuration error.' : `Please select a ${mediaType} and provide an analysis prompt.`);
      return;
    }
    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);
    setRagWarning(null);
    setRetrievedContext(null);
    setExtractedFrames([]);
    stopAllAudio();
    setMessageAudioStates({});
    setChatSession(null);
    setChatHistory([]);
    setChatMessage('');
    setIsChatVisible(false);
    setReEngineeredPrompt(null);
    setIsReEngineering(false);

    const finalSystemPrompt = agent.systemPrompt;
    let analysisPrompt = prompt;
    let localContextParts: string[] = [];
    let externalContextParts: string[] = [];

    try {
      // 1. External RAG
      if (agent.knowledgeBaseUrl) {
        setProgressMessage('Searching external knowledge base...');
        const { context, warning } = await fetchKnowledgeBaseContext(agent.knowledgeBaseUrl, prompt);
        if (warning) setRagWarning(warning);
        if (context) {
            externalContextParts.push(`--- EXTERNAL KNOWLEDGE ---\n${context}`);
        }
      }

      // 2. Local RAG (Hybrid: Teleport + Vectors)
      if (agent.enableLocalRag) {
          setProgressMessage('Consulting Mythos Vault (Local Memory)...');
          try {
              const allVectors = await vectorDb.getAllVectors();
              
              // A. Teleporter (O(1) Keyword Match)
              // FIX: Changed type of directHitsIds from string[] to number[] to match the return type of TELEPORTER.teleport.
              // This resolves the type error and allows correct filtering of vectors by ID.
              const directHitsIds: number[] | null = TELEPORTER.teleport(prompt);
              if (directHitsIds && directHitsIds.length > 0) {
                  const directDocs = allVectors.filter(v => directHitsIds.includes(v.id));
                  if (directDocs.length > 0) {
                       const text = directDocs.map(d => `>>> [DIRECT TELEPORT: ${d.source}]\n${d.text}`).join('\n\n');
                       localContextParts.push(`=== EXACT COORDINATE MATCHES (SHANNON/LOGOS) ===\n${text}`);
                  }
              }

              // B. Vector Resonance
              if (allVectors.length > 0) {
                  const queryEmbedding = await getEmbeddings(prompt);
                  if (queryEmbedding) {
                      const scored = allVectors.map(v => ({ ...v, score: cosineSimilarity(queryEmbedding, v.vector) }));
                      const topMatches = scored.sort((a, b) => b.score - a.score)
                                             .slice(0, 8)
                                             .filter(v => v.score > 0.45);
                      
                      if (topMatches.length > 0) {
                          const text = topMatches.map(m => `--- [RESONANCE: ${m.source}] ---\n${m.text}`).join('\n\n');
                           localContextParts.push(`=== RESONANT MATCHES (ELARA/GNOSIS) ===\n${text}`);
                      }
                  }
              }
          } catch (e) {
              console.error("Local RAG failed:", e);
          }
      }
      
      const hasContext = localContextParts.length > 0 || externalContextParts.length > 0;
      const protectedWordsInstruction = agent.protectedWords ? `3. CRITICAL: Do not modify these protected terms: ${agent.protectedWords}.` : '';

      if (hasContext) {
          const contextBlock = [...localContextParts, ...externalContextParts].join('\n\n');
          analysisPrompt = `
          HYBRID MEMORY STREAM:
          ${contextBlock}

          USER QUERY: ${prompt}

          INSTRUCTIONS:
          1. Prioritize EXACT COORDINATE MATCHES for facts/code. 
          2. Use RESONANT MATCHES for nuance/context.
          ${protectedWordsInstruction}
          `;
          setRetrievedContext(contextBlock.trim());
      } else if (agent.protectedWords) {
          analysisPrompt = `${prompt}\n\nINSTRUCTIONS:\n${protectedWordsInstruction.replace('3. ', '1. ')}`;
      }


      let resultText = '';
      let historyParts: Part[] = [];

      if (mediaType === 'video') {
        setProgressMessage('Extracting frames...');
        let frames = [];
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
        historyParts = [{ text: analysisPrompt }, ...frames.map(f => ({ inlineData: { mimeType: 'image/jpeg', data: f } }))];
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
        setExtractedFrames([base64Image]);
        historyParts = [{ text: analysisPrompt }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }];
      }

      setAnalysisResult(resultText);

      const initialHistory: Content[] = [{ role: 'user', parts: historyParts }, { role: 'model', parts: [{ text: resultText }] }];
      const formattingInstruction = "IMPORTANT: Format the entire response as clean, well-structured, semantic HTML. Use only standard tags like <p>, <h1>, <ul>, <li>, etc. Do not include any inline styles, <style> blocks, or color attributes. The styling is handled by the application's CSS.";
      const chatSystemPrompt = `${finalSystemPrompt}. ${formattingInstruction}`;
      const newChat = createChat(chatSystemPrompt, initialHistory);
      setChatSession(newChat);
      setChatHistory([]); 

      if (agent.voice && agent.autoPlayAudio) {
          handleGenerateAudio(resultText, 'analysis-result');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  };
  
    const handleKnowledgeAnalytics = async (type: 'SUMMARY' | 'QUESTIONS' | 'ENTITIES' | 'GAPS') => {
        if (!hasApiKey) {
            setError("API Key not set. Please configure it first.");
            return;
        }
        setIsLoading(true);
        setProgressMessage(`Running ${type.toLowerCase()} on Knowledge Base...`);
        setError(null);
        setActiveTab('analyzer'); 
        
        try {
            const vectors = await vectorDb.getAllVectors();
            if (vectors.length === 0) {
                setError("Knowledge Base is empty. Ingest documents to run analytics.");
                return;
            }

            const sample = vectors.sort(() => 0.5 - Math.random())
                                .slice(0, 30)
                                .map(v => v.text)
                                .join("\n\n---\n\n");
            let prompt = '';

            switch(type) {
                case 'SUMMARY':
                    prompt = `Synthesize these text fragments from a knowledge base into a high-level executive briefing. Identify key themes, entities, and relationships.\n\nCONTEXT:\n${sample}`;
                    break;
                case 'QUESTIONS':
                    prompt = `Based on these text fragments, suggest three insightful questions a user might ask to explore the knowledge base further.\n\nCONTEXT:\n${sample}`;
                    break;
                case 'ENTITIES':
                    prompt = `Extract all key named entities (characters, locations, organizations, concepts) from the following text fragments. Group them by category.\n\nCONTEXT:\n${sample}`;
                    break;
                case 'GAPS':
                     prompt = `Act as a continuity editor. Review the following text fragments from a knowledge base. Identify potential contradictions, inconsistencies, or significant gaps in the information. Provide a bulleted list of your findings.\n\nCONTEXT:\n${sample}`;
                     break;
            }
            
            const result = await generateText(prompt);
            setAnalysisResult(`AI analysis of your Knowledge Base is complete. See conversation below for details.`);
            const messageId = `analytics-${Date.now()}`;
            setChatHistory(prev => [...prev, { id: messageId, role: 'model', parts: [{ text: result }] }]);
            setIsChatVisible(true);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to run analytics: ${errorMessage}`);
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
      const partsForHistory: ChatMessagePart[] = [];
      const partsForApi: Part[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const base64 = await fileToBase64(file);
          const mimeType = file.type || 'application/octet-stream';
          partsForHistory.push({ inlineData: { mimeType, data: base64, fileName: file.name } });
          partsForApi.push({ inlineData: { mimeType, data: base64 } });
        }
      }
      if (currentMessage.trim()) {
        partsForHistory.push({ text: currentMessage });
        partsForApi.push({ text: currentMessage });
      }

      const newHistoryEntry = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        parts: partsForHistory,
      };
      setChatHistory((prev) => [...prev, newHistoryEntry]);

      const result = await chatSession.sendMessage({ message: partsForApi });
      const responseText = result.text;

      if (responseText) {
        const modelMessageId = `model-${Date.now()}`;
        setChatHistory((prev) => [...prev, { id: modelMessageId, role: 'model', parts: [{ text: responseText }] }]);
        if (agent.autoPlayAudio) {
          handleGenerateAudio(responseText, modelMessageId);
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: 'model', parts: [{ text: "Sorry, I encountered an error processing your message. Please try again." }] },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => setPrompt(suggestion);
  
  const handleReEngineerPrompt = async () => {
    if (!analysisResult) return;
    if (!hasApiKey) {
        setError("API Key not set. Please configure it first.");
        setActiveTab('knowledge');
        return;
    }
    
    const template = getDefaultPromptTemplate();
    if (!template) {
        setError("No default prompt template found. Please set a default in the Templates tab.");
        return;
    }
    
    setIsReEngineering(true);
    setReEngineeredPrompt(null);
    setError(null);

    try {
        const promptWithContext = template.content.replace('{{ANALYSIS_TEXT}}', analysisResult);
        const result = await generateSdxlPrompt(promptWithContext);
        setReEngineeredPrompt(result);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate prompt: ${errorMessage}`);
    } finally {
        setIsReEngineering(false);
    }
  };
  
    const handleForgeArtifact = () => {
    if (!analysisResult) return;

    // 1. Provenance Header
    let artifactContent = `---
Source Media: ${mediaSource instanceof File ? mediaSource.name : mediaSource || 'N/A'}
Agent: ${agent.name}
Timestamp: ${new Date().toISOString()}
Locus: Media_Analysis_Agent // Localhost
---\n\n`;

    // 2. Initial Prompt
    artifactContent += `## Initial Prompt (The Intent)\n\n`;
    artifactContent += `> ${prompt}\n\n`;

    // 3. Analysis Result
    artifactContent += `## Analysis Result (The Flesh)\n\n`;
    artifactContent += `${htmlToMarkdown(analysisResult)}\n\n`;
    
    // 4. Re-engineered prompt
    if (reEngineeredPrompt) {
        artifactContent += `## Re-Engineered Prompt (The Transmutation)\n\n`;
        artifactContent += `${htmlToMarkdown(reEngineeredPrompt)}\n\n`;
    }

    // 5. Follow-up Conversation
    if (chatHistory.length > 0) {
      artifactContent += `## Follow-up Conversation (The Dialogue)\n\n`;
      chatHistory.forEach(msg => {
        const prefix = msg.role === 'user' ? '**HITL:**' : `**${agent.name}:**`;
        const textContent = msg.parts.map(p => {
            if (p.text) return htmlToMarkdown(p.text);
            if (p.inlineData) return `[Attachment: ${p.inlineData.fileName || p.inlineData.mimeType}]`;
            return '';
        }).join(' ');
        artifactContent += `${prefix} ${textContent}\n\n`;
      });
    }

    // Create and download the file
    const blob = new Blob([artifactContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lore_artifact_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveAgentSettings = (updatedAgentData: Partial<Agent>) => {
     const newAgentData: Agent = {
         ...agent,
         ...updatedAgentData,
     };
     saveAgent(newAgentData);
     setAgent(newAgentData);
     setIsAgentSettingsOpen(false);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
        case 'analyzer':
            return (
              <div className="flex flex-col space-y-8 animate-fade-in">
                <div className="text-center space-y-3">
                   <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-text-secondary">Media Analysis Agent</h1>
                  <p className="text-text-secondary text-sm">Upload media for detailed cinematography & visual analysis.</p>
                  
                   <div className="flex justify-center">
                      <div className="flex items-center gap-2 bg-secondary/50 border border-accent rounded-xl pl-3 pr-1 py-1 group hover:border-brand/50 transition-colors">
                          {agent.avatar ? <img src={agent.avatar} alt={agent.name} className="w-5 h-5 rounded-full object-cover" /> : <UserIcon className="w-4 h-4 text-text-secondary"/>}
                          <span className="text-xs font-medium text-text-primary">{agent.name}</span>
                          {(agent.knowledgeBaseUrl || agent.enableLocalRag) && (
                              <div title={agent.enableLocalRag ? "Local & Remote RAG Active" : "Remote RAG Active"}>
                                  <div className="flex items-center gap-1 bg-brand/20 text-brand-hover px-2 py-0.5 rounded-full">
                                      <DatabaseIcon className="w-3 h-3" />
                                      <span className="text-[10px] font-bold uppercase tracking-wider">RAG Active</span>
                                  </div>
                              </div>
                          )}
                          <button 
                            onClick={() => setIsAgentSettingsOpen(true)}
                            className="p-1.5 rounded-lg hover:bg-accent text-text-secondary hover:text-text-primary transition-colors"
                            title="Configure Agent Persona"
                          >
                              <PencilIcon className="w-3 h-3" />
                          </button>
                      </div>
                   </div>
    
                </div>
    
                <div className="bg-secondary/30 p-6 rounded-xl border border-accent shadow-sm">
                  <MediaInput key={clearKey} onMediaChange={handleMediaChange} />
                </div>
    
                <div className="space-y-4">
                  <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-text-secondary mb-2">2. Analysis Prompt</label>
                    <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={mediaType === 'video' ? "Describe the video content..." : "Describe the image..."} className="w-full h-28 p-4 bg-secondary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70 shadow-inner text-base" />
                  </div>
                  
                   <div className="flex flex-wrap gap-2">
                    {CINEMATOGRAPHY_SUGGESTIONS[mediaType].map((suggestion, idx) => (
                      <button key={idx} onClick={() => handleSuggestionClick(suggestion.prompt)} className="text-xs px-3 py-1.5 rounded-xl bg-accent/50 hover:bg-brand hover:text-white border border-accent transition-colors text-text-secondary">{suggestion.label}</button>
                    ))}
                  </div>
                  
                  <div className="flex space-x-4 items-stretch pt-2">
                    <button onClick={handleAnalyzeClick} disabled={isLoading || !mediaSource || !prompt.trim() || !hasApiKey} className="flex-1 py-3 bg-brand text-text-primary font-semibold rounded-xl hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95 text-base flex items-center justify-center">
                      {isLoading ? 'Analyzing...' : 'Analyze'}
                    </button>
                    <button onClick={resetState} className="px-6 py-3 bg-secondary border border-accent text-text-secondary font-semibold rounded-xl hover:bg-accent hover:text-text-primary transition-colors flex items-center justify-center text-base">Clear All</button>
                  </div>
                </div>
    
                {error && <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200 animate-fade-in"><WarningIcon className="w-5 h-5 flex-shrink-0 mt-0.5" /><p className="text-sm">{error}</p></div>}
                
                {isLoading && <div className="py-12 animate-fade-in"><Loader message={progressMessage} mediaType={mediaType} /></div>}
    
                {!isLoading && (analysisResult || extractedFrames.length > 0 || retrievedContext) && (
                  <div className="space-y-8 animate-fade-in">
                    {retrievedContext && (agent.knowledgeBaseUrl || agent.enableLocalRag) && (
                        <KnowledgeBaseContext context={retrievedContext} warning={ragWarning} url={agent.knowledgeBaseUrl || 'Mythos Vault (Local)'} />
                    )}
    
                    {analysisResult && (
                      <>
                        <div className="border-t border-accent pt-8"><FramePreview frames={extractedFrames} title={mediaType === 'video' ? 'Extracted Keyframes' : 'Analyzed Image'} /></div>
                        <div className="bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm">
                           <AnalysisResult 
                              result={analysisResult} 
                              audioState={messageAudioStates['analysis-result']}
                              onPlayAudio={() => playAudio('analysis-result')} 
                              onStopAudio={() => stopAudio('analysis-result')} 
                              onGenerateAudio={() => handleGenerateAudio(analysisResult, 'analysis-result')} 
                              onReEngineerPrompt={handleReEngineerPrompt} 
                              isReEngineering={isReEngineering} 
                              onForgeArtifact={handleForgeArtifact}
                           />
                        </div>
                        
                        {isReEngineering && <ReEngineeredPromptLoader />}
                        {reEngineeredPrompt && <div className="animate-fade-in"><ReEngineeredPrompt prompt={reEngineeredPrompt} /></div>}
    
                        <div ref={scrollTriggerRef} className="h-1" />
                        
                        {chatHistory.map((msg) => (
                          <ChatMessage 
                            key={msg.id} 
                            message={msg} 
                            agent={agent} 
                            audioState={messageAudioStates[msg.id]}
                            onPlayAudio={() => playAudio(msg.id)}
                            onStopAudio={() => stopAudio(msg.id)}
                            onGenerateAudio={(text) => handleGenerateAudio(text, msg.id)}
                          />
                        ))}
                        
                        {isChatLoading && (
                           <div className="flex justify-start">
                               <div className="flex items-center gap-4 bg-secondary/30 border border-accent rounded-xl p-4 shadow-sm w-full">
                                   <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0"><div className="animate-spin h-5 w-5 border-2 border-brand border-t-transparent rounded-full"></div></div>
                                   <span className="text-sm font-semibold text-text-secondary">Thinking...</span>
                               </div>
                           </div>
                        )}
    
                        <div ref={chatEndRef} />
                        
                        <div className={`sticky bottom-4 z-20 transition-all duration-500 ease-in-out transform ${isChatVisible ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0'}`}>
                          <ChatInterface history={chatHistory} message={chatMessage} onMessageChange={setChatMessage} onSendMessage={handleSendMessage} isLoading={isChatLoading} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
        case 'chat':
            return <AgentChatView agent={agent} hasApiKey={hasApiKey} />;
        case 'knowledge':
            return <KnowledgeView onRunAnalysis={handleKnowledgeAnalytics} agent={agent} onSaveSettings={handleSaveAgentSettings} onApiKeyUpdate={handleApiKeyUpdate} hasApiKey={hasApiKey} />;
        case 'templates':
            return <PromptTemplatesView />;
        default:
            return null;
    }
  };


  return (
    <div className="min-h-screen bg-primary text-text-primary font-sans selection:bg-brand selection:text-white">
      <div className="border-b border-accent bg-secondary/30 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex">
          <button onClick={() => setActiveTab('analyzer')} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'analyzer' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            <AnalyzerIcon className="w-5 h-5" /> Analyzer
            {activeTab === 'analyzer' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand animate-fade-in"></span>}
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'chat' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            <ChatIcon className="w-5 h-5" /> Agent Chat
            {activeTab === 'chat' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand animate-fade-in"></span>}
          </button>
          <button onClick={() => setActiveTab('knowledge')} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'knowledge' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            <DatabaseIcon className="w-5 h-5" /> Knowledge
            {activeTab === 'knowledge' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand animate-fade-in"></span>}
          </button>
          <button onClick={() => setActiveTab('templates')} className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'templates' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
            <BookmarkIcon className="w-5 h-5" /> Templates
            {activeTab === 'templates' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand animate-fade-in"></span>}
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto p-6 pb-20">
        {renderActiveTab()}
      </main>
       
      {isAgentSettingsOpen && (
          <AgentForm 
              agent={agent}
              onSave={handleSaveAgentSettings}
              onCancel={() => setIsAgentSettingsOpen(false)}
          />
      )}
    </div>
  );
}
