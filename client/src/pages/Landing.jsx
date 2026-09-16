import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export const Landing = () => {
  const navigate = useNavigate();

  // Input & Resolution state
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [userResult, setUserResult] = useState(null); // { username, repos: [] }

  // Popular repositories state
  const [popularRepos, setPopularRepos] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState('');

  // FAQ accordion state
  const [openFaqs, setOpenFaqs] = useState({ 0: false, 1: false, 2: false, 3: false });

  // Fetch popular repositories on mount
  // Do not add fallback/sample data here under any circumstances — show a real error/empty state instead.
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

  // Handle single input resolution
  const handleResolve = async (e, manualQuery = null) => {
    if (e) e.preventDefault();
    const targetQuery = (manualQuery || query).trim();
    if (!targetQuery) return;

    setResolving(true);
    setResolveError('');
    setUserResult(null);

    try {
      const res = await axios.post('/api/repos/resolve', { query: targetQuery });
      if (res.data.type === 'repo' && res.data.repo?._id) {
        navigate(`/repos/${res.data.repo._id}`);
      } else if (res.data.type === 'user') {
        setUserResult(res.data);
      }
    } catch (err) {
      setResolveError(
        err.response?.data?.message || 'Repository or user not found on GitHub. Please verify the URL or username.'
      );
    } finally {
      setResolving(false);
    }
  };

  const handleSelectUserRepo = async (repoFullName) => {
    setResolving(true);
    setResolveError('');
    try {
      const res = await axios.post('/api/repos/resolve', { query: repoFullName });
      if (res.data.type === 'repo' && res.data.repo?._id) {
        navigate(`/repos/${res.data.repo._id}`);
      }
    } catch (err) {
      setResolveError(
        err.response?.data?.message || 'Unable to open repository. Please try again.'
      );
    } finally {
      setResolving(false);
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
      desc: 'Gemini 3.6 Flash evaluates code health, flaw density, and control flow with strict 35-second execution timeout guardrails.',
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

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#EDEDF0] font-sans antialiased selection:bg-[#2563eb] selection:text-white">
      {/* 1. Header: Logo & Product Name Only */}
      <header className="sticky top-0 z-50 w-full bg-[#0A0A0F]/95 backdrop-blur-md border-b border-[#1E1E2A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <img
              alt="CodeAudit Logo"
              className="w-7 h-7 object-contain"
              src="/favicon.png"
            />
            <span className="font-semibold text-[17px] tracking-tight text-[#EDEDF0]">CodeAudit</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/repos"
              className="text-xs font-medium text-[#888896] hover:text-[#EDEDF0] transition-colors"
            >
              All Repositories
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full">
        {/* 2. Hero Section: Headline, Subheadline, and Single Unified Input */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 border-b border-[#1E1E2A]">
          <div className="flex flex-col gap-6 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#EDEDF0] leading-[1.15]">
              Ask questions about any repository.
            </h1>

            <p className="text-base sm:text-lg text-[#888896] leading-relaxed">
              Paste a public GitHub repository URL or type a username. CodeAudit maps the project structure, inspects code health, and gives you a conversational workspace to explore the codebase.
            </p>

            {/* Single Input Form */}
            <form onSubmit={handleResolve} className="mt-2 flex flex-col sm:flex-row gap-2.5 max-w-2xl">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#888896]">
                  search
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="github.com/owner/repo or username"
                  className="w-full pl-10 pr-4 py-3 rounded bg-[#111118] border border-[#1E1E2A] text-sm text-[#EDEDF0] placeholder-[#555562] focus:outline-none focus:border-[#2563eb] transition-colors font-mono"
                  disabled={resolving}
                />
              </div>
              <button
                type="submit"
                disabled={resolving || !query.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[#2563eb] text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {resolving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Resolving...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {resolveError && (
              <div className="p-3.5 rounded bg-red-500/10 border border-red-500/30 text-xs sm:text-sm text-red-400 max-w-2xl flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                <span>{resolveError}</span>
              </div>
            )}

            {/* Username Repositories Picker (Rendered if username was entered) */}
            {userResult && (
              <div className="p-5 rounded bg-[#111118] border border-[#1E1E2A] max-w-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E1E2A] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#2563eb] text-[20px]">person</span>
                    <span className="text-sm font-semibold text-[#EDEDF0]">
                      Public repositories for @{userResult.username}
                    </span>
                    <span className="text-xs text-[#888896]">
                      ({userResult.repos?.length || 0} found)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserResult(null)}
                    className="text-xs text-[#888896] hover:text-[#EDEDF0]"
                  >
                    Close
                  </button>
                </div>

                {userResult.repos?.length === 0 ? (
                  <p className="text-xs text-[#888896]">No public repositories found for this user.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {userResult.repos.map((repo) => (
                      <div
                        key={repo.fullName}
                        onClick={() => handleSelectUserRepo(repo.fullName)}
                        className="p-3 rounded bg-[#161622] border border-[#1E1E2A] hover:border-[#2563eb]/50 cursor-pointer flex flex-col justify-between gap-2 transition-colors group"
                      >
                        <div>
                          <span className="text-xs font-semibold text-[#EDEDF0] group-hover:text-[#2563eb] transition-colors">
                            {repo.name}
                          </span>
                          <p className="text-[11px] text-[#888896] line-clamp-1 mt-0.5">
                            {repo.description || 'No description provided'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#888896] pt-1 border-t border-[#1E1E2A]/50">
                          <span>{repo.language}</span>
                          <span>★ {repo.stars.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 3. Popular Repositories Section (Real high-star GitHub API data, cached in Redis) */}
        {/* Do not add fallback/sample data here under any circumstances — show a real error/empty state instead. */}
        <section className="max-w-6xl mx-auto px-6 py-14 border-b border-[#1E1E2A]">
          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">
              Popular Repositories
            </h2>
            <p className="text-xs sm:text-sm text-[#888896]">
              Real public repositories from GitHub with active developer communities. Click any repository to open a conversational review.
            </p>
          </div>

          {loadingPopular ? (
            <div className="p-8 rounded bg-[#111118] border border-[#1E1E2A] text-center text-xs text-[#888896]">
              Loading popular repositories from GitHub...
            </div>
          ) : popularError || popularRepos.length === 0 ? (
            <div className="p-8 rounded bg-[#111118] border border-[#1E1E2A] text-center text-xs text-[#888896]">
              Unable to load popular repositories right now
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {popularRepos.map((repo) => (
                <div
                  key={repo.fullName}
                  onClick={() => handleResolve(null, repo.fullName)}
                  className="p-4 rounded bg-[#111118] border border-[#1E1E2A] hover:border-[#2563eb]/50 cursor-pointer flex flex-col justify-between gap-3.5 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        {repo.ownerAvatar && (
                          <img
                            src={repo.ownerAvatar}
                            alt=""
                            className="w-4 h-4 rounded-full"
                          />
                        )}
                        <span className="text-sm font-semibold text-[#EDEDF0] group-hover:text-[#2563eb] truncate transition-colors">
                          {repo.fullName}
                        </span>
                      </div>
                      <span className="text-xs text-[#888896] line-clamp-2 mt-1.5">
                        {repo.description || 'Public GitHub repository'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-[#888896] pt-2 border-t border-[#1E1E2A]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
                      <span>{repo.language}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[#EDEDF0]">
                      <span className="material-symbols-outlined text-[14px] text-amber-400">star</span>
                      <span>{repo.stars.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. How It Works Section (5 Numbered, Clickable Steps linking to /how-it-works/:slug) */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">How It Works</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#888896]">
              A 5-stage pipeline from repository input to interactive conversational review. Click any step to inspect technical details.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelineSteps.map((step) => (
              <Link
                key={step.slug}
                to={`/how-it-works/${step.slug}`}
                className="p-5 rounded bg-[#111118] border border-[#1E1E2A] hover:border-[#2563eb]/50 flex flex-col justify-between gap-4 transition-colors group cursor-pointer"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#2563eb] px-2 py-0.5 rounded bg-[#2563eb]/10 border border-[#2563eb]/30">
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

        {/* 5. Core Features: Trimmed Down */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">Core Capabilities</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#888896]">
              Built strictly for repository interrogation and structural comprehension.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Feature 1: Chat Q&A */}
            <div className="p-5 rounded bg-[#111118] border border-[#1E1E2A] flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[#2563eb]">
                <span className="material-symbols-outlined text-[20px]">chat</span>
                <h3 className="font-semibold text-[#EDEDF0] text-sm sm:text-base">Repository Chat Q&A</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                Query key components, data pathways, and dependencies. Grounded directly against verified repository files to eliminate speculative answers.
              </p>
            </div>

            {/* Feature 2: Structure / Tree */}
            <div className="p-5 rounded bg-[#111118] border border-[#1E1E2A] flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[#2563eb]">
                <span className="material-symbols-outlined text-[20px]">account_tree</span>
                <h3 className="font-semibold text-[#EDEDF0] text-sm sm:text-base">Interactive File Trees</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                Render directory hierarchies directly inside the chat thread. Scope questions to particular files or drill into module boundaries visually.
              </p>
            </div>

            {/* Feature 3: Code Health Score */}
            <div className="p-5 rounded bg-[#111118] border border-[#1E1E2A] flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[#2563eb]">
                <span className="material-symbols-outlined text-[20px]">analytics</span>
                <h3 className="font-semibold text-[#EDEDF0] text-sm sm:text-base">Objective Health Scores</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#888896] leading-relaxed">
                A single 0–100 score synthesized from AST complexity, syntax validations, and execution findings to measure architectural health.
              </p>
            </div>
          </div>
        </section>

        {/* 6. FAQ Section: Clean, Human-Written, Zero Auth/Account references */}
        <section className="max-w-4xl mx-auto px-6 py-16 border-b border-[#1E1E2A]">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#EDEDF0]">Frequently Asked Questions</h2>
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

      {/* 7. Footer: Project Name & License Info Only */}
      <footer className="w-full py-10 px-6 text-center bg-[#0A0A0F]">
        <div className="font-semibold text-base tracking-tight text-[#EDEDF0]">CodeAudit</div>
        <div className="mt-1 font-sans text-xs text-[#888896]">MIT License</div>
      </footer>
    </div>
  );
};
