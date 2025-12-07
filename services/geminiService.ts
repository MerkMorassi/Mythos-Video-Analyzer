
import { GoogleGenAI, Modality, GenerateContentConfig, HarmCategory, HarmBlockThreshold, Chat, Content } from "@google/genai";
import { getApiKey } from './apiKeyService';

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const getClient = () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("API Key not found. Please configure it in the Knowledge tab.");
    }
    return new GoogleGenAI({ apiKey });
}

// --- API Call with Exponential Backoff (from Mythos Vault reference) ---
const apiCallWithRetry = async <T>(apiFunction: () => Promise<T>, maxRetries = 3): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiFunction();
        } catch (error) {
            if (attempt === maxRetries - 1 || (error instanceof Error && !error.message.includes('rate limit'))) {
                throw error;
            }
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.warn(`[API Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error("API call failed after multiple retries.");
};


const fullPrompt = (prompt: string) => `${prompt}. IMPORTANT: Format the entire response as clean, well-structured, semantic HTML. Use only standard tags like <p>, <h1>, <ul>, <li>, etc. Do not include any inline styles, <style> blocks, or color attributes. The styling is handled by the application's CSS.`;

// --- MGP: Model Gate Protocol ---
const HIGH_REASONING_TRIGGERS = [
    'synthesize', 'deeply', 'complex analysis', 'tragedy', 
    'profound', 'critical assessment', 'architectural plan', 'paradigm shift',
    'visualize', 'image analysis', 'music analysis', 'video analysis', 'reverse engineer'
];

export const getModelForTask = (queryText: string): string => {
    const lowQuery = queryText.toLowerCase();
    const isHighReasoning = HIGH_REASONING_TRIGGERS.some(word => lowQuery.includes(word));
    
    if (isHighReasoning) {
        return 'gemini-3-pro-preview';
    }
    return 'gemini-2.5-flash';
};

// --- Model Fetching (from Mythos Vault reference) ---
export const fetchModels = async (): Promise<{ id: string, name: string }[]> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.warn("API Key not set, using fallback models.");
        return [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fallback)' },
            { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Fallback)' },
        ];
    }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("API call failed to fetch models.");
        }
        const data = await response.json();
        const compatibleModels = data.models
            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m: any) => ({
                id: m.name.replace('models/', ''),
                name: m.displayName
            }));
        
        if (compatibleModels.length > 0) return compatibleModels;
        throw new Error("No compatible models found.");

    } catch (e) {
        console.warn("Model fetch failed, using fallback list:", e);
        return [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fallback)' },
            { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Fallback)' },
        ];
    }
}

// --- Embeddings ---
export const getEmbeddings = async (text: string): Promise<number[] | null> => {
    return apiCallWithRetry(async () => {
        try {
            const ai = getClient();
            const response = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: { parts: [{ text }] }
            });
            return response.embeddings?.[0]?.values || null;
        } catch (error) {
            console.error("Error generating embedding:", error);
            throw error;
        }
    });
};

export const analyzeVideo = async (prompt: string, frames: string[], systemPrompt?: string): Promise<string> => {
    const model = getModelForTask(prompt + " video analysis");
    
    const runAnalysis = async (currentModel: string) => {
        const ai = getClient();
        const imageParts = frames.map(base64Data => ({
            inlineData: { data: base64Data, mimeType: 'image/jpeg' },
        }));

        const config: GenerateContentConfig = { maxOutputTokens: 8192, safetySettings };
        if (systemPrompt && systemPrompt.trim()) config.systemInstruction = systemPrompt;

        const response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: [{ text: fullPrompt(prompt) }, ...imageParts] },
            config,
        });
        
        const text = response.text;
        if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty or invalid response.');
        return text;
    };

    try {
        return await apiCallWithRetry(() => runAnalysis(model));
    } catch (error) {
        console.error(`Error analyzing video with ${model}:`, error);
        if (model !== 'gemini-2.5-flash') {
            console.warn(`Falling back to gemini-2.5-flash.`);
            return apiCallWithRetry(() => runAnalysis('gemini-2.5-flash'));
        }
        throw error instanceof Error ? new Error(`Gemini API Error: ${error.message}`) : new Error("Unknown error during video analysis");
    }
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string, systemPrompt?: string): Promise<string> => {
    const model = getModelForTask(prompt + " image analysis");

    const runAnalysis = async (currentModel: string) => {
        const ai = getClient();
        const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
        const config: GenerateContentConfig = { maxOutputTokens: 8192, safetySettings };
        if (systemPrompt && systemPrompt.trim()) config.systemInstruction = systemPrompt;

        const response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: [{ text: fullPrompt(prompt) }, imagePart] },
            config,
        });
        
        const text = response.text;
        if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty or invalid response.');
        return text;
    };

    try {
        return await apiCallWithRetry(() => runAnalysis(model));
    } catch (error) {
        console.error(`Error analyzing image with ${model}:`, error);
        if (model !== 'gemini-2.5-flash') {
            console.warn(`Falling back to gemini-2.5-flash.`);
            return apiCallWithRetry(() => runAnalysis('gemini-2.5-flash'));
        }
        throw error instanceof Error ? new Error(`Gemini API Error: ${error.message}`) : new Error("Unknown error during image analysis");
    }
};


export const generateSpeech = async (text: string, voice: string, speakingRate: number): Promise<string> => {
  return apiCallWithRetry(async () => {
    const ai = getClient();
    try {
        const config = {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
              speakingRate: speakingRate,
            },
        };

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          config: config as any,
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("TTS did not return audio data.");
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        if (error instanceof Error && error.message.includes("did not return any audio data")) throw error;
        throw new Error("Failed to generate audio due to service error.");
    }
  });
};

export const createChat = (systemPrompt?: string, initialHistory?: Content[]): Chat => {
    const ai = getClient();
    const config: GenerateContentConfig = { safetySettings };
    if (systemPrompt && systemPrompt.trim()) config.systemInstruction = systemPrompt;

    return ai.chats.create({
        model: 'gemini-3-pro-preview', 
        history: initialHistory,
        config,
    });
};

export const generateSdxlPrompt = async (promptWithContext: string): Promise<string> => {
  return apiCallWithRetry(async () => {
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: { parts: [{ text: promptWithContext }] },
          config: { maxOutputTokens: 2048, safetySettings },
        });
        const text = response.text;
        if (typeof text !== 'string' || !text.trim()) throw new Error('Invalid prompt response.');
        return text.trim();
    } catch (error) {
        console.error("Error generating SDXL prompt:", error);
        throw error instanceof Error ? new Error(`Gemini API Error: ${error.message}`) : new Error("Unknown error generating SDXL prompt.");
    }
  });
};

export const generateText = async (prompt: string): Promise<string> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: { parts: [{ text: prompt }] },
              config: { maxOutputTokens: 4096, safetySettings, temperature: 0.2 },
            });
            const text = response.text;
            if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty response.');
            return text;
        } catch(error) {
            console.error("Error during text generation:", error);
            throw error instanceof Error ? new Error(`Gemini API Error: ${error.message}`) : new Error("Unknown error during text generation.");
        }
    });
};
