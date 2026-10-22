# Speech to Text (Next.js + Node.js)

Real-time Hindi + English transcription with a CRUD history dashboard.

## Run it
1. Backend
   ```
   cd backend
   cp .env.example .env      # add DEEPGRAM_API_KEY and your Neon DATABASE_URL
   npm install
   npm run dev               # http://localhost:4000
   ```
2. Frontend
   ```
   cd frontend
   cp .env.local.example .env.local
   npm install
   npm run dev               # http://localhost:3000
   ```
3. Open http://localhost:3000, allow the microphone, and speak.

## How it works
Mic -> MediaRecorder (250 ms chunks) -> WebSocket /stream -> Node backend -> Deepgram
(nova-3, language=multi) -> interim/final text back to the browser -> saved to Neon Postgres on stop.

## API
| Method | Route | Purpose |
|---|---|---|
| GET | /api/transcriptions?q= | list / search |
| GET | /api/transcriptions/:id | read one |
| POST | /api/transcriptions | create |
| PUT | /api/transcriptions/:id | update text |
| DELETE | /api/transcriptions/:id | delete |

## Notes
- "Browser" engine uses the Web Speech API (hi-IN), works in Chrome/Edge with no key.
- Use Chrome or Edge on localhost (microphone needs localhost or HTTPS).
