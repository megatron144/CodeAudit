const express = require('express');
const router = express.Router();
const Repository = require('../models/Repository');
const Analysis = require('../models/Analysis');
const ReviewHistory = require('../models/ReviewHistory');
const githubService = require('../services/githubService');
const { checkRepoSizeCap } = require('../middleware/rateLimiter');
const { requireAdmin } = require('../middleware/auth');

// Resolve a GitHub repository URL or username
router.post('/resolve', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'A GitHub repository URL or username is required.' });
    }

    const trimmed = query.trim().replace(/^@/, '');
    const isRepoInput = trimmed.includes('/') || trimmed.includes('github.com');

    if (isRepoInput) {
      const { owner, repo: repoName } = githubService.parseRepoUrl(trimmed);
      const metadata = await githubService.getRepoMetadata(owner, repoName);

      if (metadata.isPrivate) {
        return res.status(400).json({
          message: 'Private repository detected. Only public repositories are supported.'
        });
      }

      checkRepoSizeCap(metadata);

      let repo = await Repository.findOne({
        fullName: `${owner}/${repoName}`
      });

      if (!repo) {
        repo = new Repository({
          owner,
          name: repoName,
          fullName: `${owner}/${repoName}`,
          repoUrl: `https://github.com/${owner}/${repoName}`,
          defaultBranch: metadata.defaultBranch || 'main',
          isPrivate: false,
          description: metadata.description || '',
          stars: metadata.stars || 0,
          forks: metadata.forks || 0,
        });
        await repo.save();
      }

      return res.json({
        type: 'repo',
        repo
      });
    } else {
      const repos = await githubService.getUserRepositories(trimmed);
      return res.json({
        type: 'user',
        username: trimmed,
        repos
      });
    }
  } catch (err) {
    const isNotFound = err.response?.status === 404 || err.message.toLowerCase().includes('not found');
    return res.status(isNotFound ? 404 : 400).json({
      message: err.message || 'Unable to resolve repository or user on GitHub.'
    });
  }
});

// Search GitHub users with backend Redis caching
router.get('/search-users', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json([]);
    }
    const users = await githubService.searchUsers(q);
    return res.json(users);
  } catch (err) {
    return res.json([]);
  }
});

// Fetch user profile with backend Redis caching
router.get('/user-profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await githubService.getUserProfile(username);
    return res.json(user);
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : (err.message?.includes('rate limit') ? 429 : 500);
    return res.status(status).json({ message: err.message });
  }
});

// Link a Public Repository by URL
router.post('/link', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ message: 'Repository URL is required' });
    }

    const { owner, repo: repoName } = githubService.parseRepoUrl(repoUrl);

    // Validate repo is a real, public repository via GitHub API
    const metadata = await githubService.getRepoMetadata(owner, repoName);

    if (metadata.isPrivate) {
      return res.status(400).json({
        message: 'Private repository detected. Only public repositories are supported in this version.'
      });
    }

    // Check size limit
    checkRepoSizeCap(metadata);

    let repo = await Repository.findOne({
      fullName: `${owner}/${repoName}`
    });

    if (!repo) {
      repo = new Repository({
        owner,
        name: repoName,
        fullName: `${owner}/${repoName}`,
        repoUrl: `https://github.com/${owner}/${repoName}`,
        defaultBranch: metadata.defaultBranch || 'main',
        isPrivate: false,
        description: metadata.description || '',
        stars: metadata.stars || 0,
        forks: metadata.forks || 0,
      });
      await repo.save();
    }

    res.status(201).json(repo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// List Repositories
router.get('/', async (req, res) => {
  try {
    const repos = await Repository.find().sort({ updatedAt: -1 });
    res.json(repos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Do not add fallback/sample data here under any circumstances — show a real error/empty state instead.
router.get('/popular', async (req, res) => {
  try {
    const popularRepos = await githubService.getPopularRepositories();
    if (!popularRepos || popularRepos.length === 0) {
      return res.status(503).json({ message: 'Unable to load popular repositories right now' });
    }
    res.json(popularRepos);
  } catch (err) {
    res.status(503).json({ message: 'Unable to load popular repositories right now' });
  }
});

// Get List of Past Analyses for a Repository (Used by Analyses / History view)
router.get('/:repoId/analyses', async (req, res) => {
  try {
    const { repoId } = req.params;
    const analyses = await Analysis.find({ repoId }).sort({ createdAt: -1 });
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Score Over Time History for a Repository
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    let history = await ReviewHistory.find({ repoId: id }).sort({ timestamp: 1 }).limit(50);

    // If ReviewHistory is empty, read any completed Analysis documents for this repo
    if (history.length === 0) {
      const analyses = await Analysis.find({ repoId: id, status: 'completed' }).sort({ createdAt: 1 }).limit(50);
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

// Get Single Repo
router.get('/:id', async (req, res) => {
  try {
    const repo = await Repository.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ message: 'Repository not found' });
    }

    const [commits, pulls] = await Promise.all([
      githubService.getCommits(repo.owner, repo.name),
      githubService.getPullRequests(repo.owner, repo.name),
    ]);

    res.json({
      repo,
      commits,
      pulls,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete / Unlink
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Repository.findByIdAndDelete(req.params.id);
    await Analysis.deleteMany({ repoId: req.params.id });
    await ReviewHistory.deleteMany({ repoId: req.params.id });
    res.json({ message: 'Repository unlinked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
