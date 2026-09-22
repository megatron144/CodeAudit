import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from '../components/Header';

export const Settings = () => {
  const [saveStatus, setSaveStatus] = useState('');
  const [config, setConfig] = useState({
    executionPolicy: {
      sandboxTimeoutSeconds: 30,
      memoryLimitMb: 512,
      cpuQuota: 1.0,
      enforceNetworkNone: true,
      readOnlyFilesystem: false,
    },
    llmEngine: {
      provider: 'Gemini 3.6 Flash',
      temperature: 0.1,
      cacheDiffHash: true,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/settings');
        if (res.data.config) setConfig(res.data.config);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      await axios.put('/api/settings', config);
      setSaveStatus('Engine parameters persisted successfully');
      setTimeout(() => setSaveStatus(''), 3500);
    } catch (err) {
      setSaveStatus('Failed to update engine parameters');
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface">
      <Header />
      <div className="pt-14 w-full">
        <main className="max-w-4xl mx-auto p-8 space-y-8">
          <div>
            <h1 className="font-headline-lg text-2xl font-bold tracking-tight text-on-surface">
              Engine Parameters
            </h1>
            <p className="font-body-md text-sm text-outline mt-1">
              Configure sandbox execution ceilings, LLM inference targets, and evaluation rules.
            </p>
          </div>

          {saveStatus && (
            <div className="p-3 bg-surface-container-high border border-primary/40 rounded text-xs text-primary font-mono flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>{saveStatus}</span>
            </div>
          )}

          {/* Sandbox Security Guardrails */}
          <section className="p-5 bg-surface-container border border-outline-variant/30 rounded space-y-4">
            <h2 className="font-headline-sm text-sm font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">security</span>
              <span>Sandbox execution policy</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/20 flex flex-col gap-1">
                <span className="text-outline font-body-sm text-xs font-normal">Timeout limit</span>
                <span className="text-on-surface font-semibold text-sm font-code-sm">
                  {config.executionPolicy?.sandboxTimeoutSeconds || 30}s
                </span>
                <span className="text-outline text-[11px]">Hard execution ceiling</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/20 flex flex-col gap-1">
                <span className="text-outline font-body-sm text-xs font-normal">Memory limit</span>
                <span className="text-on-surface font-semibold text-sm font-code-sm">
                  {config.executionPolicy?.memoryLimitMb || 512}MB RAM
                </span>
                <span className="text-outline text-[11px]">cgroup memory ceiling</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/20 flex flex-col gap-1">
                <span className="text-outline font-body-sm text-xs font-normal">Network namespace</span>
                <span className="text-primary font-semibold text-sm font-code-sm">--network=none</span>
                <span className="text-outline text-[11px]">Strict loopback isolation</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
