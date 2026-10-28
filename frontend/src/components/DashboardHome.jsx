import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ShieldCheck,
  RefreshCw,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ExternalLink,
  Zap,
  Code2,
  Check,
  Copy,
  Terminal,
  Activity,
  FileCode,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';


export default function DashboardHome({
  selectedRepo,
  repos = [],
  onSelectRepo,
  onNavigateTab,
  onInspectPr
}) {
  const [flowTab, setFlowTab] = useState('overview'); // 'overview' | 'security' | 'database'
  const [selectedNodeId, setSelectedNodeId] = useState('billing-controller');
  const [inspecting, setInspecting] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(false);

  // Dynamic measuring refs for responsive SVG curves
  const canvasRef = useRef(null);
  const cardBillingRef = useRef(null);
  const cardPetRef = useRef(null);
  const cardClinicRef = useRef(null);
  const cardVisitRef = useRef(null);
  const cardInvoiceRef = useRef(null);
  const cardPaymentRef = useRef(null);

  const [paths, setPaths] = useState({
    billingToClinic: '',
    petToClinic: '',
    clinicToInvoice: '',
    clinicToPayment: ''
  });

  const recalculateCurves = useCallback(() => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const getRightPort = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.right - canvasRect.left, y: r.top + r.height / 2 - canvasRect.top };
    };

    const getLeftPort = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - canvasRect.left, y: r.top + r.height / 2 - canvasRect.top };
    };

    const makeCurve = (p1, p2) => {
      if (!p1 || !p2) return '';
      const dx = Math.max(30, (p2.x - p1.x) * 0.45);
      return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    };

    const pBilling = getRightPort(cardBillingRef.current);
    const pPet = getRightPort(cardPetRef.current);
    const pClinicIn = getLeftPort(cardClinicRef.current);
    const pClinicOut = getRightPort(cardClinicRef.current);
    const pInvoiceIn = getLeftPort(cardInvoiceRef.current);
    const pPaymentIn = getLeftPort(cardPaymentRef.current);

    setPaths({
      billingToClinic: makeCurve(pBilling, pClinicIn),
      petToClinic: makeCurve(pPet, pClinicIn),
      clinicToInvoice: makeCurve(pClinicOut, pInvoiceIn),
      clinicToPayment: makeCurve(pClinicOut, pPaymentIn)
    });
  }, []);

  useEffect(() => {
    recalculateCurves();
    const timer = setTimeout(recalculateCurves, 200);
    window.addEventListener('resize', recalculateCurves);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalculateCurves);
    };
  }, [recalculateCurves]);


  // Nodes for the Interactive Change Flow Map
  const flowNodes = [
    {
      id: 'billing-controller',
      name: 'BillingController.java',
      layer: 'WEB & API LAYER',
      layerSub: 'Port :8080',
      type: 'REST',
      path: '/api/invoices (REST)',
      hasAlert: true,
      alertText: 'Missing @PreAuthorize',
      diffAdd: 23,
      diffDel: 4,
      status: 'Needs Review',
      role: 'Receives HTTP billing operations, dispatches token validations, and invokes transactional checkout pipelines.',
      upstream: ['API Gateway', 'Web Client'],
      downstream: ['ClinicService.java', 'PaymentGateway.java'],
      endpoints: ['GET /api/invoices (200 OK)', 'POST /api/invoices/checkout (Auth Pending)']
    },
    {
      id: 'pet-resource',
      name: 'PetResource.java',
      layer: 'WEB & API LAYER',
      layerSub: 'Port :8080',
      type: 'REST',
      path: '/api/pets (GET/POST)',
      hasAlert: false,
      diffText: '0 changes in branch',
      status: 'Ready',
      role: 'Exposes REST endpoints for pet lookups, vaccination certificates, and clinic intake registrations.',
      upstream: ['Web Portal', 'Mobile App'],
      downstream: ['ClinicService.java', 'VisitService.java'],
      endpoints: ['GET /api/pets/{id} (200 OK)', 'POST /api/pets/register (201 Created)']
    },
    {
      id: 'clinic-service',
      name: 'ClinicService.java',
      layer: 'CORE SERVICE LAYER',
      layerSub: 'Central Hub',
      type: 'SERVICE',
      subtitle: 'Primary Coordinator',
      description: '8 safe workflow lines. Receives billing requests and invokes transactional repositories seamlessly.',
      hasAlert: false,
      status: 'All paths clear',
      metric: '0 ms lag',
      role: 'Core domain coordinator managing transactional state, billing leases, and appointment validation logic.',
      upstream: ['BillingController.java', 'PetResource.java'],
      downstream: ['InvoiceRepository.java', 'PaymentGateway.java'],
      endpoints: ['executeBillingWorkflow()', 'auditTransactionalCommit()']
    },
    {
      id: 'visit-service',
      name: 'VisitService.java',
      layer: 'CORE SERVICE LAYER',
      layerSub: 'Central Hub',
      type: 'SERVICE',
      subtitle: 'Scheduling Workflow',
      description: 'Appointment queue safe 102% SLA',
      hasAlert: false,
      status: 'Safe',
      metric: '102% SLA',
      role: 'Handles appointment queues, calendar scheduling, and automated patient reminder dispatches.',
      upstream: ['PetResource.java'],
      downstream: ['InvoiceRepository.java'],
      endpoints: ['enqueueVisit()', 'verifyScheduleCapacity()']
    },
    {
      id: 'invoice-repository',
      name: 'InvoiceRepository.java',
      layer: 'DATA & EXTERNAL',
      layerSub: 'PostgreSQL / TLS',
      type: 'REPO',
      path: 'invoices, clinic_bills',
      description: 'Non-breaking Schema • Verified',
      hasAlert: false,
      status: 'Verified',
      role: 'JPA entity persistence layer mapping PostgreSQL invoices, audit records, and settlement entries.',
      upstream: ['ClinicService.java', 'VisitService.java'],
      downstream: ['PostgreSQL Cluster (Primary)'],
      endpoints: ['saveInvoice()', 'findByCustomerId()']
    },
    {
      id: 'payment-gateway',
      name: 'PaymentGateway.java',
      layer: 'DATA & EXTERNAL',
      layerSub: 'PostgreSQL / TLS',
      type: 'INTEGRATION',
      path: 'Encrypted Stripe Sink',
      description: 'TLS 1.3 webhook connection • Active',
      hasAlert: false,
      status: 'Active',
      role: 'Secure integration gateway communicating with Stripe endpoints with HMAC signature verification.',
      upstream: ['ClinicService.java'],
      downstream: ['Stripe External API (TLS 1.3)'],
      endpoints: ['dispatchChargeWebhook()', 'verifyHmacToken()']
    }
  ];

  const selectedNode = flowNodes.find(n => n.id === selectedNodeId) || flowNodes[0];

  const handleApplyFix = () => {
    setFixApplied(true);
    setTimeout(() => setFixApplied(false), 4000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`@PreAuthorize("hasRole('ADMIN')")\n@PostMapping("/api/invoices")\npublic ResponseEntity<InvoiceResponse> createInvoice(@RequestBody @Valid InvoiceRequest req) {\n    return ResponseEntity.ok(billingService.processInvoice(req));\n}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRunInspection = () => {
    setInspecting(true);
    setTimeout(() => {
      setInspecting(false);
    }, 1200);
  };

  return (
    <div style={{ maxWidth: '1680px', margin: '0 auto', padding: '24px 28px', color: '#F5F5F5' }}>
      {/* =========================================================================
          OVERVIEW SUMMARY CARDS (Crimson Void Data Metrics)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Connected Repositories */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Connected Repositories
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
              {repos.length}
            </div>
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--accent-red-subtle)',
            border: '1px solid rgba(255, 48, 63, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)'
          }}>
            <Layers size={18} />
          </div>
        </div>

        {/* Indexed Files */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Indexed Files
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
              {selectedRepo?.filesCount || (selectedRepo ? 48 : 0)}
            </div>
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--accent-red-subtle)',
            border: '1px solid rgba(255, 48, 63, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)'
          }}>
            <FileCode size={18} />
          </div>
        </div>

        {/* Pull Requests Reviewed */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pull Requests Reviewed
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
              {selectedRepo ? 1 : 0}
            </div>
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--accent-red-subtle)',
            border: '1px solid rgba(255, 48, 63, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)'
          }}>
            <GitPullRequest size={18} />
          </div>
        </div>

        {/* Outstanding Findings */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Outstanding Findings
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-red)', marginTop: '4px' }}>
              {selectedRepo ? 1 : 0}
            </div>
          </div>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--accent-red-subtle)',
            border: '1px solid rgba(255, 48, 63, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)'
          }}>
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: REPOSITORY PULSE & CHANGE RADAR
          ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '28px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '14px',
        padding: '24px 28px'
      }}>
        {/* Left Pulse Summary */}
        <div style={{ flex: 1, minWidth: '400px' }}>
          {/* Status Sub-badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.74rem',
              color: 'var(--text-dim)',
              fontFamily: "'JetBrains Mono', monospace",
              background: '#18181C',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #29292E'
            }}>
              {selectedRepo ? selectedRepo.fullName : 'spring-petclinic-rest'} : main
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              color: '#34D399',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
              96% Healthy Repository
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Scanned 2 mins ago
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              Repository Pulse &amp; Change Radar
            </h1>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              background: 'var(--accent-red)',
              color: '#FFFFFF',
              padding: '2px 7px',
              borderRadius: '4px',
              letterSpacing: '0.05em'
            }}>
              LIVE
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55, maxWidth: '680px', marginBottom: '20px' }}>
            Welcome back! CodeSense scanned <strong style={{ color: '#FFFFFF' }}>34 commits</strong> across 4 services. Your system is in great shape with just <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>1 minor check</span> recommended before deploying.
          </p>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <motion.button
              onClick={() => onNavigateTab('comprehension')}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px', gap: '6px' }}
            >
              <Sparkles size={14} color="var(--accent-red)" />
              Explain Today's PR In Plain English
            </motion.button>

            <motion.button
              onClick={() => setShowSandboxModal(true)}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px', gap: '6px' }}
            >
              <Code2 size={14} color="#34D399" />
              Test Changes In Sandbox
            </motion.button>

            <motion.button
              onClick={() => onNavigateTab('tree')}
              whileHover={{ y: -1, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px', gap: '6px' }}
            >
              <Activity size={14} color="var(--accent-red)" />
              Map Data Flow
            </motion.button>
          </div>
        </div>

        {/* Right Radar Card: Clean Architecture 96% */}
        <div style={{
          background: '#16161A',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          minWidth: '240px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
            {/* 96% Circle Badge */}
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(255, 48, 48, 0.12)',
              border: '2px solid var(--accent-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '1.05rem',
              boxShadow: '0 0 16px rgba(255, 48, 48, 0.25)'
            }}>
              96<span style={{ fontSize: '0.68rem', color: 'var(--accent-red)' }}>%</span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>Clean Architecture</span>
                <ShieldCheck size={16} color="var(--text-dim)" />
              </div>
              <div style={{ fontSize: '0.74rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981' }} />
                All Services Green
              </div>
            </div>
          </div>

          <motion.button
            onClick={handleRunInspection}
            disabled={inspecting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary"
            style={{ width: '100%', fontSize: '0.82rem', padding: '9px 14px', gap: '6px' }}
          >
            <RefreshCw size={14} className={inspecting ? 'animate-spin' : ''} />
            {inspecting ? 'Inspecting AST Chunks...' : 'Run Fresh Inspection'}
          </motion.button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: MAIN GRID (Change Flow Map Left + What Changed This Week Right)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(600px, 1.8fr) minmax(360px, 1fr)',
        gap: '24px',
        marginBottom: '28px'
      }}>
        {/* LEFT COLUMN: INTERACTIVE CHANGE FLOW MAP */}
        <div style={{
          background: '#121215',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Interactive Change Flow Map
                </h3>
                <span style={{
                  fontSize: '0.65rem',
                  fontFamily: 'monospace',
                  background: '#18181C',
                  border: '1px solid #29292E',
                  color: 'var(--text-dim)',
                  padding: '1px 6px',
                  borderRadius: '4px'
                }}>
                  Trace v2.4
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Follow the exact path of code modifications from incoming web requests down to SQL tables.
              </p>
            </div>

            {/* Filter Subtabs */}
            <div style={{
              display: 'flex',
              background: '#0B0B0E',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)'
            }}>
              {[
                { id: 'overview', label: 'Overview Flow' },
                { id: 'security', label: 'Security & Permissions' },
                { id: 'database', label: 'Database Impact' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFlowTab(tab.id)}
                  style={{
                    background: flowTab === tab.id ? 'var(--accent-red)' : 'transparent',
                    color: flowTab === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '0.74rem',
                    fontWeight: flowTab === tab.id ? 700 : 500,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Flow Canvas */}
          <div
            ref={canvasRef}
            style={{
              position: 'relative',
              background: '#09090C',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px 22px',
              minHeight: '440px',
              overflow: 'hidden',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px'
            }}
          >
            {/* Top Canvas Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', zIndex: 10, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#F5F5F5', fontWeight: 600 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-red)' }} />
                  Live Architecture Graph
                </span>
                <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
                <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⇄ 6 Nodes &bull; 5 Traced Paths
                </span>
                <span style={{ color: 'var(--text-dim)' }}>&bull;</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF7070' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-red)' }} />
                  1 Needs Review
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34D399' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                  5 Safe Nodes
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onNavigateTab('tree')}
                  style={{
                    background: '#16161A',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-dim)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Expand to full Architecture Topology"
                >
                  <Maximize2 size={12} />
                  Full Map
                </button>
              </div>
            </div>

            {/* Dynamic SVG Connecting Curves */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
              <defs>
                <linearGradient id="curveRedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FF3030" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="curveGreenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#34D399" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Curve 1: BillingController -> ClinicService */}
              <path
                d={paths.billingToClinic || "M 230 145 C 290 145, 310 180, 370 180"}
                fill="none"
                stroke="url(#curveRedGrad)"
                strokeWidth="2.5"
                strokeDasharray="4 3"
                opacity={flowTab === 'database' ? 0.2 : 1}
              />

              {/* Curve 2: PetResource -> ClinicService */}
              <path
                d={paths.petToClinic || "M 230 295 C 290 295, 310 210, 370 210"}
                fill="none"
                stroke="rgba(16, 185, 129, 0.45)"
                strokeWidth="1.8"
                opacity={flowTab === 'security' || flowTab === 'database' ? 0.2 : 0.8}
              />

              {/* Curve 3: ClinicService -> InvoiceRepository */}
              <path
                d={paths.clinicToInvoice || "M 540 180 C 600 180, 620 150, 680 150"}
                fill="none"
                stroke="url(#curveGreenGrad)"
                strokeWidth="2.2"
                opacity={flowTab === 'security' ? 0.2 : 1}
              />

              {/* Curve 4: ClinicService -> PaymentGateway */}
              <path
                d={paths.clinicToPayment || "M 540 210 C 600 210, 620 295, 680 295"}
                fill="none"
                stroke="rgba(59, 130, 246, 0.6)"
                strokeWidth="1.8"
                strokeDasharray="3 3"
                opacity={flowTab === 'database' ? 0.2 : 1}
              />
            </svg>

            {/* Three Columns of Change Flow Nodes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '24px',
              position: 'relative',
              zIndex: 3
            }}>
              {/* COLUMN 1: WEB & API LAYER */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: '12px' }}>
                  WEB &amp; API LAYER &bull; :8080
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Node 1: BillingController (Alert) */}
                  <motion.div
                    ref={cardBillingRef}
                    onClick={() => setSelectedNodeId('billing-controller')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ opacity: flowTab === 'database' ? 0.35 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: selectedNodeId === 'billing-controller' ? 'rgba(255, 48, 48, 0.08)' : '#141416',
                      border: selectedNodeId === 'billing-controller' ? '1.5px solid var(--accent-red)' : '1px solid rgba(255, 48, 48, 0.4)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 0 20px rgba(255, 48, 48, 0.15)',
                      position: 'relative'
                    }}
                  >
                    {/* Anchor Port Dot Right */}
                    <div style={{
                      position: 'absolute',
                      right: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: 'var(--accent-red)',
                      border: '2px solid #09090C',
                      boxShadow: '0 0 8px var(--accent-red)'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FFFFFF', fontFamily: "'JetBrains Mono', monospace" }}>
                        BillingController.java
                      </span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, background: 'var(--accent-red)', color: '#FFFFFF', padding: '1px 5px', borderRadius: '3px' }}>
                        1 Needs Review
                      </span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      /api/invoices (REST)
                    </div>

                    <div style={{
                      background: 'rgba(255, 48, 48, 0.12)',
                      border: '1px solid rgba(255, 48, 48, 0.3)',
                      borderRadius: '5px',
                      padding: '5px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.7rem'
                    }}>
                      <span style={{ color: '#FF7070', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} />
                        Missing @PreAuthorize
                      </span>
                      <span style={{ fontFamily: 'monospace', color: '#34D399' }}>+28 / -4</span>
                    </div>
                  </motion.div>

                  {/* Node 2: PetResource */}
                  <motion.div
                    ref={cardPetRef}
                    onClick={() => setSelectedNodeId('pet-resource')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ opacity: flowTab === 'security' || flowTab === 'database' ? 0.35 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: selectedNodeId === 'pet-resource' ? 'rgba(16, 185, 129, 0.08)' : '#141416',
                      border: selectedNodeId === 'pet-resource' ? '1.5px solid #10B981' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {/* Anchor Port Dot Right */}
                    <div style={{
                      position: 'absolute',
                      right: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10B981',
                      border: '2px solid #09090C'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#FFFFFF', fontFamily: "'JetBrains Mono', monospace" }}>
                        PetResource.java
                      </span>
                      <span style={{ fontSize: '0.62rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981' }} />
                        Safe
                      </span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      /api/pets (GET/POST)
                    </div>

                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>0 changes in branch</span>
                      <span style={{ color: '#34D399' }}>Ready</span>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* COLUMN 2: CORE SERVICE LAYER */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: '12px' }}>
                  CORE SERVICE LAYER &bull; Hub
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Node 3: ClinicService */}
                  <motion.div
                    ref={cardClinicRef}
                    onClick={() => setSelectedNodeId('clinic-service')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ opacity: flowTab === 'security' ? 0.35 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: selectedNodeId === 'clinic-service' ? 'rgba(16, 185, 129, 0.08)' : '#141416',
                      border: selectedNodeId === 'clinic-service' ? '1.5px solid #10B981' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {/* Left Port Dot */}
                    <div style={{
                      position: 'absolute',
                      left: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10B981',
                      border: '2px solid #09090C'
                    }} />
                    {/* Right Port Dot */}
                    <div style={{
                      position: 'absolute',
                      right: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10B981',
                      border: '2px solid #09090C'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FFFFFF', fontFamily: "'JetBrains Mono', monospace" }}>
                        ClinicService.java
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600, marginBottom: '6px' }}>
                      Primary Coordinator
                    </div>

                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '10px' }}>
                      8 safe workflow lines. Receives billing requests and invokes transactional repositories seamlessly.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#34D399', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                      <span>&bull; All paths clear</span>
                      <span style={{ color: 'var(--text-dim)' }}>0 ms lag</span>
                    </div>
                  </motion.div>

                  {/* Node 4: VisitService */}
                  <motion.div
                    ref={cardVisitRef}
                    onClick={() => setSelectedNodeId('visit-service')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ opacity: flowTab === 'security' || flowTab === 'database' ? 0.35 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: selectedNodeId === 'visit-service' ? 'rgba(16, 185, 129, 0.08)' : '#141416',
                      border: selectedNodeId === 'visit-service' ? '1.5px solid #10B981' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#FFFFFF', fontFamily: "'JetBrains Mono', monospace" }}>
                        VisitService.java
                      </span>
                      <span style={{ fontSize: '0.62rem', color: '#34D399' }}>✓ Safe</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
                      Scheduling Workflow
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Appointment queue safe</span>
                      <span style={{ color: '#34D399', fontWeight: 700 }}>102% SLA</span>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* COLUMN 3: DATA & EXTERNAL */}
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: '12px' }}>
                  DATA &amp; EXTERNAL &bull; TLS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Node 5: InvoiceRepository */}
                  <motion.div
                    ref={cardInvoiceRef}
                    onClick={() => setSelectedNodeId('invoice-repository')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ opacity: flowTab === 'security' ? 0.35 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: selectedNodeId === 'invoice-repository' ? 'rgba(16, 185, 129, 0.08)' : '#141416',
                      border: selectedNodeId === 'invoice-repository' ? '1.5px solid #10B981' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {/* Left Port Dot */}
                    <div style={{
                      position: 'absolute',
                      left: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10B981',
                      border: '2px solid #09090C'
                    }} />

                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FFFFFF', fontFamily: "'JetBrains Mono', monospace", marginBottom: '4px' }}>
                      InvoiceRepository.java
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '8px' }}>
                      invoices, clinic_bills
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>Non-breaking Schema</span>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>Verified</span>
                    </div>
                  </motion.div>

                  {/* Node 6: PaymentGateway */}
                  <motion.div
                    ref={cardPaymentRef}
                    onClick={() => setSelectedNodeId('payment-gateway')}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ opacity: flowTab === 'database' ? 0.35 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      background: selectedNodeId === 'payment-gateway' ? 'rgba(59, 130, 246, 0.08)' : '#141416',
                      border: selectedNodeId === 'payment-gateway' ? '1.5px solid #3B82F6' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {/* Left Port Dot */}
                    <div style={{
                      position: 'absolute',
                      left: '-5px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#3B82F6',
                      border: '2px solid #09090C'
                    }} />

                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#FFFFFF', fontFamily: "'JetBrains Mono', monospace", marginBottom: '4px' }}>
                      PaymentGateway.java
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                      Encrypted Stripe Sink
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>TLS 1.3 webhook</span>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>Active</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>



            {/* Bottom Interaction Guide */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '12px',
              fontSize: '0.74rem',
              color: 'var(--text-dim)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--accent-red)' }}>👆</span> Click any node to trace its caller graph or preview changes line-by-line in plain English.
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24' }}>
                <Activity size={13} />
                Path Audits: 1 recommendation pending
              </span>
            </div>
          </div>

          {/* Fast Fix Banner for BillingController */}
          <div style={{
            background: '#16161A',
            border: '1px solid rgba(255, 48, 48, 0.35)',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '320px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 48, 48, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={18} color="var(--accent-red)" />
              </div>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Fast Fix Available for BillingController
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Add <code style={{ color: '#FF7070', background: 'rgba(255,48,48,0.1)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>@PreAuthorize("hasRole('ADMIN')")</code> to line 42 to make this branch 100% ready to deploy.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyCode}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '7px 12px', gap: '5px' }}
              >
                {copiedCode ? <Check size={13} color="#34D399" /> : <Copy size={13} />}
                {copiedCode ? 'Copied' : 'Copy Snippet'}
              </button>

              <button
                onClick={handleApplyFix}
                className="btn-primary"
                style={{ fontSize: '0.78rem', padding: '7px 14px', gap: '6px' }}
              >
                <Sparkles size={14} />
                {fixApplied ? '✓ Fix Recommended' : 'Apply Suggested Code'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: "WHAT CHANGED THIS WEEK?" WIDGET */}
        <div style={{
          background: '#121215',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '20px'
        }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                  What Changed This Week?
                </h3>
              </div>
              <span style={{
                fontSize: '0.68rem',
                fontFamily: 'monospace',
                background: '#18181C',
                border: '1px solid #29292E',
                color: 'var(--accent-red)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                34 Commits
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Visual breakdown of all code alterations across this repository.
            </p>

            {/* Segmented Color Progress Bar */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                height: '8px',
                borderRadius: '4px',
                background: '#1F1F24',
                overflow: 'hidden',
                display: 'flex',
                gap: '2px'
              }}>
                <div style={{ width: '45%', background: '#38BDF8' }} title="Features (45%)" />
                <div style={{ width: '30%', background: '#F59E0B' }} title="Bugs (30%)" />
                <div style={{ width: '15%', background: '#10B981' }} title="Tests & Docs (15%)" />
                <div style={{ width: '10%', background: 'var(--accent-red)' }} title="Security (10%)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                <span>0%</span>
                <span>4 categories tracked</span>
                <span>100%</span>
              </div>
            </div>

            {/* Change Categories Breakdown List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {/* Category 1 */}
              <div style={{
                background: '#16161A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🚀</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>Features Added</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Billing tokens &amp; UI polish</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF' }}>15 files</div>
                  <div style={{ fontSize: '0.68rem', color: '#38BDF8' }}>(45%)</div>
                </div>
              </div>

              {/* Category 2 */}
              <div style={{
                background: '#16161A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🐛</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>Bugs Squashed</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Null safety &amp; date parsers</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF' }}>10 files</div>
                  <div style={{ fontSize: '0.68rem', color: '#F59E0B' }}>(30%)</div>
                </div>
              </div>

              {/* Category 3 */}
              <div style={{
                background: '#16161A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>📝</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>Tests &amp; Docs</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>JUnit 5 &amp; REST specs</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF' }}>5 files</div>
                  <div style={{ fontSize: '0.68rem', color: '#10B981' }}>(15%)</div>
                </div>
              </div>

              {/* Category 4 */}
              <div style={{
                background: '#16161A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>Security Hardening</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Dependency bumps &amp; headers</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF' }}>4 files</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--accent-red)' }}>(10%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Plain-English Takeaway Bottom Card */}
          <div style={{
            background: '#0E0E12',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <span style={{ color: '#34D399', fontSize: '1.1rem', lineHeight: 1 }}>💡</span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: '#FFFFFF' }}>Plain-English Takeaway:</strong> Most changes this week are new payment features. No risk to existing pet or owner records.
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: BOTTOM GRID (Change Risk & Safety Score + Recent PR Activity)
          ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(420px, 1fr) minmax(480px, 1.2fr)',
        gap: '24px'
      }}>
        {/* BOTTOM LEFT: CHANGE RISK & SAFETY SCORE */}
        <div style={{
          background: '#121215',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '18px'
        }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#10B981" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Change Risk &amp; Safety Score
                </h3>
              </div>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#34D399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                Healthy &bull; Grade A
              </span>
            </div>

            {/* Overall Grade Card */}
            <div style={{
              background: '#16161A',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '18px'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10B981',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34D399',
                fontWeight: 900,
                fontSize: '1.25rem',
                lineHeight: 1
              }}>
                A
                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#FFFFFF' }}>96%</span>
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Overall Risk: Very Low
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Branch is fully test-validated and ready for deployment once PR #142 is approved.
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <CheckCircle2 size={16} color="#34D399" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>All <strong style={{ color: '#FFFFFF' }}>142 automated unit &amp; regression tests</strong> continue passing flawlessly</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <CheckCircle2 size={16} color="#34D399" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>No breaking SQL migration scripts or circular service loops detected</span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.8rem',
                color: '#FF8888',
                background: 'rgba(255, 48, 48, 0.08)',
                border: '1px solid rgba(255, 48, 48, 0.25)',
                borderRadius: '6px',
                padding: '8px 12px'
              }}>
                <AlertTriangle size={15} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Just 1 endpoint (<code style={{ color: '#FFFFFF' }}>/api/invoices</code>) needs security authorization header before release</span>
              </div>
            </div>
          </div>

          {/* Action Recommendation */}
          <div style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '14px',
            fontSize: '0.76rem',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#FBBF24' }}>💡</span>
            <span><strong style={{ color: '#FFFFFF' }}>What should I do next?</strong> Simply approve PR #142 after adding the permission tag, and you're 100% ready to ship to production.</span>
          </div>
        </div>

        {/* BOTTOM RIGHT: RECENT REPOSITORY ACTIVITY */}
        <div style={{
          background: '#121215',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '18px'
        }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitPullRequest size={18} color="var(--accent-red)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Recent Repository Activity
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                2 active pull requests
              </span>
            </div>

            {/* PR Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* PR Item 1: #142 */}
              <div style={{
                background: '#16161A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FF7070', fontFamily: 'monospace' }}>
                      PR #142
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>
                      Add user login security check
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: 'rgba(255, 48, 48, 0.15)',
                      color: '#FF7070',
                      border: '1px solid rgba(255, 48, 48, 0.3)',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      Needs 1 small fix
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Opened by <strong style={{ color: '#D4D4D8' }}>Alex Morgan</strong> &bull; 3 files changed &bull; Touching billing endpoint
                  </div>
                </div>

                <button
                  onClick={() => onNavigateTab('pr-review')}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '8px 16px' }}
                >
                  Review &amp; Fix
                </button>
              </div>

              {/* PR Item 2: #143 */}
              <div style={{
                background: '#16161A',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#34D399', fontFamily: 'monospace' }}>
                      PR #143
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FFFFFF' }}>
                      Update API documentation &amp; guides
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34D399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      Ready to Merge
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Opened by <strong style={{ color: '#D4D4D8' }}>DevOps Team</strong> &bull; 2 files changed &bull; All automated tests passed
                  </div>
                </div>

                <button
                  onClick={() => onNavigateTab('pr-review')}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                >
                  View Changes
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
              Integrated with GitHub Webhooks &bull; Real-time synchronization
            </span>
            <button
              onClick={() => onNavigateTab('pr-review')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-red)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              All Pull Requests &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Optional Interactive Sandbox Modal */}
      <AnimatePresence>
        {showSandboxModal && (
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
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                background: '#141416',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '650px',
                padding: '24px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={18} color="var(--accent-red)" />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>CodeSense AST Sandbox</h4>
                </div>
                <button
                  onClick={() => setShowSandboxModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '1.1rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Isolated evaluation container testing caller hierarchy and AST compatibility for active branch changes.
              </p>

              <div style={{ background: '#09090C', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#E4E4E7', lineHeight: 1.6, marginBottom: '18px' }}>
                <div style={{ color: '#34D399' }}>✓ Parsing AST for BillingController.java</div>
                <div style={{ color: '#34D399' }}>✓ Resolved 4 controller endpoints</div>
                <div style={{ color: '#FBBF24' }}>! Warning: /api/invoices missing authorization interceptor</div>
                <div style={{ color: '#38BDF8' }}>✓ Verified 0 circular dependency loops with ClinicService</div>
                <div style={{ color: '#34D399' }}>✓ Sandbox build passed in 412ms</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowSandboxModal(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowSandboxModal(false);
                    onNavigateTab('pr-review');
                  }}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem' }}
                >
                  View Full PR Audit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
