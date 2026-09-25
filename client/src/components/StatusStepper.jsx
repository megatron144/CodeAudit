import React from 'react';

export const StatusStepper = ({ status = 'completed', stageDurations = {} }) => {
  const getStepState = (stepIndex) => {
    switch (status) {
      case 'queued':
        if (stepIndex === 1) return 'active';
        return 'pending';
      case 'sandbox_running':
        if (stepIndex < 2) return 'done';
        if (stepIndex === 2) return 'active';
        return 'pending';
      case 'ast_analyzed':
        if (stepIndex < 3) return 'done';
        if (stepIndex === 3) return 'active';
        return 'pending';
      case 'awaiting_llm':
        if (stepIndex < 4) return 'done';
        if (stepIndex === 4) return 'active';
        return 'pending';
      case 'completed':
      default:
        return 'done';
    }
  };

  const steps = [
    {
      id: 1,
      label: 'Webhook received',
      meta: stageDurations.webhookMs ? `${stageDurations.webhookMs}ms` : 'verified',
    },
    {
      id: 2,
      label: 'Micro-sandbox spawned',
      meta: stageDurations.sandboxMs ? `${stageDurations.sandboxMs}ms` : 'isolated',
    },
    {
      id: 3,
      label: 'AST and static analysis',
      meta: 'evaluated',
    },
    {
      id: 4,
      label: 'Semantic review',
      meta: status === 'awaiting_llm' ? 'evaluating' : (status === 'completed' ? 'complete' : 'pending'),
    },
    {
      id: 5,
      label: 'Report generation',
      meta: status === 'completed' ? 'complete' : 'pending',
    },
  ];

  return (
    <div className="w-full bg-[#0A0A0F] border-b border-[#1E1E2A] px-6 py-2.5 overflow-x-auto select-none">
      <div className="flex items-center min-w-[880px] gap-2">
        {steps.map((step, idx) => {
          const state = getStepState(step.id);

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                {state === 'done' && (
                  <span className="w-4 h-4 rounded-full bg-[#2563eb]/10 border border-[#2563eb]/40 flex items-center justify-center text-blue-400 font-sans text-[10px]">
                    ✓
                  </span>
                )}
                {state === 'active' && (
                  <span className="w-4 h-4 rounded-full border border-[#2563eb] text-[#2563eb] flex items-center justify-center font-sans text-[10px] bg-[#2563eb]/20 shadow-[0_0_8px_rgba(37,99,235,0.4)] animate-pulse">
                    ●
                  </span>
                )}
                {state === 'pending' && (
                  <span className="w-4 h-4 rounded-full border border-[#1E1E2A] text-[#5F5F70] flex items-center justify-center font-sans text-[10px]">
                    ○
                  </span>
                )}

                <span
                  className={`font-sans text-xs ${
                    state === 'active'
                      ? 'text-[#2563eb] font-medium'
                      : state === 'done'
                      ? 'text-[#EDEDF0]'
                      : 'text-[#888896]'
                  }`}
                >
                  {step.label}
                </span>

                {step.badge && (
                  <span className="font-sans text-xs px-1.5 py-0.5 bg-[#161622] border border-[#1E1E2A] text-[#888896] rounded">
                    {step.badge}
                  </span>
                )}

                {step.meta && (
                  <span className="font-sans text-xs text-[#888896]">
                    {step.meta}
                  </span>
                )}
              </div>

              {idx < steps.length - 1 && (
                <div className="w-6 h-px bg-[#1E1E2A]"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
