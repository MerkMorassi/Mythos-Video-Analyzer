import { GoogleGenAI, Modality, GenerateContentConfig, HarmCategory, HarmBlockThreshold, Chat, Content } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // For this environment, we assume the key is always present.
  console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const safetySettings = [
    // These settings are quite permissive. In a real application, you'd want to
    // tailor them to your specific use case and safety requirements.
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

const fullPrompt = (prompt: string) => `${prompt}. IMPORTANT: Format the entire response as clean, well-structured, semantic HTML. Use only standard tags like <p>, <h1>, <ul>, <li>, etc. Do not include any inline styles, <style> blocks, or color attributes. The styling is handled by the application's CSS.`;

export const analyzeVideo = async (prompt: string, frames: string[], systemPrompt?: string): Promise<string> => {
  const imageParts = frames.map(base64Data => ({
    inlineData: {
      data: base64Data,
      mimeType: 'image/jpeg',
    },
  }));

  const config: GenerateContentConfig = {
    maxOutputTokens: 8192,
    safetySettings,
  };

  if (systemPrompt && systemPrompt.trim()) {
    config.systemInstruction = systemPrompt;
  }

  try {
    const response = await ai.models.generateContent({
      // FIX: Updated model to `gemini-3-pro-preview` for complex multimodal analysis.
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: fullPrompt(prompt) }, ...imageParts] },
      config,
    });
    
    const text = response.text;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('The model returned an empty or invalid response.');
    }
    return text;

  } catch (error) {
    console.error("Error analyzing video:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling the Gemini API.");
  }
};

export const analyzeImage = async (prompt:string, imageBase64: string, mimeType: string, systemPrompt?: string): Promise<string> => {
  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const config: GenerateContentConfig = {
    maxOutputTokens: 8192,
    safetySettings,
  };

  if (systemPrompt && systemPrompt.trim()) {
    config.systemInstruction = systemPrompt;
  }

  try {
    const response = await ai.models.generateContent({
      // FIX: Updated model to `gemini-3-pro-preview` for better performance and consistency.
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: fullPrompt(prompt) }, imagePart] },
      config,
    });
    
    const text = response.text;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('The model returned an empty or invalid response.');
    }
    return text;

  } catch (error) {
    console.error("Error analyzing image:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling the Gemini API.");
  }
};


export const generateSpeech = async (text: string, voice: string, speakingRate: number): Promise<string> => {
  try {
    const config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
          speakingRate: speakingRate,
        },
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: config as any, // Using 'as any' to bypass potentially stale SDK types
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("The text-to-speech service did not return any audio data. This can happen if the analysis result is empty or contains unsupported content.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    if (error instanceof Error) {
        if (error.message.includes("did not return any audio data")) {
            throw error; // Re-throw our specific error
        }
        // Generalize other API/network errors
        throw new Error("Failed to generate audio due to a service error. Please try again later.");
    }
    throw new Error("An unknown error occurred while generating speech.");
  }
};


export const createChat = (systemPrompt?: string, initialHistory?: Content[]): Chat => {
    const config: GenerateContentConfig = {
        safetySettings,
    };

    if (systemPrompt && systemPrompt.trim()) {
        config.systemInstruction = systemPrompt;
    }

    return ai.chats.create({
        // FIX: Updated model to `gemini-3-pro-preview` for chat sessions.
        model: 'gemini-3-pro-preview',
        history: initialHistory,
        config,
    });
};

export const generateSdxlPrompt = async (promptWithContext: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Use a strong model for creative/instructed text generation
      contents: { parts: [{ text: promptWithContext }] },
      config: {
        maxOutputTokens: 2048, // Generous token limit for detailed prompts
        safetySettings,
      },
    });

    const text = response.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('The model returned an empty or invalid prompt.');
    }
    // Clean up the response to remove any preamble or markdown formatting
    return text.trim();
  } catch (error) {
    console.error("Error generating SDXL prompt:", error);
    if (error instanceof Error) {
      throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the SDXL prompt.");
  }
};