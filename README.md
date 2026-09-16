# CodeAudit — Full-Stack AI Code Review & Runtime Analysis Platform

CodeAudit is an AI-powered code review and repository analysis platform engineered for software architects, systems engineers, and security analysts.

## Technology Stack

- **Frontend**: React.js 18, Tailwind CSS (Precision Engineering Dark palette), Vite, Socket.io-client, React Router v6.
- **Backend**: Node.js, Express, Mongoose, BullMQ, ioredis, Dockerode, JWT, Socket.io.
- **Database & Cache**: MongoDB 7.0 (persistent storage), Redis 7.0 (job queue & ETag/LLM caching).
- **Isolation Sandbox**: Ephemeral Docker containers with `--network=none`, 512MB RAM limit, 1.0 CPU quota, and 30-second kill timeout.
- **Review Engine**: Grounded LLM triage (Gemini 1.5 Flash API with SHA-256 diff caching) and deterministic static rule validation.

---

## Architecture & Pipeline

```
[01 Ingestion] ──► [02 Micro-Sandbox] ──► [03 Invariant Engine] ──► [04 LLM Triage]
  Webhook / API       Docker (--net=none)    AST & CWE Checklists    Health Score (0-100)
```

1. **Repo Ingestion**: GitHub REST API with conditional ETag caching to respect rate limits (5000 req/hr).
2. **Job Queue**: Decoupled BullMQ worker running asynchronous analysis jobs.
3. **Sandbox Execution**: Code runs in isolated Docker containers with structured stdout/stderr capture.
4. **LLM Review**: Generates PR summary, inline code review comments with patch suggestions, and Code Health Score.
5. **Repo-Aware Chatbot**: Real-time Socket.io streaming scoped to the viewed repository, diff, and sandbox output.
6. **Metrics**: Tracks health scores over time and pass/fail ratios.

---

## Local Development Setup

### 1. Backend Server & Worker
```bash
cd server
npm install
npm run dev
```

### 2. Frontend Client
```bash
cd client
npm install
npm run dev
```

### 3. Docker Full Stack Deployment
```bash
docker-compose up --build
```
