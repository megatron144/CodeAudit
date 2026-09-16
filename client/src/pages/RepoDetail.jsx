import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { RepoChatbot } from '../components/RepoChatbot';

export const RepoDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchDetail = async () => {
    try {
      const res = await axios.get(`/api/repos/${id}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleTriggerAnalysis = async () => {
    if (!data?.repo) return;
    setAnalyzing(true);
    try {
      await axios.post('/api/analysis/trigger', {
        repoId: id,
        branch: data.repo.defaultBranch || 'main',
      });
      setTimeout(() => {
        fetchDetail();
        setAnalyzing(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest text-on-surface">
        <Header />
        <Sidebar />
        <div className="pl-60 pt-24 text-center text-outline font-body-sm text-xs">
          Loading repository workspace...
        </div>
      </div>
    );
  }

  const { repo } = data || {};

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased flex flex-col">
      <Header />
      <Sidebar />

      <div className="pl-60 pt-14 flex-1 flex flex-col h-[calc(100vh-56px)]">
        {/* Top Context Bar */}
        <div className="h-14 px-6 bg-surface border-b border-outline-variant/30 flex items-center justify-between gap-4 shrink-0 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-body-sm text-xs text-outline shrink-0">
              <Link to="/repos" className="hover:text-on-surface transition-colors">
                Repositories
              </Link>
              <span className="text-outline-variant select-none">›</span>
              <span className="text-on-surface-variant truncate">
                {repo?.owner}
              </span>
            </nav>

            <span className="text-outline-variant select-none">/</span>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-headline-sm text-sm font-semibold text-on-surface truncate">
                {repo?.name}
              </h1>
              <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-code-sm text-[11px] text-primary shrink-0">
                {repo?.defaultBranch || 'main'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {repo?.lastScore !== null && repo?.lastScore !== undefined && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-outline-variant/30 text-xs font-code-sm text-on-surface">
                <span className="text-outline">Health Score:</span>
                <span className="font-semibold text-primary">{repo.lastScore}/100</span>
              </div>
            )}

            <button
              onClick={handleTriggerAnalysis}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 disabled:opacity-50 text-on-surface font-body-sm text-xs rounded transition-colors"
              title="Run AST parser and sandbox verification"
            >
              <span className={`material-symbols-outlined text-[14px] ${analyzing ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{analyzing ? 'Analyzing...' : 'Re-analyze'}</span>
            </button>
          </div>
        </div>

        {/* Primary Interaction Surface: Full-Page Chatbot Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <RepoChatbot
            repoId={repo?._id}
            repoName={repo?.fullName || `${repo?.owner}/${repo?.name}`}
            isFullPage={true}
          />
        </main>
      </div>
    </div>
  );
};

export default RepoDetail;
