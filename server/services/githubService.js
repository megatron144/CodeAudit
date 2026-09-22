const axios = require('axios');
const redis = require('../config/redis');

class GitHubService {
  constructor() {
    this.apiBase = 'https://api.github.com';
  }

  getHeaders(userToken = null, etag = null) {
    const token = userToken || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || null;
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeAudit-System/2.4'
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    return headers;
  }

  async searchUsers(query) {
    if (!query || query.trim().length < 2) return [];
    const clean = query.trim().replace(/^@/, '').toLowerCase();
    const cacheKey = `gh:user_search:${clean}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    try {
      const url = `${this.apiBase}/search/users?q=${encodeURIComponent(clean)}&per_page=6`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 5000,
      });
      const items = response.data?.items || [];
      const users = items.map((u) => ({
        login: u.login,
        avatar_url: u.avatar_url,
        type: u.type,
      }));

      try {
        await redis.set(cacheKey, JSON.stringify(users), 'EX', 1800); // 30 min cache
      } catch (e) {}

      return users;
    } catch (err) {
      console.warn(`[GitHubService] searchUsers notice: ${err.message}`);
      return [];
    }
  }

  async getUserProfile(username) {
    if (!username) throw new Error('Username is required');
    const clean = username.trim().replace(/^@/, '');
    const cacheKey = `gh:user_profile:${clean.toLowerCase()}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    try {
      const url = `${this.apiBase}/users/${encodeURIComponent(clean)}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 8000,
      });
      const user = response.data;
      try {
        await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600); // 1 hr cache
      } catch (e) {}
      return user;
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error(`GitHub user "${username}" not found.`);
      }
      if (err.response?.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Add a GITHUB_TOKEN to your .env file for 5,000 requests/hour.');
      }
      throw err;
    }
  }

  async cachedRequest(url, userToken = null, ttl = 300) {
    const cacheKey = `gh:cache:${url}`;
    const etagKey = `gh:etag:${url}`;

    try {
      const cachedData = await redis.get(cacheKey);
      const cachedEtag = await redis.get(etagKey);

      const headers = this.getHeaders(userToken, cachedEtag);
      const response = await axios.get(url, {
        headers,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304
      });

      if (response.status === 304 && cachedData) {
        return JSON.parse(cachedData);
      }

      if (response.status === 200) {
        const data = response.data;
        const newEtag = response.headers.etag;
        try {
          await redis.set(cacheKey, JSON.stringify(data), 'EX', ttl);
          if (newEtag) {
            await redis.set(etagKey, newEtag, 'EX', ttl * 2);
          }
        } catch (e) {}
        return data;
      }
    } catch (err) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (e) {}

      if (err.response) {
        if (err.response.status === 404) {
          throw new Error('Repository or resource not found on GitHub. Ensure it is a valid public repository.');
        }
        if (err.response.status === 403) {
          throw new Error('GitHub API rate limit exceeded or access denied.');
        }
      }
      throw err;
    }
  }

  parseRepoUrl(repoUrl) {
    if (!repoUrl || typeof repoUrl !== 'string') {
      throw new Error('Repository URL or identifier is required');
    }
    const clean = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
    const match = clean.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    const shortMatch = clean.match(/^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)$/);
    if (shortMatch) {
      return { owner: shortMatch[1], repo: shortMatch[2] };
    }
    throw new Error('Invalid GitHub repository URL format. Expected: https://github.com/owner/repo or owner/repo');
  }

  // Do not add fallback/sample data here under any circumstances — show a real error/empty state instead.
  async getPopularRepositories() {
    const cacheKey = 'gh:popular_repos';
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    try {
      const url = `${this.apiBase}/search/repositories?q=stars:>10000+is:public&sort=stars&order=desc&per_page=6`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data.items) && response.data.items.length > 0) {
        const popular = response.data.items.map(item => ({
          name: item.name,
          fullName: item.full_name,
          owner: item.owner?.login || '',
          ownerAvatar: item.owner?.avatar_url || '',
          description: item.description || '',
          stars: item.stargazers_count || 0,
          forks: item.forks_count || 0,
          language: item.language || 'Code',
          url: item.html_url
        }));

        try {
          // Cache in Redis for 4 hours (14400s)
          await redis.set(cacheKey, JSON.stringify(popular), 'EX', 14400);
        } catch (e) {}

        return popular;
      }
      throw new Error('GitHub Search API returned no repository items');
    } catch (err) {
      console.warn(`[GitHubService] getPopularRepositories failed: ${err.message}`);
      // Do not add fallback/sample data here under any circumstances — show a real error/empty state instead.
      throw new Error(`Unable to load popular repositories from GitHub Search API: ${err.message}`);
    }
  }

  async getUserRepositories(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('Username is required');
    }
    const cleanUser = username.trim().replace(/^@/, '');
    const cacheKey = `gh:user_repos:${cleanUser.toLowerCase()}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    try {
      const url = `${this.apiBase}/users/${encodeURIComponent(cleanUser)}/repos?sort=updated&per_page=15&type=public`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 10000
      });

      if (Array.isArray(response.data)) {
        const repos = response.data
          .filter(item => !item.private)
          .map(item => ({
            name: item.name,
            fullName: item.full_name,
            owner: item.owner?.login || cleanUser,
            ownerAvatar: item.owner?.avatar_url || '',
            description: item.description || '',
            stars: item.stargazers_count || 0,
            forks: item.forks_count || 0,
            language: item.language || 'Code',
            updatedAt: item.updated_at,
            url: item.html_url,
            defaultBranch: item.default_branch || 'main'
          }));

        try {
          // Cache in Redis for 10 minutes (600s)
          await redis.set(cacheKey, JSON.stringify(repos), 'EX', 600);
        } catch (e) {}

        return repos;
      }
      return [];
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error(`GitHub user "${cleanUser}" not found.`);
      }
      if (err.response?.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please try again later.');
      }
      throw err;
    }
  }

  async getRepoMetadata(owner, repo, userToken = null) {
    const url = `${this.apiBase}/repos/${owner}/${repo}`;
    const data = await this.cachedRequest(url, userToken, 600);
    return {
      name: data.name,
      owner: data.owner.login,
      defaultBranch: data.default_branch || 'main',
      isPrivate: Boolean(data.private),
      size: data.size, // in KB
      description: data.description || '',
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssues: data.open_issues_count || 0
    };
  }

  async getCommits(owner, repo, userToken = null, limit = 10) {
    const url = `${this.apiBase}/repos/${owner}/${repo}/commits?per_page=${limit}`;
    try {
      const data = await this.cachedRequest(url, userToken, 300);
      if (!Array.isArray(data)) return [];
      return data.map((c) => ({
        sha: c.sha.substring(0, 7),
        fullSha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name || c.author?.login || 'Unknown',
        date: c.commit.author?.date || c.commit.committer?.date,
        url: c.html_url
      }));
    } catch (err) {
      console.warn(`[GitHubService] getCommits failed for ${owner}/${repo}: ${err.message}`);
      return [];
    }
  }

  async getPullRequests(owner, repo, userToken = null) {
    const url = `${this.apiBase}/repos/${owner}/${repo}/pulls?state=all&per_page=10`;
    try {
      const data = await this.cachedRequest(url, userToken, 300);
      if (!Array.isArray(data)) return [];
      return data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'Unknown',
        branch: pr.head?.ref || 'head',
        targetBranch: pr.base?.ref || 'main',
        headSha: pr.head?.sha ? pr.head.sha.substring(0, 7) : 'head',
        fullHeadSha: pr.head?.sha || '',
        createdAt: pr.created_at,
        url: pr.html_url
      }));
    } catch (err) {
      console.warn(`[GitHubService] getPullRequests failed for ${owner}/${repo}: ${err.message}`);
      return [];
    }
  }

  async getCommitDiff(owner, repo, commitSha, userToken = null) {
    const url = `${this.apiBase}/repos/${owner}/${repo}/commits/${commitSha}`;
    const headers = this.getHeaders(userToken);
    headers.Accept = 'application/vnd.github.v3.diff';
    const response = await axios.get(url, { headers });
    return response.data;
  }

  async getPullRequestDiff(owner, repo, prNumber, userToken = null) {
    const url = `${this.apiBase}/repos/${owner}/${repo}/pulls/${prNumber}`;
    const headers = this.getHeaders(userToken);
    headers.Accept = 'application/vnd.github.v3.diff';
    const response = await axios.get(url, { headers });
    return response.data;
  }

  async getFileTree(owner, repo, defaultBranch = 'main', userToken = null) {
    const url = `${this.apiBase}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    try {
      const data = await this.cachedRequest(url, userToken, 600);
      if (!data || !Array.isArray(data.tree)) return [];
      return data.tree
        .filter(item => item.type === 'blob')
        .map(item => item.path);
    } catch (err) {
      console.warn(`[GitHubService] getFileTree failed for ${owner}/${repo}: ${err.message}`);
      return [];
    }
  }
}

module.exports = new GitHubService();
