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
      label: 'Score generation',
      meta: status === 'completed' ? 'calculated' : 'pending',
    },
  ];

  return (
    <div className="w-full bg-surface-container-lowest border-b border-outline-variant/30 px-6 py-2.5 overflow-x-auto select-none">
      <div className="flex items-center min-w-[880px] gap-2">
        {steps.map((step, idx) => {
          const state = getStepState(step.id);

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                {state === 'done' && (
                  <span className="w-4 h-4 rounded-full bg-primary-container/20 border border-primary-container flex items-center justify-center text-primary font-code-sm text-[10px]">
                    ✓
                  </span>
                )}
                {state === 'active' && (
                  <span className="w-4 h-4 rounded-full border border-primary text-primary flex items-center justify-center font-code-sm text-[10px] bg-primary/10 animate-pulse">
                    ●
                  </span>
                )}
                {state === 'pending' && (
                  <span className="w-4 h-4 rounded-full border border-outline-variant text-outline flex items-center justify-center font-code-sm text-[10px]">
                    ○
                  </span>
                )}

                <span
                  className={`font-body-sm text-xs ${
                    state === 'active'
                      ? 'text-primary font-medium'
                      : state === 'done'
                      ? 'text-on-surface'
                      : 'text-outline'
                  }`}
                >
                  {step.label}
                </span>

                {step.badge && (
                  <span className="font-body-sm text-xs px-1.5 py-0.5 bg-surface-container border border-outline-variant/30 text-on-surface-variant rounded">
                    {step.badge}
                  </span>
                )}

                {step.meta && (
                  <span className="font-code-sm text-xs text-outline">
                    {step.meta}
                  </span>
                )}
              </div>

              {idx < steps.length - 1 && (
                <div className="w-6 h-px bg-outline-variant/40"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
