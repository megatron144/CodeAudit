const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global_config',
  },
  executionPolicy: {
    sandboxTimeoutSeconds: { type: Number, default: 30 },
    memoryLimitMb: { type: Number, default: 512 },
    cpuQuota: { type: Number, default: 1.0 },
    enforceNetworkNone: { type: Boolean, default: true },
    readOnlyFilesystem: { type: Boolean, default: false },
  },
  llmEngine: {
    provider: { type: String, default: 'Gemini 1.5 Flash' },
    temperature: { type: Number, default: 0.1 },
    cacheDiffHash: { type: Boolean, default: true },
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
