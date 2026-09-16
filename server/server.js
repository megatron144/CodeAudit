require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const chatService = require('./services/chatService');
const { setSocketIO } = require('./queue/worker');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
setSocketIO(io);

// Connect DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/repos', require('./routes/repos'));
app.use('/api/analyses', require('./routes/analysis'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/history', require('./routes/history'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'CodeAudit Enterprise Daemon',
    version: 'v2.4.0',
    gateStatus: 'ENFORCING'
  });
});

// Socket.io Real-Time Handler
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join analysis room for live status stepper updates
  socket.on('join:analysis', (analysisId) => {
    socket.join(`analysis:${analysisId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined room analysis:${analysisId}`);
  });

  socket.on('leave:analysis', (analysisId) => {
    socket.leave(`analysis:${analysisId}`);
  });

  // Repo-Aware Chatbot streaming transport
  socket.on('chat:message', async (data) => {
    const { sessionId, query, repoId, analysisId, mode, taggedFiles, requestTree } = data;
    console.log(`[Socket.io] Chat query received for session: ${sessionId}, query: "${query}"`);

    try {
      await chatService.streamReply({
        sessionId: sessionId || socket.id,
        query,
        repoId,
        analysisId,
        mode: mode || 'detailed',
        taggedFiles: taggedFiles || [],
        requestTree: Boolean(requestTree),
        onChunk: (chunk) => {
          socket.emit('chat:stream_chunk', { chunk });
        },
        onComplete: (result) => {
          socket.emit('chat:stream_end', result);
        }
      });
    } catch (err) {
      console.error(`[Socket.io] Chat error for session "${sessionId}":`, err.message);
      socket.emit('chat:error', {
        message: 'Something went wrong generating a response — try again',
        query,
      });
    }
  });

  socket.on('chat:clear', async ({ sessionId }) => {
    if (sessionId) {
      await chatService.clearSession(sessionId);
      socket.emit('chat:cleared', { sessionId });
    }
  });

  socket.on('chat:get_tree', async ({ repoId, analysisId }) => {
    try {
      const treeData = await chatService.getInteractiveTree({ repoId, analysisId });
      socket.emit('chat:tree_data', treeData);
    } catch (err) {
      socket.emit('chat:error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`[CodeAudit Server] Running on http://localhost:${PORT}`);
});
