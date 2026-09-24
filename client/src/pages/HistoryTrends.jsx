import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';

export const HistoryTrends = () => {
  const { repoId: routeRepoId } = useParams();
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(routeRepoId || null);
  const [historyData, setHistoryData] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load repositories list
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await axios.get('/api/repos');
        const repoList = Array.isArray(res.data) ? res.data : [];
        setRepos(repoList);
        if (!selectedRepoId && repoList.length > 0) {
          setSelectedRepoId(repoList[0]._id);
        }
      } catch (err) {
        console.error('Failed to load repositories', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRepos();
  }, []);

  // Fetch history & past analyses for selected repo
  useEffect(() => {
    if (!selectedRepoId) return;

    const fetchRepoHistory = async () => {
      setLoadingHistory(true);
      try {
        const [histRes, analRes] = await Promise.all([
          axios.get(`/api/repos/${selectedRepoId}/history`),
          axios.get(`/api/repos/${selectedRepoId}/analyses`)
        ]);
        setHistoryData(histRes.data);
        setAnalyses(Array.isArray(analRes.data) ? analRes.data : []);
      } catch (err) {
        console.error('Failed to load history metrics', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchRepoHistory();
  }, [selectedRepoId]);

  const selectedRepo = repos.find(r => r._id === selectedRepoId);
  const metrics = historyData?.metrics || {
    totalAnalyses: analyses.length,
    passRate: 100,
    currentScore: selectedRepo?.lastScore ?? null,
    issueDistribution: { critical: 0, warning: 0, notices: 0 }
  };
  const historyRuns = historyData?.history || [];

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased flex flex-col">
      <Header />

      <main className="flex-1 pt-14 px-6 max-w-6xl w-full mx-auto py-8 space-y-6">
        {/* Page Title & Repo Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-5">
          <div>
            <h1 className="font-headline-lg text-2xl font-bold text-on-surface tracking-tight">
              Audit History & Health Trends
            </h1>
            <p className="font-body-sm text-xs text-outline mt-1">
              Historical regression tracking, gate pass rates, and security issue distribution over time.
            </p>
          </div>

          {/* Repo Selector Dropdown */}
          {repos.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="repo-select" className="font-label-sm text-xs text-outline whitespace-nowrap">
                Repository:
              </label>
              <select
                id="repo-select"
                value={selectedRepoId || ''}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="bg-surface-container border border-outline-variant/40 rounded px-3 py-1.5 font-code-sm text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                {repos.map(r => (
                  <option key={r._id} value={r._id}>
                    {r.fullName || `${r.owner}/${r.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-outline text-xs">
            Loading repository audit trends...
          </div>
        ) : repos.length === 0 ? (
          <div className="py-16 text-center bg-surface-container-low border border-outline-variant/30 rounded p-8">
            <p className="text-on-surface font-medium text-sm">No audited repositories yet.</p>
            <p className="text-outline text-xs mt-1">Link a repository to track security trends and code health over time.</p>
            <Link
              to="/repos"
              className="mt-4 inline-block px-4 py-2 bg-primary text-on-primary font-medium text-xs rounded hover:opacity-90 transition-opacity"
            >
              Add a Repository
            </Link>
          </div>
        ) : (
          <>
            {/* Top Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Current Health Score */}
              <div className="p-4 bg-surface-container border border-outline-variant/30 rounded flex flex-col justify-between">
                <span className="font-label-sm text-xs text-outline">Current Code Health</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-headline-lg text-2xl font-bold text-primary">
                    {metrics.currentScore !== null && metrics.currentScore !== undefined ? `${metrics.currentScore}/100` : 'Pending'}
                  </span>
                  {metrics.currentScore >= 80 && (
                    <span className="text-[11px] text-primary-fixed-dim">Clean Invariants</span>
                  )}
                </div>
                <span className="text-[11px] text-outline mt-1">Based on latest evaluated commit</span>
              </div>

              {/* Invariant Pass Rate */}
              <div className="p-4 bg-surface-container border border-outline-variant/30 rounded flex flex-col justify-between">
                <span className="font-label-sm text-xs text-outline">Sandbox Pass Rate</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-headline-lg text-2xl font-bold text-on-surface">
                    {metrics.passRate}%
                  </span>
                  <span className="text-[11px] text-outline">exit 0</span>
                </div>
                <div className="w-full bg-surface-container-high h-1.5 rounded overflow-hidden mt-2">
                  <div className="bg-primary h-full transition-all" style={{ width: `${metrics.passRate}%` }}></div>
                </div>
              </div>

              {/* Total Audits */}
              <div className="p-4 bg-surface-container border border-outline-variant/30 rounded flex flex-col justify-between">
                <span className="font-label-sm text-xs text-outline">Evaluated Runs</span>
                <div className="mt-2">
                  <span className="font-headline-lg text-2xl font-bold text-on-surface">
                    {metrics.totalAnalyses}
                  </span>
                </div>
                <span className="text-[11px] text-outline mt-1">Automated BullMQ pipeline executions</span>
              </div>

              {/* Issue Distribution */}
              <div className="p-4 bg-surface-container border border-outline-variant/30 rounded flex flex-col justify-between">
                <span className="font-label-sm text-xs text-outline">Issue Distribution</span>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center font-code-sm text-xs">
                  <div className="p-1 bg-surface-container-low rounded border border-outline-variant/20">
                    <span className="text-tertiary font-bold">{metrics.issueDistribution?.critical || 0}</span>
                    <span className="block text-[9px] text-outline">Crit</span>
                  </div>
                  <div className="p-1 bg-surface-container-low rounded border border-outline-variant/20">
                    <span className="text-on-surface font-bold">{metrics.issueDistribution?.warning || 0}</span>
                    <span className="block text-[9px] text-outline">Warn</span>
                  </div>
                  <div className="p-1 bg-surface-container-low rounded border border-outline-variant/20">
                    <span className="text-outline font-bold">{metrics.issueDistribution?.notices || 0}</span>
                    <span className="block text-[9px] text-outline">Note</span>
                  </div>
                </div>
                <span className="text-[11px] text-outline mt-1">Total open/evaluated findings</span>
              </div>
            </div>

            {/* Historical Audit Execution Table */}
            <div className="bg-surface-container border border-outline-variant/30 rounded overflow-hidden">
              <div className="px-5 py-3.5 border-b border-outline-variant/30 flex items-center justify-between">
                <h2 className="font-headline-sm text-sm font-semibold text-on-surface">
                  Historical Audit Runs ({analyses.length})
                </h2>
                <Link
                  to={`/repos/${selectedRepoId}`}
                  className="font-body-sm text-xs text-primary hover:underline"
                >
                  Open Chatbot Workspace →
                </Link>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-outline text-xs">Loading audit records...</div>
              ) : analyses.length === 0 ? (
                <div className="p-8 text-center text-outline text-xs">
                  No audits recorded for this repository yet. Run an analysis from the repository page.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-body-sm text-xs">
                    <thead className="bg-surface-container-low text-outline border-b border-outline-variant/20">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Commit</th>
                        <th className="px-4 py-2.5 font-medium">Branch</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Health Score</th>
                        <th className="px-4 py-2.5 font-medium">Findings</th>
                        <th className="px-4 py-2.5 font-medium">Timestamp</th>
                        <th className="px-4 py-2.5 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {analyses.map((a) => (
                        <tr key={a._id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="px-4 py-3 font-code-sm text-on-surface font-semibold">
                            {a.commitHash || 'HEAD'}
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant font-code-sm">
                            {a.branch || 'main'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              a.status === 'completed'
                                ? 'bg-primary/10 text-primary border border-primary/30'
                                : a.status === 'failed'
                                ? 'bg-tertiary/10 text-tertiary border border-tertiary/30'
                                : 'bg-surface-container-high text-outline'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {a.score !== null && a.score !== undefined ? (
                              <span className={a.score >= 80 ? 'text-primary' : 'text-tertiary'}>
                                {a.score}/100
                              </span>
                            ) : (
                              <span className="text-outline">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-outline">
                            {(a.findings || []).length} {a.findings?.length === 1 ? 'finding' : 'findings'}
                          </td>
                          <td className="px-4 py-3 text-outline whitespace-nowrap">
                            {new Date(a.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/analysis/${a._id}`}
                              className="px-2.5 py-1 bg-surface-container-high hover:bg-primary hover:text-on-primary rounded text-xs transition-colors"
                            >
                              Inspect
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default HistoryTrends;
