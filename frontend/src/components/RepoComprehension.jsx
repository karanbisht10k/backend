import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  MessageSquare,
  Plus,
  FileCode,
  CheckCircle2,
  ChevronRight,
  Hash,
  Search,
  AlertCircle,
  BookOpen,
  Code2,
  Layers,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import StructuredAiResponse from './StructuredAiResponse';

export default function RepoComprehension({ selectedRepo, initialPrompt }) {
  const [structures, setStructures] = useState([]);
  const [loadingStructures, setLoadingStructures] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileFilter, setFileFilter] = useState('');

  // Chat State
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState(initialPrompt || '');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [chatError, setChatError] = useState(null);

  const messagesEndRef = useRef(null);

  // Load structures when repo changes
  useEffect(() => {
    if (!selectedRepo) return;
    loadStructures(selectedRepo.id);
    loadSessions(selectedRepo.id);
  }, [selectedRepo]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Handle external prompt passed in
  useEffect(() => {
    if (initialPrompt) {
      setInputQuestion(initialPrompt);
    }
  }, [initialPrompt]);

  const loadStructures = async (repoId) => {
    setLoadingStructures(true);
    try {
      const data = await api.repos.structure(repoId);
      setStructures(data || []);
      if (data && data.length > 0) {
        setSelectedFile(data[0]);
      }
    } catch (err) {
      console.error('Failed to load structures', err);
    } finally {
      setLoadingStructures(false);
    }
  };

  const loadSessions = async (repoId) => {
    try {
      const list = await api.chat.listSessions(repoId);
      setSessions(list || []);
      if (list && list.length > 0) {
        selectSession(list[0].id);
      } else {
        createNewSession(repoId);
      }
    } catch (err) {
      console.error('Failed to load chat sessions', err);
    }
  };

  const createNewSession = async (repoId) => {
    try {
      const newSession = await api.chat.createSession(repoId, 'Architecture Analysis');
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (err) {
      setChatError(err.message || 'Failed to create chat session. Please make sure the repo is indexed.');
    }
  };

  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    try {
      const msgs = await api.chat.getMessages(sessionId);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleSendMessage = (textToSend) => {
    const question = textToSend || inputQuestion;
    if (!question.trim() || streaming || !activeSessionId) return;

    setInputQuestion('');
    setChatError(null);
    setStreaming(true);
    setStreamingText('');

    // Optimistically add user message
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      role: 'USER',
      content: question,
      citations: [],
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    let accumulatedTokens = '';

    api.chat.streamMessage(activeSessionId, question, {
      onToken: (token) => {
        accumulatedTokens += token;
        setStreamingText(accumulatedTokens);
      },
      onAssistantMessage: (assistantMsg) => {
        setMessages(prev => [...prev, assistantMsg]);
        setStreamingText('');
      },
      onDone: () => {
        setStreaming(false);
        setStreamingText('');
      },
      onError: (err) => {
        setChatError(err.message || 'Error streaming reply from AI engine');
        setStreaming(false);
        setStreamingText('');
      }
    });
  };

  const suggestedPrompts = [
    'How does authentication work in this repository?',
    'Where is the database connection initialized?',
    'What happens when this API endpoint is called?',
    'Which components depend on this service?'
  ];

  if (!selectedRepo) {
    return (
      <div style={{ maxWidth: '900px', margin: '48px auto', textAlign: 'center', padding: '0 24px' }}>
        <div className="glass-panel" style={{ padding: '48px' }}>
          <Code2 size={42} color="var(--accent-red)" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
            No Repository Selected
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto' }}>
            Please select an imported repository from the Repositories dashboard to browse its AST skeleton and ask grounded architecture questions.
          </p>
        </div>
      </div>
    );
  }

  const filteredStructures = structures.filter(s =>
    s.filePath.toLowerCase().includes(fileFilter.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1440px', margin: '24px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '400px 1fr', gap: '22px', height: 'calc(100vh - 125px)' }}>
      {/* LEFT COLUMN: Repository Structural AST Skeleton */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#121215' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={16} color="var(--accent-red)" />
              Codebase Skeleton &amp; AST
            </h3>
            <span className="badge badge-indexing" style={{ fontSize: '0.68rem' }}>
              {structures.length} Files
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Filter files by path or name..."
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-red)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>
        </div>

        {/* Structures List & AST Inspector Split */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* File Paths List */}
          <div style={{ height: '42%', overflowY: 'auto', borderBottom: '1px solid var(--border-subtle)', padding: '6px' }}>
            {filteredStructures.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                {loadingStructures ? 'Loading code structures...' : 'No files match filter or repository not indexed yet.'}
              </div>
            ) : (
              filteredStructures.map((s) => {
                const isSelected = selectedFile && selectedFile.filePath === s.filePath;
                return (
                  <div
                    key={s.id || s.filePath}
                    onClick={() => setSelectedFile(s)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                      background: isSelected ? 'rgba(255, 48, 48, 0.12)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--accent-red)' : '2px solid transparent',
                      marginBottom: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {s.filePath}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected File AST Details */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', background: '#0D0D10' }}>
            {selectedFile ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FileCode size={15} color="var(--accent-red)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', wordBreak: 'break-all' }}>
                    {selectedFile.filePath.split('/').pop()}
                  </span>
                </div>

                {selectedFile.packageName && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '10px' }}>
                    package {selectedFile.packageName}
                  </div>
                )}

                {/* Classes */}
                {selectedFile.classes && selectedFile.classes.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, marginBottom: '6px' }}>
                      Classes ({selectedFile.classes.length})
                    </div>
                    {selectedFile.classes.map((cls, idx) => (
                      <div key={idx} style={{ background: '#141416', border: '1px solid var(--border-subtle)', padding: '8px 10px', borderRadius: '5px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF' }}>
                          <span>{cls.name}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>L{cls.startLine}-L{cls.endLine}</span>
                        </div>
                        {cls.annotations && cls.annotations.length > 0 && (
                          <div style={{ fontSize: '0.68rem', color: '#FF7070', marginTop: '3px', fontFamily: 'monospace' }}>
                            {cls.annotations.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Methods */}
                {selectedFile.methods && selectedFile.methods.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, marginBottom: '6px' }}>
                      Methods ({selectedFile.methods.length})
                    </div>
                    {selectedFile.methods.map((method, idx) => (
                      <div key={idx} style={{ background: '#141416', border: '1px solid var(--border-subtle)', padding: '7px 9px', borderRadius: '5px', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 600, color: '#FFFFFF' }}>
                          <span>{method.name}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>L{method.startLine}-L{method.endLine}</span>
                        </div>
                        {method.signature && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {method.signature}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '30px' }}>
                Select a file above to inspect its AST declarations.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Grounded Architecture Q&A Chat */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#121215' }}>
        {/* Chat Top Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--accent-red)" />
              Architecture &amp; Codebase Copilot
            </h3>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-dim)' }}>
              Grounded responses citing actual files and line ranges from {selectedRepo.fullName}
            </span>
          </div>

          <button
            onClick={() => createNewSession(selectedRepo.id)}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 10px', gap: '5px' }}
          >
            <Plus size={13} />
            New Session
          </button>
        </div>

        {/* Chat Message Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 && !streaming ? (
            <div style={{ textAlign: 'center', margin: 'auto', maxWidth: '620px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-red-subtle)', border: '1px solid rgba(255, 48, 48, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Sparkles size={24} color="var(--accent-red)" />
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                Ask Architecture Questions Grounded in the Repository
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: '24px' }}>
                CodeSense synthesizes responses using AST structural indexing and PGVector semantic search, returning structured explanations with source citations and verified code blocks.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', textAlign: 'left' }}>
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="glass-panel"
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '8px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-red)';
                      e.currentTarget.style.background = 'rgba(255, 48, 48, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    }}
                  >
                    <span>{prompt}</span>
                    <ChevronRight size={14} color="var(--accent-red)" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isUser = msg.role === 'USER';
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: isUser ? '80%' : '92%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: '10px',
                        background: isUser ? 'var(--accent-red)' : '#161619',
                        border: isUser ? 'none' : '1px solid var(--border-subtle)',
                        color: '#FFFFFF',
                        boxShadow: isUser ? '0 2px 12px rgba(255, 48, 48, 0.25)' : 'none'
                      }}
                    >
                      {isUser ? (
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </div>
                      ) : (
                        <StructuredAiResponse
                          content={msg.content}
                          citations={msg.citations || []}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Streaming bubble */}
              {streaming && streamingText && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '10px',
                    background: '#161619',
                    border: '1px solid rgba(255, 48, 48, 0.35)',
                    color: '#FFFFFF'
                  }}>
                    <StructuredAiResponse content={streamingText} />
                    <div style={{ display: 'inline-block', width: '6px', height: '14px', background: 'var(--accent-red)', marginLeft: '4px', verticalAlign: 'middle', animation: 'pulseGlow 1s infinite' }} />
                  </div>
                </div>
              )}

              {/* Chat Error */}
              {chatError && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 48, 48, 0.12)',
                  border: '1px solid rgba(255, 48, 48, 0.35)',
                  color: '#FF6666',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  {chatError}
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)', background: '#0E0E11' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            <input
              type="text"
              placeholder={`Ask a grounded question about ${selectedRepo.name}... (e.g. Where is auth handled?)`}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              disabled={streaming}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '0.88rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-red)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />

            <button
              type="submit"
              disabled={streaming || !inputQuestion.trim()}
              className="btn-primary"
              style={{ padding: '12px 20px', fontSize: '0.88rem' }}
            >
              {streaming ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <Send size={16} />
                  Ask
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
