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
      <div className="min-h-screen bg-[#0A0A0F] text-[#EDEDF0]">
        <Header />
        <div className="pt-32 flex flex-col items-center justify-center gap-3 text-center">
          <span className="w-5 h-5 border-2 border-[#2563eb]/30 border-t-[#2563eb] rounded-full animate-spin"></span>
          <span className="text-xs font-sans text-[#888896]">Loading repository workspace...</span>
        </div>
      </div>
    );
  }

  const { repo } = data || {};

  return (
    <div className="h-screen bg-[#0A0A0F] text-[#EDEDF0] font-sans antialiased flex flex-col overflow-hidden">
      <Header />

      <div className="pt-14 flex-1 flex flex-col min-h-0 w-full">
        {/* Top Context Bar */}
        <div className="h-14 px-6 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-[#1E1E2A] flex items-center justify-between gap-4 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0 font-sans text-sm">
            <span className="text-[#888896] font-normal truncate">
              {repo?.owner}
            </span>
            <span className="text-[#5F5F70] select-none">/</span>
            <h1 className="font-semibold text-sm text-[#EDEDF0] truncate">
              {repo?.name}
            </h1>
          </div>
        </div>

        {/* Primary Interaction Surface: Full-Page Chatbot Workspace */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0A0A0F]">
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
