import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { getDemandById } from './services/db'
import { getFirestore, collection, getDocs, query } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'

// ── Firebase (matches db.ts) ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyADllQ8Um7qsJ4trH5WkRCWfVvHVh_qpp4",
  authDomain: "jansetu-ef57d.firebaseapp.com",
  projectId: "jansetu-ef57d",
  storageBucket: "jansetu-ef57d.appspot.com",
  messagingSenderId: "1079925388",
  appId: "1:1079925388:web:c2f2f8f3f7f6c9e8f5a1b2"
}
const app = initializeApp(firebaseConfig, 'track-app')
const db = getFirestore(app)

// ── Type helpers ─────────────────────────────────────────────────────────────
interface TimelineEvent {
  id: string
  label: string
  description: string
  timestamp?: string
  status: 'done' | 'active' | 'pending'
  icon: string
  color: string
  detail?: string
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_ORDER = ['pending','needs_info','approved','reviewed','raised','funded','work_started','completed','solved']

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:      { label: 'Submitted',        color: '#6366f1', icon: '📥' },
  needs_info:   { label: 'Needs More Info',   color: '#f59e0b', icon: '❓' },
  approved:     { label: 'Manager Approved',  color: '#10b981', icon: '✅' },
  reviewed:     { label: 'Under Review',      color: '#f59e0b', icon: '🔍' },
  raised:       { label: 'Raised in Parliament', color: '#818cf8', icon: '🏛️' },
  funded:       { label: 'Funds Released',    color: '#fbbf24', icon: '💰' },
  work_started: { label: 'Work Started',      color: '#60a5fa', icon: '🔧' },
  completed:    { label: 'Completed',         color: '#34d399', icon: '🎉' },
  solved:       { label: 'Resolved',          color: '#34d399', icon: '🎯' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  water: '💧', power: '⚡', health: '🏥', education: '📚', roads: '🛣️',
  safety: '🚓', sanitation: '🪠', agriculture: '🌾', housing: '🏠',
  environment: '🌱', others: '📁', general: '📋', transport: '🚌',
  waste: '🗑️', drainage: '🌊', electricity: '💡', telecom: '📡',
}

function TrackComplaint() {
  const [complaintId, setComplaintId] = useState<string | null>(null)
  const [complaint, setComplaint] = useState<any>(null)
  const [linkedPlan, setLinkedPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    setComplaintId(id)
    if (!id) { setError('No tracking ID provided.'); setLoading(false); return }

    getDemandById(id).then(async data => {
      if (!data) { setError('Complaint not found. Please check the ID.'); setLoading(false); return }
      setComplaint(data)

      // Try to find linked action plan in Firestore
      try {
        const plansQ = query(collection(db, 'plans'))
        const plansSnap = await getDocs(plansQ)
        for (const planDoc of plansSnap.docs) {
          const planData = planDoc.data()
          if ((planData.associatedComplaintIds || []).includes(id)) {
            setLinkedPlan({ id: planDoc.id, ...planData })
            break
          }
        }
      } catch (_) {}

      setLoading(false)
    }).catch(() => { setError('Error fetching complaint.'); setLoading(false) })
  }, [])

