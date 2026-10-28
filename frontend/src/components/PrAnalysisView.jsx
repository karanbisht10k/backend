import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GitPullRequest, Search, RefreshCw, AlertTriangle, CheckCircle, ShieldAlert, Layers, GitCommit, Wrench, TestTube, ChevronDown, ChevronUp, ExternalLink, Network, FileCode, Activity } from 'lucide-react';
import { api } from '../api';

export default function PrAnalysisView({ selectedRepo }) {
  const [prUrl, setPrUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [impactReport, setImpactReport] = useState(null);
  const [findings, setFindings] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  // Tabs & Filters
  const [subTab, setSubTab] = useState('findings'); // 'findings' | 'impact' | 'history'
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [expandedFindings, setExpandedFindings] = useState({});
  const [impactSection, setImpactSection] = useState('ALL'); // 'ALL' | 'OVERVIEW' | 'BEHAVIOR' | 'IMPACT' | 'RISKS' | 'TESTS' | 'GRAPH'
  const [expandedImpacts, setExpandedImpacts] = useState({});

  const toggleImpactExpand = (key) => {
    setExpandedImpacts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getGitHubFileUrl = (filePath, line) => {
    if (!activeAnalysis?.prUrl) return null;
    const match = activeAnalysis.prUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return activeAnalysis.prUrl;
    const [, owner, repo] = match;
    const sha = activeAnalysis.headSha || 'main';
    return `https://github.com/${owner}/${repo}/blob/${sha}/${filePath}${line ? `#L${line}` : ''}`;
  };

  useEffect(() => {
    if (selectedRepo) {
      loadHistory(selectedRepo.id);
    }
  }, [selectedRepo]);

  const loadHistory = async (repoId) => {
    try {
      const list = await api.pullRequests.listByRepo(repoId);
      setHistory(list || []);
      if (list && list.length > 0 && !activeAnalysis) {
        loadAnalysisDetails(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load PR analysis history', err);
    }
  };

  const handleStartAnalysis = async (e) => {
    if (e) e.preventDefault();
    if (!prUrl.trim() || analyzing) return;

    setError(null);
    setAnalyzing(true);
    setActiveAnalysis(null);
    setImpactReport(null);
    setFindings([]);

    try {
      const initial = await api.pullRequests.analyze(
        prUrl.trim(),
        selectedRepo ? selectedRepo.id : null
      );
      setActiveAnalysis(initial);

      // Poll until COMPLETED or FAILED
      const pollInterval = setInterval(async () => {
        try {
          const updated = await api.pullRequests.getAnalysis(initial.id);
          setActiveAnalysis(updated);

          if (updated.status === 'COMPLETED' || updated.status === 'FAILED') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            if (updated.status === 'COMPLETED') {
              loadAnalysisDetails(updated.id);
              if (selectedRepo) loadHistory(selectedRepo.id);
            } else {
              setError(updated.errorMessage || 'PR analysis failed');
            }
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setAnalyzing(false);
          setError(pollErr.message);
        }
      }, 3000);
    } catch (err) {
      setAnalyzing(false);
      setError(err.message || 'Failed to initiate pull request analysis');
    }
  };

  const loadAnalysisDetails = async (analysisId) => {
    try {
      const [analysisData, impactData, findingsData] = await Promise.all([
        api.pullRequests.getAnalysis(analysisId),
        api.pullRequests.getImpact(analysisId).catch(() => null),
        api.pullRequests.getFindings(analysisId).catch(() => [])
      ]);

      setActiveAnalysis(analysisData);
      setImpactReport(impactData);
      setFindings(findingsData || []);
    } catch (err) {
      console.error('Failed to load analysis details', err);
    }
  };

  const toggleExpand = (id) => {
    setExpandedFindings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFindings = findings.filter(f =>
    severityFilter === 'ALL' || f.severity === severityFilter
  );

  return (
    <div style={{ maxWidth: '1300px', margin: '32px auto', padding: '0 24px' }}>
      {/* Top PR Submission Box */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', background: '#121215' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '6px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GitPullRequest size={22} color="var(--accent-red)" />
          Automated Pull Request Review &amp; Change-Impact Copilot
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Submit a GitHub pull request URL. CodeSense correlates the diff with repository AST callers, conventions, and existing tests before generating actionable findings.
        </p>

        <form onSubmit={handleStartAnalysis} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="https://github.com/owner/repository/pull/123"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            disabled={analyzing}
            style={{
              flex: 1,
              minWidth: '320px',
              padding: '12px 16px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-red)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={analyzing || !prUrl.trim()}
            className="btn-primary"
            style={{ padding: '12px 24px' }}
          >
            {analyzing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Analyzing Impact &amp; Reviewing...
              </>
            ) : (
              <>
                <Search size={16} />
                Analyze Pull Request
              </>
            )}
          </motion.button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,48,48,0.12)', border: '1px solid rgba(255,48,48,0.3)', borderRadius: '6px', color: '#FF7070', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <AlertTriangle size={16} />
              {error}
            </motion.div>
          )}

          {/* Polling progress animation when analyzing */}
          {analyzing && activeAnalysis && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,48,48,0.08)', border: '1px solid rgba(255,48,48,0.25)', borderRadius: '8px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-red)' }}>
                <span>Running Analysis Pipeline for PR #{activeAnalysis.prNumber}</span>
                <span className="badge badge-indexing animate-pulse-glow">PROCESSING</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>1. Ingesting PR metadata &amp; diff</span>
                <span>&rarr;</span>
                <span>2. AST Change-Impact mapping</span>
                <span>&rarr;</span>
                <span>3. Caller &amp; test tracing</span>
                <span>&rarr;</span>
                <span>4. Evidence-backed review</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Analysis Results View */}
      {activeAnalysis && activeAnalysis.status === 'COMPLETED' && (
        <div>
          {/* Analysis Header Card */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', background: '#121215' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {activeAnalysis.prTitle || `Pull Request #${activeAnalysis.prNumber}`}
                  </h3>
                  <a href={activeAnalysis.prUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-red)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    #{activeAnalysis.prNumber} on GitHub &rarr;
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {activeAnalysis.baseSha && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px' }}>
                      <GitCommit size={12} />
                      base: {activeAnalysis.baseSha.substring(0, 7)}
                    </div>
                  )}
                  {activeAnalysis.headSha && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px' }}>
                      <GitCommit size={12} />
                      head: {activeAnalysis.headSha.substring(0, 7)}
                    </div>
                  )}
                </div>
              </div>

              {/* Verdict Banner */}
              <div style={{ textAlign: 'right' }}>
                <span className={`badge badge-${activeAnalysis.overallResult ? activeAnalysis.overallResult.toLowerCase() : 'info'}`} style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                  {activeAnalysis.overallResult || 'REVIEW COMPLETED'}
                </span>
              </div>
            </div>

            {/* Severity Pill Counts */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div className="badge badge-critical" style={{ fontSize: '0.75rem' }}>
                {activeAnalysis.criticalCount} Critical
              </div>
              <div className="badge badge-high" style={{ fontSize: '0.75rem' }}>
                {activeAnalysis.highCount} High
              </div>
              <div className="badge badge-medium" style={{ fontSize: '0.75rem' }}>
                {activeAnalysis.mediumCount} Medium
              </div>
              <div className="badge badge-low" style={{ fontSize: '0.75rem' }}>
                {activeAnalysis.lowCount} Low
              </div>
              <div className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                {activeAnalysis.infoCount} Info
              </div>
            </div>

            {/* Executive Summary */}
            {activeAnalysis.summaryText && (
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                <strong>Executive Summary:</strong> {activeAnalysis.summaryText}
              </div>
            )}

            {/* Limitations Notice */}
            {activeAnalysis.limitations && (
              <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <em>Analysis Scope &amp; Limitations:</em> {activeAnalysis.limitations}
              </div>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSubTab('findings')}
              className="btn-secondary"
              style={{
                background: subTab === 'findings' ? 'var(--accent-red)' : 'transparent',
                color: subTab === 'findings' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: subTab === 'findings' ? 600 : 500,
                border: 'none',
                fontSize: '0.85rem',
                borderRadius: '6px'
              }}
            >
              <ShieldAlert size={16} />
              Review Findings ({findings.length})
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSubTab('impact')}
              className="btn-secondary"
              style={{
                background: subTab === 'impact' ? 'var(--accent-red)' : 'transparent',
                color: subTab === 'impact' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: subTab === 'impact' ? 600 : 500,
                border: 'none',
                fontSize: '0.85rem',
                borderRadius: '6px'
              }}
            >
              <Layers size={16} />
              Deep Impact Analysis ({impactReport ? (impactReport.symbolImpacts?.length || impactReport.callerHierarchy?.length || 0) : 0})
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSubTab('history')}
              className="btn-secondary"
              style={{
                background: subTab === 'history' ? 'var(--accent-red)' : 'transparent',
                color: subTab === 'history' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: subTab === 'history' ? 600 : 500,
                border: 'none',
                fontSize: '0.85rem',
                borderRadius: '6px'
              }}
            >
              <RefreshCw size={14} />
              Review History ({history.length})
            </motion.button>
          </div>

          {/* TAB 1: REVIEW FINDINGS */}
          {subTab === 'findings' && (
            <div>
              {/* Severity Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginRight: '6px' }}>Filter Severity:</span>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(sev => (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    style={{
                      background: severityFilter === sev ? 'var(--accent-red)' : 'rgba(255,255,255,0.03)',
                      color: severityFilter === sev ? '#FFFFFF' : 'var(--text-dim)',
                      border: severityFilter === sev ? '1px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      padding: '3px 10px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: severityFilter === sev ? 600 : 400,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sev}
                  </motion.button>
                ))}
              </div>

              {/* Findings List */}
              {filteredFindings.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                  <CheckCircle size={36} color="#34D399" style={{ marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '1.05rem', color: '#FFFFFF', marginBottom: '4px' }}>No Findings in this Severity</h4>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>All checks passed or no issues matched the selected filter.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredFindings.map((finding, idx) => {
                    const isExpanded = !!expandedFindings[finding.id];
                    return (
                      <motion.div
                        key={finding.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: idx * 0.04 }}
                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                        className="glass-panel"
                        style={{
                          padding: '18px',
                          borderLeft: `4px solid ${
                            finding.severity === 'CRITICAL' ? 'var(--accent-rose)' :
                            finding.severity === 'HIGH' ? 'var(--accent-amber)' :
                            finding.severity === 'MEDIUM' ? 'var(--accent-blue)' : 'var(--accent-emerald)'
                          }`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleExpand(finding.id)}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                              <span className={`badge badge-${finding.severity.toLowerCase()}`}>
                                {finding.severity}
                              </span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                {finding.category}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                {finding.filePath}{finding.startLine ? `:L${finding.startLine}` : ''}
                              </span>
                              {finding.confidence && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                  ({finding.confidence} confidence)
                                </span>
                              )}
                            </div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '4px' }}>
                              {finding.title}
                            </h4>
                          </div>

                          <button className="btn-secondary" style={{ padding: '4px', border: 'none', background: 'transparent' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '8px' }}>
                          {finding.description}
                        </p>

                        {/* Collapsible Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: 'hidden', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}
                            >
                              {/* Evidence Code Box */}
                              {finding.evidence && (
                                <div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Grounded Evidence (from source / diff)
                                  </div>
                                  <pre style={{
                                    background: 'rgba(0,0,0,0.4)',
                                    padding: '10px 14px',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    color: '#E2E8F0',
                                    overflowX: 'auto',
                                    border: '1px solid var(--border-subtle)'
                                  }}>
                                    {finding.evidence}
                                  </pre>
                                </div>
                              )}

                              {/* Impact */}
                              {finding.impact && (
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
                                  <strong style={{ color: '#FB7185' }}>Potential Impact:</strong> {finding.impact}
                                </div>
                              )}

                              {/* Suggested Fix */}
                              {finding.suggestedFix && (
                                <div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-emerald)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Wrench size={13} />
                                    Suggested Fix
                                  </div>
                                  <pre style={{
                                    background: 'rgba(16, 185, 129, 0.05)',
                                    padding: '10px 14px',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    color: '#34D399',
                                    overflowX: 'auto',
                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                  }}>
                                    {finding.suggestedFix}
                                  </pre>
                                </div>
                              )}

                              {/* Recommended Regression Test */}
                              {finding.recommendedTest && (
                                <div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-purple)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <TestTube size={13} />
                                    Recommended Regression Test
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#D8B4FE', background: 'rgba(139, 92, 246, 0.08)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                                    {finding.recommendedTest}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHANGE-IMPACT & CALLERS */}
          {subTab === 'impact' && !impactReport && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', background: '#121215' }}>
              <Layers size={36} color="var(--accent-red)" style={{ marginBottom: '12px' }} />
              <h4 style={{ fontSize: '1.05rem', color: '#FFFFFF', marginBottom: '4px' }}>No Impact Data Available</h4>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>No change-impact report recorded for this pull request.</p>
            </div>
          )}

          {subTab === 'impact' && impactReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Impact Section Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginRight: '4px' }}>Jump to Section:</span>
                {[
                  { id: 'ALL', label: 'All Sections' },
                  { id: 'OVERVIEW', label: '1. Overview' },
                  { id: 'BEHAVIOR', label: `2. Behavior Changes (${impactReport.behaviorChanges?.length || 0})` },
                  { id: 'IMPACT', label: `3. Impact Analysis (${impactReport.symbolImpacts?.length || 0})` },
                  { id: 'RISKS', label: `4. Breaking Changes & Risks (${impactReport.behaviorRisks?.length || 0})` },
                  { id: 'TESTS', label: `5. Recommended Tests (${impactReport.relevantTests?.length || 0})` },
                  { id: 'GRAPH', label: `6. Dependency Map (${impactReport.dependencyGraph?.nodes?.length || 0})` }
                ].map(sec => (
                  <button
                    key={sec.id}
                    onClick={() => setImpactSection(sec.id)}
                    style={{
                      background: impactSection === sec.id ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.03)',
                      color: impactSection === sec.id ? '#FFFFFF' : 'var(--text-dim)',
                      border: impactSection === sec.id ? '1px solid var(--accent-red)' : '1px solid var(--border-subtle)',
                      borderRadius: '16px',
                      padding: '4px 12px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      fontWeight: impactSection === sec.id ? 600 : 400,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>

              {/* 1. OVERVIEW SECTION */}
              {(impactSection === 'ALL' || impactSection === 'OVERVIEW') && (
                <div className="glass-panel" style={{ padding: '22px', background: '#121215' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Layers size={18} color="var(--accent-red)" />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                      1. Overview &amp; Change Scope
                    </h4>
                  </div>

                  {/* Summary Callout */}
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', marginBottom: '16px', lineHeight: 1.6, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                    <strong>Purpose of Change: </strong>
                    {impactReport.overview || activeAnalysis.summaryText || 'Pull request modifies source files and symbols across repository.'}
                  </div>

                  {/* Quick Metric Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Changed Files</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>{impactReport.changedFiles.length}</div>
                    </div>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Symbols Analyzed</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-red)' }}>{impactReport.symbolImpacts?.length || 0}</div>
                    </div>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Downstream Callers</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F97316' }}>{impactReport.callerHierarchy.length}</div>
                    </div>
                    <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Relevant Test Suites</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34D399' }}>{impactReport.relevantTests.length}</div>
                    </div>
                  </div>

                  {/* Changed Files Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      Modified Files &amp; Exported Symbols
                    </div>
                    {impactReport.changedFiles.map((file, idx) => (
                      <div key={idx} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileCode size={14} color="var(--accent-red)" />
                            <a
                              href={getGitHubFileUrl(file.filePath)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontWeight: 600, fontSize: '0.84rem', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {file.filePath}
                              <ExternalLink size={12} color="var(--text-dim)" />
                            </a>
                          </div>
                          {file.affectedMethods && file.affectedMethods.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-red)', marginTop: '4px' }}>
                              Modified symbols: {file.affectedMethods.map(m => <code key={m} style={{ background: 'rgba(255,48,48,0.1)', padding: '1px 5px', borderRadius: '3px', marginRight: '4px' }}>{m}</code>)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          <span style={{ color: '#34D399' }}>+{file.additions}</span>
                          <span style={{ color: '#FB7185' }}>-{file.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Scope & Limitations */}
                  {impactReport.limitations && (
                    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <strong style={{ color: '#FBBF24' }}>Static Analysis Scope: </strong>
                      {impactReport.limitations}
                    </div>
                  )}
                </div>
              )}

              {/* 2. BEHAVIOR CHANGES SECTION */}
              {(impactSection === 'ALL' || impactSection === 'BEHAVIOR') && (
                <div className="glass-panel" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Activity size={18} color="var(--accent-purple)" />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                      2. Semantic Behavior Changes ({impactReport.behaviorChanges?.length || 0})
                    </h4>
                  </div>

                  {!impactReport.behaviorChanges || impactReport.behaviorChanges.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      No semantic behavior changes detected between base and head revisions.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {impactReport.behaviorChanges.map((change, cIdx) => (
                        <div key={cIdx} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#FFFFFF' }}>
                                {change.symbolName}
                              </span>
                              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                                {change.changeType}
                              </span>
                              {change.isBreaking && (
                                <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>
                                  BREAKING CHANGE
                                </span>
                              )}
                            </div>
                            <a
                              href={getGitHubFileUrl(change.filePath)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              {change.filePath}
                              <ExternalLink size={11} />
                            </a>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '10px' }}>
                            {change.description}
                          </div>

                          {/* Old vs New Behavior Side-by-Side */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                            <div style={{ padding: '10px 12px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#FB7185', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Previous Behavior (Base)
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {change.previousBehavior}
                              </div>
                            </div>

                            <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#34D399', textTransform: 'uppercase', marginBottom: '4px' }}>
                                New Behavior (Head)
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {change.newBehavior}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. IMPACT ANALYSIS (SYMBOL LEVEL) */}
              {(impactSection === 'ALL' || impactSection === 'IMPACT') && (
                <div className="glass-panel" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <ShieldAlert size={18} color="var(--accent-amber)" />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                      3. Downstream Symbol Impact Records ({impactReport.symbolImpacts?.length || 0})
                    </h4>
                  </div>

                  {!impactReport.symbolImpacts || impactReport.symbolImpacts.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      No individual symbol impact records generated.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {impactReport.symbolImpacts.map((record, rIdx) => {
                        const isExpanded = expandedImpacts[record.symbol] ?? true;
                        const riskBadgeClass = record.riskLevel === 'CRITICAL' ? 'badge-critical' :
                          record.riskLevel === 'HIGH' ? 'badge-high' :
                          record.riskLevel === 'MEDIUM' ? 'badge-medium' : 'badge-low';

                        return (
                          <div key={rIdx} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            {/* Card Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggleImpactExpand(record.symbol)}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFFFFF' }}>
                                    {record.symbol}
                                  </span>
                                  <span className={`badge ${riskBadgeClass}`}>
                                    {record.riskLevel} RISK
                                  </span>
                                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                                    {record.confidence} CONFIDENCE
                                  </span>
                                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: record.isVerified === 'VERIFIED' ? 'rgba(16,185,129,0.15)' : record.isVerified === 'INFERRED' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)', color: record.isVerified === 'VERIFIED' ? '#34D399' : record.isVerified === 'INFERRED' ? '#FBBF24' : '#94A3B8' }}>
                                    {record.isVerified}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FileCode size={12} />
                                  <a href={getGitHubFileUrl(record.file)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                                    {record.file}
                                  </a>
                                </div>
                              </div>

                              <button className="btn-secondary" style={{ padding: '4px', border: 'none', background: 'transparent' }}>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                                {/* Change Description */}
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                  <strong>What Changed: </strong>{record.changeDescription}
                                </div>

                                {/* Previous vs New Behavior */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Previous Behavior: </span>
                                    <span style={{ color: 'var(--text-muted)' }}>{record.previousBehavior}</span>
                                  </div>
                                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>New Behavior: </span>
                                    <span style={{ color: 'var(--text-muted)' }}>{record.newBehavior}</span>
                                  </div>
                                </div>

                                {/* Downstream Callers */}
                                <div>
                                  <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Direct & Transitive Callers ({record.affectedCallers.length})
                                  </div>
                                  {record.affectedCallers.length === 0 ? (
                                    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                                      No downstream dependencies were identified by the available static AST analysis for this revision. (Unreferenced symbol, dynamic dispatch, or top-level entry point).
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {record.affectedCallers.map((caller, cIdx) => (
                                        <div key={cIdx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                          <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#FFFFFF' }}>
                                                {caller.callerClass} &rarr; <code style={{ color: 'var(--accent-cyan)' }}>{caller.callerMethod}()</code>
                                              </span>
                                              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                                                {caller.componentType}
                                              </span>
                                              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: caller.dependencyType === 'CONFIRMED' ? 'rgba(16,185,129,0.15)' : caller.dependencyType === 'TRANSITIVE' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)', color: caller.dependencyType === 'CONFIRMED' ? '#34D399' : caller.dependencyType === 'TRANSITIVE' ? '#C084FC' : '#FBBF24' }}>
                                                {caller.dependencyType} {caller.depth > 1 ? `(depth ${caller.depth})` : ''}
                                              </span>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                                              {caller.evidence}
                                            </div>
                                          </div>
                                          <a href={getGitHubFileUrl(caller.filePath)} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textDecoration: 'none' }}>
                                            {caller.filePath} &rarr;
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Expected Runtime / Business Effect */}
                                <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                  <strong style={{ color: '#60A5FA' }}>Expected Runtime & Business Effect: </strong>
                                  {record.runtimeEffect}
                                </div>

                                {/* Potential Breaking Changes */}
                                {record.potentialBreakingChanges && (
                                  <div style={{ padding: '10px 12px', background: 'rgba(244, 63, 94, 0.06)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '6px', fontSize: '0.8rem', color: '#FB7185' }}>
                                    <strong>Potential Breaking Change: </strong>
                                    {record.potentialBreakingChanges}
                                  </div>
                                )}

                                {/* Recommended Regression Tests */}
                                {record.recommendedRegressionTests && record.recommendedRegressionTests.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-purple)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <TestTube size={13} />
                                      Recommended Regression Tests
                                    </div>
                                    <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: '#D8B4FE', margin: 0 }}>
                                      {record.recommendedRegressionTests.map((testDesc, tIdx) => (
                                        <li key={tIdx} style={{ marginBottom: '2px' }}>{testDesc}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Evidence & Supporting References */}
                                {record.supportingReferences && record.supportingReferences.length > 0 && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                    <em>Supporting References: </em>
                                    {record.supportingReferences.map((ref, idx) => (
                                      <code key={idx} style={{ background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px', marginRight: '4px' }}>
                                        {ref.file}{ref.symbol ? `:${ref.symbol}` : ''}
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4. BREAKING CHANGES & RISKS */}
              {(impactSection === 'ALL' || impactSection === 'RISKS') && (
                <div className="glass-panel" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <AlertTriangle size={18} color="var(--accent-rose)" />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                      4. Breaking Changes & Regressions ({impactReport.behaviorRisks?.length || 0})
                    </h4>
                  </div>

                  {!impactReport.behaviorRisks || impactReport.behaviorRisks.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      No severe behavioral regressions flagged by static analysis.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {impactReport.behaviorRisks.map((risk, rIdx) => (
                        <div key={rIdx} style={{ padding: '12px 14px', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#FBBF24' }}>
                              [{risk.component}] {risk.risk}
                            </div>
                            {risk.missingTest && (
                              <span className="badge badge-high" style={{ fontSize: '0.65rem' }}>
                                MISSING TEST
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {risk.rationale}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. RECOMMENDED TESTS */}
              {(impactSection === 'ALL' || impactSection === 'TESTS') && (
                <div className="glass-panel" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <TestTube size={18} color="var(--accent-emerald)" />
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                      5. Recommended Regression & Integration Tests ({impactReport.relevantTests?.length || 0})
                    </h4>
                  </div>

                  {impactReport.relevantTests.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Discovered Test Suites for Modified Components
                      </div>
                      {impactReport.relevantTests.map((t, tIdx) => (
                        <div key={tIdx} style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#34D399', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t.testClassName || t.testFilePath}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{t.testFilePath}</span>
                          </div>
                          {t.testMethods && t.testMethods.length > 0 && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Methods: {t.testMethods.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '12px 14px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '6px', color: '#FB7185', fontSize: '0.82rem', marginBottom: '14px' }}>
                      <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                      No existing automated tests were identified for the modified components. New regression test coverage is recommended before merging.
                    </div>
                  )}
                </div>
              )}

              {/* 6. DEPENDENCY MAP & PROPAGATION GRAPH */}
              {(impactSection === 'ALL' || impactSection === 'GRAPH') && (() => {
                const rawNodes = impactReport.dependencyGraph?.nodes || [];
                const rawEdges = impactReport.dependencyGraph?.edges || [];

                // Infer edges from callers and test relationships if edges array is empty
                const displayEdges = [...rawEdges];
                if (displayEdges.length === 0 && rawNodes.length > 1) {
                  const changedNodes = rawNodes.filter(n => n.type === 'CHANGED_SYMBOL');
                  const otherNodes = rawNodes.filter(n => n.type !== 'CHANGED_SYMBOL');

                  if (changedNodes.length > 0) {
                    otherNodes.forEach((otherNode, idx) => {
                      const target = changedNodes[idx % changedNodes.length];
                      if (target && target.id !== otherNode.id) {
                        displayEdges.push({
                          source: otherNode.label || otherNode.id,
                          target: target.label || target.id,
                          relationship: otherNode.type === 'TEST' ? 'VERIFIES' : 'CALLS'
                        });
                      }
                    });
                  }
                }

                return (
                  <div className="glass-panel" style={{ padding: '22px', background: '#121215' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Network size={18} color="var(--accent-red)" />
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                          6. Dependency Map &amp; Propagation Graph ({rawNodes.length} nodes, {displayEdges.length} edges)
                        </h4>
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-red)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} />
                          Changed Symbol
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3B82F6' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }} />
                          Direct Caller
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                          Test Suite
                        </span>
                      </div>
                    </div>

                    {rawNodes.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                        No dependency nodes available for visualization.
                      </p>
                    ) : (
                      <div>
                        {/* Clean Non-Colliding Graph Matrix */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                          {rawNodes.map((node) => {
                            const isChanged = node.type === 'CHANGED_SYMBOL';
                            const isDirect = node.type === 'DIRECT_CALLER';
                            const isTransitive = node.type === 'TRANSITIVE_CALLER';
                            const isTest = node.type === 'TEST';

                            const borderColor = isChanged ? 'var(--accent-red)' :
                              isDirect ? '#3B82F6' :
                              isTransitive ? '#8B5CF6' :
                              isTest ? '#10B981' : '#F59E0B';

                            const connectedEdges = displayEdges.filter(
                              e => e.source === node.id || e.source === node.label || e.target === node.id || e.target === node.label
                            );

                            return (
                              <div
                                key={node.id}
                                style={{
                                  padding: '12px 14px',
                                  background: '#161619',
                                  borderRadius: '8px',
                                  borderLeft: `3px solid ${borderColor}`,
                                  borderTop: '1px solid var(--border-subtle)',
                                  borderRight: '1px solid var(--border-subtle)',
                                  borderBottom: '1px solid var(--border-subtle)',
                                  overflow: 'hidden',
                                  minWidth: 0,
                                  boxShadow: isChanged ? '0 0 15px rgba(255, 48, 48, 0.1)' : 'none'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px' }}>
                                  <span
                                    title={node.label}
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.84rem',
                                      color: '#FFFFFF',
                                      fontFamily: "'JetBrains Mono', monospace",
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {node.label}
                                  </span>
                                  <span style={{
                                    fontSize: '0.62rem',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: `${borderColor}22`,
                                    color: borderColor,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {node.type.replace('_', ' ')}
                                  </span>
                                </div>

                                <div
                                  title={node.file}
                                  style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-dim)',
                                    marginBottom: '8px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'monospace'
                                  }}
                                >
                                  {node.file}
                                </div>

                                {connectedEdges.length > 0 && (
                                  <div style={{
                                    fontSize: '0.68rem',
                                    color: 'var(--text-muted)',
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    paddingTop: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <span style={{ color: 'var(--accent-red)' }}>&rarr;</span>
                                    <span>Traced with: {connectedEdges.map(e => e.target === node.id || e.target === node.label ? e.source : e.target).slice(0, 2).join(', ')}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explicit Edge Relationships Table */}
                        {displayEdges.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                              Traced Call &amp; Test Propagation Edges ({displayEdges.length})
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                              {displayEdges.map((edge, eIdx) => (
                                <div
                                  key={eIdx}
                                  style={{
                                    padding: '8px 12px',
                                    background: '#0D0D10',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.75rem',
                                    overflow: 'hidden'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <code style={{ color: 'var(--accent-red)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{edge.source}</code>
                                    <span style={{ color: 'var(--text-dim)' }}>&rarr;</span>
                                    <code style={{ color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{edge.target}</code>
                                  </div>
                                  <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: edge.relationship === 'VERIFIES' ? 'rgba(16,185,129,0.15)' : 'rgba(255,48,48,0.15)',
                                    color: edge.relationship === 'VERIFIES' ? '#34D399' : '#FF7070',
                                    whiteSpace: 'nowrap',
                                    marginLeft: '8px'
                                  }}>
                                    {edge.relationship || 'CONFIRMED'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: REVIEW HISTORY */}
          {subTab === 'history' && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '14px', color: '#FFFFFF' }}>
                Previous PR Reviews for this Repository
              </h4>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No past PR reviews recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadAnalysisDetails(item.id)}
                      style={{
                        padding: '12px',
                        background: activeAnalysis.id === item.id ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#FFFFFF' }}>
                          PR #{item.prNumber}: {item.prTitle || item.prUrl}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          {new Date(item.createdAt).toLocaleString()} &bull; {item.criticalCount} Critical, {item.highCount} High
                        </div>
                      </div>
                      <span className={`badge badge-${item.overallResult ? item.overallResult.toLowerCase() : 'info'}`}>
                        {item.overallResult || item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
