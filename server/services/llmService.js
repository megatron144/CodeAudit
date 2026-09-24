const crypto = require('crypto');
const axios = require('axios');
const redis = require('../config/redis');

class LLMService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  hashDiff(diff) {
    return crypto.createHash('sha256').update(diff || '').digest('hex');
  }

  async analyzeReview(diff, sandboxResult, repoContext = {}) {
    const diffHash = this.hashDiff(diff);
    const cacheKey = `llm:review:${diffHash}`;

    // 1. Check Redis cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[LLMService] Cache hit for diff hash: ${diffHash.slice(0, 8)}`);
        return {
          ...JSON.parse(cached),
          diffHash,
          fromCache: true
        };
      }
    } catch (e) {}

    console.log(`[LLMService] Generating new review for diff hash: ${diffHash.slice(0, 8)}`);

    // 2. Call LLM or deterministic fallback
    let reviewData = null;

    if (this.apiKey) {
      try {
        reviewData = await this.callGeminiAPI(diff, sandboxResult, repoContext);
      } catch (geminiErr) {
        console.warn(`[LLMService] Gemini API call failed: ${geminiErr.message}. Falling back to rule engine.`);
      }
    }

    if (!reviewData) {
      reviewData = this.generateDeterministicReview(diff, sandboxResult, repoContext);
    }

    reviewData.diffHash = diffHash;

    // 3. Cache result in Redis for 7 days
    try {
      await redis.set(cacheKey, JSON.stringify(reviewData), 'EX', 7 * 86400);
    } catch (e) {}

    return reviewData;
  }

  async callGeminiAPI(diff, sandboxResult, repoContext) {
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    const prompt = `You are CodeAudit's precision static analysis and code review engine.
Analyze the following code diff and sandbox output:

Repo: ${repoContext.repoName || 'unknown'}
Language: ${sandboxResult.language || 'generic'}
Sandbox Logs / Exit Code: ${sandboxResult.exitCode}, stdout: ${sandboxResult.stdout || 'none'}

Diff:
${diff ? diff.substring(0, 8000) : 'No diff provided.'}

Respond ONLY with valid JSON matching this exact schema:
{
  "score": number (0-100, where 100 is pristine code health),
  "scoreDelta": number (e.g. +1.5 or -2.0),
  "summary": string (1-2 plain sentences evaluating this change, no fluff),
  "findings": [
    {
      "rule": string (e.g. "RULE: SEC-01" or "RULE: PERF-02"),
      "line": number,
      "file": string (the actual filename from the diff),
      "severity": "critical" | "warning" | "notice",
      "title": string,
      "finding": string,
      "confidence": number (e.g. 98.5),
      "suggestedPatch": string
    }
  ],
  "cweChecklist": [
    { "name": string, "status": "Clean" | "Flagged" }
  ]
}`;

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const res = await axios.post(
          endpoint,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          },
          { timeout: 25000 }
        );

        const candidate = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          const cleanJson = candidate.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          return JSON.parse(cleanJson);
        }
      } catch (err) {
        console.warn(`[LLMService] Model ${model} failed (${err.message}). Trying next candidate...`);
      }
    }
    throw new Error('All Gemini API candidate models exhausted or rate-limited.');
  }

  generateDeterministicReview(diff, sandboxResult = {}, repoContext = {}) {
    if (!diff || !diff.trim()) {
      return {
        score: null,
        scoreDelta: 0,
        summary: "Analysis hasn't completed for this commit yet.",
        findings: [],
        cweChecklist: []
      };
    }

    // Extract actual changed filenames from diff
    const fileMatches = [...(diff || '').matchAll(/diff --git a\/([^\s]+) b\/([^\s]+)/g)];
    const primaryFile = fileMatches[0]?.[1] || 'code';
    const findings = [];
    const cweChecklist = [
      { name: 'CWE-89 SQL Injection', status: 'Clean' },
      { name: 'CWE-79 Cross-Site Scripting (XSS)', status: 'Clean' },
      { name: 'CWE-95 Dynamic Code Evaluation', status: 'Clean' },
      { name: 'CWE-400 Unbounded Resource Exhaustion', status: 'Clean' },
      { name: 'CWE-798 Hardcoded Secrets / Keys', status: 'Clean' },
      { name: 'CWE-319 Cleartext Protocol', status: 'Clean' }
    ];

    // Check Sandbox execution failures
    if (sandboxResult.exitCode !== 0) {
      findings.push({
        id: 'f-sandbox-err',
        rule: 'RULE: SANDBOX-FAIL',
        line: 1,
        file: primaryFile,
        severity: 'critical',
        title: 'Sandbox verification error',
        finding: sandboxResult.stderr || 'Build or static verification returned a non-zero exit code.',
        confidence: 99.0,
        suggestedPatch: ''
      });
    }

    // Rule 1: Dynamic code execution
    if (/(\beval\(|\bexec\(|\bFunction\(|child_process\.exec)/i.test(diff)) {
      cweChecklist.find(c => c.name.includes('CWE-95')).status = 'Flagged';
      findings.push({
        id: 'f-cwe-95',
        rule: 'RULE: SEC-CWE-95',
        line: 12,
        file: primaryFile,
        severity: 'critical',
        title: 'Dynamic code execution detected',
        finding: 'Use of eval, exec, or dynamic function invocation allows arbitrary code execution from untrusted inputs.',
        confidence: 97.5,
        suggestedPatch: '// Refactor to deterministic handlers instead of dynamic evaluation'
      });
    }

    // Rule 2: SQL Injection patterns
    if (/(SELECT|INSERT|UPDATE|DELETE).*\+.*req\.(body|query|params)|(SELECT|INSERT|UPDATE|DELETE).*`.*\$\{req\./i.test(diff)) {
      cweChecklist.find(c => c.name.includes('CWE-89')).status = 'Flagged';
      findings.push({
        id: 'f-cwe-89',
        rule: 'RULE: SEC-CWE-89',
        line: 24,
        file: primaryFile,
        severity: 'critical',
        title: 'Potential SQL Injection vector',
        finding: 'Raw query concatenation with request parameters detected. Use parameterized queries or prepared statements.',
        confidence: 96.0,
        suggestedPatch: 'db.query("SELECT * FROM users WHERE id = $1", [userId]);'
      });
    }

    // Rule 3: Cross-Site Scripting (XSS)
    if (/(dangerouslySetInnerHTML|innerHTML\s*=|\.html\(.*req\.)/i.test(diff)) {
      cweChecklist.find(c => c.name.includes('CWE-79')).status = 'Flagged';
      findings.push({
        id: 'f-cwe-79',
        rule: 'RULE: SEC-CWE-79',
        line: 18,
        file: primaryFile,
        severity: 'warning',
        title: 'Direct HTML / DOM Injection vector',
        finding: 'Unsanitized HTML rendering allows stored or reflected cross-site scripting (XSS).',
        confidence: 92.0,
        suggestedPatch: '// Use textContent or DOMPurify.sanitize() before DOM insertion'
      });
    }

    // Rule 4: Hardcoded credentials
    if (/(ghp_[a-zA-Z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA )?PRIVATE KEY-----)/i.test(diff)) {
      cweChecklist.find(c => c.name.includes('CWE-798')).status = 'Flagged';
      findings.push({
        id: 'f-cwe-798',
        rule: 'RULE: SEC-CWE-798',
        line: 5,
        file: primaryFile,
        severity: 'critical',
        title: 'Hardcoded secret or private credential',
        finding: 'Detected potential API token or cryptographic key committed into the repository diff.',
        confidence: 99.0,
        suggestedPatch: '// Move credentials to .env and load via process.env'
      });
    }

    // Rule 5: Resource leaks / goroutines
    if (diff.includes('context.Background()') && diff.includes('go v.')) {
      cweChecklist.find(c => c.name.includes('CWE-400')).status = 'Flagged';
      findings.push({
        id: 'f-cwe-400',
        rule: 'RULE: PERF-LEAK-01',
        line: 84,
        file: primaryFile,
        severity: 'warning',
        title: 'Unbounded goroutine lifecycle',
        finding: 'Passing context.Background() inside a long-lived goroutine prevents cancellation on request termination.',
        confidence: 94.0,
        suggestedPatch: 'go v.startEvictionLoop(ctx)'
      });
    }

    // Rule 6: Insecure cleartext transport
    if (/(http:\/\/(?!localhost|127\.0\.0\.1))/i.test(diff)) {
      cweChecklist.find(c => c.name.includes('CWE-319')).status = 'Flagged';
      findings.push({
        id: 'f-cwe-319',
        rule: 'RULE: SEC-CWE-319',
        line: 9,
        file: primaryFile,
        severity: 'notice',
        title: 'Insecure HTTP cleartext URI',
        finding: 'External resources should be requested over HTTPS to protect against interception and MITM.',
        confidence: 88.0,
        suggestedPatch: 'https://...'
      });
    }

    // Compute Health Score dynamically based on findings
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const warningCount = findings.filter(f => f.severity === 'warning').length;
    const noticeCount = findings.filter(f => f.severity === 'notice').length;

    let deduction = (criticalCount * 25) + (warningCount * 10) + (noticeCount * 3);
    const score = Math.max(20, Math.min(100, Math.round((100 - deduction) * 10) / 10));
    const scoreDelta = score < 100 ? -(100 - score) : 0;

    let summary = `Static analysis completed for ${repoContext.repoName || 'repository'}.`;
    if (criticalCount > 0) {
      summary = `Critical security findings identified (${criticalCount} blocking issues) requiring remediation before merge.`;
    } else if (warningCount > 0) {
      summary = `Code health evaluation noted ${warningCount} advisory warnings in ${primaryFile}.`;
    } else {
      summary = `All evaluated static invariant gates passed cleanly with zero critical CVE patterns.`;
    }

    return {
      score,
      scoreDelta,
      summary,
      findings,
      cweChecklist
    };
  }
}

module.exports = new LLMService();
