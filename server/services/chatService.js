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
    // Supported production Gemini models with auto-fallback
    this.models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'];
  }

  getApiKey() {
    return process.env.GEMINI_API_KEY || this.apiKey || '';
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

  async assembleContext({ repoId, analysisId, taggedFiles = [], query = '' }) {
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

    let owner = repo?.owner || '';
    let repoShortName = repo?.name || '';
    if ((!owner || !repoShortName) && analysis?.repoName) {
      const parts = analysis.repoName.split('/');
      if (parts.length === 2) {
        owner = parts[0];
        repoShortName = parts[1];
      }
    }

    const defaultBranch = repo?.defaultBranch || 'main';

    if (owner && repoShortName) {
      try {
        fileTree = await githubService.getFileTree(owner, repoShortName, defaultBranch);
      } catch (e) {}
    }

    if (repo) {
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
    if (!activeDiff && owner && repoShortName && activeCommit && activeCommit !== 'unknown' && activeCommit !== 'HEAD') {
      try {
        activeDiff = await githubService.getCommitDiff(owner, repoShortName, activeCommit);
      } catch (e) {}
    }

    const hasAnalysisCompleted = Boolean(
      analysis &&
      (analysis.status === 'completed' || (analysis.score !== null && analysis.score !== undefined))
    );
    const healthScore = hasAnalysisCompleted ? (analysis.score ?? repo?.lastScore ?? null) : null;

    // Pre-fetch critical files (README, build manifest, and query-relevant files)
    const fetchedFiles = [];
    if (owner && repoShortName && Array.isArray(fileTree) && fileTree.length > 0) {
      const filesToFetch = new Set();

      // 1. User-tagged files
      for (const tf of taggedFiles) {
        if (fileTree.includes(tf)) {
          filesToFetch.add(tf);
        }
      }

      // 2. README
      const readmeFile = fileTree.find((p) => /readme(\.md|\.markdown|\.txt)?$/i.test(p));
      if (readmeFile) {
        filesToFetch.add(readmeFile);
      }

      // 3. Manifest / build file
      const manifestFile = fileTree.find((p) =>
        /(^|\/)(pom\.xml|package\.json|go\.mod|cargo\.toml|requirements\.txt|build\.gradle|gemfile)$/i.test(p)
      );
      if (manifestFile) {
        filesToFetch.add(manifestFile);
      }

      // 4. Query-relevant files
      if (query) {
        const stopWords = new Set(['what', 'this', 'does', 'project', 'about', 'explain', 'show', 'tell', 'with', 'from', 'have', 'help', 'code']);
        const qTerms = query
          .toLowerCase()
          .split(/[^a-z0-9_-]+/)
          .filter((w) => w.length > 3 && !stopWords.has(w));

        for (const term of qTerms) {
          if (filesToFetch.size >= 5) break;
          const match = fileTree.find((p) => !filesToFetch.has(p) && p.toLowerCase().includes(term));
          if (match) {
            filesToFetch.add(match);
          }
        }
      }

      const fetchPromises = Array.from(filesToFetch).slice(0, 5).map(async (filePath) => {
        try {
          const content = await githubService.getFileContent(owner, repoShortName, filePath, defaultBranch);
          if (content) {
            return {
              path: filePath,
              content: content.length > 4000 ? content.substring(0, 4000) + '\n... [truncated]' : content,
            };
          }
        } catch (e) {
          console.warn(`[ChatService] Failed to prefetch ${filePath}: ${e.message}`);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      results.filter(Boolean).forEach((f) => fetchedFiles.push(f));
    }

    return {
      owner,
      repoShortName,
      repoName: (owner && repoShortName) ? `${owner}/${repoShortName}` : (repo ? `${repo.owner}/${repo.name}` : (analysis ? analysis.repoName : 'unknown/repo')),
      defaultBranch,
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
      fileTree: fileTree || [],
      fetchedFiles,
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
    const context = await this.assembleContext({ repoId, analysisId, taggedFiles, query });
    const t1 = Date.now();
    const contextBuildMs = t1 - t0;
    console.log(`[ChatService] [CONTEXT] Assembled in ${contextBuildMs}ms | Repo: "${context.repoName}" | Branch: "${context.defaultBranch}" | Files: ${context.fileTree.length} | Prefetched: ${context.fetchedFiles.length} | Diff length: ${context.activeDiff.length}`);

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

    const apiKey = this.getApiKey();

    if (apiKey) {
      const modeInstruction = mode === 'quick'
        ? `Provide a direct, high-density response formatted strictly in 2-3 concise bullet points with bold sub-labels (e.g. "**Primary finding:** ...", "**Resolution:** ..."). No conversational pleasantries or filler.`
        : `Structure your response with clear markdown headings and bold inline sub-labels:
- Start with an informative bold header or topic title (e.g. "### Overview of ${context.repoName}")
- Provide discrete, labeled sections using bold bullet points (e.g. "**Core Purpose:** ...", "**Key Tech Stack:** ...", "**Architecture & Entry Points:** ...", "**Key Modules:** ...")
- Present discrete points rather than a single dense block of prose.`;

      const fetchedFilesBlock = context.fetchedFiles && context.fetchedFiles.length > 0
        ? `\nPRE-FETCHED REPOSITORY FILE CONTENTS:\n` +
          context.fetchedFiles.map((f) => `=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===`).join('\n\n')
        : '';

      const prompt = `You are CodeAudit's repo-aware precision AI assistant.
Your goal is to answer the user's specific question conversationally, clearly, and technically, grounded in the actual codebase.

MANDATORY INSTRUCTIONS:
1. Answer the user's question directly, drawing on the real codebase, file contents, dependencies, architecture, and findings provided.
2. If you need to inspect an additional file from the repository file tree that is not yet shown, use the fetchFileContent tool to inspect it before giving your final answer.
3. If the user asks what the project does, explain its purpose, key tech stack, core components, and functionality based on the README and source files.
4. If the user asks about code health, quality, or audit findings:
   - If analysis hasn't completed, honestly state: "Analysis hasn't completed for this commit yet."
   - Never fabricate an audit score or invent findings.
5. Under no circumstances should you echo raw system metadata fields or dump raw JSON structures unless requested. Format your answer with clean GitHub markdown.

${modeInstruction}

REPOSITORY CONTEXT:
- Repository: ${context.repoName} (Branch: ${context.defaultBranch})
- Description: ${context.description}
${context.activeDiff ? `- Evaluated Diff:\n${context.activeDiff.substring(0, 4000)}` : ''}
${context.findings.length > 0 ? `- Findings:\n${JSON.stringify(context.findings.slice(0, 5), null, 2)}` : (context.hasAnalysisCompleted ? '- Findings: No active findings detected.' : '- Findings: Analysis has not completed yet.')}
${context.sandboxOutput ? `- Sandbox Execution Output:\n${context.sandboxOutput.substring(0, 1500)}` : ''}
${context.fileTree.length > 0 ? `- Verified Repository File Tree (Total ${context.fileTree.length} files):\n${context.fileTree.slice(0, 80).join('\n')}` : ''}
${taggedFiles.length > 0 ? `- User Scoped Files: ${taggedFiles.join(', ')}` : ''}
${fetchedFilesBlock}

${historyText ? `RECENT CHAT HISTORY:\n${historyText}\n` : ''}
USER QUESTION:
${query}

Respond conversationally to the user's question:`;

      const tools = [
        {
          functionDeclarations: [
            {
              name: 'fetchFileContent',
              description: 'Fetch the raw contents of a file in the repository to inspect its code, configuration, or implementation details.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  filePath: {
                    type: 'STRING',
                    description: 'The exact relative path of the file as shown in the Verified Repository File Tree (e.g., README.md, pom.xml, src/index.js)',
                  },
                },
                required: ['filePath'],
              },
            },
          ],
        },
      ];

      // Try models in order with hard 30s timeout per call
      for (const modelName of this.models) {
        const tModel = Date.now();
        try {
          console.log(`[ChatService] [LLM CALL] Attempting model "${modelName}" with 30s hard timeout...`);
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

          let conversationContents = [
            { role: 'user', parts: [{ text: prompt }] },
          ];

          const generationConfig = {
            temperature: mode === 'quick' ? 0.1 : 0.2,
          };
          if (!modelName.includes('lite')) {
            generationConfig.thinkingConfig = { thinkingBudget: 0 };
          }

          // Allow up to 2 tool execution turns if model requests files
          for (let turn = 0; turn < 3; turn++) {
            const res = await axios.post(
              endpoint,
              {
                contents: conversationContents,
                tools,
                generationConfig,
              },
              { timeout: 30000 }
            );

            const candidate = res.data.candidates?.[0];
            const candidateContent = candidate?.content;
            if (!candidateContent) break;

            const parts = candidateContent.parts || [];
            const functionCallPart = parts.find((p) => p.functionCall);

            if (functionCallPart && turn < 2 && context.owner && context.repoShortName) {
              const { name, args } = functionCallPart.functionCall;
              if (name === 'fetchFileContent' && args?.filePath) {
                const targetPath = args.filePath;
                console.log(`[ChatService] [TOOL CALL] Model requested file: ${targetPath}`);
                const fileCode = await githubService.getFileContent(
                  context.owner,
                  context.repoShortName,
                  targetPath,
                  context.defaultBranch
                );

                // Add model's turn (with functionCall) and function response
                conversationContents.push(candidateContent);
                conversationContents.push({
                  role: 'function',
                  parts: [
                    {
                      functionResponse: {
                        name: 'fetchFileContent',
                        response: {
                          filePath: targetPath,
                          content: fileCode ? fileCode.substring(0, 8000) : 'File not found or empty.',
                        },
                      },
                    },
                  ],
                });
                continue; // Next turn with function response
              }
            }

            // Extract text response
            const textParts = parts.map((p) => p.text).filter(Boolean);
            const text = textParts.join('\n').trim();
            if (text) {
              fullReply = text;
              const usage = res.data.usageMetadata || {};
              promptTokens = usage.promptTokenCount || Math.ceil(prompt.length / 4);
              completionTokens = usage.candidatesTokenCount || Math.ceil(fullReply.length / 4);
              totalTokens = usage.totalTokenCount || (promptTokens + completionTokens);
              console.log(`[ChatService] [LLM SUCCESS] Model "${modelName}" responded in ${Date.now() - tModel}ms | Tokens: ${totalTokens}`);
              break;
            }
          }

          if (fullReply) {
            break; // Succeeded with this model
          }
        } catch (err) {
          console.warn(`[ChatService] [LLM ERROR] Model "${modelName}" failed in ${Date.now() - tModel}ms: ${err.message}.`);
        }
      }
    } else {
      console.warn(`[ChatService] [NOTICE] No GEMINI_API_KEY set.`);
    }

    const t2 = Date.now();
    const generationMs = t2 - t1;
    const totalMs = t2 - t0;

    // Never use canned or hardcoded template answers!
    if (!fullReply) {
      fullReply = `Unable to generate a response from the AI model at this moment. Please verify your Gemini API key and network connection, then try again.`;
      promptTokens = Math.ceil(query.length / 4);
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
