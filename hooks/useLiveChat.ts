
import { useState, useRef, useCallback } from 'react';
// FIX: Alias Blob to GenAIBlob to avoid conflict with global Blob type.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { getApiKey } from '../services/apiKeyService';
import { Agent } from '../services/agentService';
import { decode, decodeAudioData, encode } from '../utils/audio';

// Define the shape of the live transcript state
interface LiveTranscript {
    user: string;
    model: string;
}

// Define the connection state types
type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export const useLiveChat = (agent: Agent) => {
    const [isLive, setIsLive] = useState(false);
    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [liveTranscript, setLiveTranscript] = useState<LiveTranscript>({ user: '', model: '' });

    // FIX: Using 'any' for the session promise ref as the 'LiveSession' type is not an exported member of the SDK.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const finalTranscriptRef = useRef<LiveTranscript>({ user: '', model: '' });

    const stopLiveChat = useCallback(async () => {
        setIsLive(false);
        setConnectionState('idle');

        // Close media stream tracks
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        // Disconnect audio nodes
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;

        // Close audio contexts
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        // Stop any playing audio
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        // Close the Gemini session
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing live session:", e);
            }
            sessionPromiseRef.current = null;
        }

        const finalTranscript = { ...finalTranscriptRef.current };
        finalTranscriptRef.current = { user: '', model: '' }; // Reset for next session
        setLiveTranscript({ user: '', model: '' });

        return finalTranscript;
    }, []);

    const startLiveChat = useCallback(async () => {
        if (isLive) return;

        const apiKey = getApiKey();
        if (!apiKey) {
            setConnectionState('error');
            console.error("API Key not found for live chat.");
            return;
        }

        setIsLive(true);
        setConnectionState('connecting');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;

            const ai = new GoogleGenAI({ apiKey });
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agent.voice || 'Kore' } } },
                    systemInstruction: agent.systemPrompt,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        setConnectionState('connected');
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: GenAIBlob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle transcription
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                             setLiveTranscript(prev => ({ ...prev, user: prev.user + text }));
                        }
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            setLiveTranscript(prev => ({ ...prev, model: prev.model + text }));
                        }
                        if (message.serverContent?.turnComplete) {
                            finalTranscriptRef.current.user = liveTranscript.user;
                            finalTranscriptRef.current.model = liveTranscript.model;
                        }

                        // Handle audio output
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const audioCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);

                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                            const source = audioCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioCtx.destination);
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live chat error:', e);
                        setConnectionState('error');
                        stopLiveChat();
                    },
                    onclose: () => {
                        setConnectionState('idle');
                    },
                },
            });

        } catch (err) {
            console.error('Failed to start live chat:', err);
            setConnectionState('error');
            setIsLive(false);
        }
    }, [isLive, agent.voice, agent.systemPrompt, stopLiveChat, liveTranscript.user, liveTranscript.model]);

    return { isLive, connectionState, liveTranscript, startLiveChat, stopLiveChat };
};
