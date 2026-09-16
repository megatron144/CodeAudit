const express = require('express');
const router = express.Router();
const ReviewHistory = require('../models/ReviewHistory');
const Analysis = require('../models/Analysis');

// Get Trends & Historical Score Data (Legacy support mapping to real data)
router.get('/trends/:repoId', async (req, res) => {
  try {
    const { repoId } = req.params;

    let history = await ReviewHistory.find({ repoId }).sort({ timestamp: 1 }).limit(50);

    // If ReviewHistory is empty, read any completed Analysis documents for this repo
    if (history.length === 0) {
      const analyses = await Analysis.find({ repoId, status: 'completed' }).sort({ createdAt: 1 }).limit(50);
      history = analyses.map((a) => ({
        _id: a._id,
        repoId: a.repoId,
        analysisId: a._id,
        commitHash: a.commitHash,
        branch: a.branch,
        score: a.score,
        criticalCount: (a.findings || []).filter((f) => f.severity === 'critical').length,
        warningCount: (a.findings || []).filter((f) => f.severity === 'warning').length,
        noticeCount: (a.findings || []).filter((f) => f.severity === 'notice').length,
        sandboxStatus: a.sandboxOutput?.exitCode === 0 ? 'pass' : 'fail',
        timestamp: a.createdAt,
      }));
    }

    const totalRuns = history.length;
    const passedRuns = history.filter((h) => h.sandboxStatus === 'pass').length;
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;
    const currentScore = totalRuns > 0 ? history[history.length - 1].score : null;

    res.json({
      history,
      metrics: {
        totalAnalyses: totalRuns,
        passRate,
        currentScore,
        issueDistribution: {
          critical: history.reduce((acc, h) => acc + (h.criticalCount || 0), 0),
          warning: history.reduce((acc, h) => acc + (h.warningCount || 0), 0),
          notices: history.reduce((acc, h) => acc + (h.noticeCount || 0), 0),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List all past analyses
router.get('/list/:repoId', async (req, res) => {
  try {
    const analyses = await Analysis.find({ repoId: req.params.repoId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('commitHash branch prNumber prTitle status score scoreDelta createdAt findings');

    res.json(analyses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
