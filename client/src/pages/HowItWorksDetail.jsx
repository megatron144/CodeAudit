import React from 'react';
import { useParams, Link } from 'react-router-dom';

const PIPELINE_STEPS = [
  {
    slug: 'repository-provisioning',
    number: '01',
    title: 'You provide a repository',
    lead: 'Enter a public GitHub repository URL or a username to start an analysis session without creating an account.',
    sections: [
      {
        heading: 'How repository resolution works',
        paragraphs: [
          'When you paste an input into CodeAudit, the backend checks whether you provided a repository URL (like https://github.com/owner/repo), an owner/repo shortcut, or a standalone GitHub username.',
          'For repository URLs, CodeAudit queries the GitHub API to verify that the repository exists and is publicly accessible. Private repositories return a clear error message because CodeAudit does not require or store personal access tokens.',
          'If you enter a username instead, CodeAudit looks up that user’s public repositories and displays them as a list sorted by recent activity so you can pick the one you want to review.'
        ]
      },
      {
        heading: 'Constraints and sizing caps',
        paragraphs: [
          'To keep analysis fast and memory predictable, repositories exceeding 500MB or containing more than 50,000 files are blocked from automated in-memory tree building. CodeAudit is completely stateless — sessions run on demand and no user account is required.'
        ]
      }
    ],
    detailsList: [
      { label: 'Authentication', value: 'None required (stateless sessions)' },
      { label: 'Supported sources', value: 'Public GitHub repositories' },
      { label: 'Repository discovery', value: 'Username lookup via GitHub Users API' },
      { label: 'Caching layer', value: 'Redis (10-minute TTL for user repos, 4-hour TTL for popular repos)' }
    ]
  },
  {
    slug: 'code-and-structure-fetching',
    number: '02',
    title: "The repo's code and structure are fetched",
    lead: "CodeAudit reads the repository file tree and relevant files directly through the GitHub API without cloning the repository to disk.",
    sections: [
      {
        heading: 'How the file tree is built',
        paragraphs: [
          'Instead of running a slow git clone command on the host server, CodeAudit calls the GitHub Git Trees API (GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1). This returns the full list of file paths and commit hashes in a single JSON payload.',
          'The raw list of paths is parsed into a tree structure in server memory. This takes under half a second for most repositories and does not leave temporary files on the host disk.',
          'Directories like node_modules, vendor, build output folders, and binary files are filtered out automatically so that only source files are indexed.'
        ]
      },
      {
        heading: 'Fetching file contents and rate limits',
        paragraphs: [
          'File contents are fetched on demand when the analysis engine or chatbot needs to inspect a specific file, rather than downloading the entire repository at once.',
          'Tree responses and metadata are cached in Redis with short expiration times. This avoids hitting GitHub API rate limits during active exploration sessions.'
        ]
      }
    ],
    detailsList: [
      { label: 'API endpoint', value: 'GET /repos/{owner}/{repo}/git/trees' },
      { label: 'Storage model', value: 'In-memory tree hierarchy (zero disk cloning)' },
      { label: 'Excluded paths', value: 'node_modules, vendor, dist, target, binary assets' },
      { label: 'Tree build time', value: 'Under 500ms for typical repositories' }
    ]
  },
  {
    slug: 'sandbox-execution',
    number: '03',
    title: 'Code runs in an isolated sandbox',
    lead: 'Untrusted code and test scripts run inside temporary Docker containers with no network access.',
    sections: [
      {
        heading: 'Network isolation',
        paragraphs: [
          'Containers are started with the --network=none flag. This ensures that any code being analyzed has zero network access — it cannot make outbound HTTP requests, reach internal services, or exfiltrate environment variables.',
          'The filesystem inside the container is ephemeral. Any temporary files written during execution are discarded as soon as the container stops.'
        ]
      },
      {
        heading: 'Resource limits and timeouts',
        paragraphs: [
          'Each container is restricted to 512MB of RAM and 1.0 CPU core using Linux cgroups. If a process attempts to exceed its memory allowance, it is terminated by the kernel rather than exhausting server resources.',
          'A hard 30-second watchdog timer monitors every execution. If a build script, test runner, or lint command hangs or enters an infinite loop, the container is killed automatically and CodeAudit reports the logs gathered up to that point.'
        ]
      }
    ],
    detailsList: [
      { label: 'Runtime environment', value: 'Docker / runc ephemeral containers' },
      { label: 'Network policy', value: '--network=none (strict loopback isolation)' },
      { label: 'Memory ceiling', value: '512MB hard limit via cgroups' },
      { label: 'Timeout limit', value: '30 seconds hard watchdog limit' }
    ]
  },
  {
    slug: 'ai-static-analysis',
    number: '04',
    title: 'Results are analyzed by an AI model',
    lead: 'Sandbox logs, code diffs, and AST findings are evaluated by Gemini to identify issues and summarize changes.',
    sections: [
      {
        heading: 'How analysis is performed',
        paragraphs: [
          'CodeAudit combines raw git diffs, sandbox test outputs, and extracted file paths into a structured prompt for Gemini 3.6 Flash. The model is configured with low temperature (0.1) to ensure consistent, deterministic findings.',
          'Large diffs are budgeted to fit within token limits, prioritizing changed function signatures, modified entrypoints, and affected logic over whitespace or vendor files.',
          'Findings are categorized into notices, warnings, and critical issues. Each finding includes the file name, line reference, and a short explanation of the problem.'
        ]
      },
      {
        heading: 'Timeout guardrails and health scoring',
        paragraphs: [
          'Every model call is protected by a 35-second hard timeout. If an API call fails or stalls, the backend catches the error cleanly and presents an inline retry state instead of hanging the interface.',
          'A normalized 0–100 code health score is calculated by combining detected flaws, cyclomatic complexity changes, and sandbox exit codes.'
        ]
      }
    ],
    detailsList: [
      { label: 'Evaluation model', value: 'Gemini 3.6 Flash (temperature 0.1)' },
      { label: 'Execution timeout', value: '35 seconds hard timeout guard' },
      { label: 'Output structure', value: 'Summary, categorized findings, and health score (0–100)' },
      { label: 'Failure recovery', value: 'Inline error notification with instant retry option' }
    ]
  },
  {
    slug: 'conversational-review',
    number: '05',
    title: 'You can ask questions about the repo through chat',
    lead: 'A chat interface lets you ask questions about the codebase, explore file relationships, and check health findings.',
    sections: [
      {
        heading: 'Grounded repository context',
        paragraphs: [
          'The chatbot has access to the repository’s verified file tree, the latest commit information, and past analysis reports. Because answers are grounded in actual files, the assistant avoids hallucinating nonexistent functions or directories.',
          'When you ask about repository structure or entrypoints, the assistant can render an interactive file tree directly in the conversation with clickable directories and files.'
        ]
      },
      {
        heading: 'Real-time streaming and session controls',
        paragraphs: [
          'Messages stream in real time over WebSocket using Socket.io. If a response ever stalls, a client-side safety timer detects the delay and provides an inline retry button so you never get stuck on a thinking indicator.',
          'The chat header displays actual token usage for the session and a query counter. You can download the complete conversation transcript as markdown or clear the session at any time.'
        ]
      }
    ],
    detailsList: [
      { label: 'Communication protocol', value: 'Socket.io WebSocket with HTTP fallback' },
      { label: 'Context grounding', value: 'Verified file tree, commit metadata, and AST findings' },
      { label: 'Interactive elements', value: 'Clickable file tree viewer and suggestion chips' },
      { label: 'Session actions', value: 'Export transcript as markdown, clear session, token counter' }
    ]
  }
];