  const copyId = () => {
    if (complaintId) { navigator.clipboard.writeText(complaintId); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const buildTimeline = (): TimelineEvent[] => {
    if (!complaint) return []
    const ts = (complaint.updatedAt || complaint.createdAt || new Date().toISOString())

    const events: TimelineEvent[] = [
      {
        id: 'submitted',
        label: '📥 Complaint Submitted',
        description: `Your ${complaint.ticketType || 'complaint'} was logged via ${complaint.source === 'telegram' ? 'Telegram Bot ✈️' : 'Jansetu Web Portal 🌐'}.`,
        timestamp: complaint.createdAt,
        status: 'done',
        icon: '📥',
        color: '#6366f1',
        detail: `Complaint ID: ${complaintId}`
      },
      {
        id: 'ai_verified',
        label: '🤖 AI Verification',
        description: complaint.aiOverview?.brief
          ? `AI Engine classified and verified this complaint. Priority score: ${complaint.aiOverview.priorityScore || 'N/A'}/100.`
          : 'AI Engine is indexing this complaint for review.',
        timestamp: complaint.createdAt,
        status: (complaint.aiOverview?.brief) ? 'done' : 'pending',
        icon: '🤖',
        color: '#8b5cf6',
        detail: complaint.aiOverview?.priorityLabel
      },
      {
        id: 'manager_review',
        label: '🏢 Constituency Manager Review',
        description: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved')
          ? `Complaint reviewed and approved by constituency manager. ${linkedPlan ? `Added to plan: "${linkedPlan.planName}".` : ''}`
          : 'Awaiting review by your constituency manager dashboard.',
        timestamp: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved') ? ts : undefined,
        status: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved') ? 'done'
               : complaint.status === 'reviewed' ? 'active' : 'pending',
        icon: '🏢',
        color: '#10b981',
        detail: linkedPlan ? `Linked to: ${linkedPlan.planName}` : undefined
      },
      {
        id: 'ai_cluster',
        label: '🔗 AI Clustering & Prioritisation',
        description: linkedPlan
          ? `This complaint has been grouped with ${(linkedPlan.associatedComplaintIds || []).length} related complaints into a coordinated action plan by the AI engine.`
          : STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved')
            ? 'This complaint has been individually forwarded for resolution. No cluster group assigned.'
            : 'AI will cluster this with similar complaints to strengthen the case.',
        timestamp: linkedPlan ? ts : undefined,
        status: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved') ? 'done' : 'pending',
        icon: '🔗',
        color: '#06b6d4',
        detail: linkedPlan?.summary ? `Plan summary: ${linkedPlan.summary.slice(0, 100)}...` : undefined
      },
      {
        id: 'parliament',
        label: '🏛️ Raised in Parliament',
        description: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('raised')
          ? 'Your Member of Parliament has formally raised this issue in Lok Sabha. A parliamentary question/brief has been submitted.'
          : 'Pending escalation to MP for parliamentary consideration.',
        timestamp: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('raised') ? ts : undefined,
        status: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('raised') ? 'done'
               : STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved') ? 'active' : 'pending',
        icon: '🏛️',
        color: '#818cf8',
      },
      {
        id: 'funded',
        label: '💰 Funds Released',
        description: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('funded')
          ? `Funding has been allocated from MPLADS or constituency development funds. Work orders have been authorized.`
          : 'Funding allocation pending parliamentary clearance.',
        timestamp: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('funded') ? ts : undefined,
        status: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('funded') ? 'done'
               : STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('raised') ? 'active' : 'pending',
        icon: '💰',
        color: '#fbbf24',
        detail: complaint.aiOverview?.estimatedBudget ? `Estimated budget: ${complaint.aiOverview.estimatedBudget}` : undefined
      },
      {
        id: 'work',
        label: '🔧 Work In Progress',
        description: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('work_started')
          ? 'On-ground work has officially begun by the responsible government agency.'
          : 'Site work will begin once funds are disbursed.',
        timestamp: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('work_started') ? ts : undefined,
        status: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('work_started') ? 'done'
               : STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('funded') ? 'active' : 'pending',
        icon: '🔧',
        color: '#60a5fa',
      },
      {
        id: 'resolved',
        label: '🎉 Issue Resolved',
        description: ['completed','solved'].includes(complaint.status)
          ? 'The issue has been fully resolved. Thank you for helping improve your constituency!'
          : 'Resolution will be confirmed after on-site verification.',
        timestamp: ['completed','solved'].includes(complaint.status) ? ts : undefined,
        status: ['completed','solved'].includes(complaint.status) ? 'done'
               : STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('work_started') ? 'active' : 'pending',
        icon: '🎉',
        color: '#34d399',
      },
    ]
    return events
  }

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#06050f 0%,#0d0c1e 50%,#110e24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#8e90b3', fontFamily: 'Inter,sans-serif', fontSize: '14px' }}>Loading complaint details…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#06050f 0%,#0d0c1e 50%,#110e24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ maxWidth: '440px', width: '100%', background: 'rgba(255,59,59,0.06)', border: '1px solid rgba(255,59,59,0.25)', borderRadius: '20px', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: '#f87171', fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Tracking Failed</h2>
        <p style={{ color: '#8e90b3', fontSize: '14px', lineHeight: 1.6 }}>{error}</p>
        <button onClick={() => window.location.href = '/'} style={{ marginTop: '24px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
          Return to Home
        </button>
      </div>
    </div>
  )

  if (!complaint) return null

  const timeline = buildTimeline()
  const statusMeta = STATUS_META[complaint.status] || STATUS_META['pending']
  const catEmoji = CATEGORY_EMOJI[complaint.category?.toLowerCase()] || '📋'
  const textContent = complaint.items?.find((i: any) => i.type === 'text')?.content || complaint.items?.find((i: any) => i.speechTranscript)?.speechTranscript
  const photos = complaint.items?.filter((i: any) => i.type === 'photo' && i.fileUrl) || []
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.href)}`

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#06050f 0%,#0d0c1e 50%,#110e24 100%)', fontFamily: 'Inter,system-ui,sans-serif', color: 'white', paddingBottom: '60px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .track-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px; animation:fadeUp 0.4s ease forwards; }
        .tl-line { position:absolute; left:19px; top:40px; bottom:-40px; width:2px; background:linear-gradient(to bottom,rgba(255,255,255,0.12),rgba(255,255,255,0.04)); }
        .badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; }
        .copy-btn { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#a5b4fc; border-radius:8px; padding:4px 10px; font-size:11px; cursor:pointer; transition:all 0.2s; font-weight:600; }
        .copy-btn:hover { background:rgba(99,102,241,0.2); }
        @media(max-width:640px){
          .hero-grid { grid-template-columns:1fr !important; }
          .stat-row { flex-direction:column !important; }
        }
      `}</style>

