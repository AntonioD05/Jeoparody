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

export type FinalJeopardy = {
  category: string;
  question: string;
  answer: string;
  sourceSnippet?: string;
};

export type FinalJeopardyWager = {
  playerId: string;
  wager: number;
  answer?: string;
  isCorrect?: boolean;
  validated?: boolean;
};
