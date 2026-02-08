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
    : [
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
      ];

  let lastError: unknown;
  let response;

  const shouldFallback = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const status = (error as { status?: number }).status;
    const message = (error as { message?: string }).message ?? "";
    if (status === 404 || status === 429) return true;
    if (message.includes("NOT_FOUND") || message.includes("RESOURCE_EXHAUSTED")) {
      return true;
    }
    return false;
  };

  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model,
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
      if (!shouldFallback(error)) {
        break;
      }
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
