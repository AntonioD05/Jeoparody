import { GoogleGenAI } from "@google/genai";

type GeminiOptions = {
  model?: string;
  temperature?: number;
};

const getApiKey = () => {
  return process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
};

export async function generateJsonWithGemini(
  prompt: string,
  options: GeminiOptions = {},
) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelCandidates = options.model
    ? [options.model]
    : ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];

  let lastError: unknown;
  let response;

  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          temperature: options.temperature ?? 0.4,
          responseMimeType: "application/json",
        },
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    throw lastError ?? new Error("Gemini request failed.");
  }

  const text = response.text ?? "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
