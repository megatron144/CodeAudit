const mongoose = require('mongoose');
const redis = require('../config/redis');
const axios = require('axios');
const Analysis = require('../models/Analysis');
const Repository = require('../models/Repository');
const ReviewHistory = require('../models/ReviewHistory');
const githubService = require('./githubService');

class ChatService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.SESSION_TTL = 86400; // 24 hours
    // Gemini model
    this.models = ['gemini-3.6-flash'];
  }

  getSessionKey(sessionId) {
    return `chat:history:${sessionId}`;
  }

  getTokensKey(sessionId) {
    return `chat:tokens:${sessionId}`;
  }

  getQueriesKey(sessionId) {
    return `chat:queries:${sessionId}`;
  }

  async getHistory(sessionId) {
    try {
      const data = await redis.get(this.getSessionKey(sessionId));
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  async saveHistory(sessionId, history) {
    try {
      await redis.set(
        this.getSessionKey(sessionId),
        JSON.stringify(history.slice(-20)), // retain last 20 messages
        'EX',
        this.SESSION_TTL
      );
    } catch (e) {}
  }

  async clearSession(sessionId) {
    try {
      await Promise.all([
        redis.del(this.getSessionKey(sessionId)),
        redis.del(this.getTokensKey(sessionId)),
        redis.del(this.getQueriesKey(sessionId)),
      ]);
    } catch (e) {}
  }

  async recordSessionUsage(sessionId, tokens = 0) {
    try {
      const tokensKey = this.getTokensKey(sessionId);
      const queriesKey = this.getQueriesKey(sessionId);

      const [currentTokens, currentQueries] = await Promise.all([
        redis.incrby(tokensKey, tokens),
        redis.incr(queriesKey),
      ]);

      await Promise.all([
        redis.expire(tokensKey, this.SESSION_TTL),
        redis.expire(queriesKey, this.SESSION_TTL),
      ]);

      return {
        tokensUsed: Number(currentTokens) || tokens,
        queriesUsed: Number(currentQueries) || 1,
        tokenLimit: 200000,
        queryLimit: 50,
      };
    } catch (e) {
      return {
        tokensUsed: tokens,
        queriesUsed: 1,
        tokenLimit: 200000,
        queryLimit: 50,
      };
    }
  }

  detectTreeIntent(query = '') {
    const q = query.toLowerCase();
    const keywords = [
      'structure',
      'tree',
      'architecture',
      'flow',
      'overview',
      'file tree',
      'hierarchy',
      'components',
      'modules',
      'how does this flow',
      'how it works',
      'dependencies',
    ];
    return keywords.some((k) => q.includes(k));
  }

  buildFileTreeHierarchy(filePaths = []) {
    const root = [];

    const getFilePurpose = (path) => {
      const lower = path.toLowerCase();
      if (lower.includes('package.json')) return 'Project manifest, scripts, and runtime dependencies';
      if (lower.includes('dockerfile')) return 'Container build specification and runtime image definition';
      if (lower.includes('readme')) return 'Primary project documentation, usage guides, and overview';
      if (lower.includes('.eslintrc') || lower.includes('eslint')) return 'Static analysis and code quality rule definitions';
      if (lower.endsWith('.test.js') || lower.endsWith('.spec.js') || lower.includes('test/')) return 'Automated test suite and invariant assertions';
      if (lower.includes('index.') || lower.includes('main.')) return 'Primary module entrypoint and router initialization';
      if (lower.includes('routes/')) return 'HTTP route endpoints and API request controllers';
      if (lower.includes('middleware/')) return 'Request pipeline interceptors and authentication guards';
      if (lower.includes('models/')) return 'Data schemas, persistence invariants, and entities';
      if (lower.includes('services/')) return 'Business logic, external integrations, and orchestrations';
      if (lower.includes('config/')) return 'Environment variables, connection pools, and runtime config';
      return `Source module: ${path}`;
    };

    filePaths.slice(0, 50).forEach((filePath) => {
      const parts = filePath.split('/');
      let currentLevel = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');

        let existing = currentLevel.find((item) => item.name === part);

        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'dir',
            purpose: isFile ? getFilePurpose(currentPath) : `${part}/ directory`,
            children: isFile ? undefined : [],
          };
          currentLevel.push(existing);
        }

        if (!isFile) {
          currentLevel = existing.children;
        }
      });
    });

    return root;
  }

  async assembleContext({ repoId, analysisId, taggedFiles = [] }) {
    let repo = null;
    let analysis = null;
    let fileTree = [];
    let pastScores = [];

    if (analysisId && mongoose.Types.ObjectId.isValid(analysisId)) {
      analysis = await Analysis.findById(analysisId);
    }

    if (repoId && mongoose.Types.ObjectId.isValid(repoId)) {
      repo = await Repository.findById(repoId);
    } else if (analysis && analysis.repoId && mongoose.Types.ObjectId.isValid(analysis.repoId)) {
      repo = await Repository.findById(analysis.repoId);
    }

    // If analysisId wasn't passed, look up the latest completed analysis for this repo
    if (!analysis && repo) {
      try {
        analysis = await Analysis.findOne({ repoId: repo._id, status: 'completed' }).sort({ createdAt: -1 });
        if (!analysis) {
          analysis = await Analysis.findOne({ repoId: repo._id }).sort({ createdAt: -1 });
        }
      } catch (e) {
        console.warn('[ChatService] Error finding recent analysis:', e.message);
      }
    }

    if (repo) {
      try {
        fileTree = await githubService.getFileTree(repo.owner, repo.name, repo.defaultBranch);
      } catch (e) {}

      try {
        const histories = await ReviewHistory.find({ repoId: repo._id }).sort({ timestamp: -1 }).limit(5);
        pastScores = histories.map((h) => ({
          commit: h.commitHash,
          score: h.score,
          date: h.timestamp,
        }));
      } catch (e) {}
    }

    const activeCommit = analysis?.commitHash || repo?.lastAnalyzedCommit || 'HEAD';
    let activeDiff = analysis?.diff || '';

    // If diff is empty but we have repo and commit, try fetching the commit diff via GitHub API
    if (!activeDiff && repo && activeCommit && activeCommit !== 'unknown' && activeCommit !== 'HEAD') {
      try {
        activeDiff = await githubService.getCommitDiff(repo.owner, repo.name, activeCommit);
      } catch (e) {}
    }

    const hasAnalysisCompleted = Boolean(
      analysis &&
      (analysis.status === 'completed' || (analysis.score !== null && analysis.score !== undefined))
    );
    const healthScore = hasAnalysisCompleted ? (analysis.score ?? repo?.lastScore ?? null) : null;

    return {
      repoName: repo ? `${repo.owner}/${repo.name}` : (analysis ? analysis.repoName : 'unknown/repo'),
      defaultBranch: repo?.defaultBranch || 'main',
      stars: repo?.stars || 0,
      forks: repo?.forks || 0,
      openIssues: repo?.openIssues || 0,
      description: repo?.description || 'Repository registered in CodeAudit workspace',
      activeCommit,
      activeDiff: activeDiff || '',
      findings: analysis?.findings || [],
      sandboxOutput: analysis?.sandboxOutput?.stdout || analysis?.sandboxOutput?.stderr || '',
      healthScore,
      hasAnalysisCompleted,
      fileTree: (fileTree || []).slice(0, 40),
      taggedFiles,
      pastScores,
    };
  }

  async getInteractiveTree({ repoId, analysisId }) {
    const context = await this.assembleContext({ repoId, analysisId });
    return {
      repoName: context.repoName,
      branch: context.defaultBranch,
      tree: this.buildFileTreeHierarchy(context.fileTree),
      totalFiles: context.fileTree.length,
    };
  }

  async streamReply({
    sessionId,
    query,
    repoId,
    analysisId,
    mode = 'detailed',
    taggedFiles = [],
    requestTree = false,
    onChunk,
    onComplete,
  }) {
    console.log(`[ChatService] [START] Request for session: "${sessionId}" | Query: "${query}" | RepoId: "${repoId}" | AnalysisId: "${analysisId}"`);
    const t0 = Date.now();
    const context = await this.assembleContext({ repoId, analysisId, taggedFiles });
    const t1 = Date.now();
    const contextBuildMs = t1 - t0;
    console.log(`[ChatService] [CONTEXT] Assembled in ${contextBuildMs}ms | Repo: "${context.repoName}" | Branch: "${context.defaultBranch}" | Files: ${context.fileTree.length} | Diff length: ${context.activeDiff.length}`);

    const history = await this.getHistory(sessionId);
    const historyText = history
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const isTreeRequested = requestTree || this.detectTreeIntent(query);
    const treeData = isTreeRequested ? this.buildFileTreeHierarchy(context.fileTree) : null;
    console.log(`[ChatService] [INTENT] Structure tree requested: ${isTreeRequested} (explicit: ${requestTree})`);

    let fullReply = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    if (this.apiKey) {
      const modeInstruction = mode === 'quick'
        ? `Provide a direct, high-density response formatted strictly in 2-3 concise bullet points with bold sub-labels (e.g. "**Primary finding:** ...", "**Resolution:** ..."). No conversational pleasantries or filler.`
        : `Structure your response with clear markdown headings and bold inline sub-labels:
- Start with an informative bold header or topic title (e.g. "### Overview of ${context.repoName}")
- Provide discrete, labeled sections using bold bullet points (e.g. "**Structure:** ...", "**Entry point:** ...", "**Key dependencies:** ...", "**Audit Invariants:** ...")
- Present discrete points rather than a single dense block of prose.`;

      const prompt = `You are CodeAudit's repo-aware precision AI assistant.
Your goal is to answer the user's specific question conversationally, clearly, and technically.

MANDATORY GUARDRAILS & INSTRUCTIONS:
1. Answer the user's question directly in natural, human-written conversational language.
2. Under no circumstances should you echo the context structure, dump raw metadata fields, or output internal system state (such as commit hashes, scores without context, or diff status strings) verbatim as a response. Always answer the user's question in natural, conversational language.
3. If the user asks about code health, quality, or audit findings:
   - If analysis hasn't completed, honestly state: "Analysis hasn't completed for this commit yet."
   - Never fabricate an audit score or invent findings.
4. If you do not have enough information to answer the question, state plainly: "I don't have enough information to answer that yet" rather than guessing or dumping internal context fields.
5. Base all technical details strictly on the repository facts, code, and findings provided below.

${modeInstruction}

REPOSITORY CONTEXT:
- Repository: ${context.repoName} (Branch: ${context.defaultBranch})
- Description: ${context.description}
${context.activeDiff ? `- Evaluated Diff:\n${context.activeDiff.substring(0, 4000)}` : '- Evaluated Diff: None loaded for this query.'}
${context.findings.length > 0 ? `- Findings:\n${JSON.stringify(context.findings.slice(0, 5), null, 2)}` : (context.hasAnalysisCompleted ? '- Findings: No active findings detected.' : '- Findings: Analysis has not completed yet.')}
${context.sandboxOutput ? `- Sandbox Execution Output:\n${context.sandboxOutput.substring(0, 1500)}` : ''}
${context.fileTree.length > 0 ? `- Verified Repository File Paths:\n${context.fileTree.join('\n')}` : ''}
${taggedFiles.length > 0 ? `- User Scoped Files: ${taggedFiles.join(', ')}` : ''}

${historyText ? `RECENT CHAT HISTORY:\n${historyText}\n` : ''}
USER QUESTION:
${query}

Respond conversationally to the user's question:`;

      // Try models in order with hard 30s timeout per call
      for (const modelName of this.models) {
        const tModel = Date.now();
        try {
          console.log(`[ChatService] [LLM CALL] Attempting model "${modelName}" with 30s hard timeout...`);
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
          const res = await axios.post(
            endpoint,
            {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: mode === 'quick' ? 0.1 : 0.2,
              },
            },
            { timeout: 30000 }
          );

          const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            fullReply = text.trim();
            const usage = res.data.usageMetadata || {};
            promptTokens = usage.promptTokenCount || Math.ceil(prompt.length / 4);
            completionTokens = usage.candidatesTokenCount || Math.ceil(fullReply.length / 4);
            totalTokens = usage.totalTokenCount || (promptTokens + completionTokens);
            console.log(`[ChatService] [LLM SUCCESS] Model "${modelName}" responded in ${Date.now() - tModel}ms | Tokens: ${totalTokens}`);
            break; // Succeeded
          }
        } catch (err) {
          console.warn(`[ChatService] [LLM ERROR] Model "${modelName}" failed in ${Date.now() - tModel}ms: ${err.message}.`);
        }
      }
    } else {
      console.log(`[ChatService] [NOTICE] No GEMINI_API_KEY set; using grounded deterministic review.`);
    }

    const t2 = Date.now();
    const generationMs = t2 - t1;
    const totalMs = t2 - t0;

    if (!fullReply) {
      // Deterministic conversational fallback answering the question naturally without dumping raw metadata
      const lowerQuery = (query || '').toLowerCase();
      
      if (lowerQuery.includes('audit') || lowerQuery.includes('finding') || lowerQuery.includes('vulnerability') || lowerQuery.includes('issue')) {
        if (context.hasAnalysisCompleted) {
          fullReply = `The audit evaluation for **${context.repoName}** identified ${context.findings.length} findings.${context.findings.length > 0 ? ` Key findings include ${context.findings.map(f => f.title || f.rule).slice(0, 2).join(' and ')}.` : ' No vulnerabilities or blocking issues were identified in this run.'}`;
        } else {
          fullReply = `Analysis hasn't completed for this commit yet. Once an audit is triggered and completes, verified diagnostic findings will be available.`;
        }
      } else if (lowerQuery.includes('what') || lowerQuery.includes('overview') || lowerQuery.includes('do') || lowerQuery.includes('about')) {
        fullReply = `**${context.repoName}** is ${context.description || 'a project registered in CodeAudit'}.${context.fileTree.length > 0 ? ` Key files and modules include \`${context.fileTree.slice(0, 4).join('`, `')}\`.` : ''}`;
      } else if (lowerQuery.includes('structure') || lowerQuery.includes('tree') || lowerQuery.includes('architecture')) {
        fullReply = `Here is the high-level module layout for **${context.repoName}** across the ${context.defaultBranch} branch:\n\n` +
          (context.fileTree.length > 0 ? context.fileTree.slice(0, 6).map(f => `• \`${f}\``).join('\n') : 'No file paths currently indexed.');
      } else {
        fullReply = `I don't have enough information to answer that yet. Please try asking about the repository structure or specific files.`;
      }
      
      promptTokens = Math.ceil(query.length / 4) + 60;
      completionTokens = Math.ceil(fullReply.length / 4);
      totalTokens = promptTokens + completionTokens;
    }

    // Record session usage
    const sessionStats = await this.recordSessionUsage(sessionId, totalTokens);

    const telemetry = {
      scope: taggedFiles.length > 0 ? `Scoped to ${taggedFiles.join(', ')}` : 'Repo context only',
      contextBuildMs,
      generationMs,
      totalMs,
      promptTokens,
      completionTokens,
      totalTokens,
    };

    // Save query to history
    history.push({
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    });

    // Stream chunks to client simulating high-speed streaming
    const words = fullReply.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
      if (onChunk) onChunk(chunk);
      await new Promise((r) => setTimeout(r, 15));
    }

    // Save response to history with telemetry
    history.push({
      role: 'assistant',
      content: fullReply,
      telemetry,
      timestamp: new Date().toISOString(),
      treeData: isTreeRequested ? treeData : null,
    });
    await this.saveHistory(sessionId, history);

    const resultPayload = {
      fullReply,
      telemetry,
      sessionStats,
      treeData: isTreeRequested ? treeData : null,
    };

    if (onComplete) onComplete(resultPayload);
    return resultPayload;
  }
}

module.exports = new ChatService();
