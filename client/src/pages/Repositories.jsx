import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';

export const Repositories = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [analyzingId, setAnalyzingId] = useState(null);

  const navigate = useNavigate();

  const fetchRepos = async () => {
    try {
      const res = await axios.get('/api/repos');
      if (res.data && Array.isArray(res.data)) {
        setRepos(res.data.map((r) => ({
          _id: r._id,
          owner: r.owner,
          name: r.name,
          fullName: r.fullName || `${r.owner}/${r.name}`,
          branch: r.defaultBranch || 'main',
          lastAnalyzed: r.lastAnalyzedAt ? new Date(r.lastAnalyzedAt).toLocaleDateString() : 'Not analyzed',
          commitsAudited: r.totalAnalyses ? `${r.totalAnalyses} audits` : '0 audits',
          score: r.lastScore !== null && r.lastScore !== undefined ? r.lastScore : null,
          status: r.lastScore !== null && r.lastScore !== undefined 
            ? (r.lastScore >= 80 ? 'Passing' : 'Review required') 
            : 'Pending audit',
          isPassing: r.lastScore !== null && r.lastScore !== undefined ? r.lastScore >= 80 : null,
        })));
      } else {
        setRepos([]);
      }
    } catch (err) {
      console.error(err);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleLinkRepo = async (e) => {
    e.preventDefault();
    setAddError('');
    try {
      const res = await axios.post('/api/repos/link', { repoUrl: newRepoUrl });
      setShowAddModal(false);
      const linkedRepo = res.data;
      setNewRepoUrl('');
      // Trigger initial background analysis so AST & health score are available to the chat
      if (linkedRepo?._id) {
        axios.post('/api/analysis/trigger', {
          repoId: linkedRepo._id,
          branch: linkedRepo.defaultBranch || 'main',
        }).catch(() => {});
        navigate(`/repos/${linkedRepo._id}`);
      } else {
        fetchRepos();
      }
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to link repository');
    }
  };

  const handleTriggerAnalysis = async (repo) => {
    setAnalyzingId(repo._id);
    try {
      const res = await axios.post('/api/analysis/trigger', {
        repoId: repo._id,
        commitHash: repo.lastAnalyzedCommit || null,
        branch: repo.branch || 'main',
      });
      navigate(`/analysis/${res.data.analysisId}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to trigger audit');
    } finally {
      setAnalyzingId(null);
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-surface-container-lowest font-body-md text-on-surface antialiased min-h-screen">
      <Header />
      <Sidebar />

      <div className="pl-60">
        <main className="w-full min-h-screen pt-14 bg-surface-container-lowest">
          <div className="flex flex-col w-full">
            {/* Header Bar */}
            <section className="w-full bg-surface-container-lowest border-b border-outline-variant/30 px-6 py-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                      Repositories
                    </h1>
                    {repos.length > 0 && (
                      <span className="font-label-sm text-xs px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant/40">
                        {repos.length} {repos.length === 1 ? 'repository' : 'repositories'}
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Tracked public repositories available for code intelligence and audit.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-secondary-container transition-none font-body-sm text-xs font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add repository</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Filter Toolbar */}
            <section className="w-full bg-surface-container-lowest border-b border-outline-variant/30 px-6 py-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined text-[16px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter repositories..."
                    className="w-full h-8 pl-9 pr-3 rounded bg-surface border border-outline-variant/30 text-on-surface font-body-sm text-xs placeholder:text-outline focus:outline-none focus:border-primary-container"
                  />
                </div>
                {filteredRepos.length > 0 && (
                  <span className="font-body-sm text-xs text-outline shrink-0">
                    {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}
                  </span>
                )}
              </div>
            </section>

            {/* Repositories Table or Clean Empty State */}
            <div className="p-6 flex flex-col gap-6">
              {loading ? (
                <div className="rounded border border-outline-variant/30 bg-surface-container-lowest p-8 text-center text-outline font-body-sm text-xs">
                  Loading repositories...
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="rounded border border-outline-variant/30 bg-surface-container-lowest p-12 flex flex-col items-center justify-center text-center" id="empty-state-container">
                  <div className="w-12 h-12 rounded bg-surface-container flex items-center justify-center border border-outline-variant/30 mb-4 text-outline">
                    <span className="material-symbols-outlined text-[24px]">source</span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface mb-1">
                    No repositories added yet.
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mb-5">
                    Add a public GitHub repository to start evaluating pull requests, commit diffs, and code health scores.
                  </p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-secondary-container transition-none font-body-sm text-xs font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Add public repository</span>
                  </button>
                </div>
              ) : (
                <div className="rounded border border-outline-variant/30 bg-surface-container-low overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="h-9 bg-surface-container-lowest border-b border-outline-variant/30">
                          <th className="px-4 font-body-sm text-xs text-outline font-medium">
                            Repository
                          </th>
                          <th className="px-4 font-body-sm text-xs text-outline font-medium">
                            Last analyzed
                          </th>
                          <th className="px-4 font-body-sm text-xs text-outline font-medium">
                            Commits audited
                          </th>
                          <th className="px-4 font-body-sm text-xs text-outline font-medium">
                            Code health score
                          </th>
                          <th className="px-4 font-body-sm text-xs text-outline font-medium">
                            Status
                          </th>
                          <th className="px-4 font-body-sm text-xs text-outline font-medium text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 font-body-sm text-xs">
                        {filteredRepos.map((r) => (
                          <tr
                            key={r._id}
                            className="h-12 bg-surface hover:bg-surface-container transition-none group"
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[16px] text-outline">
                                  code
                                </span>
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/repos/${r._id}`}
                                    className="font-headline-sm text-headline-sm text-on-surface hover:text-primary transition-none"
                                  >
                                    {r.name}
                                  </Link>
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant/30 text-on-surface-variant font-code-sm text-[11px]">
                                    {r.branch}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-on-surface-variant font-body-sm text-xs">
                              {r.lastAnalyzed}
                            </td>
                            <td className="px-4 py-2 text-on-surface font-body-sm text-xs">
                              {r.commitsAudited}
                            </td>
                            <td className="px-4 py-2">
                              {r.score !== null ? (
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-high border border-primary-container text-primary font-code-sm text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                                  <span>{r.score}/100</span>
                                </div>
                              ) : (
                                <span className="text-outline font-body-sm text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {r.isPassing !== null ? (
                                <div
                                  className={`flex items-center gap-1.5 ${
                                    r.isPassing ? 'text-primary' : 'text-tertiary'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {r.isPassing ? 'check_circle' : 'warning'}
                                  </span>
                                  <span className="font-body-sm text-xs text-on-surface">
                                    {r.status}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-outline font-body-sm text-xs">Pending audit</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Link
                                to={`/repos/${r._id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-primary text-on-primary hover:bg-primary/90 font-body-sm text-xs font-medium transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">chat</span>
                                <span>Open chat</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Table Footer */}
                  <div className="h-10 px-4 bg-surface-container-lowest border-t border-outline-variant/30 flex items-center justify-between font-body-sm text-xs text-outline">
                    <div className="flex items-center gap-2">
                      <span>Page 1 of 1</span>
                      <span className="text-outline-variant">·</span>
                      <span>Showing {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add Repository Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container border border-outline-variant/40 rounded p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-base font-semibold text-on-surface">
                Add public repository
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {addError && (
              <div className="p-2.5 bg-error-container/20 border border-error text-error text-xs font-body-sm rounded">
                {addError}
              </div>
            )}

            <form onSubmit={handleLinkRepo} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-body-sm text-xs text-outline font-normal">
                  Public GitHub repository URL
                </label>
                <input
                  type="text"
                  required
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="bg-surface-container-lowest border border-outline-variant/40 px-3 py-2 text-on-surface font-body-sm text-xs rounded focus:border-primary-container focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-surface-container-high text-on-surface font-body-sm text-xs rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-container hover:bg-secondary-container text-on-primary-container font-body-sm text-xs font-medium rounded"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>Add repository</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
