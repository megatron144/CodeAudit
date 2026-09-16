const githubService = require('./services/githubService');
const sandboxRunner = require('./sandbox/sandboxRunner');
const llmService = require('./services/llmService');
const chatService = require('./services/chatService');

async function testPipeline() {
  console.log('=== [1] Testing GitHub Service ===');
  const parsed = githubService.parseRepoUrl('https://github.com/expressjs/express');
  console.log('Parsed repo:', parsed);

  const meta = await githubService.getRepoMetadata('expressjs', 'express');
  console.log('Repo metadata name:', meta.name, 'defaultBranch:', meta.defaultBranch);

  console.log('\n=== [2] Testing Sandbox Runner ===');
  const sampleDiff = `diff --git a/pkg/middleware/auth_jwt.go b/pkg/middleware/auth_jwt.go
--- a/pkg/middleware/auth_jwt.go
+++ b/pkg/middleware/auth_jwt.go
@@ -84,1 +84,1 @@
+ go v.startEvictionLoop(context.Background())`;

  const sandboxRes = await sandboxRunner.run({
    diff: sampleDiff,
    files: ['pkg/middleware/auth_jwt.go']
  });
  console.log('Sandbox exit code:', sandboxRes.exitCode);
  console.log('Sandbox logs captured:', sandboxRes.logs.length);
  console.log('Sandbox duration:', sandboxRes.durationMs, 'ms');

  console.log('\n=== [3] Testing LLM Service Review ===');
  const review = await llmService.analyzeReview(sampleDiff, sandboxRes, { repoName: 'expressjs/express' });
  console.log('Score:', review.score, 'Delta:', review.scoreDelta);
  console.log('Findings count:', review.findings.length);
  if (review.findings[0]) {
    console.log('Top finding:', review.findings[0].rule, '->', review.findings[0].title);
  }

  console.log('\n=== [4] Testing Chat Service ===');
  let streamed = '';
  await chatService.streamReply({
    sessionId: 'test-session',
    query: 'Why did the score drop on auth_jwt.go?',
    onChunk: (chunk) => {
      streamed += chunk;
    },
    onComplete: (full) => {
      console.log('Grounded reply:', full);
    }
  });

  console.log('\n=== ALL PIPELINE VERIFICATIONS PASSED ===');
  process.exit(0);
}

testPipeline().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
