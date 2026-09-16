import React, { useState } from 'react';

export const SandboxTerminal = ({ logs = [], isRunning = false }) => {
  const [cleared, setCleared] = useState(false);

  const activeLogs = cleared ? [] : logs;

  const getTagClass = (tag = '') => {
    if (tag.includes('warn') || tag.includes('err')) return 'text-tertiary';
    if (tag.includes('init') || tag.includes('sandbox')) return 'text-primary-fixed-dim';
    return 'text-on-surface';
  };

  return (
    <div className="flex-1 flex flex-col min-h-[300px] select-none">
      {/* Header */}
      <div className="h-9 px-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-container"></span>
          <span className="font-label-sm text-xs text-outline font-medium">
            Sandbox output terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCleared(!cleared)}
            className="font-body-sm text-xs text-outline hover:text-on-surface transition-none"
          >
            {cleared ? 'Restore' : 'Clear'}
          </button>
          <span className="text-outline-variant/40">|</span>
          <span className="font-code-sm text-xs text-primary">stdout</span>
        </div>
      </div>

      {/* Terminal Stream */}
      <div className="flex-1 p-4 font-code-sm text-code-sm leading-5 text-on-surface-variant flex flex-col gap-1 bg-surface-container-lowest overflow-y-auto select-text">
        {activeLogs.length === 0 ? (
          <div className="text-outline text-xs py-4">
            {isRunning ? 'Executing micro-sandbox container...' : 'No sandbox execution logs for this run.'}
          </div>
        ) : (
          activeLogs.map((log, i) => (
            <div key={i}>
              {log.timestamp && <span className="text-outline">[{log.timestamp}] </span>}
              {log.tag && <span className={log.tagClass || getTagClass(log.tag)}>[{log.tag}] </span>}
              <span>{log.message}</span>
            </div>
          ))
        )}

        {/* Live Cursor Indicator */}
        {isRunning && (
          <div className="flex items-center gap-1 text-outline mt-1 select-none">
            <span className="w-1.5 h-3 bg-primary animate-pulse inline-block"></span>
            <span className="text-[11px]">Executing container sandbox...</span>
          </div>
        )}
      </div>
    </div>
  );
};
