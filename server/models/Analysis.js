const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
  rule: { type: String, required: true },
  line: { type: Number, required: true },
  file: { type: String, default: 'main' },
  severity: { type: String, enum: ['critical', 'warning', 'notice'], default: 'notice' },
  title: { type: String, required: true },
  finding: { type: String, required: true },
  confidence: { type: Number, default: 98.5 },
  suggestedPatch: { type: String, default: '' },
  status: { type: String, enum: ['open', 'applied', 'dismissed'], default: 'open' }
});

const analysisSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  repoName: { type: String, required: true },
  commitHash: { type: String, required: true },
  branch: { type: String, default: 'main' },
  author: { type: String, default: 'developer' },
  prNumber: { type: Number, default: null },
  prTitle: { type: String, default: 'Manual audit run' },
  targetBranch: { type: String, default: 'main' },
  status: {
    type: String,
    enum: ['queued', 'sandbox_running', 'awaiting_llm', 'completed', 'failed'],
    default: 'queued',
  },
  score: { type: Number, default: null },
  scoreDelta: { type: Number, default: 0 },
  diff: { type: String, default: '' },
  diffHash: { type: String, default: '' },
  filesChanged: [{
    filename: String,
    additions: Number,
    deletions: Number,
    status: String,
    rawDiff: String,
  }],
  findings: [findingSchema],
  summary: { type: String, default: '' },
  cweChecklist: [{
    name: String,
    status: { type: String, enum: ['Clean', 'Flagged'], default: 'Clean' }
  }],
  sandboxOutput: {
    stdout: { type: String, default: '' },
    stderr: { type: String, default: '' },
    exitCode: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    logs: [{
      timestamp: String,
      tag: String,
      message: String,
      severity: String,
    }]
  },
  stageDurations: {
    webhookMs: { type: Number, default: 120 },
    sandboxMs: { type: Number, default: 42 },
    astMs: { type: Number, default: 85 },
    llmMs: { type: Number, default: 310 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Analysis', analysisSchema);
