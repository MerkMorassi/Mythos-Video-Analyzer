import { GoogleGenAI, Modality, GenerateContentConfig, HarmCategory, HarmBlockThreshold, Chat, Content } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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
        // console.log("[MGP] High Reasoning task detected. Promoting to Pro.");
        return 'gemini-3-pro-preview';
    }
    // console.log("[MGP] Standard task detected. Using Flash.");
    return 'gemini-2.5-flash';
};

// --- Embeddings ---
export const getEmbeddings = async (text: string): Promise<number[] | null> => {
    try {
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: { parts: [{ text }] }
        });
        return response.embeddings?.[0]?.values || null;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
};

export const getAvailableModels = async () => {
  try {
    const response = await ai.models.list();
    return response.models || [];
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
};

export const analyzeVideo = async (prompt: string, frames: string[], systemPrompt?: string): Promise<string> => {
  const imageParts = frames.map(base64Data => ({
    inlineData: { data: base64Data, mimeType: 'image/jpeg' },
  }));

  const config: GenerateContentConfig = { maxOutputTokens: 8192, safetySettings };
  if (systemPrompt && systemPrompt.trim()) config.systemInstruction = systemPrompt;
  
  // Video Analysis usually implies high complexity, so we default to checking MGP but bias towards Pro for video
  const model = getModelForTask(prompt + " video analysis"); 

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: fullPrompt(prompt) }, ...imageParts] },
      config,
    });
    
    const text = response.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty or invalid response.');
    return text;
  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error instanceof Error ? new Error(`Gemini API Error: ${error.message}`) : new Error("Unknown error during video analysis");
  }
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string, systemPrompt?: string): Promise<string> => {
  const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
  const config: GenerateContentConfig = { maxOutputTokens: 8192, safetySettings };
  if (systemPrompt && systemPrompt.trim()) config.systemInstruction = systemPrompt;

  const model = getModelForTask(prompt + " image analysis");

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: fullPrompt(prompt) }, imagePart] },
      config,
    });
    
    const text = response.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty or invalid response.');
    return text;
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error instanceof Error ? new Error(`Gemini API Error: ${error.message}`) : new Error("Unknown error during image analysis");
  }
};

export const generateSpeech = async (text: string, voice: string, speakingRate: number): Promise<string> => {
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
};

export const createChat = (systemPrompt?: string, initialHistory?: Content[]): Chat => {
    const config: GenerateContentConfig = { safetySettings };
    if (systemPrompt && systemPrompt.trim()) config.systemInstruction = systemPrompt;

    // For chat, we start with Pro to ensure context retention and reasoning quality
    return ai.chats.create({
        model: 'gemini-3-pro-preview', 
        history: initialHistory,
        config,
    });
};

export const generateSdxlPrompt = async (promptWithContext: string): Promise<string> => {
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
};