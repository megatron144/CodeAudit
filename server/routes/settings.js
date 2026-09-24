const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const { requireAdmin } = require('../middleware/auth');

const DEFAULT_CONFIG = {
  executionPolicy: {
    sandboxTimeoutSeconds: 30,
    memoryLimitMb: 512,
    cpuQuota: 1.0,
    enforceNetworkNone: true,
    readOnlyFilesystem: false,
  },
  llmEngine: {
    provider: 'Gemini 1.5 Flash',
    temperature: 0.1,
    cacheDiffHash: true,
  },
};

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let configDoc = await SystemConfig.findOne({ key: 'global_config' });
    if (!configDoc) {
      configDoc = await SystemConfig.create({
        key: 'global_config',
        ...DEFAULT_CONFIG,
      });
    }
    res.json({ config: configDoc });
  } catch (err) {
    res.json({ config: DEFAULT_CONFIG });
  }
});

// PUT /api/settings
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { executionPolicy, llmEngine } = req.body;
    let configDoc = await SystemConfig.findOne({ key: 'global_config' });
    if (!configDoc) {
      configDoc = new SystemConfig({ key: 'global_config' });
    }

    if (executionPolicy) {
      configDoc.executionPolicy = {
        ...configDoc.executionPolicy.toObject(),
        ...executionPolicy,
      };
    }

    if (llmEngine) {
      configDoc.llmEngine = {
        ...configDoc.llmEngine.toObject(),
        ...llmEngine,
      };
    }

    configDoc.updatedAt = new Date();
    await configDoc.save();

    res.json({ message: 'Settings saved successfully', config: configDoc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
