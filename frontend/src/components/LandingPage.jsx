import React, { useState } from 'react';
import {
  Sparkles,
  GitPullRequest,
  Code2,
  Layers,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Cpu,
  Database,
  Terminal,
  Activity,
  FileCheck,
  AlertTriangle,
  FileText,
  Share2,
  ShieldCheck,
  ArrowDown
} from 'lucide-react';

export default function LandingPage({ onExplore, onSelectTab, user, selectedRepo }) {
  const [showFullDiff, setShowFullDiff] = useState(false);
  const [heroTab, setHeroTab] = useState('explanation');

  return (
    <div style={{ position: 'relative', overflowX: 'hidden' }}>
      {/* =========================================================================
          HERO SECTION (Pixel-matched to user screenshot)
          ========================================================================= */}
      <section style={{
        position: 'relative',
        minHeight: '88vh',
        padding: '70px 24px 70px',
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(420px, 1.05fr) minmax(480px, 1.15fr)',
        gap: '40px',
        alignItems: 'center',
        zIndex: 1
      }}>
        {/* Giant Background Watermark */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 'clamp(4.5rem, 13vw, 11rem)',
          fontWeight: 900,
          color: 'rgba(255, 255, 255, 0.032)',
          letterSpacing: '0.14em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          WHAT THE HACK
        </div>

        {/* Far-Left Vertical Annotation: 01 & BUILD / REVIEW / SHIP / FASTER / */}
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '120px',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1
        }}>
          {/* 01 indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '2px', height: '14px', background: 'var(--accent-red)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#686875', fontFamily: "'JetBrains Mono', monospace" }}>01</span>
          </div>

          {/* Vertical text stack */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            color: '#4B4B58',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.22em',
            fontFamily: "'JetBrains Mono', monospace"
          }}>
            <span>BUILD</span>
            <span>REVIEW</span>
            <span>SHIP</span>
            <span>FASTER</span>
            <span style={{ color: 'var(--accent-red)' }}>/</span>
          </div>
        </div>

        {/* Far-Right Vertical Annotation: 02 & TRACE / UNDERSTAND / REVIEW / SHIP */}
        <div style={{
          position: 'absolute',
          right: '16px',
          top: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1
        }}>
          {/* Red line with node points */}
          <div style={{
            position: 'absolute',
            right: '-12px',
            top: '40px',
            height: '220px',
            width: '1px',
            background: 'rgba(255, 48, 48, 0.25)'
          }}>
            <div style={{
              position: 'absolute',
              top: '70px',
              left: '-3px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--accent-red)',
              boxShadow: '0 0 10px var(--accent-red)'
            }} />
            <div style={{
              position: 'absolute',
              top: '160px',
              left: '-3px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--accent-red)',
              boxShadow: '0 0 10px var(--accent-red)'
            }} />
          </div>

          {/* 02 indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#686875', fontFamily: "'JetBrains Mono', monospace" }}>02</span>
          </div>

          {/* Vertical text stack */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            color: '#4B4B58',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.22em',
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: 'right'
          }}>
            <span>TRACE</span>
            <span>UNDERSTAND</span>
            <span>REVIEW</span>
            <span>SHIP</span>
          </div>

          {/* Subtle curved laser sweep SVG */}
          <svg style={{ position: 'absolute', right: '-10px', top: '240px', width: '160px', height: '140px', pointerEvents: 'none' }}>
            <path d="M 140 0 C 80 50 20 90 0 140" fill="none" stroke="rgba(255, 48, 48, 0.4)" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Floating red crosshair */}
        <div style={{
          position: 'absolute',
          top: '32%',
          left: '46%',
          color: 'rgba(255, 48, 48, 0.6)',
          fontSize: '1.1rem',
          fontWeight: 300,
          pointerEvents: 'none'
        }}>
          +
        </div>

        {/* Hero Left Content */}
        <div style={{ position: 'relative', zIndex: 2, paddingLeft: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
            <span style={{ width: '3px', height: '14px', background: 'var(--accent-red)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.14em', color: '#A1A1AA', textTransform: 'uppercase' }}>
              AI-POWERED CODE INTELLIGENCE
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.6rem, 5vw, 4.4rem)',
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
            marginBottom: '24px'
          }}>
            Your codebase.<br />
            <span style={{
              background: 'linear-gradient(90deg, #FFFFFF 0%, #FF303F 85%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>
              Finally understood.
            </span>
          </h1>

          <p style={{
            fontSize: '1rem',
            color: 'var(--text-muted)',
            lineHeight: 1.65,
            maxWidth: '520px',
            marginBottom: '34px'
          }}>
            Understand complex repositories, uncover hidden dependencies, and review pull requests with AI that looks beyond the changed lines.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '46px' }}>
            <button
              onClick={() => onSelectTab('repos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'var(--accent-red)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.92rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(255, 48, 63, 0.35)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(255, 48, 63, 0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(255, 48, 63, 0.35)'; }}
            >
              Connect GitHub Repository
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onSelectTab('home')}
              style={{
                padding: '12px 22px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.92rem',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 48, 63, 0.5)'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              Explore Dashboard
            </button>
          </div>

          {/* Social Proof / Stats Row directly below buttons */}
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1 }}>10K+</div>
              <div style={{ fontSize: '0.74rem', color: '#7E7E8B', marginTop: '6px' }}>Developers</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1 }}>50K+</div>
              <div style={{ fontSize: '0.74rem', color: '#7E7E8B', marginTop: '6px' }}>Repositories Analyzed</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1 }}>95%</div>
              <div style={{ fontSize: '0.74rem', color: '#7E7E8B', marginTop: '6px' }}>Faster Code Reviews</div>
            </div>
          </div>
        </div>

        {/* Hero Right: Interactive Code Review Window matching screenshot */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{
            background: '#0F0F12',
            border: '1px solid #24242A',
            borderRadius: '12px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(255, 48, 48, 0.05)',
            overflow: 'hidden'
          }}>
            {/* Window Titlebar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: '#131317',
              borderBottom: '1px solid #202026'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F56', display: 'inline-block' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27C93F', display: 'inline-block' }} />
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: '#8E8E98' }}>
                  payments-service/src/PaymentRecoveryService.java
                </span>
              </div>

              {/* 1 Issue Found Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(255, 48, 48, 0.12)',
                border: '1px solid rgba(255, 48, 48, 0.35)',
                color: 'var(--accent-red)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}>
                <AlertTriangle size={12} color="var(--accent-red)" />
                1 ISSUE FOUND
              </div>
            </div>

            {/* Code Diff Panel lines 40-48 */}
            <div style={{
              padding: '18px 20px',
              background: '#0A0A0D',
              borderBottom: '1px solid #202026',
              fontSize: '0.82rem',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.68
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', color: '#D4D4D8' }}>
                <span style={{ color: '#52525E' }}>40</span>
                <span><span style={{ color: '#FF7070' }}>public async</span> processFailedPayment() &#123;</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', color: '#D4D4D8' }}>
                <span style={{ color: '#52525E' }}>41</span>
                <span>&nbsp;&nbsp;<span style={{ color: '#FF7070' }}>const</span> staleRecords = <span style={{ color: '#FF7070' }}>await</span> this.repo.findStale();</span>
              </div>
              {/* Line 43: Red Deletion */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr',
                background: 'rgba(255, 48, 48, 0.22)',
                color: '#FFA1A1',
                padding: '1px 0',
                margin: '2px 0',
                borderRadius: '3px'
              }}>
                <span style={{ color: '#FF7070', paddingLeft: '2px' }}>43&nbsp;&nbsp;-</span>
                <span>await this.recreateRecovery(staleRecords);</span>
              </div>
              {/* Line 44: Green Addition */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#4ADE80',
                padding: '1px 0',
                margin: '2px 0',
                borderRadius: '3px'
              }}>
                <span style={{ color: '#34D399', paddingLeft: '2px' }}>44&nbsp;&nbsp;+</span>
                <span>await this.acquireClaimLease(staleRecords);</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', color: '#D4D4D8' }}>
                <span style={{ color: '#52525E' }}>45</span>
                <span>&nbsp;&nbsp;<span style={{ color: '#FF7070' }}>await</span> this.executeRecoveryWithLease(staleRecords);</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', color: '#D4D4D8' }}>
                <span style={{ color: '#52525E' }}>47</span>
                <span>&#125;</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', color: '#52525E' }}>
                <span>48</span>
                <span></span>
              </div>
            </div>

            {/* Sub-tabs bar: AI Explanation | PR Review | File Structure | Suggested Fix */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '0 20px',
              background: '#0D0D10',
              borderBottom: '1px solid #202026',
              fontSize: '0.78rem',
              fontWeight: 600,
              overflowX: 'auto'
            }}>
              <button
                onClick={() => setHeroTab('explanation')}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: heroTab === 'explanation' ? '2px solid var(--accent-red)' : '2px solid transparent',
                  color: heroTab === 'explanation' ? 'var(--accent-red)' : '#8E8E98',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: heroTab === 'explanation' ? 700 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <AlertTriangle size={13} color={heroTab === 'explanation' ? 'var(--accent-red)' : '#8E8E98'} />
                AI Explanation
              </button>

              <button
                onClick={() => setHeroTab('pr-review')}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: heroTab === 'pr-review' ? '2px solid var(--accent-red)' : '2px solid transparent',
                  color: heroTab === 'pr-review' ? 'var(--accent-red)' : '#8E8E98',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: heroTab === 'pr-review' ? 700 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <GitPullRequest size={13} color={heroTab === 'pr-review' ? 'var(--accent-red)' : '#8E8E98'} />
                PR Review
              </button>

              <button
                onClick={() => setHeroTab('files')}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: heroTab === 'files' ? '2px solid var(--accent-red)' : '2px solid transparent',
                  color: heroTab === 'files' ? 'var(--accent-red)' : '#8E8E98',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: heroTab === 'files' ? 700 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <Layers size={13} color={heroTab === 'files' ? 'var(--accent-red)' : '#8E8E98'} />
                File Structure
              </button>

              <button
                onClick={() => setHeroTab('fix')}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: heroTab === 'fix' ? '2px solid var(--accent-red)' : '2px solid transparent',
                  color: heroTab === 'fix' ? 'var(--accent-red)' : '#8E8E98',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: heroTab === 'fix' ? 700 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <CheckCircle2 size={13} color={heroTab === 'fix' ? 'var(--accent-red)' : '#8E8E98'} />
                Suggested Fix
              </button>
            </div>

            {/* Active Tab Body: Potential duplicate payment finding */}
            <div style={{ padding: '20px 22px', background: 'var(--bg-card)' }}>
              {heroTab === 'explanation' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'var(--accent-red)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 900
                    }}>
                      !
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                      Potential duplicate payment
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: 'var(--accent-red)',
                      border: '1px solid rgba(255, 48, 63, 0.4)',
                      background: 'rgba(255, 48, 63, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      High Severity
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.55,
                    marginBottom: '16px'
                  }}>
                    Un-idempotent database insertion on retry execution could lead to duplicate payment execution records if a network partition occurs during commit phase.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#7E7E8B' }}>Affects:</span>
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#D4D4D8',
                        background: '#1B1518',
                        border: '1px solid var(--border-subtle)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        PaymentLog.java
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#D4D4D8',
                        background: '#1B1518',
                        border: '1px solid var(--border-subtle)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        PaymentRecoveryService.java
                      </span>
                    </div>

                    <button
                      onClick={() => onSelectTab('pr-review')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-red)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0
                      }}
                    >
                      Inspect Full PR Review &rarr;
                    </button>
                  </div>
                </>
              )}

              {heroTab === 'pr-review' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GitPullRequest size={16} color="var(--accent-red)" />
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                        PR #4: Refactor stale payment retry worker
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: 'var(--accent-red)',
                      border: '1px solid rgba(255, 48, 63, 0.4)',
                      background: 'rgba(255, 48, 63, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      Changes Requested
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                    Branch: <code style={{ color: '#F5F5F5', background: '#1B1518', padding: '1px 5px', borderRadius: '3px' }}>fix/stale-retries</code> &rarr; <code style={{ color: '#F5F5F5', background: '#1B1518', padding: '1px 5px', borderRadius: '3px' }}>main</code> &bull; 2 changed files (+14 -4 lines)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onSelectTab('pr-review')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Open Pull Request Workspace &rarr;
                    </button>
                  </div>
                </>
              )}

              {heroTab === 'files' && (
                <>
                  <div style={{ fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace", color: '#A1A1AA', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ color: '#D4D4D8' }}>📁 payments-service/src</div>
                    <div style={{ paddingLeft: '16px', color: '#D4D4D8' }}>📁 services/</div>
                    <div style={{ paddingLeft: '32px', color: 'var(--accent-red)', fontWeight: 600 }}>
                      📄 PaymentRecoveryService.java <span style={{ fontSize: '0.65rem', color: '#FF303F' }}>[1 issue]</span>
                    </div>
                    <div style={{ paddingLeft: '32px', color: '#71717A' }}>📄 PaymentLog.java</div>
                    <div style={{ paddingLeft: '16px', color: '#71717A' }}>📁 controllers/PaymentController.java</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      onClick={() => onSelectTab('tree')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Explore Architecture Tree &rarr;
                    </button>
                  </div>
                </>
              )}

              {heroTab === 'fix' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#22C55E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 900
                    }}>
                      ✓
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                      Acquire distributed claim lease
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: '#22C55E',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      background: 'rgba(34, 197, 94, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      Recommended Fix
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '16px' }}>
                    Replace immediate recovery with an atomic lease acquisition query so multiple workers never recover the same record simultaneously.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onSelectTab('pr-review')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Apply Suggested Patch &rarr;
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: "Everything you need for better code reviews." (Exact match)
          ========================================================================= */}
      <section style={{
        position: 'relative',
        padding: '90px 24px 100px',
        maxWidth: '1440px',
        margin: '0 auto',
        borderTop: '1px solid #1E1E24'
      }}>
        {/* Category & Headline Header Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(380px, 1.2fr) minmax(320px, 1fr)',
          gap: '30px',
          alignItems: 'flex-end',
          marginBottom: '50px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '3px', height: '14px', background: 'var(--accent-red)', display: 'inline-block' }} />
              <span style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.14em', color: '#8E8E98', textTransform: 'uppercase' }}>
                BUILT FOR DEVELOPERS
              </span>
            </div>
            <h2 style={{
              fontSize: 'clamp(2rem, 3.6vw, 3rem)',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: '#FFFFFF'
            }}>
              Everything you need for <span style={{ color: 'var(--accent-red)' }}>better code reviews.</span>
            </h2>
          </div>

          <div>
            <p style={{
              fontSize: '0.95rem',
              color: '#9E9EA8',
              lineHeight: 1.6,
              maxWidth: '460px',
              marginLeft: 'auto'
            }}>
              From understanding complex codebases to catching critical issues, CodeSense helps you ship with confidence.
            </p>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '50px'
        }}>
          {/* Card 1: AI Code Explanation */}
          <div
            onClick={() => onSelectTab('comprehension')}
            style={{
              background: '#111114',
              border: '1px solid #202026',
              borderRadius: '12px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              minHeight: '210px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 48, 48, 0.45)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,48,48,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#202026';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 48, 48, 0.45)',
                background: 'rgba(255, 48, 48, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <FileText size={20} color="var(--accent-red)" />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                AI Code Explanation
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#8E8E98', lineHeight: 1.55 }}>
                Understand complex code in simple terms with AI-powered explanations.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid #2E2E36',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9E9EA8'
              }}>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>

          {/* Card 2: Pull Request Review */}
          <div
            onClick={() => onSelectTab('pr-review')}
            style={{
              background: '#111114',
              border: '1px solid #202026',
              borderRadius: '12px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              minHeight: '210px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 48, 48, 0.45)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,48,48,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#202026';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 48, 48, 0.45)',
                background: 'rgba(255, 48, 48, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <GitPullRequest size={20} color="var(--accent-red)" />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                Pull Request Review
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#8E8E98', lineHeight: 1.55 }}>
                Get intelligent reviews, catch bugs, and improve code quality automatically.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid #2E2E36',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9E9EA8'
              }}>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>

          {/* Card 3: Call Graph Analysis */}
          <div
            onClick={() => onSelectTab('tree')}
            style={{
              background: '#111114',
              border: '1px solid #202026',
              borderRadius: '12px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              minHeight: '210px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 48, 48, 0.45)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,48,48,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#202026';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 48, 48, 0.45)',
                background: 'rgba(255, 48, 48, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Share2 size={20} color="var(--accent-red)" />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                Call Graph Analysis
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#8E8E98', lineHeight: 1.55 }}>
                Visualize function dependencies and trace code execution paths.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid #2E2E36',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9E9EA8'
              }}>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>

          {/* Card 4: Automatic Error Detection */}
          <div
            onClick={() => onSelectTab('pr-review')}
            style={{
              background: '#111114',
              border: '1px solid #202026',
              borderRadius: '12px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              minHeight: '210px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 48, 48, 0.45)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,48,48,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#202026';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 48, 48, 0.45)',
                background: 'rgba(255, 48, 48, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <ShieldCheck size={20} color="var(--accent-red)" />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '10px' }}>
                Automatic Error Detection
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#8E8E98', lineHeight: 1.55 }}>
                Detect potential bugs, security vulnerabilities, and performance issues.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid #2E2E36',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9E9EA8'
              }}>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>
        </div>

        {/* Floating Scroll Indicator on Bottom-Left */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: '#555562',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.14em',
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          <ArrowDown size={14} color="#777785" />
          <span>SCROLL TO EXPLORE</span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: EVIDENCE-BASED REVIEW PREVIEW (Wide panel matching screenshot)
          ========================================================================= */}
      <section style={{
        padding: '80px 24px',
        maxWidth: '1360px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            No guesses. <span style={{ color: 'var(--accent-red)' }}>Just evidence.</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '6px' }}>
            Every finding comes with concrete references, code evidence, and impact explanation.
          </p>
        </div>

        {/* Wide Evidence Panel */}
        <div className="glass-panel" style={{
          padding: '28px 32px',
          background: '#121215',
          border: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: '1fr 220px',
          gap: '30px',
          alignItems: 'center'
        }}>
          {/* Left Column: Finding details & diff code snippet */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                FINDING 01
              </span>
              <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>High Risk</span>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
              Retry path may duplicate persistence
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Potentially duplicate record inserted when transient DB failure occurs before lease expiration.
            </p>

            {/* Code Snippet Box */}
            <div style={{
              background: '#09090C',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '14px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem',
              lineHeight: 1.6
            }}>
              <div style={{ color: '#71717A' }}>// payment_recovery_handler.go:L142</div>
              <div style={{ color: '#E4E4E7' }}>if payment != nil &amp;&amp; !retry_attempted &#123;</div>
              <div style={{ color: '#FF7070', background: 'rgba(255, 48, 48, 0.12)', padding: '2px 6px', borderRadius: '3px', margin: '2px 0' }}>
                -&nbsp;&nbsp;to.persist(transient_id, payment)
              </div>
              <div style={{ color: '#34D399', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 6px', borderRadius: '3px', margin: '2px 0' }}>
                +&nbsp;&nbsp;to.persist_idempotent(transient_id, payment, lease_token)
              </div>
              <div style={{ color: '#E4E4E7' }}>&#125;</div>
            </div>

            {/* Toggleable Full Diff Context */}
            {showFullDiff && (
              <div style={{
                marginTop: '14px',
                padding: '14px',
                background: '#09090C',
                border: '1px solid rgba(255, 48, 48, 0.3)',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: '#D4D4D8'
              }}>
                <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: '6px' }}>
                  Full Method Context &amp; Call Graph Impact:
                </div>
                <div>&bull; Caller: PaymentReconciliationWorker.run() in worker_node.go:L88</div>
                <div>&bull; Transaction Boundary: @Transactional(propagation = REQUIRED)</div>
                <div>&bull; Suggested Test: test_concurrent_recovery_preserves_idempotency()</div>
              </div>
            )}
          </div>

          {/* Right Column: Confidence Bar and Action */}
          <div style={{
            borderLeft: '1px solid var(--border-subtle)',
            paddingLeft: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: '14px'
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em' }}>
              CONFIDENCE
            </span>

            {/* Large 82% with vertical red bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '4px',
                height: '56px',
                background: 'var(--bg-input)',
                borderRadius: '2px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '100%',
                  height: '82%',
                  background: 'var(--accent-red)',
                  boxShadow: '0 0 10px rgba(255, 48, 48, 0.8)'
                }} />
              </div>
              <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                82%
              </span>
            </div>

            <button
              onClick={() => setShowFullDiff(!showFullDiff)}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 16px', width: '100%', justifyContent: 'center' }}
            >
              {showFullDiff ? 'Hide Details' : 'View Diff'}
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: FROM INSIGHT TO COVERAGE
          ========================================================================= */}
      <section style={{
        padding: '70px 24px',
        maxWidth: '1360px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFFFFF' }}>
            From insight to coverage.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Automated recommendations turn findings into verifiable code improvements.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Card 1 */}
          <div className="glass-panel" style={{ padding: '22px', borderLeft: '3px solid var(--accent-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-red)' }}>GENERATE TEST</span>
              <span className="badge badge-critical" style={{ fontSize: '0.62rem' }}>HIGH RISK</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>
              @Test void test_retry_on_timeout()
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Synthesizes regression test recipe asserting lease lock acquisition during transient retry.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel" style={{ padding: '22px', borderLeft: '3px solid var(--accent-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-red)' }}>AUTO-FIX</span>
              <span className="badge badge-low" style={{ fontSize: '0.62rem' }}>RECOMMENDED</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>
              @Test void returns_cached_lease()
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Bound retry loops and apply exponential backoff jitter to prevent thundering herd.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel" style={{ padding: '22px', borderLeft: '3px solid var(--accent-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-red)' }}>IMPACT AUDIT</span>
              <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>REVIEWED</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '6px' }}>
              @Test void locks_on_concurrent_charge()
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verified downstream call sites and schema constraints mapped via AST caller hierarchy.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => onSelectTab('pr-review')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-red)',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Explore automated test coverage &rarr;
          </button>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: A CLEARER PATH THROUGH COMPLEXITY
          ========================================================================= */}
      <section style={{
        padding: '70px 24px',
        maxWidth: '1360px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '40px' }}>
          A clearer path through complexity.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', textAlign: 'left' }}>
          <div style={{ borderTop: '2px solid var(--accent-red)', paddingTop: '20px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-red)', fontFamily: 'monospace' }}>01</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 6px' }}>Connect your repository</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Import any GitHub repository or authenticate to automatically sync all your personal and team repos.
            </p>
          </div>

          <div style={{ borderTop: '2px solid var(--border-subtle)', paddingTop: '20px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-dim)', fontFamily: 'monospace' }}>02</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 6px' }}>Ask about any change</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Browse the visual code tree, query architecture questions, or submit a pull request URL for deep analysis.
            </p>
          </div>

          <div style={{ borderTop: '2px solid var(--border-subtle)', paddingTop: '20px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-dim)', fontFamily: 'monospace' }}>03</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 6px' }}>Ship with confidence</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Merge pull requests with verified caller impact, identified edge-case regressions, and zero hallucinated review comments.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: BUILT ON A SERIOUS STACK
          ========================================================================= */}
      <section style={{
        padding: '50px 24px',
        maxWidth: '1360px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center'
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          ENGINEERED FOR PRODUCTION CODEBASES
        </span>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 20px' }}>
          Built on a serious stack.
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', maxWidth: '800px', margin: '0 auto' }}>
          {[
            'Java 21',
            'Spring Boot',
            'Hibernate / JPA',
            'PostgreSQL pgvector',
            'AST Parser',
            'GitHub REST API',
            'Motion',
            'Oxlint'
          ].map((tech) => (
            <span
              key={tech}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: '#D4D4D8',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                padding: '6px 14px',
                borderRadius: '6px'
              }}
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Architecture Pipeline Flow from Screenshot */}
        <div style={{
          marginTop: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          <span>Raw source</span>
          <span style={{ color: 'var(--accent-red)' }}>&rarr;</span>
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>AST Parser</span>
          <span style={{ color: 'var(--accent-red)' }}>&rarr;</span>
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Semantic Graph</span>
          <span style={{ color: 'var(--accent-red)' }}>&rarr;</span>
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Vector Database</span>
          <span style={{ color: 'var(--accent-red)' }}>&rarr;</span>
          <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>PR Review Engine</span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: FINAL CTA (Matching reference screenshot)
          ========================================================================= */}
      <section style={{
        padding: '80px 24px 100px',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        textAlign: 'center'
      }}>
        <div className="glass-panel" style={{
          padding: '60px 32px',
          background: '#121215',
          border: '1px solid rgba(255, 48, 48, 0.25)',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 0 50px rgba(255, 48, 48, 0.08)'
        }}>
          {/* Low-opacity background text */}
          <div className="bg-giant-text" style={{ bottom: '-30px', left: '50%', transform: 'translateX(-50%)', opacity: 0.035 }}>
            WHAT THE HACK
          </div>

          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            GLOBAL HACK WEEK &bull; AI COPILOT
          </span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#FFFFFF', margin: '12px 0 16px', letterSpacing: '-0.02em' }}>
            Make the codebase make sense.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 28px' }}>
            Start analyzing PRs and tracing call graphs in seconds.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onSelectTab('tree')}
              className="btn-primary"
              style={{ padding: '12px 28px', fontSize: '0.95rem' }}
            >
              Get Started Free
              <ArrowRight size={17} />
            </button>
            <button
              onClick={() => onSelectTab('tree')}
              className="btn-secondary"
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              Read the Docs
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER (Matching reference screenshot)
          ========================================================================= */}
      <footer style={{
        padding: '36px 32px',
        maxWidth: '1360px',
        margin: '0 auto',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        color: 'var(--text-dim)',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#FFFFFF' }}>
            <span style={{ color: 'var(--accent-red)' }}>&lt;/&gt;</span> CodeSense
          </div>
          <span>&bull;</span>
          <span>&copy; 2026 CodeSense. Built with precision.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="#features" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 700, behavior: 'smooth' }); }} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Features
          </a>
          <a href="#status" onClick={(e) => { e.preventDefault(); onSelectTab('tree'); }} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Status
          </a>
          <a href="#privacy" onClick={(e) => { e.preventDefault(); }} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Privacy Policy
          </a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); }} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}
