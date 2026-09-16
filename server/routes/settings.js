const express = require('express');
const router = express.Router();

let systemConfig = {
  executionPolicy: {
    sandboxTimeoutSeconds: 30,
    memoryLimitMb: 512,
    cpuQuota: 1.0,
    enforceNetworkNone: true,
    readOnlyFilesystem: false
  },
  llmEngine: {
    provider: 'Gemini 3.6 Flash',
    temperature: 0.1,
    cacheDiffHash: true
  }
};

router.get('/', (req, res) => {
  res.json({
    config: systemConfig
  });
});

router.put('/', (req, res) => {
  const { executionPolicy, llmEngine } = req.body;
  if (executionPolicy) systemConfig.executionPolicy = { ...systemConfig.executionPolicy, ...executionPolicy };
  if (llmEngine) systemConfig.llmEngine = { ...systemConfig.llmEngine, ...llmEngine };

  res.json({ message: 'Settings saved', config: systemConfig });
});

module.exports = router;
