import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Language indicator colors for GitHub repos
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Default: '#2563eb'
};

export const Landing = () => {
  const navigate = useNavigate();

  // Primary view state: 'hero' | 'loading' | 'picker'
  const [viewState, setViewState] = useState('hero');

  // Input & search state
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);

  // Loading screen state
  const [loadingTarget, setLoadingTarget] = useState(null); // { type: 'user' | 'repo', raw: '', owner: '', repo: '', username: '' }
  const [loadingAvatar, setLoadingAvatar] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState(null); // { message: string, canRetry: boolean }

  // Repo picker state (for username input)
  const [userData, setUserData] = useState(null); // { username, name, avatar_url, bio, public_repos, html_url }
  const [userRepos, setUserRepos] = useState([]);
  const [repoFilter, setRepoFilter] = useState('');
  const [openingRepo, setOpeningRepo] = useState(null);
  const [pickerError, setPickerError] = useState('');

  // Popular repositories state
  const [popularRepos, setPopularRepos] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState('');

  // FAQ accordion state
  const [openFaqs, setOpenFaqs] = useState({ 0: false, 1: false, 2: false, 3: false });

  // Refs
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const autocompleteCacheRef = useRef({});

  // Fetch popular repositories on mount
  useEffect(() => {
    const fetchPopular = async () => {
      setLoadingPopular(true);
      setPopularError('');
      try {
        const res = await axios.get('/api/repos/popular');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setPopularRepos(res.data);
        } else {
          setPopularRepos([]);
          setPopularError('Unable to load popular repositories right now');
        }
      } catch (e) {
        setPopularRepos([]);
        setPopularError('Unable to load popular repositories right now');
      } finally {
        setLoadingPopular(false);
      }
    };
    fetchPopular();
  }, []);

  // Handle click outside to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live debounced autocomplete query to GitHub User Search API
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveSuggestionIdx(-1);

    const trimmed = val.trim().replace(/^@/, '');

    // Don't show username autocomplete if query is too short or appears to be a repo URL / path
    if (trimmed.length < 2 || trimmed.includes('/') || trimmed.includes('github.com')) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Check client-side memory cache first
    if (autocompleteCacheRef.current[trimmed]) {
      const cached = autocompleteCacheRef.current[trimmed];
      setSuggestions(cached);
      setShowSuggestions(cached.length > 0);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await axios.get(`/api/repos/search-users?q=${encodeURIComponent(trimmed)}`);
        if (Array.isArray(res.data)) {
          autocompleteCacheRef.current[trimmed] = res.data;
          setSuggestions(res.data);
          setShowSuggestions(res.data.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (err) {
        // Silently fail if rate-limited or offline
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);
  };

  // Keyboard navigation inside autocomplete suggestions
  const handleInputKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
      if (e.key === 'Enter' && activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
        e.preventDefault();
        const selected = suggestions[activeSuggestionIdx];
        setQuery(selected.login);
        setShowSuggestions(false);
        executeResolution(selected.login);
        return;
      }
    }
  };

  // Clicking a suggestion fills input and closes dropdown
  const handleSelectSuggestion = (login) => {
    setQuery(login);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Trigger resolution when user presses Enter
  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setShowSuggestions(false);
    executeResolution(query.trim());
  };

  // Parse input into username vs repo URL and execute resolution flow
  const executeResolution = async (rawInput) => {
    const clean = rawInput.trim();
    if (!clean) return;

    const trimmed = clean.replace(/^@/, '');
    const isRepo = trimmed.includes('/') || trimmed.includes('github.com');

    setLoadingError(null);
    setViewState('loading');

    if (isRepo) {
      // Parse owner and repo name
      let owner = '';
      let repo = '';
      const urlMatch = trimmed.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
      if (urlMatch) {
        owner = urlMatch[1];
        repo = urlMatch[2].replace(/\.git$/, '');
      } else {
        const parts = trimmed.split('/');
        owner = parts[0];
        repo = parts[1]?.replace(/\.git$/, '') || '';
      }

      const targetInfo = {
        type: 'repo',
        raw: clean,
        owner,
        repo,
        fullName: `${owner}/${repo}`
      };
      setLoadingTarget(targetInfo);
      setLoadingAvatar(`https://github.com/${owner}.png`);
      setLoadingMessage(`Mapping the codebase for ${owner}/${repo}...`);

      // Fetch owner avatar via backend cached endpoint
      axios
        .get(`/api/repos/user-profile/${encodeURIComponent(owner)}`)
        .then((res) => {
          if (res.data?.avatar_url) setLoadingAvatar(res.data.avatar_url);
        })
        .catch(() => {});

      // Resolve repository directly on backend
      try {
        const res = await axios.post('/api/repos/resolve', { query: clean });
        if (res.data.type === 'repo' && res.data.repo?._id) {
          navigate(`/repos/${res.data.repo._id}`);
        } else {
          throw new Error('Could not open repository.');
        }
      } catch (err) {
        const status = err.response?.status;
        let errMsg = err.response?.data?.message || err.message;
        if (status === 404) {
          errMsg = `Repository "${owner}/${repo}" was not found on GitHub. Verify that it is public and spelled correctly.`;
        } else if (status === 403) {
          errMsg = 'GitHub API rate limit reached or access restricted. Please try again in a few moments.';
        }
        setLoadingError({
          message: errMsg,
          canRetry: true
        });
      }
    } else {
      // Bare username input
      const targetInfo = {
        type: 'user',
        raw: clean,
        username: trimmed
      };
      setLoadingTarget(targetInfo);
      setLoadingAvatar(`https://github.com/${trimmed}.png`);
      setLoadingMessage(`Fetching @${trimmed}'s repositories...`);

      try {
        // Step 1: Fetch user details via backend cached endpoint
        let userProfile = null;
        try {
          const userRes = await axios.get(
            `/api/repos/user-profile/${encodeURIComponent(trimmed)}`
          );
          userProfile = userRes.data;
          if (userProfile?.avatar_url) {
            setLoadingAvatar(userProfile.avatar_url);
          }
        } catch (uErr) {
          if (uErr.response?.status === 404) {
            throw new Error(`GitHub user "${trimmed}" does not exist.`);
          }
        }

        // Step 2: Fetch public repositories via backend resolve
        const backendRes = await axios.post('/api/repos/resolve', { query: trimmed });
        let reposList = [];
        if (backendRes.data.type === 'user' && Array.isArray(backendRes.data.repos)) {
          reposList = backendRes.data.repos;
        } else {
          throw new Error(`Could not load public repositories for @${trimmed}.`);
        }

        setUserData({
          username: trimmed,
          name: userProfile?.name || trimmed,
          avatar_url: userProfile?.avatar_url || `https://github.com/${trimmed}.png`,
          bio: userProfile?.bio || '',
          public_repos: userProfile?.public_repos || reposList.length,
          html_url: userProfile?.html_url || `https://github.com/${trimmed}`
        });
        setUserRepos(reposList);
        setViewState('picker');
      } catch (err) {
        const status = err.response?.status;
        let errMsg = err.response?.data?.message || err.message;
        if (status === 404 || errMsg.includes('does not exist') || errMsg.includes('not found')) {
          errMsg = `GitHub user "@${trimmed}" was not found. Please verify the username.`;
        } else if (status === 403 || errMsg.includes('rate limit')) {
          errMsg = 'GitHub API rate limit reached. Please wait a few moments before trying again.';
        }
        setLoadingError({
          message: errMsg,
          canRetry: true
        });
      }
    }
  };

  // When a user selects a repository from the username repo picker
  const handleSelectUserRepo = async (repoFullName) => {
    setOpeningRepo(repoFullName);
    setPickerError('');
    try {
      const res = await axios.post('/api/repos/resolve', { query: repoFullName });
      if (res.data.type === 'repo' && res.data.repo?._id) {
        navigate(`/repos/${res.data.repo._id}`);
      } else {
        throw new Error('Could not open repository.');
      }
    } catch (err) {
      setPickerError(
        err.response?.data?.message || 'Unable to open repository. Please try again.'
      );
      setOpeningRepo(null);
    }
  };

  const toggleFaq = (idx) => {
    setOpenFaqs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const faqs = [
    {
      q: 'Do I need an account to analyze a repository?',
      a: 'No. CodeAudit is completely stateless and account-free. Simply enter any public GitHub repository URL or developer username to launch an interactive session immediately.'
    },
    {
      q: 'How does CodeAudit access repository code?',
      a: 'CodeAudit streams the repository file tree and requested blobs directly from the public GitHub API into memory. Your code is never written or cloned to persistent host disk.'
    },
    {
      q: 'Is untrusted code executed safely?',
      a: 'All analysis and test executions run exclusively within ephemeral, strictly non-networked micro-sandboxes (--network=none) with 512MB RAM caps and hard 30-second execution timeouts.'
    },
    {
      q: 'Can the assistant answer structural questions about the codebase?',
      a: 'Yes. The assistant inspects real repository file trees and AST analysis reports. You can query project entrypoints, request interactive visual file hierarchies, and drill down into specific files.'
    }
  ];

  const pipelineSteps = [
    {
      step: '01',
      slug: 'repository-provisioning',
      title: 'You provide a repository',
      desc: 'Enter any public GitHub URL or username. CodeAudit validates the repository against the live GitHub API without requiring sign-in or tokens.',
      icon: 'link'
    },
    {
      step: '02',
      slug: 'code-and-structure-fetching',
      title: "The repo's code and structure are fetched",
      desc: 'Git trees and file hierarchies are extracted directly into an in-memory index with zero disk-cloning overhead.',
      icon: 'account_tree'
    },
    {
      step: '03',
      slug: 'sandbox-execution',
      title: 'Code runs in an isolated sandbox',
      desc: 'Telemetry and syntax checks execute within ephemeral non-networked Docker micro-containers locked to 512MB RAM.',
      icon: 'terminal'
    },
    {
      step: '04',
      slug: 'ai-static-analysis',
      title: 'Results are analyzed by an AI model',
      desc: 'Gemini 3.6 Flash evaluates flaw density, deterministic invariants, and control flow with strict 35-second execution timeout guardrails.',
      icon: 'psychology'
    },
    {
      step: '05',
      slug: 'conversational-review',
      title: 'You can ask questions about the repo through chat',
      desc: 'Ask questions, explore interactive visual file trees, and investigate architecture in a focused conversational workspace.',
      icon: 'chat'
    }
  ];

  // Filtered repositories inside the repo picker
  const filteredUserRepos = userRepos.filter((r) => {
    const q = repoFilter.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.language?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#EDEDF0] font-sans antialiased selection:bg-[#2563eb] selection:text-white">
      {/* 1. Header */}
      <header className="sticky top-0 z-50 w-full bg-[#0A0A0F]/95 backdrop-blur-md border-b border-[#1E1E2A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            onClick={() => {
              setViewState('hero');
              setQuery('');
            }}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <img alt="CodeAudit Logo" className="w-7 h-7 object-contain" src="/favicon.png" />
            <span className="font-semibold text-[17px] tracking-tight text-[#EDEDF0]">
              CodeAudit
            </span>
          </Link>
        </div>
      </header>

      {/* VIEW STATE 1: GITHUB-FETCH LOADING SCREEN */}
      {viewState === 'loading' && (
        <main className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="max-w-md w-full mx-auto flex flex-col items-center gap-6 p-8 rounded-2xl bg-[#111118] border border-[#1E1E2A] shadow-2xl relative">
            {/* User Avatar with Glowing Indicator */}
            <div className="relative">
              <div
                className={`w-24 h-24 rounded-full p-1 border-2 ${
                  loadingError
                    ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'border-[#2563eb] shadow-[0_0_24px_rgba(37,99,235,0.35)] animate-pulse'
                }`}
              >
                {loadingAvatar ? (
                  <img
                    src={loadingAvatar}
                    alt="GitHub Avatar"
                    className="w-full h-full rounded-full object-cover bg-[#161622]"
                    onError={(e) => {
                      e.target.src = '/favicon.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#161622] flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-4xl">person</span>
                  </div>
                )}
              </div>

              {!loadingError && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#0A0A0F] border-2 border-[#2563eb] flex items-center justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Status Message or Error */}
            {loadingError ? (
              <div className="flex flex-col gap-3 w-full">
                <div className="inline-flex items-center justify-center gap-1.5 text-red-400 text-sm font-semibold">
                  <span className="material-symbols-outlined text-[20px]">error</span>
                  <span>Unable to resolve</span>
                </div>
                <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                  {loadingError.message}
                </p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => executeResolution(loadingTarget?.raw || query)}
                    className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-semibold hover:bg-blue-600 transition-colors inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Try again</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('hero');
                      setLoadingError(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#161622] border border-[#1E1E2A] text-xs font-medium text-[#EDEDF0] hover:bg-[#1E1E2A] transition-colors"
                  >
                    ← Back to search
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <h2 className="text-lg sm:text-xl font-semibold text-[#EDEDF0]">
                  {loadingMessage}
                </h2>
                <p className="text-xs text-[#888896]">
                  Communicating with GitHub API & configuring workspace...
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('hero');
                    }}
                    className="text-xs text-[#888896] hover:text-[#EDEDF0] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* VIEW STATE 2: REPO PICKER FOR USERNAME INPUT */}
      {viewState === 'picker' && userData && (
        <main className="max-w-6xl mx-auto px-6 py-10 animate-fadeIn">
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between pb-6 border-b border-[#1E1E2A] mb-8">
            <button
              type="button"
              onClick={() => {
                setViewState('hero');
                setRepoFilter('');
              }}
              className="inline-flex items-center gap-2 text-xs font-medium text-[#888896] hover:text-[#EDEDF0] px-3 py-1.5 rounded-lg bg-[#111118] border border-[#1E1E2A] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to search</span>
            </button>

            <span className="text-xs text-[#888896]">
              {userRepos.length} public {userRepos.length === 1 ? 'repository' : 'repositories'} found
            </span>
          </div>

          {/* User Profile Header Card */}
          <div className="p-6 rounded-2xl bg-[#111118] border border-[#1E1E2A] mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={userData.avatar_url}
                alt={userData.username}
                className="w-16 h-16 rounded-full border-2 border-[#2563eb]/40 object-cover bg-[#161622]"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[#EDEDF0]">{userData.name}</h1>
                  <span className="text-sm text-[#888896]">@{userData.username}</span>
                </div>
                {userData.bio && (
                  <p className="text-xs sm:text-sm text-[#888896] max-w-xl">{userData.bio}</p>
                )}
              </div>
            </div>

            <a
              href={userData.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#161622] border border-[#1E1E2A] text-xs font-medium text-[#EDEDF0] hover:border-[#2563eb]/50 transition-colors shrink-0"
            >
              <span>GitHub Profile</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>

          {/* Search Filter Input within Picker */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#888896]">
                search
              </span>
              <input
                type="text"
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                placeholder="Filter repositories by name or language..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#111118] border border-[#1E1E2A] text-xs sm:text-sm text-[#EDEDF0] placeholder-[#555562] focus:outline-none focus:border-[#2563eb] transition-colors"
              />
            </div>
            {repoFilter && (
              <span className="text-xs text-[#888896]">
                Showing {filteredUserRepos.length} of {userRepos.length}
              </span>
            )}
          </div>

          {/* Error inside picker if opening a repo failed */}
          {pickerError && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{pickerError}</span>
            </div>
          )}

          {/* Repositories Grid */}
          {filteredUserRepos.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#111118] border border-[#1E1E2A] text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-[#5F5F70]">folder_off</span>
              <p className="text-sm font-semibold text-[#EDEDF0]">No repositories found</p>
              <p className="text-xs text-[#888896]">
                {repoFilter
                  ? 'No repositories match your filter.'
                  : 'This user does not have any public repositories.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUserRepos.map((repo) => {
                const isOpening = openingRepo === repo.fullName;
                const langColor = LANGUAGE_COLORS[repo.language] || LANGUAGE_COLORS.Default;

                return (
                  <div
                    key={repo.fullName}
                    onClick={() => !isOpening && handleSelectUserRepo(repo.fullName)}
                    className="p-5 rounded-xl bg-[#111118] border border-[#1E1E2A] hover:border-[#2563eb]/60 cursor-pointer flex flex-col justify-between gap-4 transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.12)] group relative"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#EDEDF0] group-hover:text-[#2563eb] transition-colors break-words">
                          {repo.name}
                        </h3>
                        {isOpening && (
                          <span className="w-4 h-4 border-2 border-[#2563eb]/30 border-t-[#2563eb] rounded-full animate-spin shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#888896] line-clamp-2 leading-relaxed">
                        {repo.description || 'No description provided'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#888896] pt-3 border-t border-[#1E1E2A]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: langColor }}
                        />
                        <span className="truncate max-w-[90px]">{repo.language}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[#EDEDF0]">
                          <span className="material-symbols-outlined text-[14px] text-amber-400">
                            star
                          </span>
                          <span>{repo.stars?.toLocaleString() || 0}</span>
                        </span>
                        {repo.forks > 0 && (
                          <span className="flex items-center gap-0.5 text-[#888896]">
                            <span className="material-symbols-outlined text-[13px]">
                              fork_right
                            </span>
                            <span>{repo.forks}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* VIEW STATE 3: HERO & MAIN LANDING PAGE */}
      {viewState === 'hero' && (
        <main className="w-full">
          {/* 2. Hero Section: Centered Vertically & Horizontally, Single Enter-Only Input, Live Autocomplete */}
          <section className="max-w-6xl mx-auto px-6 py-24 sm:py-32 flex flex-col items-center justify-center text-center border-b border-[#1E1E2A]">
            <div className="flex flex-col items-center justify-center text-center gap-6 max-w-3xl mx-auto w-full">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#EDEDF0] leading-[1.12]">
                Ask questions about any repository.
              </h1>

              <p className="text-base sm:text-lg text-[#888896] leading-relaxed max-w-2xl mx-auto">
                Paste a public GitHub repository URL or type a username. CodeAudit maps the project
                structure, inspects codebase findings, and gives you a conversational workspace to explore the
                codebase.
              </p>

              {/* Single Input Form - No Analyze Button, Enter to submit, Autocomplete below */}
              <div className="w-full max-w-xl mx-auto relative mt-4" ref={suggestionsRef}>
                <form onSubmit={handleFormSubmit} className="relative w-full">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#888896] pointer-events-none">
                    search
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="github.com/owner/repo or username"
                    className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-[#111118] border border-[#1E1E2A] text-sm sm:text-base text-[#EDEDF0] placeholder-[#555562] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all shadow-lg"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {loadingSuggestions && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none select-none">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </form>

                {/* Live Autocomplete Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#111118] border border-[#1E1E2A] rounded-xl shadow-2xl overflow-hidden divide-y divide-[#1E1E2A]/60 backdrop-blur-md text-left animate-fadeIn">
                    <div className="px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-[#5F5F70] bg-[#0E0E14]">
                      GitHub Users
                    </div>
                    {suggestions.map((user, idx) => {
                      const isActive = idx === activeSuggestionIdx;
                      return (
                        <div
                          key={user.login}
                          onClick={() => handleSelectSuggestion(user.login)}
                          className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#2563eb]/15 text-[#EDEDF0]'
                              : 'hover:bg-[#161622] text-[#EDEDF0]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={user.avatar_url}
                              alt={user.login}
                              className="w-6 h-6 rounded-full object-cover bg-[#161622] border border-[#1E1E2A]"
                            />
                            <span className="text-sm font-medium truncate">
                              {user.login}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#5F5F70] shrink-0">
                            User
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. Popular Repositories Section */}
          <section className="max-w-6xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
            <div className="flex flex-col gap-1 mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">
                Popular Repositories
              </h2>
              <p className="text-xs sm:text-sm text-[#888896]">
                Real public repositories from GitHub with active developer communities. Click any
                repository to open a conversational review.
              </p>
            </div>

            {loadingPopular ? (
              <div className="p-8 rounded-xl bg-[#111118] border border-[#1E1E2A] text-center text-xs text-[#888896]">
                Loading popular repositories from GitHub...
              </div>
            ) : popularError || popularRepos.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#111118] border border-[#1E1E2A] text-center text-xs text-[#888896]">
                Unable to load popular repositories right now
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {popularRepos.map((repo) => (
                  <div
                    key={repo.fullName}
                    onClick={() => executeResolution(repo.fullName)}
                    className="p-5 rounded-xl bg-[#111118] border border-[#1E1E2A] hover:border-[#2563eb]/50 cursor-pointer flex flex-col justify-between gap-4 transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.1)] group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          {repo.ownerAvatar && (
                            <img
                              src={repo.ownerAvatar}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          )}
                          <span className="text-sm font-semibold text-[#EDEDF0] group-hover:text-[#2563eb] truncate transition-colors">
                            {repo.fullName}
                          </span>
                        </div>
                        <span className="text-xs text-[#888896] line-clamp-2 mt-2 leading-relaxed">
                          {repo.description || 'Public GitHub repository'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#888896] pt-3 border-t border-[#1E1E2A]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
                        <span>{repo.language}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[#EDEDF0]">
                        <span className="material-symbols-outlined text-[14px] text-amber-400">
                          star
                        </span>
                        <span>{repo.stars?.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. How It Works Section with Restyled Badge / Pill Treatment */}
          <section className="max-w-6xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">How It Works</h2>
              <p className="mt-1 text-xs sm:text-sm text-[#888896]">
                A 5-stage pipeline from repository input to interactive conversational review. Click any
                step to inspect technical details.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pipelineSteps.map((step) => (
                <Link
                  key={step.slug}
                  to={`/how-it-works/${step.slug}`}
                  className="p-5 rounded-xl bg-[#111118] border border-[#1E1E2A] hover:border-[#2563eb]/50 flex flex-col justify-between gap-4 transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.1)] group cursor-pointer"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      {/* Target Pill Badge Treatment */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B1220] border border-[#2563eb]/50 shadow-[0_0_12px_rgba(37,99,235,0.15)] text-xs font-semibold text-blue-400 tracking-wider">
                        Step {step.step}
                      </span>
                      <span className="material-symbols-outlined text-[#5F5F70] group-hover:text-[#2563eb] text-[20px] transition-colors">
                        {step.icon}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-[#EDEDF0] group-hover:text-[#2563eb] transition-colors">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm text-[#888896] leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-[#2563eb] font-medium pt-2 border-t border-[#1E1E2A]">
                    <span>Inspect pipeline step</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 5. Core Features */}
          <section className="max-w-6xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">Core Capabilities</h2>
              <p className="mt-1 text-xs sm:text-sm text-[#888896]">
                Built strictly for repository interrogation and structural comprehension.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#111118] border border-[#1E1E2A] flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[#2563eb]">
                  <span className="material-symbols-outlined text-[20px]">chat</span>
                  <h3 className="font-semibold text-[#EDEDF0] text-sm sm:text-base">
                    Repository Chat Q&A
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                  Query key components, data pathways, and dependencies. Grounded directly against
                  verified repository files to eliminate speculative answers.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#111118] border border-[#1E1E2A] flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[#2563eb]">
                  <span className="material-symbols-outlined text-[20px]">account_tree</span>
                  <h3 className="font-semibold text-[#EDEDF0] text-sm sm:text-base">
                    Interactive File Trees
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                  Render directory hierarchies directly inside the chat thread. Scope questions to
                  particular files or drill into module boundaries visually.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-[#111118] border border-[#1E1E2A] flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[#2563eb]">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <h3 className="font-semibold text-[#EDEDF0] text-sm sm:text-base">
                    Deterministic Verification
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                  AST static evaluation and isolated container execution identify vulnerabilities,
                  regressions, and architectural anomalies with zero hallucination.
                </p>
              </div>
            </div>
          </section>

          {/* 6. FAQ Section */}
          <section className="max-w-4xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="divide-y divide-[#1E1E2A] border-y border-[#1E1E2A]">
              {faqs.map((faq, idx) => (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between text-left text-sm sm:text-base font-medium text-[#EDEDF0] hover:text-[#2563eb] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="material-symbols-outlined text-[18px] text-[#888896]">
                      {openFaqs[idx] ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {openFaqs[idx] && (
                    <div className="mt-2 text-xs sm:text-sm text-[#888896] leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* 7. Footer */}
      <footer className="w-full py-10 px-6 text-center bg-[#0A0A0F]">
        <div className="font-semibold text-base tracking-tight text-[#EDEDF0]">CodeAudit</div>
        <div className="mt-1 font-sans text-xs text-[#888896]">MIT License</div>
      </footer>
    </div>
  );
};

export default Landing;