      {/* ── Top Nav ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,5,15,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => window.location.href = '/'} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8e90b3', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          ← Back to Portal
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🗳️</span>
          <span style={{ fontWeight: 800, fontSize: '14px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JanSetu Track</span>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px' }}>

        {/* ── Hero Header ── */}
        <div className="track-card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.06))', borderColor: 'rgba(99,102,241,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8e90b3', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '6px', textTransform: 'uppercase' }}>Complaint Reference</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '0.04em' }}>{complaintId}</span>
                <button className="copy-btn" onClick={copyId}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="badge" style={{ background: `${statusMeta.color}22`, color: statusMeta.color, border: `1px solid ${statusMeta.color}44`, fontSize: '12px', padding: '6px 14px', borderRadius: '24px' }}>
                {statusMeta.icon} {statusMeta.label}
              </div>
              <div style={{ fontSize: '11px', color: '#8e90b3', marginTop: '6px' }}>
                Filed: {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Quick stat row */}
          <div className="stat-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { icon: catEmoji, label: 'Category', value: complaint.category?.toUpperCase() || 'GENERAL' },
              { icon: '📍', label: 'Scope', value: complaint.scope?.toUpperCase() || 'WARD' },
              { icon: '👥', label: 'Impact', value: `~${(complaint.estimatedImpact || 0).toLocaleString()} citizens` },
              { icon: complaint.source === 'telegram' ? '✈️' : '🌐', label: 'Source', value: complaint.source === 'telegram' ? 'Telegram Bot' : 'Web Portal' },
            ].map(s => (
              <div key={s.label} style={{ flex: '1', minWidth: '120px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '10px', color: '#8e90b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginTop: '2px' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI Verification Card ── */}
        {complaint.aiOverview?.brief && (
          <div className="track-card" style={{ marginBottom: '20px', borderColor: 'rgba(139,92,246,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🤖</span>
              <span style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '14px' }}>AI Verification & Classification</span>
              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', marginLeft: 'auto' }}>✓ Verified</span>
            </div>
            <p style={{ color: '#d1d5db', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px' }}>{complaint.aiOverview.brief}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {complaint.aiOverview.priorityScore && (
                <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                  🎯 Priority: {complaint.aiOverview.priorityScore}/100
                </span>
              )}
              {complaint.aiOverview.priorityLabel && (
                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.25)' }}>
                  ⚡ {complaint.aiOverview.priorityLabel}
                </span>
              )}
              {complaint.aiOverview.safetyRisk && (
                <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                  🛡️ {complaint.aiOverview.safetyRisk}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── AI Cluster / Action Plan Card ── */}
        {linkedPlan ? (
          <div className="track-card" style={{ marginBottom: '20px', background: 'rgba(6,182,212,0.04)', borderColor: 'rgba(6,182,212,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🔗</span>
              <span style={{ fontWeight: 700, color: '#67e8f9', fontSize: '14px' }}>Grouped in AI Action Plan</span>
              <span className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)', marginLeft: 'auto' }}>
                {(linkedPlan.associatedComplaintIds || []).length} complaints
              </span>
            </div>
            <div style={{ fontWeight: 700, color: 'white', fontSize: '15px', marginBottom: '6px' }}>{linkedPlan.planName}</div>
            {linkedPlan.summary && <p style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.6 }}>{linkedPlan.summary}</p>}
            {linkedPlan.isApproved && (
              <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                ✅ Plan Approved by Manager
              </div>
            )}
          </div>
        ) : (
          <div className="track-card" style={{ marginBottom: '20px', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔗</span>
              <span style={{ fontWeight: 700, color: '#8e90b3', fontSize: '14px' }}>AI Clustering Status</span>
            </div>
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '8px', lineHeight: 1.6 }}>
              {STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved')
                ? 'This complaint has been individually forwarded. No cluster group assigned.'
                : 'The AI engine is analyzing similar complaints to create a unified action plan. Check back after manager review.'}
            </p>
          </div>
        )}

        {/* ── Location & Description ── */}
        <div className="track-card" style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8e90b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>📍 Location</div>
            <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: 1.6 }}>{complaint.address || 'Location not provided'}</div>
            {complaint.constituency && (
              <span className="badge" style={{ marginTop: '8px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                🏛️ {complaint.constituency} Constituency
              </span>
            )}
            {complaint.associatedPlace && (
              <div style={{ marginTop: '8px' }}>
                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.25)' }}>
                  📌 {complaint.associatedPlace.name} ({complaint.associatedPlace.type})
                </span>
              </div>
            )}
          </div>
          {textContent && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
              <div>
                <div style={{ fontSize: '11px', color: '#8e90b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>📝 Description</div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {textContent}
                </div>
              </div>
            </>
          )}
          {photos.length > 0 && (
            <>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
              <div>
                <div style={{ fontSize: '11px', color: '#8e90b3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>📸 Evidence Photos ({photos.length})</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {photos.map((p: any, idx: number) => (
                    <a key={idx} href={p.fileUrl} target="_blank" rel="noreferrer">
                      <img src={p.fileUrl} alt={`Evidence ${idx+1}`} style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Progress Timeline ── */}
        <div className="track-card" style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⏱️</span> Complaint Journey Timeline
          </div>
          <div style={{ position: 'relative' }}>
            {timeline.map((evt, i) => {
              const isLast = i === timeline.length - 1
              return (
                <div key={evt.id} style={{ position: 'relative', display: 'flex', gap: '16px', paddingBottom: isLast ? 0 : '28px' }}>
                  {/* Vertical line */}
                  {!isLast && <div className="tl-line" />}
                  {/* Node */}
                  <div style={{
                    flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%',
                    background: evt.status === 'done' ? `${evt.color}22` : evt.status === 'active' ? `${evt.color}15` : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${evt.status === 'done' ? evt.color : evt.status === 'active' ? evt.color + '66' : 'rgba(255,255,255,0.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 1, position: 'relative',
                    boxShadow: evt.status === 'done' ? `0 0 12px ${evt.color}44` : evt.status === 'active' ? `0 0 8px ${evt.color}33` : 'none',
                    animation: evt.status === 'active' ? 'pulse 2s ease infinite' : 'none'
                  }}>
                    {evt.status === 'pending' ? '○' : evt.icon}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: evt.status === 'pending' ? '#6b7280' : 'white' }}>{evt.label}</span>
                      {evt.status === 'done' && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)', fontSize: '10px' }}>✓ Done</span>}
                      {evt.status === 'active' && <span className="badge" style={{ background: `${evt.color}18`, color: evt.color, border: `1px solid ${evt.color}44`, fontSize: '10px' }}>● In Progress</span>}
                    </div>
                    <p style={{ fontSize: '12px', color: evt.status === 'pending' ? '#4b5563' : '#94a3b8', lineHeight: 1.6, marginBottom: evt.timestamp || evt.detail ? '6px' : 0 }}>{evt.description}</p>
                    {evt.detail && <p style={{ fontSize: '11px', color: '#6366f1', fontStyle: 'italic' }}>{evt.detail}</p>}
                    {evt.timestamp && (
                      <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px' }}>
                        🕐 {new Date(evt.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Key Milestone Badges ── */}
        <div className="track-card" style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px' }}>📊 Milestone Checklist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Complaint Submitted', done: true },
              { label: 'AI Classified & Verified', done: !!complaint.aiOverview?.brief },
              { label: 'Manager Approved', done: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('approved') },
              { label: 'Grouped in AI Action Plan', done: !!linkedPlan },
              { label: 'Raised in Parliament', done: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('raised') },
              { label: 'Funds Released', done: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('funded') },
              { label: 'Work Started On-site', done: STATUS_ORDER.indexOf(complaint.status) >= STATUS_ORDER.indexOf('work_started') },
              { label: 'Issue Fully Resolved', done: ['completed','solved'].includes(complaint.status) },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: m.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', border: m.done ? '1.5px solid #10b981' : '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>
                  {m.done ? '✓' : ''}
                </div>
                <span style={{ fontSize: '13px', color: m.done ? '#e2e8f0' : '#4b5563', fontWeight: m.done ? 600 : 400 }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── QR & Share (Tracking) ── */}
        <div className="track-card" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>📡 Share Tracking Page</div>
          <img src={qrUrl} alt="Tracking QR Code" style={{ width: '130px', height: '130px', borderRadius: '12px', border: '2px solid rgba(99,102,241,0.4)', marginBottom: '10px' }} />
          <div style={{ fontSize: '11px', color: '#8e90b3', marginBottom: '12px' }}>Scan to view complaint progress on any device</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Tracking link copied!'); }} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              📋 Copy Tracking Link
            </button>
            <button onClick={() => {
              const text = `My JanSetu complaint (${complaintId}) status: ${statusMeta.label}. Track live: ${window.location.href}`
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
            }} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              💬 Share Status on WhatsApp
            </button>
          </div>
        </div>

        {/* ── Petition Upvote Link ── */}
        <div className="track-card" style={{ background: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.2)' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📢 Get Neighbour Support (Community Petition)
          </div>
          <p style={{ fontSize: '12px', color: '#86efac', lineHeight: 1.7, marginBottom: '14px' }}>
            Share the petition link below with your neighbours. When they open it, they'll see your issue on a map and can <strong>sign the petition by verifying they live nearby</strong> (within 2 km). More signatures = stronger case for your MP to act.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <input
              readOnly
              value={`${window.location.origin}/complainant.html?petitionId=${complaintId}`}
              style={{ flex: 1, minWidth: '200px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 10px', borderRadius: '6px', fontSize: '10.5px', fontFamily: 'monospace' }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/complainant.html?petitionId=${complaintId}`);
                alert('Petition link copied! Share it with your neighbours.');
              }}
              style={{ flexShrink: 0, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80', borderRadius: '6px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
            >
              📋 Copy
            </button>
          </div>
          <button
            onClick={() => {
              const petitionLink = `${window.location.origin}/complainant.html?petitionId=${complaintId}`;
              const text = `🗳️ I need your support!\n\nI've filed an issue with JanSetu: "${complaint.aiOverview?.brief || complaint.category}"\n\n📍 ${complaint.address}\n🏛️ ${complaint.constituency || 'Local Area'}\n\n👉 Click this link to support this issue (you must be within 2 km to verify your signature):\n${petitionLink}\n\nLet's raise this together with our MP!`;
              window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
            }}
            style={{ width: '100%', padding: '10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            💬 Share Petition on WhatsApp — Get More Signatures
          </button>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
            👍 {complaint.upvotes || 1} neighbour{(complaint.upvotes || 1) !== 1 ? 's' : ''} already signed this petition
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackComplaint />
  </StrictMode>,
)
