import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';

// Simple rich-text formatter for structured LLM responses
const RichBotContent = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="flex flex-col gap-2 font-body-sm text-xs leading-relaxed text-on-surface select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Helper to clean heading: remove outer asterisks and trailing repo names
        const cleanHeading = (title) => {
          let t = title.replace(/^\*\*(.*?)\*\*$/, '$1').trim();
          t = t.replace(/\s+(?:of|for|in)\s+([a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+|[a-zA-Z0-9_\-\.]+)(\s|$)/i, '').trim();
          return t;
        };

        // Markdown headings
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-headline-sm text-xs font-semibold text-primary pt-1">
              {cleanHeading(trimmed.replace('### ', ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-headline-sm text-sm font-semibold text-on-surface pt-1 border-b border-outline-variant/20 pb-1">
              {cleanHeading(trimmed.replace('## ', ''))}
            </h3>
          );
        }

        // Standalone bold title line e.g. **Possible Fixes** or **Overview**
        if (idx === 0 && /^\*\*[A-Za-z0-9\s\-_&/:]+\*\*$/.test(trimmed)) {
          return (
            <h4 key={idx} className="font-headline-sm text-xs font-semibold text-primary pt-1">
              {cleanHeading(trimmed.slice(2, -2))}
            </h4>
          );
        }

        // Bullet list item
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[•\-\*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-primary mt-0.5">•</span>
              <div className="flex-1">{parseInlineFormattedText(itemText)}</div>
            </div>
          );
        }

        // Standard line
        return <div key={idx}>{parseInlineFormattedText(line)}</div>;
      })}
    </div>
  );
};

