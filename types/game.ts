export type Player = {
  id: string;
  name: string;
  isHost?: boolean;
  score?: number;
};

export type Clue = {
  id: string;
  question: string;
  answer: string;
  value: number;
  categoryId: string;
  sourceSnippet?: string;
};

export type Category = {
  id: string;
  title: string;
  clues: Clue[];
};

export type Board = {
  categories: Category[];
};
