import React from 'react';

export const HeroMockup = () => (
  <div className="w-full bg-surface-container-low border border-outline-variant/40 rounded overflow-hidden font-code-sm text-code-sm shadow-none">
    {/* Window Header */}
    <div className="h-9 px-3.5 bg-surface-container border-b border-outline-variant/30 flex items-center justify-between text-outline">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-outline-variant/60 inline-block"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-outline-variant/60 inline-block"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-outline-variant/60 inline-block"></span>
        <span className="ml-2 text-on-surface font-medium text-xs">src/alloc/arena_tree.rs</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-surface-container-high border border-outline-variant/30 text-primary">88/100 · 42ms runtime</span>
      </div>
    </div>
    {/* Code Lines */}
    <div className="p-3.5 flex flex-col gap-1 bg-surface-container-lowest text-on-surface-variant text-xs select-none">
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-outline">41</span>
        <span className="text-on-surface">pub fn allocate_block(&mut self, size: usize) -&gt; Result&lt;BlockRef, ArenaError&gt; &#123;</span>
      </div>
      <div className="flex items-center gap-3 bg-secondary-container/10 border-l-2 border-primary-container px-1">
        <span className="w-6 text-right text-primary">42</span>
        <span className="text-on-surface font-mono">+   let block = self.active_arena.claim_slot(size)?;</span>
      </div>
      <div className="flex items-center gap-3 bg-secondary-container/10 border-l-2 border-primary-container px-1">
        <span className="w-6 text-right text-primary">43</span>
        <span className="text-on-surface font-mono">+   self.barrier.enforce_lifecycle_boundary(&block)?;</span>
      </div>
      {/* Inline finding chip */}
      <div className="my-1.5 p-2 bg-surface-container-low border border-outline-variant/40 rounded flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          <span className="text-xs text-on-surface font-medium">Invariant Gate Verified</span>
          <span className="text-[10px] text-outline font-mono">AST_BOUNDS_CLEAN</span>
        </div>
        <span className="text-[11px] text-primary font-mono">PASS 100%</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-outline">44</span>
        <span className="text-on-surface">    Ok(block)</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-outline">45</span>
        <span className="text-on-surface">&#125;</span>
      </div>
    </div>
  </div>
);

export const FlowPipelineDiagram = () => (
  <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-2 text-left font-code-sm">
    <div className="p-3.5 bg-surface-container border border-outline-variant/30 rounded flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-outline text-xs">
        <span className="text-primary font-medium">01</span>
        <span>INGEST</span>
      </div>
      <div className="font-headline-sm text-sm text-on-surface font-medium">Repository Ingestion</div>
      <div className="text-xs text-on-surface-variant font-body-sm">
        Webhook or manual commit diff ingestion with ETag rate compliance.
      </div>
    </div>

    <div className="p-3.5 bg-surface-container border border-outline-variant/30 rounded flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-outline text-xs">
        <span className="text-primary font-medium">02</span>
        <span>SANDBOX</span>
      </div>
      <div className="font-headline-sm text-sm text-on-surface font-medium">Isolated Sandbox</div>
      <div className="text-xs text-on-surface-variant font-body-sm">
        Ephemerally booted container with strict network isolation and quotas.
      </div>
    </div>

    <div className="p-3.5 bg-surface-container border border-outline-variant/30 rounded flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-outline text-xs">
        <span className="text-primary font-medium">03</span>
        <span>STATIC AST</span>
      </div>
      <div className="font-headline-sm text-sm text-on-surface font-medium">Invariant Engine</div>
      <div className="text-xs text-on-surface-variant font-body-sm">
        Deterministic security rules and CWE classification across changed files.
      </div>
    </div>

    <div className="p-3.5 bg-surface-container border border-outline-variant/30 rounded flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-outline text-xs">
        <span className="text-primary font-medium">04</span>
        <span>LLM TRIAGE</span>
      </div>
      <div className="font-headline-sm text-sm text-on-surface font-medium">Diagnostic Triage</div>
      <div className="text-xs text-on-surface-variant font-body-sm">
        Evaluates deterministic invariants with inline diagnostics and patches.
      </div>
    </div>
  </div>
);

export const ContainerSandboxSnippet = () => (
  <div className="p-3 bg-surface-container-lowest border border-outline-variant/30 rounded font-code-sm text-xs flex flex-col gap-1 text-on-surface-variant">
    <div className="flex items-center justify-between text-outline">
      <span className="text-primary">docker:sandbox</span>
      <span>--network=none</span>
    </div>
    <div className="text-on-surface">limits: 512MB RAM · 1.0 CPU · timeout 30s</div>
    <div className="text-outline">exit_code: 0 · kvm_isolated</div>
  </div>
);

export const InlineDiffSnippet = () => (
  <div className="p-3 bg-surface-container-lowest border border-outline-variant/30 rounded font-code-sm text-xs flex flex-col gap-1 text-on-surface-variant">
    <div className="text-outline">pkg/middleware/auth_jwt.go</div>
    <div className="text-error bg-surface-container-high/30 px-1">- go v.startEvictionLoop(context.Background())</div>
    <div className="text-primary bg-secondary-container/10 px-1">+ go v.startEvictionLoop(ctx)</div>
  </div>
);

export const RealtimeJobSnippet = () => (
  <div className="p-3 bg-surface-container-lowest border border-outline-variant/30 rounded font-code-sm text-xs flex flex-col gap-1.5">
    <div className="flex items-center justify-between text-outline">
      <span className="text-on-surface font-medium">Pipeline Telemetry</span>
      <span className="flex items-center gap-1 text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
        <span>LIVE</span>
      </span>
    </div>
    <div className="text-on-surface-variant text-[11px]">P1: Ingest ✓ · P2: Sandbox ✓ · P3: LLM ●</div>
  </div>
);

export const TrendHistorySnippet = () => (
  <div className="p-3 bg-surface-container-lowest border border-outline-variant/30 rounded font-code-sm text-xs flex flex-col gap-1">
    <div className="flex items-center justify-between text-outline">
      <span>Pass Rate</span>
      <span className="text-primary font-medium">96.7%</span>
    </div>
    <div className="w-full bg-surface-container-high h-2 rounded overflow-hidden mt-1">
      <div className="bg-primary-container h-full w-[96.7%]"></div>
    </div>
  </div>
);

export const EmptyStateIllustration = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-outline">
    <rect x="6" y="8" width="28" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 14H34" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="11" r="1" fill="currentColor" />
    <circle cx="14" cy="11" r="1" fill="currentColor" />
    <circle cx="18" cy="11" r="1" fill="currentColor" />
    <path d="M12 21L16 25L12 29" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="19" y1="29" x2="27" y2="29" stroke="#b4c5ff" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
