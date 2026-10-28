import React, { useState, useEffect } from 'react';
import {
  Home,
  FolderTree,
  Sparkles,
  GitPullRequest,
  Layers,
  Settings,
  Search,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  LogOut,
  User,
  Compass,
  Code2,
  X,
  FileCode,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';


export default function SidebarLayout({
  activeTab,
  setActiveTab,
  user,
  repos = [],
  selectedRepo,
  setSelectedRepo,
  onSyncRepos,
  syncing,
  onDemoLogin,
  onLogout,
  children
}) {
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowFeedbackModal(false);
        setShowRepoDropdown(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quick navigation items in the top navbar matching Crimson Void spec
  const navItems = [
    { id: 'home', label: 'Overview', icon: Home },
    { id: 'repos', label: 'Repositories', icon: Layers },
    { id: 'comprehension', label: 'Codebase Q&A', icon: Sparkles },
    { id: 'pr-review', label: 'Pull Requests', icon: GitPullRequest },
    { id: 'tree', label: 'Architecture', icon: FolderTree },
    { id: 'landing', label: 'Features', icon: Compass },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  // Search results
  const searchCommands = [
    { type: 'command', title: 'Interactive Change Flow Map', desc: 'Trace incoming web requests to SQL tables', tab: 'home' },
    { type: 'file', title: 'BillingController.java', desc: 'REST Controller &bull; Needs @PreAuthorize check', tab: 'pr-review' },
    { type: 'file', title: 'ClinicService.java', desc: 'Core Service Coordinator &bull; All paths clear', tab: 'tree' },
    { type: 'file', title: 'InvoiceRepository.java', desc: 'PostgreSQL persistence &bull; Non-breaking schema', tab: 'tree' },
    { type: 'command', title: 'Ask Copilot: Explain Architecture', desc: 'Plain English system explanation', tab: 'comprehension' },
    { type: 'command', title: 'PR #142: Add user login security check', desc: '1 small fix required before merge', tab: 'pr-review' },
    { type: 'command', title: 'Sync GitHub Repositories', desc: 'Trigger full webhook and commit scan', action: onSyncRepos }
  ].filter((item) =>
    searchQuery === ''
      ? true
      : item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-main)', color: '#F5F5F5' }}>
      {/* =========================================================================
          TOP NAVBAR (Crimson Void Navigation)
          ========================================================================= */}
      <header style={{
        height: '62px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(8, 8, 8, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        gap: '16px'
      }}>
        {/* Left: Brand Logo matching screenshot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <div
            onClick={() => setActiveTab('home')}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ color: 'var(--accent-red)', fontWeight: 900, fontSize: '1.3rem', fontFamily: 'monospace' }}>&lt;/&gt;</span>
            <span style={{
              fontWeight: 800,
              fontSize: '1.2rem',
              letterSpacing: '-0.02em',
              color: '#FFFFFF'
            }}>
              CodeSense
            </span>
          </div>

          <div style={{ width: '1px', height: '22px', background: '#24242C' }} />

          {/* Active Repository Chip & Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRepoDropdown((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#141418',
                border: '1px solid #282830',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-red)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#282830')}
            >
              <span style={{ color: '#8A8A93' }}>📦</span>
              <span style={{ fontWeight: 600 }}>
                {selectedRepo ? selectedRepo.name : 'spring-petclinic-rest'}
              </span>
              <span style={{ color: '#55555E' }}>/</span>
              <span style={{ color: '#8A8A93' }}>⎇ main</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                color: '#34D399',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '1px 6px',
                borderRadius: '10px',
                marginLeft: '4px'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981' }} />
                Ready
              </span>
              <ChevronDown size={14} color="#8A8A93" />
            </button>

            {/* Repo Dropdown Menu */}
            <AnimatePresence>
              {showRepoDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: '42px',
                    left: 0,
                    width: '320px',
                    background: '#141418',
                    border: '1px solid #282830',
                    borderRadius: '8px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                    zIndex: 60,
                    padding: '8px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    padding: '6px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#8A8A93',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Select Repository
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {repos.length > 0 ? (
                      repos.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedRepo(r);
                            setShowRepoDropdown(false);
                          }}
                          style={{
                            padding: '7px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: selectedRepo && selectedRepo.id === r.id ? '#202028' : 'transparent',
                            color: selectedRepo && selectedRepo.id === r.id ? '#FFFFFF' : '#C4C4CC',
                            fontSize: '0.78rem',
                            fontFamily: "'JetBrains Mono', monospace"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#202028')}
                          onMouseLeave={(e) => {
                            if (!selectedRepo || selectedRepo.id !== r.id) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.fullName || r.name}
                          </span>
                          {selectedRepo && selectedRepo.id === r.id && (
                            <CheckCircle2 size={13} color="var(--accent-red)" />
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '10px', fontSize: '0.76rem', color: '#71717A' }}>
                        No repositories connected yet.
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid #202026', marginTop: '6px', paddingTop: '6px' }}>
                    <button
                      onClick={() => {
                        onSyncRepos();
                        setShowRepoDropdown(false);
                      }}
                      disabled={syncing}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: '#1A1A22',
                        border: '1px solid #2A2A35',
                        borderRadius: '5px',
                        color: '#FFFFFF',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                      {syncing ? 'Syncing GitHub...' : 'Sync GitHub Repos'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center: Main Horizontal Navigation Text Links with Crimson Indicator */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px'
        }}>
          {navItems.filter(item => item.id !== 'settings').map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  color: isActive ? '#FFFFFF' : '#A1A1AA',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  padding: '8px 4px',
                  transition: 'color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? '#FFFFFF' : '#A1A1AA')}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="navActiveUnderline"
                    style={{
                      position: 'absolute',
                      bottom: '-12px',
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'var(--accent-red)',
                      boxShadow: '0 0 10px rgba(255, 48, 63, 0.7)',
                      borderRadius: '2px'
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Search bar, Explore Platform, User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Search Input Bar (Matches screenshot with Ctrl K badge) */}
            <div
              onClick={() => setShowSearchModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#121216',
                border: '1px solid #24242C',
                borderRadius: '6px',
                padding: '6px 12px',
                width: '210px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#383844')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#24242C')}
            >
              <Search size={13} color="#71717A" />
              <span style={{ fontSize: '0.76rem', color: '#71717A', flex: 1, userSelect: 'none' }}>
                Search repository...
              </span>
              <kbd style={{
                background: '#1C1C22',
                border: '1px solid #2C2C36',
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '0.62rem',
                fontFamily: 'monospace',
                color: '#8A8A93'
              }}>
                Ctrl K
              </kbd>
            </div>

            {/* Explore Platform CTA Button matching screenshot */}
            <button
              onClick={() => setActiveTab(activeTab === 'landing' ? 'tree' : 'landing')}
              className="btn-primary"
              style={{
                background: 'var(--accent-red)',
                color: '#FFFFFF',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 14px rgba(255, 48, 48, 0.35)'
              }}
            >
              <span>{activeTab === 'landing' ? 'Explore Platform' : 'View Features'}</span>
              <ArrowRight size={13} />
            </button>

            {/* User Profile / Login matching circle with K and chevron */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowUserMenu((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#2A2A32',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-subtle)'
                }}>
                  K
                </div>
                <ChevronDown size={13} color="#8A8A93" />
              </div>
              {user ? (
                <button
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#16161B',
                    border: '1px solid #282832',
                    padding: '4px 8px 4px 5px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    color: '#FFFFFF',
                    fontSize: '0.76rem'
                  }}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                    />
                  ) : (
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--accent-red)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.72rem'
                    }}>
                      {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.username || 'User'}
                  </span>
                  <ChevronDown size={12} color="#8A8A93" />
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={onDemoLogin}
                    style={{
                      background: '#1A1A22',
                      border: '1px solid #2A2A35',
                      color: '#FFFFFF',
                      fontSize: '0.74rem',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Demo Mode
                  </button>
                  <a
                    href="http://localhost:8080/api/auth/github"
                    style={{
                      background: 'var(--accent-red)',
                      color: '#FFFFFF',
                      fontSize: '0.74rem',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Sign in with GitHub
                  </a>
                </div>
              )}

              {/* User Dropdown */}
              <AnimatePresence>
                {showUserMenu && user && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      top: '38px',
                      right: 0,
                      width: '180px',
                      background: '#141418',
                      border: '1px solid #282830',
                      borderRadius: '8px',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                      zIndex: 60,
                      padding: '6px'
                    }}
                  >
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #202026', marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF' }}>{user.username}</div>
                      <div style={{ fontSize: '0.68rem', color: '#8A8A93' }}>GitHub Connected</div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: 'transparent',
                        border: 'none',
                        color: '#C4C4CC',
                        fontSize: '0.76rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#202028')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Settings size={13} />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        onLogout();
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: 'transparent',
                        border: 'none',
                        color: '#FF6B6B',
                        fontSize: '0.76rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#202028')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ACTIVE VIEW CONTENT */}
        <main style={{ flex: 1, padding: '24px 32px 48px', width: '100%', maxWidth: '1880px', margin: '0 auto', boxSizing: 'border-box' }}>
          {children}
        </main>

      {/* =========================================================================
          GLOBAL SEARCH MODAL (Triggered by ⌘K)
          ========================================================================= */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '12vh'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                background: '#121216',
                border: '1px solid #282832',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '560px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
                overflow: 'hidden'
              }}
            >
              {/* Search Input Box */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderBottom: '1px solid #202028'
              }}>
                <Search size={18} color="var(--accent-red)" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search files, symbols, endpoints, commands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.95rem',
                    outline: 'none',
                    width: '100%'
                  }}
                />
                <button
                  onClick={() => setShowSearchModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#71717A', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Results list */}
              <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
                {searchCommands.length > 0 ? (
                  searchCommands.map((item, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ x: 3 }}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else if (item.tab) {
                          setActiveTab(item.tab);
                        }
                        setShowSearchModal(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1A1A22')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {item.type === 'file' ? (
                          <FileCode size={16} color="#38BDF8" />
                        ) : (
                          <Sparkles size={16} color="var(--accent-red)" />
                        )}
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>{item.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#8A8A93' }}>{item.desc}</div>
                        </div>
                      </div>
                      <ArrowRight size={14} color="#55555E" />
                    </motion.div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#71717A', fontSize: '0.84rem' }}>
                    No matches found for "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Footer tip */}
              <div style={{
                padding: '8px 16px',
                background: '#0B0B0E',
                borderTop: '1px solid #1E1E26',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.68rem',
                color: '#666670'
              }}>
                <span>Navigation: Tab, Tree, PRs, Comprehension</span>
                <span>ESC to close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          FEEDBACK MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                background: '#141418',
                border: '1px solid #282832',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '480px',
                padding: '24px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="var(--accent-red)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>Share Feedback</h3>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#71717A', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {feedbackSent ? (
                <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                  <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ color: '#FFFFFF', marginBottom: '6px' }}>Thank you!</h4>
                  <p style={{ fontSize: '0.8rem', color: '#8A8A93' }}>Your feedback helps make CodeSense better.</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', color: '#8A8A93', marginBottom: '12px' }}>
                    Have an idea for a feature or encountered an issue with code tracing? Let the team know!
                  </p>
                  <textarea
                    rows={4}
                    placeholder="What's on your mind?..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0B0B0E',
                      border: '1px solid #282832',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      outline: 'none',
                      resize: 'none',
                      marginBottom: '16px',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={() => setShowFeedbackModal(false)}
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setFeedbackSent(true);
                        setTimeout(() => {
                          setFeedbackSent(false);
                          setShowFeedbackModal(false);
                          setFeedbackText('');
                        }, 1800);
                      }}
                      className="btn-primary"
                      style={{ fontSize: '0.8rem', padding: '7px 16px' }}
                    >
                      Submit Feedback
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
