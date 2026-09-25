import React from 'react';

export const FindingsSummary = ({
  criticalCount = 0,
  warningCount = 0,
  noticeCount = 0,
  cweChecklist = [],
}) => {
  const totalCount = criticalCount + warningCount + noticeCount;

  return (
    <div className="p-4 rounded-xl border border-[#1E1E2A] bg-[#0A0A0F] select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="font-sans text-xs text-[#888896] font-medium">
          Findings summary
        </span>
        <span className="font-sans text-xs text-[#888896]">{totalCount} {totalCount === 1 ? 'item' : 'items'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 font-sans text-xs">
        {/* Critical */}
        <div className="p-2.5 bg-[#111118] border border-red-500/20 rounded-xl flex flex-col">
          <span className="text-xs text-red-400 font-normal">Critical</span>
          <span className="text-lg text-[#EDEDF0] mt-1 font-semibold">
            {criticalCount}
          </span>
          <span className="text-[10px] text-[#888896]">blocking</span>
        </div>

        {/* Warning */}
        <div className="p-2.5 bg-[#111118] border border-amber-500/20 rounded-xl flex flex-col">
          <span className="text-xs text-amber-400 font-normal">
            Warning
          </span>
          <span className="text-lg text-amber-300 mt-1 font-semibold">
            {warningCount}
          </span>
          <span className="text-[10px] text-[#888896]">review required</span>
        </div>

        {/* Informational / Notices */}
        <div className="p-2.5 bg-[#111118] border border-[#1E1E2A] rounded-xl flex flex-col">
          <span className="text-xs text-[#888896] font-normal">Notices</span>
          <span className="text-lg text-[#EDEDF0] mt-1 font-semibold">
            {noticeCount}
          </span>
          <span className="text-[10px] text-[#888896]">informational</span>
        </div>
      </div>

      {/* Rules Checklist */}
      {cweChecklist.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 font-sans text-xs">
          {cweChecklist.map((cwe) => (
            <div
              key={cwe.name}
              className="flex items-center justify-between p-2 bg-[#111118] rounded-lg border border-[#1E1E2A]"
            >
              <span className="font-mono text-xs text-[#EDEDF0] truncate">{cwe.name}</span>
              <span
                className={`text-xs shrink-0 font-medium ${
                  cwe.status === 'Flagged' ? 'text-amber-400' : 'text-[#888896]'
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