// Parses inline bold labels like **Structure:** and inline `code`
function parseInlineFormattedText(text) {
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-on-surface">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-code-sm text-[11px] text-primary">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Interactive File Tree View Component
const InteractiveTreeView = ({ tree = [], onSelectNode }) => {
  const [expandedNodes, setExpandedNodes] = useState({ 0: true, 1: true });
  const [activeFileDesc, setActiveFileDesc] = useState(null);

  const toggleNode = (nodePath) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodePath]: !prev[nodePath],
    }));
  };

  const renderNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isDir = node.type === 'dir' || (node.children && node.children.length > 0);
      const isExpanded = expandedNodes[node.path];

      return (
        <div key={node.path} className="flex flex-col select-none">
          <div
            onClick={() => {
              if (isDir) {
                toggleNode(node.path);
              } else {
                setActiveFileDesc(node);
                if (onSelectNode) onSelectNode(node.path);
              }
            }}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            className={`h-7 flex items-center gap-2 text-xs rounded hover:bg-surface-container cursor-pointer transition-colors ${
              activeFileDesc?.path === node.path ? 'bg-surface-container text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] text-outline">
              {isDir ? (isExpanded ? 'folder_open' : 'folder') : 'description'}
            </span>
            <span className="font-code-sm text-xs truncate">{node.name}</span>
          </div>

          {isDir && isExpanded && node.children && (
            <div className="flex flex-col border-l border-outline-variant/30 ml-3 pl-1 transition-all duration-150 ease-out">
              {renderNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface-container-low border border-outline-variant/30 rounded">
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
        <div className="flex items-center gap-1.5 font-body-sm text-xs text-outline font-medium">
          <span className="material-symbols-outlined text-[16px] text-primary">account_tree</span>
          <span>Repository structure</span>
        </div>
        <span className="font-body-sm text-[11px] text-outline">Interactive tree</span>
      </div>

      <div className="max-h-56 overflow-y-auto font-code-sm text-xs pr-1">
        {tree.length > 0 ? renderNodes(tree) : (
          <div className="p-4 text-center text-outline text-xs">Loading tree structure...</div>
        )}
      </div>

      {activeFileDesc && (
        <div className="mt-1 p-2.5 rounded bg-surface-container border border-outline-variant/30 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-code-sm text-[11px] text-primary font-medium truncate">
              {activeFileDesc.path}
            </span>
            <span className="font-body-sm text-[10px] text-outline">Static analysis target</span>
          </div>
          <p className="font-body-sm text-xs text-on-surface">
            {activeFileDesc.purpose || 'Source module tracked in CodeAudit static analysis graph.'}
          </p>
        </div>
      )}
    </div>
  );
};

export const RepoChatbot = ({
  repoId,
  analysisId,
  repoName = 'Repository',
  prNumber = null,
  isFullPage = false,
}) => {
  const { socket } = useSocket();

  // Resize & Persistence State
  const defaultDimensions = { width: 420, height: 560 };
  const [dimensions, setDimensions] = useState(() => {
    try {
      const saved = localStorage.getItem('codeaudit_chat_dimensions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return defaultDimensions;
  });

  const [minimized, setMinimized] = useState(false);
  const [closed, setClosed] = useState(false);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('detailed'); // 'quick' vs 'detailed'
  const [showTreeModal, setShowTreeModal] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [repoMeta, setRepoMeta] = useState({
    stars: 0,
    forks: 0,
    description: 'Repository registered in CodeAudit workspace',
  });

  const [sessionStats, setSessionStats] = useState({
    tokensUsed: 0,
    tokenLimit: 200000,
    queriesUsed: 0,
    queryLimit: 50,
  });

  const [mentionQuery, setMentionQuery] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [streaming, setStreaming] = useState(false);

  const [messages, setMessages] = useState([]);

  const threadRef = useRef(null);
  const resizeRef = useRef({ isResizing: false, startX: 0, startY: 0, startWidth: 0, startHeight: 0 });
  const timeoutRef = useRef(null);
  const lastQueryRef = useRef('');

  // Fetch real repo metadata & file tree for real stats & @-mentions
  useEffect(() => {
    if (!repoId) return;

    const fetchMeta = async () => {
      try {
        const res = await axios.get(`/api/repos/${repoId}`);
        if (res.data?.repo) {
          setRepoMeta({
            stars: res.data.repo.stars || 0,
            forks: res.data.repo.forks || 0,
            description: res.data.repo.description || `${res.data.repo.owner}/${res.data.repo.name} workspace`,
          });
        }
      } catch (e) {}
    };

    fetchMeta();

    if (socket) {
      socket.emit('chat:get_tree', { repoId, analysisId });
    }
  }, [repoId, socket]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Socket listener with error and timeout handling
  useEffect(() => {
    if (!socket) return;

    let currentBotMsg = '';

    const handleChunk = (data) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setStreaming(false);
        }, 30000);
      }
      currentBotMsg += data.chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: currentBotMsg },
          ];
        } else {
          return [
            ...prev,
            {
              id: 'stream_' + Date.now(),
              role: 'assistant',
              content: currentBotMsg,
              streaming: true,
            },
          ];
        }
      });
    };

    const handleEnd = (data) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setStreaming(false);
      if (data.sessionStats) {
        setSessionStats((prev) => ({ ...prev, ...data.sessionStats }));
      }
      if (data.treeData) {
        setTreeData(data.treeData);
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: data.fullReply || last.content,
              telemetry: data.telemetry || null,
              treeData: data.treeData || null,
              streaming: false,
            },
          ];
        }
        return prev;
      });
    };

    const handleTreeData = (data) => {
      if (data && data.tree) {
        setTreeData(data.tree);
        // Extract flat file list for mentions
        const extractFiles = (nodes) => {
          let list = [];
          nodes.forEach((n) => {
            if (n.type === 'file') list.push(n.path);
            if (n.children) list = list.concat(extractFiles(n.children));
          });
          return list;
        };
        setFileList(extractFiles(data.tree));
      }
    };

    const handleError = (data) => {
      console.warn('[RepoChatbot] Received chat:error:', data);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setStreaming(false);
      const errMsg = data?.message || 'Something went wrong generating a response — try again';
      const failedQ = data?.query || lastQueryRef.current;
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          isError: true,
          content: errMsg,
          retryQuery: failedQ,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    socket.on('chat:stream_chunk', handleChunk);
    socket.on('chat:stream_end', handleEnd);
    socket.on('chat:tree_data', handleTreeData);
    socket.on('chat:error', handleError);

    return () => {
      socket.off('chat:stream_chunk', handleChunk);
      socket.off('chat:stream_end', handleEnd);
      socket.off('chat:tree_data', handleTreeData);
      socket.off('chat:error', handleError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [socket]);

  // Resizing mouse events
  const startResize = (e, direction = 'both') => {
    e.preventDefault();
    resizeRef.current = {
      isResizing: true,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
    };

    const handleMouseMove = (moveEvent) => {
      if (!resizeRef.current.isResizing) return;
      const deltaX = resizeRef.current.startX - moveEvent.clientX;
      const deltaY = resizeRef.current.startY - moveEvent.clientY;

      const newWidth = Math.max(340, Math.min(window.innerWidth * 0.92, resizeRef.current.startWidth + deltaX));
      const newHeight = Math.max(440, Math.min(window.innerHeight * 0.9, resizeRef.current.startHeight + deltaY));

      const updated = { width: Math.round(newWidth), height: Math.round(newHeight) };
      setDimensions(updated);
      try {
        localStorage.setItem('codeaudit_chat_dimensions', JSON.stringify(updated));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      resizeRef.current.isResizing = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSend = (e, explicitTree = false, overrideQuery = null) => {
    if (e) e.preventDefault();
    const q = overrideQuery !== null ? overrideQuery.trim() : input.trim();
    if (!q && !explicitTree) return;

    lastQueryRef.current = q;

    // Detect tagged files from query (@path/to/file)
    const taggedMatches = q.match(/@([^\s]+)/g) || [];
    const taggedFiles = taggedMatches.map((t) => t.replace('@', ''));

    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        id: 'user_' + Date.now(),
        role: 'user',
        content: q || 'Show interactive repository structure',
        taggedFiles,
        timestamp: new Date().toISOString(),
      },
    ]);
    if (overrideQuery === null) {
      setInput('');
    }
    setMentionQuery(null);
    setStreaming(true);

    // Hard client-side 35s fallback timer
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      console.warn('[RepoChatbot] Client timeout fired after 35s');
      setStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: 'timeout_' + Date.now(),
          role: 'assistant',
          isError: true,
          content: 'Something went wrong generating a response — try again',
          retryQuery: q,
          timestamp: new Date().toISOString(),
        },
      ]);
    }, 35000);

    if (socket && socket.connected) {
      socket.emit('chat:message', {
        sessionId: `session_${repoId || 'default'}`,
        query: q || 'Provide an overview and interactive structure tree of this repository',
        repoId,
        analysisId,
        mode,
        taggedFiles,
        requestTree: explicitTree,
      });
    } else {
      setTimeout(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setMessages((prev) => [
          ...prev,
          {
            id: 'err_' + Date.now(),
            role: 'assistant',
            isError: true,
            content: 'Real-time daemon connection offline. Re-establishing socket link...',
            retryQuery: q,
          },
        ]);
        setStreaming(false);
      }, 400);
    }
  };

  const handleRetry = (queryToRetry) => {
    handleSend(null, false, queryToRetry);
  };

  const handleClearSession = () => {
    if (socket) {
      socket.emit('chat:clear', { sessionId: `session_${repoId || 'default'}` });
    }
    setMessages([
      {
        id: 'cleared_' + Date.now(),
        role: 'assistant',
        content: `Session history cleared. Ready for new technical queries on **${repoName}**.`,
        telemetry: null,
      },
    ]);
    setSessionStats((prev) => ({ ...prev, tokensUsed: 0, queriesUsed: 0 }));
  };

  const handleExportConversation = () => {
    const transcript = messages
      .map(
        (m) =>
          `[${m.role.toUpperCase()}] ${m.timestamp || ''}\n${m.content}\n` +
          (m.telemetry
            ? `Telemetry: Context: ${m.telemetry.contextBuildMs}ms | Generation: ${m.telemetry.generationMs}ms | Tokens: ${m.telemetry.totalTokens}\n`
            : '')
      )
      .join('\n---\n\n');

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codeaudit-chat-${repoName.replace('/', '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Mention helper
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1 && atIndex >= val.length - 20) {
      setMentionQuery(val.substring(atIndex + 1));
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (filePath) => {
    const atIndex = input.lastIndexOf('@');
    const prefix = input.substring(0, atIndex);
    setInput(`${prefix}@${filePath} `);
    setMentionQuery(null);
  };

  const filteredMentions = fileList
    .filter((f) => (mentionQuery ? f.toLowerCase().includes(mentionQuery.toLowerCase()) : true))
    .slice(0, 5);

  if (closed && !isFullPage) {
    return (
      <button
        onClick={() => setClosed(false)}
        className="fixed bottom-5 right-5 h-11 px-4 bg-surface-container border border-outline-variant/50 rounded-full shadow-lg flex items-center gap-2.5 text-on-surface hover:border-primary-container z-50 transition-colors group"
      >
        <div className="w-6 h-6 rounded-full border border-primary-container/80 flex items-center justify-center bg-primary-container/10">
          <span className="material-symbols-outlined text-[15px] text-primary">smart_toy</span>
        </div>
        <span className="font-body-sm text-xs font-medium">Repo-aware assistant</span>
        {sessionStats.queriesUsed > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[10px] font-code-sm">
            {sessionStats.queriesUsed}
          </span>
        )}
      </button>
    );
  }

  const quickPrompts = [
    'Show repository structure',
    'What does this project do?',
    'Explain main entrypoint',
  ];

  // Full-page view layout
  if (isFullPage) {
    return (
      <div className="w-full flex-1 flex flex-col min-h-0 bg-surface-container-lowest font-body-md text-on-surface select-text overflow-hidden justify-between">
        {/* Message Thread */}
        <div
          ref={threadRef}
          className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 select-text bg-surface-container-lowest min-h-0"
        >
          {messages.map((msg) => (
            <div key={msg.id || msg.timestamp} className="flex flex-col gap-1.5 max-w-4xl w-full mx-auto">
              {msg.role === 'user' ? (
                /* User Message: Right-Aligned, Blue Bubble */
                <div className="flex items-start justify-end gap-2 max-w-[85%] self-end">
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-primary text-on-primary font-body-sm text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : msg.isError ? (
                /* Inline Error Card with Retry Button */
                <div className="flex items-start gap-2.5 max-w-[95%] self-start w-full">
                  <div className="w-6 h-6 rounded-full border border-tertiary/60 bg-surface-container flex items-center justify-center shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[14px] text-tertiary">error</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="p-3.5 rounded bg-surface-container border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <span className="text-on-surface font-body-sm">{msg.content}</span>
                      {msg.retryQuery && (
                        <button
                          onClick={() => handleRetry(msg.retryQuery)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-on-primary font-body-sm text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-[14px]">refresh</span>
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Bot Message: Left-Aligned, Clean Flat Card */
                <div className="flex items-start gap-2.5 max-w-[95%] self-start w-full">
                  <div className="w-6 h-6 rounded-full border border-primary/50 bg-surface-container flex items-center justify-center shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[13px] text-primary">smart_toy</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <div className="relative p-4 rounded bg-surface-container border border-outline-variant/30 flex flex-col gap-2">
                      {/* Copy to Clipboard Icon */}
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="absolute top-3 right-3 w-6 h-6 rounded hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                        title="Copy response"
                        aria-label="Copy response to clipboard"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copiedId === msg.id ? 'check' : 'content_copy'}
                        </span>
                      </button>

                      <RichBotContent content={msg.content} />

                      {/* Interactive Tree View rendered if treeData exists */}
                      {msg.treeData && (
                        <div className="mt-3">
                          <InteractiveTreeView tree={msg.treeData} />
                        </div>
                      )}
                    </div>

                    {/* Technical Generation Metadata Footer */}
                    {msg.telemetry && (
                      <div className="px-1 font-code-sm text-[10px] text-outline flex items-center gap-1.5 select-none">
                        <span>Repo context</span>
                        {msg.telemetry.totalMs && (
                          <>
                            <span>·</span>
                            <span>{msg.telemetry.totalMs}ms</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {streaming && (
            <div className="flex items-center gap-2 text-primary font-code-sm text-xs pl-8 max-w-4xl mx-auto w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span>Thinking and formulating response...</span>
            </div>
          )}
        </div>

        {/* Explicit Tree Overlay (if toggled via tree button) */}
        {showTreeModal && (
          <div className="p-4 bg-surface-container border-t border-outline-variant/30 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between pb-2">
              <span className="font-headline-sm text-xs font-semibold">Repository structure</span>
              <button
                onClick={() => setShowTreeModal(false)}
                className="w-5 h-5 rounded hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface"
                aria-label="Close file tree"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
            <InteractiveTreeView
              tree={treeData}
              onSelectNode={(filePath) => {
                setInput((prev) => `${prev} @${filePath} `);
                setShowTreeModal(false);
              }}
            />
          </div>
        )}

        {/* Mention Tagging Dropdown */}
        {mentionQuery !== null && filteredMentions.length > 0 && (
          <div className="mx-6 mb-1 p-1 bg-surface-container-high border border-outline-variant/40 rounded shadow-lg flex flex-col gap-0.5 max-w-4xl mx-auto w-full">
            <span className="px-2 py-1 font-label-sm text-[10px] text-outline font-medium">
              Scope question to file:
            </span>
            {filteredMentions.map((file) => (
              <button
                key={file}
                onClick={() => insertMention(file)}
                className="px-2 py-1 text-left font-code-sm text-xs text-on-surface hover:bg-surface-container rounded truncate transition-colors"
              >
                @{file}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-surface border-t border-outline-variant/30 shrink-0 select-none mt-auto">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-2.5">
            {/* Suggested Question Chips positioned directly above input */}
            <div className="flex items-center gap-2 overflow-x-auto select-none pb-0.5">
              {quickPrompts.map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => handleSend(null, promptText.includes('structure'), promptText)}
                  className="px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/30 hover:border-primary/40 text-on-surface hover:text-primary text-xs font-body-sm transition-colors whitespace-nowrap shrink-0"
                >
                  {promptText}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => handleSend(e, false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedText = e.dataTransfer.getData('text/plain');
                if (droppedText) {
                  setInput((prev) => `${prev} @${droppedText} `);
                }
              }}
              className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 focus-within:border-primary transition-colors w-full"
            >
              {/* Tree Trigger */}
              <button
                type="button"
                onClick={() => {
                  if (treeData.length === 0 && socket) {
                    socket.emit('chat:get_tree', { repoId, analysisId });
                  }
                  setShowTreeModal(!showTreeModal);
                }}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors shrink-0 ${
                  showTreeModal ? 'text-primary bg-surface-container' : 'text-outline hover:text-on-surface'
                }`}
                title="Toggle file hierarchy"
                aria-label="Toggle file hierarchy"
              >
                <span className="material-symbols-outlined text-[17px]">account_tree</span>
              </button>

              {/* Main Input Field */}
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask anything about this repo's code or structure (use @ to tag a file)..."
                className="flex-1 min-w-0 bg-transparent text-sm text-on-surface placeholder:text-outline font-body-sm focus:outline-none"
              />

              {/* Primary Send Action */}
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="w-7 h-7 rounded bg-primary hover:bg-primary/90 disabled:opacity-30 text-on-primary flex items-center justify-center transition-colors shrink-0"
                title="Send query"
                aria-label="Send query"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Floating panel layout
  return (
    <div
      style={{
        width: minimized ? '360px' : `${dimensions.width}px`,
        height: minimized ? '48px' : `${dimensions.height}px`,
      }}
      className="fixed bottom-5 right-5 bg-surface-container border border-outline-variant/40 rounded flex flex-col z-50 shadow-2xl overflow-hidden font-body-md text-on-surface"
      id="codeaudit-chatbot-panel"
    >
      {/* Draggable Resize Handle on Top-Left Corner */}
      {!minimized && (
        <div
          onMouseDown={(e) => startResize(e, 'both')}
          title="Drag to resize panel"
          className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50 hover:bg-primary/20 flex items-center justify-center select-none"
        >
          <div className="w-1.5 h-1.5 border-t-2 border-l-2 border-outline-variant"></div>
        </div>
      )}

      {/* Header Bar: Minimalist with essential repo context and controls only */}
      <div className="h-11 px-3 bg-surface-container-high border-b border-outline-variant/30 flex items-center justify-between shrink-0 select-none">
        {/* Left: Context / Identity */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-full border border-primary/50 bg-surface-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[13px] text-primary">smart_toy</span>
          </div>
          <span className="font-headline-sm text-xs font-semibold text-on-surface truncate">
            {repoName}
          </span>
          <span className="text-[11px] text-outline font-body-sm shrink-0">· Assistant</span>
        </div>

        {/* Right Side: Collapse and Close controls only */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMinimized(!minimized)}
            className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"
            title={minimized ? 'Expand' : 'Collapse'}
            aria-label={minimized ? 'Expand chatbot' : 'Collapse chatbot'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {minimized ? 'unfold_more' : 'remove'}
            </span>
          </button>
          <button
            onClick={() => setClosed(true)}
            className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"
            title="Close"
            aria-label="Close chatbot"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      {!minimized && (
        <>
          {/* Message Thread */}
          <div
            ref={threadRef}
            className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 select-text bg-surface-container-lowest"
          >
            {messages.map((msg) => (
              <div key={msg.id || msg.timestamp} className="flex flex-col gap-1.5">
                {msg.role === 'user' ? (
                  /* User Message: Right-Aligned, Blue Bubble */
                  <div className="flex items-start justify-end gap-2 max-w-[85%] self-end">
                    <div className="px-3.5 py-2 rounded-2xl rounded-tr-sm bg-primary text-on-primary font-body-sm text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ) : msg.isError ? (
                  /* Inline Error Card with Retry Button */
                  <div className="flex items-start gap-2.5 max-w-[95%] self-start w-full">
                    <div className="w-5 h-5 rounded-full border border-tertiary/60 bg-surface-container flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-[13px] text-tertiary">error</span>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <div className="p-3 rounded bg-surface-container border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <span className="text-on-surface font-body-sm">{msg.content}</span>
                        {msg.retryQuery && (
                          <button
                            onClick={() => handleRetry(msg.retryQuery)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-on-primary font-body-sm text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                          >
                            <span className="material-symbols-outlined text-[13px]">refresh</span>
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Bot Message: Left-Aligned, Clean Flat Card */
                  <div className="flex items-start gap-2.5 max-w-[95%] self-start">
                    <div className="w-5 h-5 rounded-full border border-primary/50 bg-surface-container flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-[12px] text-primary">smart_toy</span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <div className="relative p-3.5 rounded bg-surface-container border border-outline-variant/30 flex flex-col gap-2">
                        {/* Copy to Clipboard Icon */}
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="absolute top-2.5 right-2.5 w-6 h-6 rounded hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                          title="Copy response"
                          aria-label="Copy response to clipboard"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedId === msg.id ? 'check' : 'content_copy'}
                          </span>
                        </button>

                        <RichBotContent content={msg.content} />

                        {/* Interactive Tree View rendered if treeData exists */}
                        {msg.treeData && (
                          <div className="mt-2">
                            <InteractiveTreeView tree={msg.treeData} />
                          </div>
                        )}
                      </div>

                      {/* Technical Generation Metadata Footer */}
                      {msg.telemetry && (
                        <div className="px-1 font-code-sm text-[10px] text-outline flex items-center gap-1.5 select-none">
                          <span>Repo context</span>
                          {msg.telemetry.totalMs && (
                            <>
                              <span>·</span>
                              <span>{msg.telemetry.totalMs}ms</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {streaming && (
              <div className="flex items-center gap-2 text-primary font-code-sm text-xs pl-7">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span>Generating technical analysis...</span>
              </div>
            )}
          </div>

          {/* Explicit Tree Overlay (if toggled via tree button) */}
          {showTreeModal && (
            <div className="p-3 bg-surface-container border-t border-outline-variant/30">
              <div className="flex items-center justify-between pb-2">
                <span className="font-headline-sm text-xs font-semibold">Repository structure</span>
                <button
                  onClick={() => setShowTreeModal(false)}
                  className="w-5 h-5 rounded hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface"
                  aria-label="Close file tree"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              </div>
              <InteractiveTreeView
                tree={treeData}
                onSelectNode={(filePath) => {
                  setInput((prev) => `${prev} @${filePath} `);
                  setShowTreeModal(false);
                }}
              />
            </div>
          )}

          {/* Mention Tagging Dropdown */}
          {mentionQuery !== null && filteredMentions.length > 0 && (
            <div className="mx-3 mb-1 p-1 bg-surface-container-high border border-outline-variant/40 rounded shadow-lg flex flex-col gap-0.5">
              <span className="px-2 py-1 font-label-sm text-[10px] text-outline font-medium">
                Scope question to file:
              </span>
              {filteredMentions.map((file) => (
                <button
                  key={file}
                  onClick={() => insertMention(file)}
                  className="px-2 py-1 text-left font-code-sm text-xs text-on-surface hover:bg-surface-container rounded truncate transition-colors"
                >
                  @{file}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar: Clean, focused, consistent spacing */}
          <div className="p-3 bg-surface-container-high border-t border-outline-variant/30 shrink-0 select-none">
            {/* Suggested Question Chips positioned directly above input */}
            <div className="flex items-center gap-1.5 overflow-x-auto select-none pb-2 scrollbar-none">
              {quickPrompts.map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => handleSend(null, promptText.includes('structure'), promptText)}
                  className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 hover:border-primary/40 text-on-surface hover:text-primary text-[11px] font-body-sm transition-colors whitespace-nowrap shrink-0"
                >
                  {promptText}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => handleSend(e, false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedText = e.dataTransfer.getData('text/plain');
                if (droppedText) {
                  setInput((prev) => `${prev} @${droppedText} `);
                }
              }}
              className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/40 rounded px-2.5 py-1.5 focus-within:border-primary transition-colors"
            >
              {/* Unobtrusive Tree Trigger */}
              <button
                type="button"
                onClick={() => {
                  if (treeData.length === 0 && socket) {
                    socket.emit('chat:get_tree', { repoId, analysisId });
                  }
                  setShowTreeModal(!showTreeModal);
                }}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${
                  showTreeModal ? 'text-primary bg-surface-container' : 'text-outline hover:text-on-surface'
                }`}
                title="Toggle file hierarchy"
                aria-label="Toggle file hierarchy"
              >
                <span className="material-symbols-outlined text-[15px]">account_tree</span>
              </button>

              {/* Main Input Field */}
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about this repo's structure, code, or entrypoint..."
                className="flex-1 min-w-0 bg-transparent text-xs text-on-surface placeholder:text-outline font-body-sm focus:outline-none"
              />

              {/* Primary Send Action */}
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="w-6 h-6 rounded bg-primary hover:bg-primary/90 disabled:opacity-30 text-on-primary flex items-center justify-center transition-colors shrink-0"
                title="Send query"
                aria-label="Send query"
              >
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
