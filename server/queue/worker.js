require('dotenv').config();
const { Worker } = require('bullmq');
const redis = require('../config/redis');
const connectDB = require('../config/db');
const Analysis = require('../models/Analysis');
const Repository = require('../models/Repository');
const ReviewHistory = require('../models/ReviewHistory');
const githubService = require('../services/githubService');
const sandboxRunner = require('../sandbox/sandboxRunner');
const llmService = require('../services/llmService');
const { QUEUE_NAME } = require('./analysisQueue');

// Connect Database in worker process
connectDB();

let ioInstance = null;
const setSocketIO = (io) => {
  ioInstance = io;
};

const notifyStatus = (analysisId, stage, data = {}) => {
  if (ioInstance) {
    ioInstance.to(`analysis:${analysisId}`).emit('analysis:status', {
      analysisId,
      stage,
      ...data,
      timestamp: new Date().toISOString()
    });
  }
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { analysisId, repoId, owner, repoName, commitHash, userToken, branch } = job.data;
    console.log(`[Worker] Processing analysis job ${job.id} for ${owner}/${repoName}@${commitHash}`);

    const analysis = await Analysis.findById(analysisId);
    if (!analysis) {
      throw new Error(`Analysis record ${analysisId} not found`);
    }

    try {
      // Stage 1: Ingest / Fetch Diff
      notifyStatus(analysisId, 'queued', { label: 'Webhook & Diff ingested', step: 1 });
      let diff = analysis.diff;
      if (!diff) {
        diff = await githubService.getCommitDiff(owner, repoName, commitHash, userToken);
        analysis.diff = diff;
        await analysis.save();
      }

      // Stage 2: Sandbox Execution
      notifyStatus(analysisId, 'sandbox_running', { label: 'Micro-sandbox spawned', step: 2 });
      analysis.status = 'sandbox_running';
      await analysis.save();

      const filesToTest = (analysis.filesChanged && analysis.filesChanged.length > 0)
        ? analysis.filesChanged.map(f => f.filename)
        : [];

      const sandboxResult = await sandboxRunner.run({
        diff,
        files: filesToTest
      });

      analysis.sandboxOutput = {
        stdout: sandboxResult.stdout,
        stderr: sandboxResult.stderr,
        exitCode: sandboxResult.exitCode,
        durationMs: sandboxResult.durationMs,
        logs: sandboxResult.logs
      };
      await analysis.save();

      // Stage 3: AST & Static rules evaluated
      notifyStatus(analysisId, 'ast_analyzed', { label: 'AST & Static analysis verified', step: 3 });

      // Stage 4: LLM Review
      notifyStatus(analysisId, 'awaiting_llm', { label: 'Semantic LLM review in progress', step: 4 });
      analysis.status = 'awaiting_llm';
      await analysis.save();

      const review = await llmService.analyzeReview(diff, sandboxResult, { repoName: `${owner}/${repoName}` });

      // Stage 5: Store results
      analysis.status = 'completed';
      analysis.score = review.score;
      analysis.scoreDelta = review.scoreDelta;
      analysis.summary = review.summary;
      analysis.diffHash = review.diffHash;
      analysis.findings = review.findings || [];
      analysis.cweChecklist = review.cweChecklist || [];
      await analysis.save();

      // Update Repository record
      const repo = await Repository.findById(repoId);
      if (repo) {
        repo.lastScore = review.score;
        repo.lastAnalyzedCommit = commitHash;
        repo.totalAnalyses = (repo.totalAnalyses || 0) + 1;
        repo.updatedAt = new Date();
        await repo.save();
      }

      // Record in ReviewHistory for metrics & trend tracking
      const criticalCount = analysis.findings.filter(f => f.severity === 'critical').length;
      const warningCount = analysis.findings.filter(f => f.severity === 'warning').length;
      const noticeCount = analysis.findings.filter(f => f.severity === 'notice').length;

      await ReviewHistory.create({
        repoId,
        analysisId,
        commitHash,
        branch: branch || 'main',
        score: review.score,
        criticalCount,
        warningCount,
        noticeCount,
        sandboxStatus: sandboxResult.exitCode === 0 ? 'pass' : 'fail',
        timestamp: new Date()
      });

      // Stage 5 Notify Complete
      notifyStatus(analysisId, 'completed', {
        label: 'Score generation complete',
        step: 5,
        score: review.score,
        scoreDelta: review.scoreDelta,
        findings: analysis.findings
      });

      console.log(`[Worker] Analysis job ${job.id} completed. Score: ${review.score}`);
      return { status: 'completed', score: review.score };
    } catch (err) {
      console.error(`[Worker] Job ${job.id} failed:`, err);
      analysis.status = 'failed';
      await analysis.save();
      notifyStatus(analysisId, 'failed', { error: err.message });
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 5
  }
);

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} permanently failed: ${err.message}`);
});

module.exports = { worker, setSocketIO };
