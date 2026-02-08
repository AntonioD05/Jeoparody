import type { NextRequest } from "next/server";
import { z } from "zod";
import { BoardSchema } from "../../../types/board-schema";
import { generateJsonWithGemini } from "../../../utils/gemini";
import { createServerSupabaseClient } from "../../../utils/supabase/server-client";

export const runtime = "nodejs";

const RequestSchema = z.object({
  roomId: z.string().uuid(),
  chunks: z.array(z.string().min(1)).min(1),
  options: z
    .object({
      model: z.string().optional(),
      difficulty: z.string().optional(),
    })
    .optional(),
});

const GeminiBoardSchema = {
  type: "OBJECT",
  properties: {
    categories: {
      type: "ARRAY",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          clues: {
            type: "ARRAY",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                value: {
                  type: "INTEGER",
                  enum: [200, 400, 600, 800, 1000],
                },
                question: { type: "STRING" },
                answer: { type: "STRING" },
                source_snippet: { type: "STRING" },
              },
              required: [
                "id",
                "value",
                "question",
                "answer",
                "source_snippet",
              ],
            },
          },
        },
        required: ["title", "clues"],
      },
    },
  },
  required: ["categories"],
};

const buildPrompt = (chunks: string[], difficulty?: string) => {
  return [
    "You are generating a Jeopardy-style trivia board in JSON only.",
    "Rules:",
    "- Output JSON only. No markdown, no extra text.",
    "- Exactly 5 categories, each with exactly 5 clues.",
    "- Clue values must be 200, 400, 600, 800, 1000.",
    "- Each clue has: id (string), value (int), question (string), answer (string), source_snippet (1-2 sentences).",
    "Use the provided source text chunks to derive questions.",
    difficulty ? `Difficulty: ${difficulty}.` : "",
    "",
    "Source text chunks:",
    chunks.map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`).join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");
};

const buildFixPrompt = (badJson: string, errorMessage: string) => {
  return [
    "Fix the JSON to match the schema.",
    "Return JSON only. No markdown, no extra text.",
    "Issues:",
    errorMessage,
    "",
    "Invalid JSON:",
    badJson,
  ].join("\n");
};

const extractJsonFromText = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
};

const parseBoardCandidate = (rawText: string) => {
  const jsonText = extractJsonFromText(rawText);
  const parsed = JSON.parse(jsonText);
  if (parsed && typeof parsed === "object" && "board" in parsed) {
    const inner = (parsed as { board: unknown }).board;
    if (Array.isArray(inner)) {
      return { categories: inner };
    }
    if (inner && typeof inner === "object" && !("categories" in (inner as Record<string, unknown>))) {
      return { categories: Object.values(inner as Record<string, unknown>) };
    }
    return inner;
  }
  if (Array.isArray(parsed)) {
    return { categories: parsed };
  }
  if (parsed && typeof parsed === "object" && !("categories" in parsed)) {
    const values = Object.values(parsed as Record<string, unknown>);
    if (values.length > 0) {
      return { categories: values };
    }
  }
  if (parsed && typeof parsed === "object" && "categories" in parsed) {
    return parsed;
  }
  return parsed;
};

const normalizeBoardCandidate = (candidate: unknown) => {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("categories" in candidate)
  ) {
    return candidate;
  }

  const categories = Array.isArray((candidate as { categories: unknown }).categories)
    ? ((candidate as { categories: unknown }).categories as Array<Record<string, unknown>>)
    : [];

  const normalizedCategories = categories.map((category) => {
    if ("title" in category) {
      return category;
    }
    if ("category" in category) {
      return {
        ...category,
        title: category.category,
      };
    }
    if ("name" in category) {
      return {
        ...category,
        title: category.name,
      };
    }
    return category;
  });

  return { ...(candidate as Record<string, unknown>), categories: normalizedCategories };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { roomId, chunks, options } = parsed.data;
    const prompt = buildPrompt(chunks, options?.difficulty);

    const raw = await generateJsonWithGemini(prompt, {
      model: options?.model,
    });

    const attemptParse = (text: string) => {
      const candidate = parseBoardCandidate(text);
      const normalized = normalizeBoardCandidate(candidate);
      return BoardSchema.safeParse(normalized);
    };

    let validation = attemptParse(raw);

    if (!validation.success) {
      console.error("Gemini raw response (attempt 1):", raw);
      const fixPrompt = buildFixPrompt(
        raw,
        validation.error.flatten().formErrors.join("; "),
      );
      const repaired = await generateJsonWithGemini(fixPrompt, {
        model: options?.model,
      });
      validation = attemptParse(repaired);
      if (!validation.success) {
        console.error("Gemini raw response (attempt 2):", repaired);
      }
    }

    if (!validation.success) {
      return Response.json(
        { error: "Board validation failed.", details: validation.error.flatten() },
        { status: 502 },
      );
    }

    const board = validation.data;
    const supabase = createServerSupabaseClient();

    const { error: gameError } = await supabase
      .from("games")
      .upsert(
        { room_id: roomId, board_json: board, phase: "playing" },
        { onConflict: "room_id" },
      );

    if (gameError) {
      return Response.json(
        { error: "Failed to persist game board.", details: gameError.message },
        { status: 500 },
      );
    }

    const { error: roomError } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", roomId);

    if (roomError) {
      return Response.json(
        { error: "Failed to update room status.", details: roomError.message },
        { status: 500 },
      );
    }

    return Response.json({ board });
  } catch (error) {
    console.error("Generate board error:", error);
    return Response.json(
      { error: "Failed to generate board." },
      { status: 500 },
    );
  }
}
