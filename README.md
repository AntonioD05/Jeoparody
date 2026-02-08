# Jeoparody

A real-time multiplayer Jeopardy-style trivia game where AI generates custom questions from any PDF you upload. Play solo to study or compete with friends!

## Features

- **AI-Powered Questions** — Upload any PDF and Google Gemini AI creates a full 5×5 Jeopardy board with 5 categories and 25 clues based on the content
- **Multiplayer Rooms** — Create a room and share the code with friends to play together in real-time
- **Solo Mode** — Practice and study by yourself with AI-generated questions from your study materials
- **Real-Time Sync** — All players see the same board, scores update live, and turns are synchronized via Supabase Realtime
- **Classic Jeopardy Format** — 5 categories, clue values from $200 to $1000, answer in the form of a question

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Database & Realtime**: [Supabase](https://supabase.com) (PostgreSQL + Realtime subscriptions)
- **AI**: [Google Gemini](https://ai.google.dev/) for question generation
- **PDF Processing**: pdf-parse & pdfjs-dist
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **Validation**: [Zod](https://zod.dev)
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- A Google Gemini API key

### 1. Clone and Install

```bash
git clone https://github.com/your-username/jeoparody.git
cd jeoparody
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Set Up Supabase Database

Create the following tables in your Supabase project:

**rooms**
- `id` (uuid, primary key)
- `code` (text, unique) — 6-character room code
- `host_id` (uuid, references players)
- `status` (text) — "waiting" or "playing"
- `board` (jsonb) — the generated Jeopardy board
- `game_state` (jsonb) — current game state
- `created_at` (timestamp)

**players**
- `id` (uuid, primary key)
- `room_id` (uuid, references rooms)
- `name` (text)
- `score` (integer, default 0)
- `joined_at` (timestamp)

Enable Realtime on both tables for live updates.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Create or Join a Room** — Enter your name and create a new room or join an existing one with a code
2. **Upload a PDF** — The host uploads a PDF (lecture notes, textbook chapter, study guide, etc.)
3. **AI Generates Questions** — The PDF is parsed into text chunks and sent to Gemini AI, which creates 5 themed categories with 5 clues each
4. **Play!** — Players take turns selecting clues from the board. Answer correctly (answers verified by AI) to earn points, or lose points for wrong answers
5. **Win** — The player with the highest score when all clues are revealed wins!

## Project Structure

```
app/
├── page.tsx              # Home page (create/join room)
├── room/[code]/page.tsx  # Room lobby (waiting for players, PDF upload)
├── game/[code]/page.tsx  # Active game board
├── actions/              # Server actions for game logic
└── api/
    ├── extract/          # PDF text extraction
    ├── generate-board/   # Gemini AI board generation
    ├── current-player/   # Player identification
    └── leave-room/       # Room cleanup

components/
├── JeopardyBoard.tsx     # The 5x5 game board
├── ClueModal.tsx         # Modal for answering clues
├── Scoreboard.tsx        # Player scores display
├── HostControls.tsx      # PDF upload & game controls
└── PlayerList.tsx        # Room player list

utils/
├── gemini.ts             # Gemini AI client wrapper
└── supabase/             # Supabase client utilities
```

## API Endpoints

### `POST /api/extract`
Extracts and chunks text from a PDF file.

**Request**: `multipart/form-data` with `file` field

**Response**:
```json
{
  "chunks": ["chunk 1 text...", "chunk 2 text..."],
  "pages": 15,
  "totalWords": 4500
}
```

### `POST /api/generate-board`
Generates a Jeopardy board from text chunks using Gemini AI.

**Request**:
```json
{
  "roomId": "uuid",
  "chunks": ["chunk 1...", "chunk 2..."],
  "options": {
    "difficulty": "medium"
  }
}
```

**Response**:
```json
{
  "board": {
    "categories": [
      {
        "title": "Category Name",
        "clues": [
          {
            "id": "clue-1",
            "value": 200,
            "question": "This is the clue text",
            "answer": "What is the answer?",
            "source_snippet": "Relevant text from the PDF"
          }
        ]
      }
    ]
  }
}
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Deployment

Deploy easily on [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the project in Vercel
3. Add your environment variables
4. Deploy!

## License

MIT

