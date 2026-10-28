import React, { useState, useEffect } from 'react';
import SidebarLayout from './components/SidebarLayout';
import DashboardHome from './components/DashboardHome';
import LandingPage from './components/LandingPage';
import RepoDashboard from './components/RepoDashboard';
import CodeTreeVisualizer from './components/CodeTreeVisualizer';
import RepoComprehension from './components/RepoComprehension';
import PrAnalysisView from './components/PrAnalysisView';
import { api } from './api';
import { Settings, ShieldCheck, RefreshCw, Cpu, Database, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing'); // Default to landing page matching the reference screenshot
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState('');

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      // Check for OAuth callback error/success in query string
      const searchParams = new URLSearchParams(window.location.search);
      const oauthError = searchParams.get('error');
      const isLoginSuccess = searchParams.get('login') === 'success';

      if (oauthError) {
        alert(`Authentication Error: ${oauthError}`);
        window.history.replaceState({}, '', window.location.pathname);
      } else if (isLoginSuccess) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 1. Try to fetch current authenticated user
      let currentUser = null;
      try {
        currentUser = await api.auth.getMe();
        if (currentUser && currentUser.authenticated) {
          setUser(currentUser);
        }
      } catch {
        // Not authenticated yet
      }

      // 2. If user just logged in with GitHub or is authenticated, automatically sync repos
      if (isLoginSuccess || (currentUser && currentUser.authenticated)) {
        try {
          await api.repos.sync();
        } catch (syncErr) {
          console.warn('Auto sync on init skipped:', syncErr.message);
        }
      }

      // 3. Load stored repositories
      await refreshRepos();
    } catch (err) {
      console.error('App init error', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshRepos = async () => {
    try {
      const list = await api.repos.list(false);
      setRepos(list || []);
      if (list && list.length > 0 && !selectedRepo) {
        setSelectedRepo(list[0]);
      } else if (selectedRepo) {
        const updated = list.find(r => r.id === selectedRepo.id);
        if (updated) setSelectedRepo(updated);
      }
    } catch (err) {
      console.error('Failed to refresh repos', err);
    }
  };

  const handleSyncRepos = async () => {
    setSyncing(true);
    try {
      await api.repos.sync();
      await refreshRepos();
    } catch (err) {
      console.error('Failed to sync repos', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      const u = await api.auth.demoLogin();
      setUser(u);
      await api.repos.sync();
      await refreshRepos();
    } catch (err) {
      alert(`Demo login failed: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setUser(null);
      setRepos([]);
      setSelectedRepo(null);
      setActiveTab('home');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const handleSelectRepo = (repo) => {
    setSelectedRepo(repo);
  };

  return (
    <SidebarLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      repos={repos}
      selectedRepo={selectedRepo}
      setSelectedRepo={handleSelectRepo}
      onSyncRepos={handleSyncRepos}
      syncing={syncing}
      onDemoLogin={handleDemoLogin}
      onLogout={handleLogout}
    >
      {/* Animated Tab Page Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ width: '100%', minHeight: '100%' }}
        >
          {/* 1. Home / Repository Pulse & Change Radar Dashboard */}
          {activeTab === 'home' && (
            <DashboardHome
              selectedRepo={selectedRepo}
              repos={repos}
              onSelectRepo={handleSelectRepo}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onInspectPr={() => setActiveTab('pr-review')}
            />
          )}

          {/* 2. Architecture Map & Code Tree Topology */}
          {activeTab === 'tree' && (
            <CodeTreeVisualizer
              selectedRepo={selectedRepo}
              onAskQuestion={(question) => {
                setInitialQuestion(question);
                setActiveTab('comprehension');
              }}
              onInspectPr={() => setActiveTab('pr-review')}
            />
          )}

          {/* 3. Ask Your Code / Repo Comprehension AI Chat */}
          {activeTab === 'comprehension' && (
            <RepoComprehension
              selectedRepo={selectedRepo}
              initialPrompt={initialQuestion}
            />
          )}

          {/* 4. PR Reviews & Impact Propagation Graph */}
          {activeTab === 'pr-review' && (
            <PrAnalysisView
              selectedRepo={selectedRepo}
            />
          )}

          {/* 5. Connected Repositories Management */}
          {activeTab === 'repos' && (
            <RepoDashboard
              repos={repos}
              selectedRepo={selectedRepo}
              onSelectRepo={handleSelectRepo}
              onRefreshRepos={refreshRepos}
              onSelectTab={(tab) => setActiveTab(tab)}
              user={user}
            />
          )}

          {/* 6. Landing Page / Product Tour */}
          {activeTab === 'landing' && (
            <LandingPage
              onExplore={(tab) => setActiveTab(tab || 'home')}
              onSelectTab={(tab) => setActiveTab(tab)}
              user={user}
              selectedRepo={selectedRepo}
            />
          )}

          {/* 7. Settings View */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '960px', margin: '32px auto', padding: '0 24px', color: '#F5F5F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <Settings size={22} color="var(--accent-red)" />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>CodeSense Settings &amp; Configuration</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Account card */}
                <div style={{ background: '#121215', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>GitHub Integration</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Manage your GitHub OAuth token and repository webhooks for live PR change tracking.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181C', padding: '12px 16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ShieldCheck size={18} color="#10B981" />
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{user ? user.username : 'Demo User'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Scope: repo, read:user, pull_requests</div>
                      </div>
                    </div>
                    <button
                      onClick={handleSyncRepos}
                      disabled={syncing}
                      className="btn-primary"
                      style={{ fontSize: '0.78rem', padding: '6px 14px', gap: '6px' }}
                    >
                      <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>
                </div>

                {/* AI Engine & AST Analysis */}
                <div style={{ background: '#121215', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Analysis Engine &amp; Models</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Underlying intelligence layers powering AST symbol resolution, caller graphs, and risk auditing.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#18181C', border: '1px solid var(--border-subtle)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Cpu size={16} color="var(--accent-red)" />
                        <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>LLM Reasoning Core</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Claude 3.5 Sonnet / GPT-4o with deterministic JSON schema</div>
                    </div>

                    <div style={{ background: '#18181C', border: '1px solid var(--border-subtle)', padding: '14px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Database size={16} color="#34D399" />
                        <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>Tree-sitter AST Parser</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Java 17/21 AST symbol graph &amp; call hierarchy indexing</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </SidebarLayout>
  );
}

