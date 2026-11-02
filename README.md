# CivicLens

**Ask questions about public services and get answers grounded in real documents, with sources.**

CivicLens is a full-stack Retrieval-Augmented Generation (RAG) app. Admins upload official documents (handbooks, guides, forms). Users ask questions in plain English or search the library, and the assistant answers only from those documents and cites where each answer came from.

**Live demo:** https://civic-lens-one-wine.vercel.app
*(The API runs on a free host that sleeps when idle. The first request after a quiet period can take about a minute.)*

<img width="1440" height="900" alt="Screenshot 2026-11-01 at 6 27 18 PM" src="https://github.com/user-attachments/assets/7373a27d-8252-4a28-bc40-cb5fb66fbe49" />


## Features
- **Grounded answers with citations.** Questions are matched against document chunks. If nothing relevant is found, the assistant says so instead of guessing.
- **Streaming chat** (Server-Sent Events) with saved conversation history.
- **Semantic library search**, plus saved resources and personal deadlines on a dashboard.
- **Admin panel.** Upload and index documents, publish or unpublish them, manage users and roles, see usage analytics, find "content gaps" (questions the library couldn't answer), and check system health.
- **Dark and light themes.**

## How the RAG pipeline works
1. **Ingest:** upload (PDF, DOCX, TXT) → extract text → split into overlapping chunks.
2. **Embed:** each chunk becomes a 384-dimension vector using `all-MiniLM-L6-v2`, run locally on the server (no embedding API cost).
3. **Retrieve:** the question is embedded the same way, and MongoDB Atlas Vector Search returns the closest chunks.
4. **Gate:** a similarity threshold decides whether the library actually covers the question.
5. **Generate:** Gemini writes the answer from the retrieved chunks only, streamed back with source citations.

## Tech stack
| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, TypeScript, Mongoose |
| Data / search | MongoDB Atlas, Atlas Vector Search |
| AI | Transformers.js (local embeddings), Google Gemini |
| Auth & security | JWT, bcrypt, role-based access, helmet, rate limiting, input sanitising |
| Quality | Automated tests (node:test, Vitest + React Testing Library), GitHub Actions CI |
| Deploy | Docker, Render (API), Vercel (web) |

## Run it locally
```bash
# backend
cd backend && cp .env.example .env   # fill in MongoDB, JWT secret, Gemini key
npm install && npm run dev

# frontend
cd frontend && cp .env.example .env
npm install && npm run dev
```
Or run both with `docker compose up --build`. You also need a MongoDB Atlas vector index (384 dimensions, cosine) named `vector_index`.

## Tests
`cd backend && npm test` and `cd frontend && npm test`

## Known limitations
- Free hosting: the API sleeps when idle, and uploaded original files are not kept across restarts (extracted text and search data are safe in Atlas).
- Search-similarity thresholds were tuned on a small document set.
