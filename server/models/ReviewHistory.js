const mongoose = require('mongoose');

const reviewHistorySchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  analysisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Analysis',
    required: true,
  },
  commitHash: { type: String, required: true },
  branch: { type: String, default: 'main' },
  score: { type: Number, required: true },
  criticalCount: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  noticeCount: { type: Number, default: 0 },
  sandboxStatus: { type: String, enum: ['pass', 'fail'], default: 'pass' },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ReviewHistory', reviewHistorySchema);
