import React from 'react';

export const FindingsSummary = ({
  criticalCount = 0,
  warningCount = 0,
  noticeCount = 0,
  cweChecklist = [],
}) => {
  const totalCount = criticalCount + warningCount + noticeCount;

  return (
    <div className="p-4 border-b border-outline-variant/30 select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="font-body-sm text-xs text-outline font-medium">
          Findings summary
        </span>
        <span className="font-body-sm text-xs text-outline">{totalCount} {totalCount === 1 ? 'item' : 'items'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 font-body-sm text-xs">
        {/* Critical */}
        <div className="p-2.5 bg-surface-container-low border border-outline-variant/30 rounded flex flex-col">
          <span className="font-body-sm text-xs text-outline font-normal">Critical</span>
          <span className="font-headline-lg text-lg text-on-surface mt-1 font-semibold">
            {criticalCount}
          </span>
          <span className="font-body-xs text-[10px] text-outline">blocking</span>
        </div>

        {/* Warning */}
        <div className="p-2.5 bg-surface-container-low border border-outline-variant/30 rounded flex flex-col">
          <span className="font-body-sm text-xs text-tertiary-fixed-dim font-normal">
            Warning
          </span>
          <span className="font-headline-lg text-lg text-tertiary mt-1 font-semibold">
            {warningCount}
          </span>
          <span className="font-body-xs text-[10px] text-outline">review required</span>
        </div>

        {/* Informational / Notices */}
        <div className="p-2.5 bg-surface-container-low border border-outline-variant/30 rounded flex flex-col">
          <span className="font-body-sm text-xs text-outline font-normal">Notices</span>
          <span className="font-headline-lg text-lg text-on-surface mt-1 font-semibold">
            {noticeCount}
          </span>
          <span className="font-body-xs text-[10px] text-outline">informational</span>
        </div>
      </div>

      {/* Rules Checklist */}
      {cweChecklist.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 font-body-sm text-xs">
          {cweChecklist.map((cwe) => (
            <div
              key={cwe.name}
              className="flex items-center justify-between p-1.5 bg-surface-container-low rounded border border-outline-variant/20"
            >
              <span className="font-code-sm text-xs text-on-surface truncate">{cwe.name}</span>
              <span
                className={`font-code-sm text-xs shrink-0 ${
                  cwe.status === 'Flagged' ? 'text-tertiary' : 'text-outline'
                }`}
              >
                {cwe.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
