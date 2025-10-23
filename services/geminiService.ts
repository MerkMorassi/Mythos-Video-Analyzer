
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // For this environment, we assume the key is always present.
  console.warn("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });
const modelName = 'gemini-2.5-pro';

export const analyzeVideo = async (prompt: string, frames: string[]): Promise<string> => {
  const imageParts = frames.map(base64Data => ({
    inlineData: {
      data: base64Data,
      mimeType: 'image/jpeg',
    },
  }));

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }, ...imageParts] },
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing video:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling the Gemini API.");
  }
};
