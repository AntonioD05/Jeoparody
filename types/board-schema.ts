import { z } from "zod";

const ClueValueSchema = z.union([
  z.literal(200),
  z.literal(400),
  z.literal(600),
  z.literal(800),
  z.literal(1000),
]);

export const ClueSchema = z.object({
  id: z.string().min(1),
  value: ClueValueSchema,
  question: z.string().min(1),
  answer: z.string().min(1),
  source_snippet: z.string().min(1),
});

export const CategorySchema = z.object({
  title: z.string().min(1),
  clues: z.array(ClueSchema).length(5),
});

export const BoardSchema = z.object({
  categories: z.array(CategorySchema).length(5),
});

export type Board = z.infer<typeof BoardSchema>;
