import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';

export const HistoryTrends = () => {
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get('/api/repos');
        setRepos(res.data);
        if (res.data.length > 0) {
          setSelectedRepoId(res.data[0]._id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedRepoId) {
      setAnalyses([]);
      return;
    }

    const fetchAnalyses = async () => {
      try {
        const res = await axios.get(`/api/repos/${selectedRepoId}/analyses`);
        setAnalyses(res.data || []);
      } catch (err) {
        console.error(err);
        setAnalyses([]);
      }
    };
    fetchAnalyses();
  }, [selectedRepoId]);

  const totalAnalyses = analyses.length;
  const passedRuns = analyses.filter((a) => a.sandboxOutput?.exitCode === 0 || a.status === 'completed').length;
  const passRate = totalAnalyses > 0 ? Math.round((passedRuns / totalAnalyses) * 100) : 100;
  const currentScore = totalAnalyses > 0 ? analyses[analyses.length - 1].score : null;
  const criticalDefects = analyses.reduce((acc, a) => acc + (a.findings || []).filter((f) => f.severity === 'critical').length, 0);
  const warningDefects = analyses.reduce((acc, a) => acc + (a.findings || []).filter((f) => f.severity === 'warning').length, 0);

  // Generate SVG coordinates for flat single blue line
  const svgWidth = 600;
  const svgHeight = 180;
  const padding = 30;

  const points = analyses.map((item, i) => {
    const x = padding + (i / Math.max(analyses.length - 1, 1)) * (svgWidth - padding * 2);
    const score = Math.max(0, Math.min(100, item.score || 0));
    const y = svgHeight - padding - (score / 100) * (svgHeight - padding * 2);
    return { x, y, score: item.score, commit: item.commitHash, id: item._id };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md">
      <Header />
      <Sidebar />

      <div className="pl-60 pt-14">
        <main className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header & Repo Selector */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-outline-variant/30 pb-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-headline-xl text-xl font-semibold text-on-surface">
                Historical health trends
              </h1>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Score-over-time tracking and quality metrics across evaluation runs.
              </p>
            </div>

            {repos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-xs text-outline font-normal">Repository:</span>
                <select
                  value={selectedRepoId || ''}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="bg-surface-container border border-outline-variant/40 px-3 py-1.5 text-on-surface font-body-sm text-xs rounded focus:outline-none"
                >
                  {repos.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.fullName || `${r.owner}/${r.name}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {repos.length === 0 && !loading ? (
            <div className="rounded border border-outline-variant/30 bg-surface-container-lowest p-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded bg-surface-container flex items-center justify-center border border-outline-variant/30 mb-4 text-outline">
                <span className="material-symbols-outlined text-[24px]">source</span>
              </div>
              <h2 className="font-headline-md text-base font-semibold text-on-surface mb-1">
                No repositories added yet.
              </h2>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-sm mb-5">
                Add a public GitHub repository to view historical audit metrics and score trajectories.
              </p>
              <Link
                to="/repos"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-secondary-container transition-none font-body-sm text-xs font-medium"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Add repository</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Metrics Summary Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-surface-container border border-outline-variant/30 rounded flex flex-col">
                  <span className="font-body-sm text-xs text-outline font-normal">Total runs</span>
                  <span className="font-code-lg text-lg text-on-surface mt-1 font-semibold">
                    {totalAnalyses}
                  </span>
                </div>
                <div className="p-3 bg-surface-container border border-outline-variant/30 rounded flex flex-col">
                  <span className="font-body-sm text-xs text-outline font-normal">Pass rate</span>
                  <span className="font-code-lg text-lg text-primary mt-1 font-semibold">
                    {passRate}%
                  </span>
                </div>
                <div className="p-3 bg-surface-container border border-outline-variant/30 rounded flex flex-col">
                  <span className="font-body-sm text-xs text-outline font-normal">Latest score</span>
                  <span className="font-code-lg text-lg text-on-surface mt-1 font-semibold">
                    {currentScore !== null ? `${currentScore}/100` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-surface-container border border-outline-variant/30 rounded flex flex-col">
                  <span className="font-body-sm text-xs text-outline font-normal">Cumulative defects</span>
                  <span className="font-code-lg text-lg text-tertiary mt-1 font-semibold">
                    {criticalDefects} critical · {warningDefects} warning
                  </span>
                </div>
              </div>

              {/* Flat Single Blue Line Chart */}
              <div className="p-5 bg-surface-container border border-outline-variant/30 rounded flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-sm font-semibold text-on-surface">
                    Score trajectory over time
                  </span>
                  <span className="font-body-sm text-xs text-outline">Scale: 0 to 100</span>
                </div>

                {points.length === 0 ? (
                  <div className="p-8 text-center text-outline font-body-sm text-xs">
                    No historical trend data recorded for this repository yet. Trigger an audit on a commit or pull request to start plotting health trends.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-48 select-none"
                    >
                      {/* Grid Lines */}
                      <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#2a292f" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1={padding} y1={(svgHeight) / 2} x2={svgWidth - padding} y2={(svgHeight) / 2} stroke="#2a292f" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#2a292f" strokeWidth="1" />

                      {/* Y Axis Labels */}
                      <text x="5" y={padding + 4} fill="#8d90a0" fontSize="10" fontFamily="JetBrains Mono">100</text>
                      <text x="12" y={(svgHeight) / 2 + 4} fill="#8d90a0" fontSize="10" fontFamily="JetBrains Mono">50</text>
                      <text x="18" y={svgHeight - padding + 4} fill="#8d90a0" fontSize="10" fontFamily="JetBrains Mono">0</text>

                      {/* Single Blue Line */}
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                        points={polylinePoints}
                      />

                      {/* Points */}
                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="4" fill="#131318" stroke="#2563eb" strokeWidth="2" />
                          <text
                            x={p.x}
                            y={p.y - 8}
                            textAnchor="middle"
                            fill="#e4e1e9"
                            fontSize="10"
                            fontFamily="JetBrains Mono"
                          >
                            {p.score}
                          </text>
                          <text
                            x={p.x}
                            y={svgHeight - 12}
                            textAnchor="middle"
                            fill="#8d90a0"
                            fontSize="9"
                            fontFamily="JetBrains Mono"
                          >
                            {p.commit}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                )}
              </div>

              {/* Past Analyses Table */}
              <div className="flex flex-col gap-3">
                <h2 className="font-headline-md text-base font-semibold text-on-surface">
                  Past analyses log
                </h2>

                {analyses.length === 0 ? (
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded text-center text-xs text-outline font-body-sm">
                    No past analyses recorded.
                  </div>
                ) : (
                  <div className="border border-outline-variant/30 rounded bg-surface-container overflow-hidden">
                    <table className="w-full text-left font-body-sm text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant/30 bg-surface-container-high/40 text-outline font-body-sm">
                          <th className="py-2.5 px-4 font-medium">Commit</th>
                          <th className="py-2.5 px-4 font-medium">Branch</th>
                          <th className="py-2.5 px-4 font-medium">Date</th>
                          <th className="py-2.5 px-4 font-medium">Score</th>
                          <th className="py-2.5 px-4 font-medium">Defects</th>
                          <th className="py-2.5 px-4 text-right font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20">
                        {analyses.map((item, idx) => {
                          const crit = (item.findings || []).filter((f) => f.severity === 'critical').length;
                          const warn = (item.findings || []).filter((f) => f.severity === 'warning').length;
                          const isPass = item.sandboxOutput?.exitCode === 0 || item.status === 'completed';
                          return (
                            <tr key={item._id || idx} className="hover:bg-surface-container-low/50">
                              <td className="py-3 px-4 text-primary font-medium">
                                <Link to={`/analysis/${item._id}`} className="hover:underline font-code-sm text-xs">
                                  {item.commitHash}
                                </Link>
                              </td>
                              <td className="py-3 px-4 text-outline font-code-sm text-xs">{item.branch}</td>
                              <td className="py-3 px-4 text-outline font-body-sm text-xs">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-1.5 py-0.5 bg-surface-container-high rounded text-on-surface font-code-sm text-xs">
                                  {item.score}/100
                                </span>
                              </td>
                              <td className="py-3 px-4 text-outline font-body-sm text-xs">
                                {crit} critical · {warn} warning
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-body-sm ${
                                    isPass
                                      ? 'bg-primary-container/20 text-primary'
                                      : 'bg-error-container/20 text-error'
                                  }`}
                                >
                                  {isPass ? 'Pass' : 'Review required'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
