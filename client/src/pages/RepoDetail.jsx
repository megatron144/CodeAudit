import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { RepoChatbot } from '../components/RepoChatbot';

export const RepoDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest text-on-surface">
        <Header />
        <div className="pt-24 text-center text-outline font-body-sm text-xs">
          Loading repository workspace...
        </div>
      </div>
    );
  }

  const { repo } = data || {};

  return (
    <div className="h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased flex flex-col overflow-hidden">
      <Header />

      <div className="pt-14 flex-1 flex flex-col min-h-0 w-full">
        {/* Top Context Bar */}
        <div className="h-14 px-6 bg-surface border-b border-outline-variant/30 flex items-center justify-between gap-4 shrink-0 select-none">
          <div className="flex items-center gap-1.5 min-w-0 font-body-sm text-sm">
            <span className="text-on-surface-variant font-normal truncate">
              {repo?.owner}
            </span>
            <span className="text-outline select-none">/</span>
            <h1 className="font-headline-sm text-sm font-semibold text-on-surface truncate">
              {repo?.name}
            </h1>
          </div>
        </div>

        {/* Primary Interaction Surface: Full-Page Chatbot Workspace */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
