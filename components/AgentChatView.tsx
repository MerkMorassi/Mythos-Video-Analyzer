import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Agent } from '../services/agentService';
import { Chat, Part, Content } from '@google/genai';
import { createChat, generateSpeech } from '../services/geminiService';
import { ChatMessage } from './ChatMessage';
import { ChatInterface } from './ChatInterface';
import { decode, decodeAudioData } from '../utils/audio';
import { TrashIcon } from './icons/TrashIcon';
import { vectorDb } from '../services/vectorDbService';
import { WarningIcon } from './icons/WarningIcon';
import { useLiveChat } from '../hooks/useLiveChat';
import { MicIcon } from './icons/MicIcon';
import { MicOffIcon } from './icons/MicOffIcon';

interface AgentChatViewProps {
  agent: Agent;
  hasApiKey: boolean;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
  
interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
    fileName?: string;
  };
}


export const AgentChatView: React.FC<AgentChatViewProps> = ({ agent, hasApiKey }) => {
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<{ id: string; role: 'user' | 'model'; parts: ChatMessagePart[] }[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [messageAudioStates, setMessageAudioStates] = useState<Record<string, {
    isGenerating: boolean;
    isPlaying: boolean;
    buffer: AudioBuffer | null;
    error: string | null;
  }>>({});
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRefs = useRef<Record<string, AudioBufferSourceNode | null>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const { isLive, connectionState, liveTranscript, startLiveChat, stopLiveChat } = useLiveChat(agent);


   useEffect(() => {
    if (!hasApiKey || isLive) return;
    const loadChat = async () => {
        const logs = await vectorDb.getAgentChatLogs();
        setChatHistory(logs);

        const formattingInstruction = "IMPORTANT: Format the entire response as clean, well-structured, semantic HTML. Use only standard tags like <p>, <h1>, <ul>, <li>, etc. Do not include any inline styles, <style> blocks, or color attributes.";
        const chatSystemPrompt = `${agent.systemPrompt}. ${formattingInstruction}`;
        
        const geminiHistory: Content[] = logs.map(log => ({
            role: log.role,
            parts: log.parts.map(p => {
                if (p.inlineData) {
                    return { inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } };
                }
                return { text: p.text || '' };
            })
        }));

        const newChat = createChat(chatSystemPrompt, geminiHistory);
        setChatSession(newChat);
    };
    loadChat();
  }, [agent.systemPrompt, hasApiKey, isLive]);
  
  const saveHistory = useCallback((history: { id: string; role: 'user' | 'model'; parts: ChatMessagePart[] }[]) => {
      vectorDb.saveAgentChatLogs(history);
  }, []);
  
  useEffect(() => {
    if (chatHistory.length > 0 && !isLive) {
        saveHistory(chatHistory);
    }
  }, [chatHistory, saveHistory, isLive]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatHistory, isChatLoading, liveTranscript]);
  
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
        { id: `error-${Date.now()}`, role: 'model', parts: [{ text: "Sorry, I encountered an error. Please try again." }] },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDownloadTranscript = () => {
    let transcript = `Agent Chat Transcript\nAgent: ${agent.name}\nTimestamp: ${new Date().toISOString()}\n\n---\n\n`;
    chatHistory.forEach(msg => {
        const prefix = msg.role === 'user' ? 'HITL:' : `${agent.name.toUpperCase()}:`;
        const textContent = msg.parts.map(p => {
            if (p.text) return p.text;
            if (p.inlineData) return `[Attachment: ${p.inlineData.fileName || p.inlineData.mimeType}]`;
            return '';
        }).join(' ');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = textContent;
        transcript += `${prefix} ${tempDiv.innerText || tempDiv.textContent || ''}\n\n`;
    });
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_transcript_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearChat = async () => {
    if (window.confirm("Are you sure you want to clear this entire chat history?")) {
        await vectorDb.clearAgentChatLogs();
        setChatHistory([]);
        
        const formattingInstruction = "IMPORTANT: Format the entire response as clean, well-structured, semantic HTML...";
        const chatSystemPrompt = `${agent.systemPrompt}. ${formattingInstruction}`;
        const newChat = createChat(chatSystemPrompt);
        setChatSession(newChat);
    }
  };
  
    const handleToggleLiveChat = async () => {
        if (isLive) {
            const finalTranscript = await stopLiveChat();
            if (finalTranscript.user.trim() || finalTranscript.model.trim()) {
                setChatHistory(prev => [
                    ...prev,
                    { id: `user-live-${Date.now()}`, role: 'user', parts: [{ text: finalTranscript.user }] },
                    { id: `model-live-${Date.now()}`, role: 'model', parts: [{ text: finalTranscript.model }] },
                ]);
            }
        } else {
            startLiveChat();
        }
    };

    const getLiveStatusText = () => {
        switch (connectionState) {
            case 'connecting': return 'Connecting...';
            case 'connected': return 'Live - Speak Now';
            case 'error': return 'Connection Error';
            default: return 'Voice Mode';
        }
    };


  if (!hasApiKey) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <WarningIcon className="w-12 h-12 text-yellow-500/50 mb-4" />
            <h2 className="text-xl font-bold text-text-primary">API Key Required</h2>
            <p className="text-text-secondary mt-2">
                The Agent Chat is disabled. Please go to the <span className="font-bold text-text-primary">Knowledge</span> tab to configure your Gemini API Key.
            </p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-text-primary">Agent Chat</h2>
                <p className="text-text-secondary">Have a free-form conversation with <span className="font-semibold text-text-primary">{agent.name}</span>.</p>
            </div>
             <div className="flex items-center gap-2">
                 <button
                    onClick={handleToggleLiveChat}
                    className={`px-4 py-2 text-sm font-semibold border rounded-xl transition-all flex items-center gap-2 ${
                        isLive ? 'bg-red-900/40 border-red-500/50 text-red-200 animate-pulse' : 'bg-secondary border-accent text-text-secondary hover:bg-accent hover:text-text-primary'
                    }`}
                >
                    {isLive ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
                    <span>{getLiveStatusText()}</span>
                </button>
                <button
                    onClick={handleDownloadTranscript}
                    disabled={chatHistory.length === 0 || isLive}
                    className="px-4 py-2 text-sm font-semibold bg-secondary border border-accent text-text-secondary hover:bg-accent hover:text-text-primary rounded-xl transition-colors disabled:opacity-50"
                >
                    Download Transcript
                </button>
                 <button
                    onClick={handleClearChat}
                    disabled={chatHistory.length === 0 || isLive}
                    className="p-2 text-sm font-semibold bg-secondary border border-accent text-text-secondary hover:bg-red-900/20 hover:text-red-400 rounded-xl transition-colors disabled:opacity-50"
                    title="Clear Chat History"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
      
        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto min-h-[calc(100vh-300px)]">
             {chatHistory.length === 0 && !isChatLoading && !isLive && (
                <div className="text-center p-8 text-text-secondary italic">
                    No messages yet. Start the conversation below or activate Voice Mode.
                </div>
            )}
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
            
            {isLive && (
                <div className="bg-secondary/30 border border-accent rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-3">
                        <span className="text-sm font-bold text-text-secondary w-12">YOU:</span>
                        <p className="text-text-primary flex-1">{liveTranscript.user}</p>
                    </div>
                     <div className="flex items-start gap-3 border-t border-accent pt-2">
                        <span className="text-sm font-bold text-brand-hover w-12">{agent.name.toUpperCase()}:</span>
                        <p className="text-text-primary flex-1">{liveTranscript.model}</p>
                    </div>
                </div>
            )}
            
            {isChatLoading && (
                <div className="flex justify-start">
                    <div className="flex items-center gap-4 bg-secondary/30 border border-accent rounded-xl p-4 shadow-sm w-full">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0"><div className="animate-spin h-5 w-5 border-2 border-brand border-t-transparent rounded-full"></div></div>
                        <span className="text-sm font-semibold text-text-secondary">Thinking...</span>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

      <div className={`sticky bottom-4 z-20 ${isLive ? 'pointer-events-none opacity-50' : ''}`}>
        <ChatInterface 
            history={chatHistory} 
            message={chatMessage} 
            onMessageChange={setChatMessage} 
            onSendMessage={handleSendMessage} 
            isLoading={isChatLoading} 
        />
      </div>
    </div>
  );
};