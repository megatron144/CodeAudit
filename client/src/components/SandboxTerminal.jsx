import React, { useState } from 'react';

export const SandboxTerminal = ({ logs = [], isRunning = false }) => {
  const [cleared, setCleared] = useState(false);

  const activeLogs = cleared ? [] : logs;

  const getTagClass = (tag = '') => {
    if (tag.includes('warn') || tag.includes('err')) return 'text-red-400';
    if (tag.includes('init') || tag.includes('sandbox')) return 'text-blue-400';
    return 'text-[#EDEDF0]';
  };

  return (
    <div className="flex-1 flex flex-col min-h-[300px] select-none rounded-xl border border-[#1E1E2A] overflow-hidden bg-[#0A0A0F]">
      {/* Header */}
      <div className="h-9 px-4 bg-[#111118] border-b border-[#1E1E2A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2563eb]"></span>
          <span className="font-sans text-xs text-[#888896] font-medium">
            Sandbox output terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCleared(!cleared)}
            className="font-sans text-xs text-[#888896] hover:text-[#EDEDF0] transition-colors"
          >
            {cleared ? 'Restore' : 'Clear'}
          </button>
          <span className="text-[#1E1E2A]">|</span>
          <span className="font-mono text-xs text-blue-400">stdout</span>
        </div>
      </div>

      {/* Terminal Stream */}
      <div className="flex-1 p-4 font-mono text-xs leading-5 text-[#888896] flex flex-col gap-1 bg-[#0A0A0F] overflow-y-auto select-text">
        {activeLogs.length === 0 ? (
          <div className="text-[#5F5F70] text-xs py-4 font-sans">
            {isRunning ? 'Executing micro-sandbox container...' : 'No sandbox execution logs for this run.'}
          </div>
        ) : (
          activeLogs.map((log, i) => (
            <div key={i}>
              {log.timestamp && <span className="text-[#5F5F70]">[{log.timestamp}] </span>}
              {log.tag && <span className={log.tagClass || getTagClass(log.tag)}>[{log.tag}] </span>}
              <span className="text-[#EDEDF0]">{log.message}</span>
            </div>
          ))
        )}

        {/* Live Cursor Indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-[#888896] mt-2 select-none font-sans text-xs">
            <span className="w-2 h-2 rounded-full bg-[#2563eb] shadow-[0_0_8px_rgba(37,99,235,0.6)] animate-pulse inline-block"></span>
            <span>Executing container sandbox...</span>
          </div>
        )}
      </div>
    </div>
  );
};