export const HowItWorksDetail = () => {
  const { slug } = useParams();

  // Normalize slug to handle aliases like ai-analysis -> ai-static-analysis
  const normalizedSlug = slug === 'ai-analysis' ? 'ai-static-analysis' : slug;
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.slug === normalizedSlug);
  const currentStep = currentIndex !== -1 ? PIPELINE_STEPS[currentIndex] : PIPELINE_STEPS[0];

  const prevStep = currentIndex > 0 ? PIPELINE_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < PIPELINE_STEPS.length - 1 ? PIPELINE_STEPS[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#EDEDF0] font-sans antialiased selection:bg-[#2563eb] selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 w-full bg-[#0A0A0F]/95 backdrop-blur-md border-b border-[#1E1E2A]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <img
              alt="CodeAudit Logo"
              className="w-6 h-6 object-contain"
              src="/favicon.png"
            />
            <span className="font-semibold text-[15px] tracking-tight text-[#EDEDF0]">CodeAudit</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-[#888896]">
            <Link to="/" className="hover:text-[#EDEDF0] transition-colors">
              ← Back to home
            </Link>
            <Link
              to="/repos"
              className="px-2.5 py-1 rounded bg-[#111118] border border-[#1E1E2A] text-[#EDEDF0] hover:border-[#2563eb]/40 transition-colors"
            >
              Repositories
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Step Navigation Bar */}
        <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2 scrollbar-none border-b border-[#1E1E2A] pb-4">
          {PIPELINE_STEPS.map((step) => {
            const isActive = step.slug === currentStep.slug;
            return (
              <Link
                key={step.slug}
                to={`/how-it-works/${step.slug}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#2563eb] text-white font-medium'
                    : 'text-[#888896] hover:text-[#EDEDF0] hover:bg-[#111118]'
                }`}
              >
                <span>{step.number}</span>
                <span className="truncate max-w-[130px] sm:max-w-none">{step.title}</span>
              </Link>
            );
          })}
        </div>

        {/* Step Header */}
        <div className="mb-10">
          <div className="text-base sm:text-lg font-semibold text-[#2563eb] mb-2">
            Step {currentStep.number}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#EDEDF0]">
            {currentStep.title}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-[#888896] leading-relaxed max-w-2xl">
            {currentStep.lead}
          </p>
        </div>

        {/* Step Explanatory Sections */}
        <div className="space-y-8 mb-12">
          {currentStep.sections.map((sec, idx) => (
            <section key={idx} className="space-y-3">
              <h2 className="text-base sm:text-lg font-semibold text-[#EDEDF0]">
                {sec.heading}
              </h2>
              <div className="space-y-3 max-w-2xl">
                {sec.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="text-sm sm:text-base text-[#888896] leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Technical Constraints / Parameters List */}
        <section className="mb-12 pt-8 border-t border-[#1E1E2A]">
          <h2 className="text-base sm:text-lg font-semibold text-[#EDEDF0] mb-4">
            Key details and limits
          </h2>
          <div className="rounded border border-[#1E1E2A] bg-[#111118] divide-y divide-[#1E1E2A] max-w-2xl">
            {currentStep.detailsList.map((item, idx) => (
              <div key={idx} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                <span className="text-[#888896]">{item.label}</span>
                <span className="font-mono text-xs text-[#EDEDF0]">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Step Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-[#1E1E2A] text-xs sm:text-sm">
          {prevStep ? (
            <Link
              to={`/how-it-works/${prevStep.slug}`}
              className="text-[#888896] hover:text-[#EDEDF0] transition-colors"
            >
              ← Step {prevStep.number}: {prevStep.title}
            </Link>
          ) : (
            <Link
              to="/"
              className="text-[#888896] hover:text-[#EDEDF0] transition-colors"
            >
              ← Back to home
            </Link>
          )}

          {nextStep ? (
            <Link
              to={`/how-it-works/${nextStep.slug}`}
              className="text-[#2563eb] hover:underline font-medium transition-colors"
            >
              Step {nextStep.number}: {nextStep.title} →
            </Link>
          ) : (
            <Link
              to="/"
              className="text-[#2563eb] hover:underline font-medium transition-colors"
            >
              Back to home →
            </Link>
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full py-8 text-center border-t border-[#1E1E2A] text-xs text-[#888896]">
        <div className="font-medium text-sm text-[#EDEDF0]">CodeAudit</div>
        <div className="mt-1">MIT License</div>
      </footer>
    </div>
  );
};
