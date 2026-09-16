# CodeAudit ⚡

> **Stateless, real-time repository analysis & precision conversational code review platform.**

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-ioredis-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Google Gemini](https://img.shields.io/badge/Gemini-3.6--Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## 📌 Overview

**CodeAudit** is a full-stack code analysis and developer intelligence platform. It turns any public GitHub repository into an interactive audit workbench: ingesting commit diffs, executing static verification in isolated environments, calculating genuine Code Health Scores (0–100), and powering a **repo-aware AI assistant** that streams technical insights without dumping raw internal context.

Built from the ground up to be **stateless and friction-free** — no user accounts, passwords, or signup barriers. Paste a GitHub repository link or username to start analyzing instantly.

---

## ✨ Key Features

- **Instant Ingestion**: Enter a GitHub repo URL (e.g. `owner/repo`) or search by username to retrieve public repositories with live GitHub API caching (ETag-aware to preserve rate limits).
- **Grounded Semantic Code Review**: Analyzes pull requests and commits using **Google Gemini 3.6 Flash** with SHA-256 diff caching for sub-second retrieval.
- **Truthful Code Health Metric**: Calculates an objective 0–100 score based on verified findings and execution checks. Never fabricates scores for unanalyzed commits.
- **Repo-Aware Streaming Assistant**:
  - Real-time token streaming powered by WebSocket (`socket.io`).
  - **`@` File Scoping**: Type `@filename` to scope questions directly to specific modules.
  - **Interactive File Tree**: Explore repository hierarchy and architectural entry points visually.
  - **Strict Anti-Hallucination Guardrails**: Conversationally answers real technical questions while strictly forbidding raw metadata dumps.
- **Isolated Execution Pipeline**: Ephemeral micro-sandboxes with enforced quotas (CPU, RAM, timeout kill guards, and `--network=none` isolation).
- **Historical Health Trends**: Visual score trajectories over time across commits and review runs.

---

## 🏗️ Architecture & Pipeline

```
[01 Ingestion] ──────► [02 Job Queue] ──────► [03 Micro-Sandbox] ──────► [04 AI Engine] ──────► [05 Workbench]
 GitHub REST API         BullMQ + Redis          Docker (--net=none)        Gemini 3.6 Flash       Interactive UI
 Conditional ETags       Async processing        stdout / stderr capture    Diff Review & CWE      Streaming Chat
```

1. **Ingestion Layer**: Fetches commit diffs, file trees, and pull requests via GitHub's v3 REST API with Redis ETag caching.
2. **Asynchronous Queue**: Jobs are dispatched via BullMQ to decouple heavy parsing and verification from the web server.
3. **Execution Sandbox**: Runs code inspection and lint assertions in isolated container environments.
4. **AI Review Engine**: Reviews unified diffs, detects Common Weakness Enumerations (CWEs), and generates contextual remediation patches.
5. **Real-time Interface**: Vite-powered client renders unified diffs, collapsible structure trees, terminal outputs, and conversational assistant.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, Socket.io Client, React Router v6 |
| **Backend** | Node.js, Express, Socket.io, BullMQ, ioredis, Mongoose, Axios, Dockerode |
| **AI / LLM** | Google Gemini 3.6 Flash (`generativelanguage.googleapis.com`) |
| **Database** | MongoDB Atlas (persistence for repos, analyses, and history) |
| **Cache & Queue** | Redis / Render Key Value / Upstash (BullMQ queue & API response caching) |
| **Deployment** | Vercel (Frontend SPA) + Render (Backend Web Service & Redis) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18 or higher)
- Redis server (`brew install redis` or Docker)
- MongoDB instance (local or MongoDB Atlas connection string)
- Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### 1. Clone the Repository
```bash
git clone https://github.com/megatron144/CodeAudit.git
cd CodeAudit
```

### 2. Configure Environment Variables

Create `server/.env`:
```env
PORT=5050
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
RUN_WORKER_IN_PROCESS=true
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_key
```

### 3. Start Redis
```bash
# Using Homebrew
brew services start redis

# Or using Docker
docker run -d -p 6379:6379 redis:alpine
```

### 4. Start the Backend Server
```bash
cd server
npm install
npm run dev
```
*Backend runs at `http://localhost:5050`.*

### 5. Start the Frontend Client
In a new terminal window:
```bash
cd client
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

---

## 🌐 Production Deployment

### Backend on [Render](https://render.com)
1. Create a **Web Service** pointing to your repository with **Root Directory** set to `server`.
2. Build Command: `npm install` | Start Command: `npm start`.
3. Create a **Key Value** instance (Redis) on Render, copy the **Internal Connection String**, and set it as `REDIS_URL`.
4. Add environment variables:
   - `MONGODB_URI`
   - `GEMINI_API_KEY`
   - `REDIS_URL`
   - `RUN_WORKER_IN_PROCESS=true`
   - `PORT=5050`
   - `JWT_SECRET`
   - `CLIENT_URL=https://your-app.vercel.app`

### Frontend on [Vercel](https://vercel.com)
1. Import repository on Vercel.
2. Select Framework: **Vite**, Root Directory: **`client`**.
3. Add Environment Variable:
   - `VITE_API_URL`: `https://your-render-backend.onrender.com`
4. Deploy!

---

## 📂 Project Structure

```text
CodeAudit/
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # RepoChatbot, Header, Sidebar, Navigation
│   │   ├── context/            # SocketContext (real-time WebSocket connection)
│   │   ├── pages/              # Landing, Repositories, RepoDetail, AnalysisView, HistoryTrends
│   │   └── index.css           # Custom styling & typography tokens
│   ├── vercel.json             # SPA routing rewrite configuration
│   └── vite.config.js          # Vite configuration & dev proxy
│
├── server/                     # Node.js + Express Backend
│   ├── config/                 # MongoDB connection & Redis/ioredis setup
│   ├── models/                 # Mongoose schemas (Repository, Analysis, ReviewHistory)
│   ├── queue/                  # BullMQ analysis queue and inline worker
│   ├── routes/                 # Express API routes (repos, analysis, history, settings)
│   ├── services/               # GitHub API client, Gemini LLM review, and ChatService
│   └── server.js               # HTTP & WebSocket initialization
│
├── .gitignore                  # Git tracking exclusions
├── docker-compose.yml          # Containerized local environment
└── README.md                   # Project documentation
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
