import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  RefreshCw,
  GitBranch,
  FileCode,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  GitCommit,
  FolderTree,
  Sparkles,
  GitPullRequest,
  Check
} from 'lucide-react';
import { api } from '../api';

export default function RepoDashboard({
  repos,
  selectedRepo,
  onSelectRepo,
  onRefreshRepos,
  onSelectTab,
  user
}) {
  const [urlInput, setUrlInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [indexingId, setIndexingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleImport = async (e) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setError(null);
    setSuccessMsg(null);
    setImporting(true);

    try {
      const repo = await api.repos.import(urlInput.trim());
      setSuccessMsg(`Successfully imported ${repo.fullName}!`);
      setUrlInput('');
      await onRefreshRepos();
      onSelectRepo(repo);
    } catch (err) {
      setError(err.message || 'Failed to import repository');
    } finally {
      setImporting(false);
    }
  };

  const handleSyncGithub = async () => {
    setError(null);
    setSuccessMsg(null);
    setSyncing(true);
    try {
      const res = await api.repos.sync();
      setSuccessMsg(res.message || 'Repositories synchronized successfully!');
      await onRefreshRepos();
    } catch (err) {
      setError(err.message || 'Failed to sync repositories');
    } finally {
      setSyncing(false);
    }
  };

  const handleIndex = async (repoId) => {
    try {
      setIndexingId(repoId);
      await api.repos.index(repoId);
      await onRefreshRepos();

      // Poll status for a short while
      const interval = setInterval(async () => {
        try {
          const status = await api.repos.status(repoId);
          if (status.indexStatus !== 'INDEXING') {
            clearInterval(interval);
            setIndexingId(null);
            onRefreshRepos();
          }
        } catch {
          clearInterval(interval);
          setIndexingId(null);
        }
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to start indexing');
      setIndexingId(null);
    }
  };

  const quickPresets = [
    'https://github.com/spring-projects/spring-petclinic',
    'https://github.com/octocat/Hello-World'
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '32px auto', padding: '0 24px' }}>
      {/* Import & Ingestion Panel */}
      <div className="glass-panel" style={{
        padding: '32px',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden',
        background: '#121215',
        border: '1px solid var(--border-subtle)'
      }}>
        {/* Subtle red ambient glow in the corner */}
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '220px',
          height: '220px',
          background: 'radial-gradient(circle, rgba(255, 48, 48, 0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
          <div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Repository Ingestion &amp; Comprehension
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '720px' }}>
              Import any public GitHub repository to parse its structural AST skeleton, generate semantic code embeddings with PGVector, and enable deep change-impact analysis.
            </p>
          </div>

          {/* Automatic Sync Button */}
          <button
            onClick={handleSyncGithub}
            disabled={syncing}
            className="btn-secondary"
            style={{ padding: '9px 16px', fontSize: '0.82rem', gap: '8px' }}
            title="Automatically sync all repositories from your linked GitHub account"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing Repositories...' : 'Sync GitHub Repositories'}
          </button>
        </div>

        {/* Import Form */}
        <form onSubmit={handleImport} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '24px' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '320px' }}>
            <input
              type="text"
              placeholder="https://github.com/owner/repository"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={importing}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '0.92rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-red)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          <button
            type="submit"
            disabled={importing || !urlInput.trim()}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '0.92rem' }}
          >
            {importing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Resolving &amp; Ingesting...
              </>
            ) : (
              <>
                <Plus size={18} />
                Import Repository
              </>
            )}
          </button>
        </form>

        {/* Quick Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Try sample:</span>
          {quickPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setUrlInput(preset)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontSize: '0.75rem',
                borderRadius: '6px',
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-red)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
            >
              {preset.replace('https://github.com/', '')}
            </button>
          ))}
        </div>

        {/* Status / Error Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              style={{
                marginTop: '18px',
                padding: '12px 16px',
                background: 'rgba(255, 48, 48, 0.12)',
                border: '1px solid rgba(255, 48, 48, 0.35)',
                borderRadius: '8px',
                color: '#FF6666',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              style={{
                marginTop: '18px',
                padding: '12px 16px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                color: '#34D399',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={16} />
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Repositories Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
            Available Repositories ({repos.length})
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Synchronized repositories ready for structural AST browsing, architecture Q&amp;A, and pull request audits.
          </p>
        </div>

        <button
          onClick={onRefreshRepos}
          className="btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <RefreshCw size={14} />
          Refresh Status
        </button>
      </div>

      {/* Repos Grid */}
      {repos.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <FileCode size={44} color="var(--text-dim)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.15rem', color: '#FFFFFF', marginBottom: '6px' }}>No Repositories Synchronized Yet</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 20px' }}>
            Paste a public GitHub repository URL above or click "Sync GitHub Repositories" to populate your repository list.
          </p>
          <button
            onClick={handleSyncGithub}
            disabled={syncing}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            Auto-Sync Repositories
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '22px' }}>
          {repos.map((repo, idx) => {
            const isSelected = selectedRepo && selectedRepo.id === repo.id;
            const isIndexing = repo.indexStatus === 'INDEXING' || indexingId === repo.id;

            return (
              <motion.div
                key={repo.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.04 }}
                whileHover={{ y: -3, transition: { duration: 0.16 } }}
                className="glass-panel card-interactive"
                style={{
                  padding: '22px',
                  borderColor: isSelected ? 'var(--accent-red)' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(255, 48, 48, 0.04)' : '#141416',
                  boxShadow: isSelected ? '0 0 25px rgba(255, 48, 48, 0.12)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#FFFFFF' }}>{repo.fullName}</span>
                      {repo.isPrivate && <span className="badge badge-medium" style={{ fontSize: '0.62rem' }}>Private</span>}
                    </div>
                    <span className={`badge badge-${repo.indexStatus.toLowerCase()}`}>
                      {repo.indexStatus}
                    </span>
                  </div>

                  {repo.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {repo.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px' }}>
                      <GitBranch size={12} />
                      {repo.defaultBranch || 'main'}
                    </div>

                    {repo.commitSha && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px' }} title={repo.commitSha}>
                        <GitCommit size={12} />
                        {repo.commitSha.substring(0, 7)}
                      </div>
                    )}
                  </div>

                  {/* Dynamic Indexing Progress Stepper */}
                  <AnimatePresence>
                    {isIndexing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          marginBottom: '16px',
                          padding: '12px',
                          background: 'rgba(255, 48, 48, 0.06)',
                          border: '1px solid rgba(255, 48, 48, 0.25)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={13} className="animate-spin" color="var(--accent-red)" />
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#FFFFFF' }}>Repository Indexing</span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--accent-red)', fontWeight: 600 }}>Active</span>
                        </div>

                        {/* Stages */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                          {[
                            { name: 'Scan Files', key: 'scan' },
                            { name: 'Map Deps', key: 'deps' },
                            { name: 'Index AST', key: 'ast' },
                            { name: 'Prepare', key: 'ready' }
                          ].map((stage, sIdx) => (
                            <div
                              key={stage.key}
                              style={{
                                fontSize: '0.6rem',
                                textAlign: 'center',
                                padding: '3px 2px',
                                background: sIdx <= 1 ? 'rgba(255, 48, 48, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                border: sIdx <= 1 ? '1px solid rgba(255, 48, 48, 0.35)' : '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                color: sIdx <= 1 ? '#FFFFFF' : 'var(--text-dim)',
                                fontWeight: sIdx <= 1 ? 600 : 400
                              }}
                            >
                              {stage.name}
                            </div>
                          ))}
                        </div>

                        {/* Animated Progress Bar */}
                        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: '20%' }}
                            animate={{ width: ['20%', '55%', '85%', '96%'] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ height: '100%', background: 'linear-gradient(90deg, #FF3030, #FF7070)' }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Progress Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0D0D10', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Files Indexed</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                        {repo.filesProcessed ?? (repo.indexStatus === 'COMPLETED' ? 'Indexed' : '0')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vector Chunks</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                        {repo.chunkCount ?? (repo.indexStatus === 'COMPLETED' ? 'Embedded' : '0')}
                      </div>
                    </div>
                  </div>

                  {repo.indexingError && (
                    <div style={{ fontSize: '0.75rem', color: '#FF7070', background: 'rgba(255,48,48,0.1)', padding: '8px', borderRadius: '4px', marginBottom: '14px' }}>
                      {repo.indexingError}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectRepo(repo)}
                      className={isSelected ? 'btn-primary' : 'btn-secondary'}
                      style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem' }}
                    >
                      {isSelected ? (
                        <>
                          <Check size={14} />
                          Active Repository
                        </>
                      ) : (
                        'Select Repository'
                      )}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleIndex(repo.id)}
                      disabled={isIndexing}
                      className="btn-secondary"
                      title="Index AST code structures and semantic embeddings"
                      style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                    >
                      <RefreshCw size={14} className={isIndexing ? 'animate-spin' : ''} />
                      {isIndexing ? 'Indexing...' : 'Index'}
                    </motion.button>

                    {repo.url && (
                      <motion.a
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        title="Open on GitHub"
                        style={{ padding: '8px 10px', display: 'flex', alignItems: 'center' }}
                      >
                        <ExternalLink size={14} />
                      </motion.a>
                    )}
                  </div>

                  {/* Secondary shortcuts for selected repo */}
                  {isSelected && onSelectTab && (
                    <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onSelectTab('tree')}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <FolderTree size={12} color="var(--accent-red)" />
                        Code Tree
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onSelectTab('comprehension')}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <Sparkles size={12} color="var(--accent-red)" />
                        Ask Q&amp;A
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onSelectTab('pr-review')}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <GitPullRequest size={12} color="var(--accent-red)" />
                        Review PR
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
