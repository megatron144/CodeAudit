const { execSync } = require('child_process');
const https = require('https');
const readline = require('readline');

let cachedToken = null;
let tokenExpiry = 0;

function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }
  try {
    const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
    cachedToken = token;
    tokenExpiry = now + 45 * 60 * 1000; // cache for 45 mins
    return token;
  } catch (err) {
    process.stderr.write(`[Stitch Proxy] Failed to get gcloud token: ${err.message}\n`);
    throw err;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line.trim()) return;

  let token;
  try {
    token = getAccessToken();
  } catch (e) {
    return;
  }

  const req = https.request('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Goog-User-Project': 'gen-lang-client-0793475456',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(line)
    }
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      if (body.trim()) {
        process.stdout.write(body + '\n');
      }
    });
  });

  req.on('error', (err) => {
    process.stderr.write(`[Stitch Proxy Request Error]: ${err.message}\n`);
  });

  req.write(line);
  req.end();
});
