import React from 'react';
import {
  Sparkles,
  GitPullRequest,
  Code2,
  Layers,
  User,
  LogOut,
  CheckCircle2,
  RefreshCw,
  FolderTree,
  Home
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  user,
  onDemoLogin,
  onLogout,
  onSyncRepos,
  syncing,
  selectedRepo,
  repos,
  setSelectedRepo
}) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      borderBottom: '1px solid var(--border-subtle)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(9, 9, 11, 0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)'
    }}>
      {/* Brand */}
      <div
        onClick={() => setActiveTab('overview')}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
      >
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(255, 48, 48, 0.4)'
        }}>
          <Sparkles size={18} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              CodeSense
            </span>
            <span className="badge badge-critical" style={{ fontSize: '0.62rem', padding: '2px 7px' }}>
              v2.0
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.01em' }}>
            AI Codebase Understanding &amp; PR Review
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <nav style={{
        display: 'flex',
        gap: '4px',
        background: '#121215',
        padding: '3px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            border: 'none',
            background: activeTab === 'overview' ? 'var(--accent-red)' : 'transparent',
            color: activeTab === 'overview' ? '#FFFFFF' : 'var(--text-muted)',
            fontWeight: activeTab === 'overview' ? 600 : 500,
            padding: '6px 12px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Home size={14} />
          Overview
        </button>

        <button
          onClick={() => setActiveTab('repos')}
          style={{
            border: 'none',
            background: activeTab === 'repos' ? 'var(--accent-red)' : 'transparent',
            color: activeTab === 'repos' ? '#FFFFFF' : 'var(--text-muted)',
            fontWeight: activeTab === 'repos' ? 600 : 500,
            padding: '6px 12px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={14} />
          Repositories
        </button>

        <button
          onClick={() => setActiveTab('tree')}
          style={{
            border: 'none',
            background: activeTab === 'tree' ? 'var(--accent-red)' : 'transparent',
            color: activeTab === 'tree' ? '#FFFFFF' : 'var(--text-muted)',
            fontWeight: activeTab === 'tree' ? 600 : 500,
            padding: '6px 12px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <FolderTree size={14} />
          Code Tree
        </button>

        <button
          onClick={() => setActiveTab('comprehension')}
          style={{
            border: 'none',
            background: activeTab === 'comprehension' ? 'var(--accent-red)' : 'transparent',
            color: activeTab === 'comprehension' ? '#FFFFFF' : 'var(--text-muted)',
            fontWeight: activeTab === 'comprehension' ? 600 : 500,
            padding: '6px 12px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Code2 size={14} />
          Architecture Q&amp;A
        </button>

        <button
          onClick={() => setActiveTab('pr-review')}
          style={{
            border: 'none',
            background: activeTab === 'pr-review' ? 'var(--accent-red)' : 'transparent',
            color: activeTab === 'pr-review' ? '#FFFFFF' : 'var(--text-muted)',
            fontWeight: activeTab === 'pr-review' ? 600 : 500,
            padding: '6px 12px',
            fontSize: '0.82rem',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <GitPullRequest size={14} />
          PR Review
        </button>
      </nav>

      {/* Right Controls: Active Repo & User Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Repo selector dropdown if repos exist */}
        {repos && repos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Repo:</span>
            <select
              value={selectedRepo ? selectedRepo.id : ''}
              onChange={(e) => {
                const r = repos.find(item => item.id === e.target.value);
                if (r) setSelectedRepo(r);
              }}
              style={{
                background: 'var(--bg-input)',
                color: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                maxWidth: '190px',
                cursor: 'pointer'
              }}
            >
              {repos.map(r => (
                <option key={r.id} value={r.id} style={{ background: '#141416', color: '#FFFFFF' }}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User state */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Auto sync repos button */}
            {onSyncRepos && (
              <button
                onClick={onSyncRepos}
                disabled={syncing}
                className="btn-secondary"
                title="Sync your GitHub repositories"
                style={{ padding: '6px 10px', fontSize: '0.75rem', gap: '5px' }}
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync Repos'}
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.githubUsername}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--border-subtle)' }}
                />
              ) : (
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={13} />
                </div>
              )}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#FFFFFF' }}>
                {user.displayName || user.githubUsername}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="btn-secondary"
              title="Sign Out"
              style={{ padding: '6px 8px', fontSize: '0.75rem' }}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onDemoLogin}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <CheckCircle2 size={13} color="#34D399" />
              Demo Sign-in
            </button>
            <a
              href="http://localhost:8080/api/auth/github"
              className="btn-primary"
              id="github-login-btn"
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Login with GitHub
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
