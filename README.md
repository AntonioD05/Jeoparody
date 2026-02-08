# Jeoparody

A real-time multiplayer Jeopardy-style trivia game where AI generates custom questions from any PDF you upload. Play solo to study or compete with friends!

**[Play Now → jeoparody-self.vercel.app](https://jeoparody-self.vercel.app/)**

## Features

- **AI-Powered Questions** — Upload any PDF and Google Gemini AI creates a full 5×5 Jeopardy board with 5 categories and 25 clues based on the content
- **Final Jeopardy** — After all 25 clues are answered, compete in a Final Jeopardy round with wagering
- **Multiplayer Rooms** — Create a room (up to 4 players) and share the code with friends to play together in real-time
- **Voice Announcements** — Text-to-speech announces answers and results
- **Real-Time Sync** — All players see the same board, scores update live, and turns are synchronized via Supabase Realtime
- **Classic Jeopardy Format** — 5 categories, clue values from $200 to $1000

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Database & Realtime**: [Supabase](https://supabase.com) (PostgreSQL + Realtime subscriptions)
- **AI**: [Google Gemini](https://ai.google.dev/) for question generation and answer grading
- **PDF Processing**: [pdfjs-dist](https://mozilla.github.io/pdf.js/) (client-side extraction)
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

# ElevenLabs Voice AI
ELEVEN_LABS_API_KEY=you_elevenlabs_api_key
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

1. **Create or Join a Room** — Enter your name and create a new room or join an existing one with a code (max 4 players)
2. **Upload a PDF** — The host uploads a PDF (lecture notes, textbook chapter, study guide, etc.)
3. **AI Generates Questions** — The PDF is parsed client-side into text chunks and sent to Gemini AI, which creates 5 themed categories with 5 clues each plus a Final Jeopardy question
4. **Play!** — Players take turns selecting clues from the board. Answer correctly to earn points, or lose points for wrong answers
5. **Final Jeopardy** — After all 25 clues are revealed, all players wager and answer simultaneously
6. **Win** — The player with the highest score after Final Jeopardy wins!

## Project Structure

```
app/
├── page.tsx              # Home page (create/join room)
├── room/[code]/page.tsx  # Room lobby (waiting for players, PDF upload)
├── game/[code]/page.tsx  # Active game board
├── actions/
│   ├── rooms.ts          # Room creation, joining, leaving
│   └── game.ts           # Game logic, clue selection, answers, Final Jeopardy
└── api/
    ├── generate-board/   # Gemini AI board generation
    ├── current-player/   # Player identification
    └── leave-room/       # Room cleanup

components/
├── JeopardyBoard.tsx     # The 5x5 game board
├── ClueModal.tsx         # Modal for answering clues
├── FinalJeopardyModal.tsx # Final Jeopardy wagering and answering
├── Scoreboard.tsx        # Player scores display
├── HostControls.tsx      # PDF upload & game controls
├── PlayerList.tsx        # Room player list
├── CreateRoomForm.tsx    # Create room form
└── JoinRoomForm.tsx      # Join room form

utils/
├── gemini.ts             # Gemini AI client wrapper
├── pdf-extractor.ts      # Client-side PDF text extraction
└── supabase/             # Supabase client utilities

types/
├── board-schema.ts       # Zod schemas for board validation
└── game.ts               # TypeScript types for game entities
```

## API Endpoints

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
    ],
    "final_jeopardy": {
      "category": "Final Category",
      "question": "The final question",
      "answer": "What is the final answer?",
      "source_snippet": "Source from PDF"
    }
  }
}
```

## Deployment

This app is deployed on [Vercel](https://vercel.com): **[jeoparody-self.vercel.app](https://jeoparody-self.vercel.app/)**

To deploy your own instance:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add your environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`)
4. Deploy!

## License

MIT

