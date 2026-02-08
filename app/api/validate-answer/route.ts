import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateJsonWithGemini } from "../../../utils/gemini";

export const runtime = "nodejs";

const RequestSchema = z.object({
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  playerAnswer: z.string().min(1),
});

const buildValidationPrompt = (
  question: string,
  correctAnswer: string,
  playerAnswer: string
) => {
  return [
    "You are a Jeopardy answer validator. Determine if the player's answer is correct.",
    "Be lenient with:",
    "- Minor spelling errors",
    "- Different phrasing that means the same thing",
    "- Partial answers that capture the key concept",
    "- Missing articles (a, an, the)",
    "- Synonyms and equivalent terms",
    "",
    "Be strict about:",
    "- Completely wrong answers",
    "- Answers that mention a different concept entirely",
    "- Numerical/factual errors",
    "",
    `Question: ${question}`,
    `Correct Answer: ${correctAnswer}`,
    `Player's Answer: ${playerAnswer}`,
    "",
    "Respond with JSON only: { \"isCorrect\": true/false, \"explanation\": \"brief reason\" }",
  ].join("\n");
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { question, correctAnswer, playerAnswer } = parsed.data;

    // Quick check for obvious matches first
    const normalizedCorrect = correctAnswer.toLowerCase().trim();
    const normalizedPlayer = playerAnswer.toLowerCase().trim();

    if (
      normalizedPlayer === normalizedCorrect ||
      normalizedPlayer.includes(normalizedCorrect) ||
      normalizedCorrect.includes(normalizedPlayer)
    ) {
      return Response.json({
        isCorrect: true,
        explanation: "Direct match or contains correct answer",
      });
    }

    // Use Gemini for more nuanced validation
    const prompt = buildValidationPrompt(question, correctAnswer, playerAnswer);
    const raw = await generateJsonWithGemini(prompt, { temperature: 0.1 });

    try {
      const result = JSON.parse(raw);
      return Response.json({
        isCorrect: Boolean(result.isCorrect),
        explanation: result.explanation ?? "Validated by AI",
      });
    } catch {
      // If parsing fails, fall back to simple string matching
      return Response.json({
        isCorrect: false,
        explanation: "Unable to validate - defaulting to incorrect",
      });
    }
  } catch (error) {
    console.error("Validate answer error:", error);
    return Response.json(
      { error: "Failed to validate answer." },
      { status: 500 }
    );
  }
}
