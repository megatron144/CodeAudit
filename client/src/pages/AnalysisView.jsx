import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { StatusStepper } from '../components/StatusStepper';
import { FindingsSummary } from '../components/FindingsSummary';
import { SandboxTerminal } from '../components/SandboxTerminal';
import { RepoChatbot } from '../components/RepoChatbot';
import { useSocket } from '../context/SocketContext';

export const AnalysisView = () => {
  const { id } = useParams();
  const { socket } = useSocket();

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);

  const fetchAnalysis = async () => {
    try {
      const res = await axios.get(`/api/analyses/${id || 'latest'}`);
      setAnalysis(res.data);
    } catch (err) {
      console.error(err);
      setAnalysis({ empty: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [id]);

  // Socket.io Real-Time Room & Event Listener
  useEffect(() => {
    if (!socket || !analysis?._id) return;

    socket.emit('join:analysis', analysis._id);

    const handleStatusUpdate = (data) => {
      console.log('[Socket.io] Analysis update:', data);
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: data.stage || prev.status,
          score: data.score !== undefined ? data.score : prev.score,
          scoreDelta: data.scoreDelta !== undefined ? data.scoreDelta : prev.scoreDelta,
          findings: data.findings || prev.findings,
        };
      });
    };

    socket.on('analysis:status', handleStatusUpdate);

    return () => {
      socket.emit('leave:analysis', analysis._id);
      socket.off('analysis:status', handleStatusUpdate);
    };
  }, [socket, analysis?._id]);

  const handleRerun = async () => {
    if (!analysis?.repoId) return;
    setRerunning(true);
    try {
      await axios.post('/api/analysis/trigger', {
        repoId: analysis.repoId,
        commitHash: analysis.commitHash,
        branch: analysis.branch,
        prNumber: analysis.prNumber,
        prTitle: analysis.prTitle,
      });
      setTimeout(() => {
        fetchAnalysis();
        setRerunning(false);
      }, 1200);
    } catch (err) {
      setRerunning(false);
    }
  };

  const handleApplyPatch = async (findingId) => {
    if (!analysis?._id) return;
    try {
      const res = await axios.post(`/api/analysis/${analysis._id}/apply-patch`, { findingId });
      setAnalysis(res.data.analysis);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissFinding = async (findingId) => {
    if (!analysis?._id) return;
    try {
      const res = await axios.post(`/api/analysis/${analysis._id}/dismiss`, { findingId });
      setAnalysis(res.data.analysis);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest text-on-surface">
        <Header />
        <div className="pt-24 text-center text-outline font-body-sm text-xs">
          Loading audit workbench...
        </div>
      </div>
    );
  }

  // Clean empty state when no analysis exists
  if (!analysis || analysis.empty || !analysis._id) {
    return (
      <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased">
        <Header />
        <div className="pt-24 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded bg-surface-container flex items-center justify-center border border-outline-variant/30 mb-4 text-outline">
            <span className="material-symbols-outlined text-[28px]">analytics</span>
          </div>
          <h2 className="font-headline-lg text-lg font-semibold text-on-surface mb-2">
            No analysis performed yet
          </h2>
          <p className="font-body-sm text-sm text-on-surface-variant max-w-md mb-6">
            Link a public repository and trigger an audit on a commit or pull request to inspect unified diffs, AST evaluation, and security findings.
          </p>
          <Link
            to="/"
            className="px-4 py-2 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container font-body-sm text-sm font-medium transition-none flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Return to home</span>
          </Link>
        </div>
      </div>
    );
  }

  const criticalCount = analysis.findings?.filter((f) => f.severity === 'critical').length || 0;
  const warningCount = analysis.findings?.filter((f) => f.severity === 'warning').length || 0;
  const noticeCount = analysis.findings?.filter((f) => f.severity === 'notice').length || 0;

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased">
      <Header />

      <main className="w-full min-h-screen pt-14 bg-surface-container-lowest flex flex-col">
          {/* Top Workspace Context Header */}
          <div className="w-full bg-surface border-b border-outline-variant/30 px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-body-sm text-body-sm text-outline">
                  {analysis.repoName && (
                    <>
                      <Link to={`/repos/${analysis.repoId}`} className="hover:text-on-surface text-on-surface-variant transition-colors">
                        {analysis.repoName}
                      </Link>
                      <span className="text-outline-variant select-none">›</span>
                    </>
                  )}
                  <span className="text-on-surface font-medium truncate">
                    {analysis.prTitle || (analysis.commitHash ? `Commit ${analysis.commitHash.slice(0, 7)}` : 'Analysis')}
                  </span>
                </nav>

                {/* Commit Metadata */}
                <div className="flex items-center gap-2 font-body-sm text-xs text-outline">
                  {analysis.commitHash && (
                    <span className="font-code-sm text-xs text-primary font-medium">
                      {analysis.commitHash.slice(0, 7)}
                    </span>
                  )}
                  {analysis.author && (
                    <>
                      <span>·</span>
                      <span>{analysis.author}</span>
                    </>
                  )}
                  {analysis.branch && (
                    <>
                      <span>·</span>
                      <span className="font-code-sm text-xs text-on-surface-variant">{analysis.branch}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleRerun}
                  disabled={rerunning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/40 hover:border-outline text-on-surface font-body-sm text-xs rounded transition-none disabled:opacity-50"
                  id="reanalyze-btn"
                >
                  <span
                    className={`material-symbols-outlined text-[15px] text-on-surface-variant ${
                      rerunning ? 'animate-spin' : ''
                    }`}
                  >
                    refresh
                  </span>
                  <span>{rerunning ? 'Analyzing...' : 'Re-analyze'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Execution Pipeline Status Stepper - Only shown while in-progress */}
          {analysis.status && analysis.status !== 'completed' && (
            <StatusStepper
              status={analysis.status}
              stageDurations={analysis.stageDurations || {}}
            />
          )}

          {/* Main Inspection Workbench: Findings Summary & Sandbox Terminal */}
          <div className="w-full max-w-6xl mx-auto p-6 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-headline-lg text-lg font-semibold text-on-surface">
                  Analysis results & findings
                </h2>
                <p className="font-body-sm text-xs text-outline">
                  {analysis.findings?.length || 0} findings evaluated across AST static graph and sandbox run
                </p>
              </div>

              {analysis.repoId && (
                <Link
                  to={`/repos/${analysis.repoId}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary text-on-primary font-body-sm text-xs font-medium hover:bg-primary/90 transition-colors self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                  <span>Ask chatbot about this audit</span>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FindingsSummary
                criticalCount={criticalCount}
                warningCount={warningCount}
                noticeCount={noticeCount}
                cweChecklist={analysis.cweChecklist || []}
              />
              <SandboxTerminal
                logs={analysis.sandboxOutput?.logs || []}
                isRunning={analysis.status === 'sandbox_running'}
              />
            </div>
          </div>
        </main>

      {/* Docked Repo Assistant Chatbot */}
      <RepoChatbot
        repoId={analysis.repoId}
        analysisId={analysis._id}
        repoName={analysis.repoName || 'Repository'}
        prNumber={analysis.prNumber || null}
      />
    </div>
  );
};
