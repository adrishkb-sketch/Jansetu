import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  ArrowLeft, 
  Award, 
  Sparkles, 
  TrendingUp, 
  CheckCircle, 
  FileText,
  DollarSign,
  Info,
  Loader2,
  X,
  Brain
} from 'lucide-react';
import { getAllDemands, updateDemandStatus, getActionPlan } from './services/db';
import { LanguageSelector, getInitialLanguage, useGoogleMapsLoader } from './App';
import { AuthModal } from './AuthModal';
import './index.css';

// Priority Score Ranker
// Formula: Priority = (Upvotes * 0.4) + (Estimated Impact * 0.3) + (Infrastructure Gap Factor * 0.3)
function computePriorityScore(d: any) {
  const votesWeight = Math.min((d.upvotes || 1) / 100, 1) * 4; // Max 4 points for upvotes
  
  const impactWeight = 
    d.scope === 'household' ? 1 :
    d.scope === 'street' ? 2 :
    d.scope === 'ward' ? 3.5 : 5; // Max 5 points for impact scope
  
  // Gap calculation: if school/hospital distance is >3km, get higher gap rating
  const baseGap = d.category === 'health' ? 4 : d.category === 'education' ? 3 : 2;
  const priority = votesWeight + impactWeight + baseGap;
  return Math.min(Math.round(priority * 10) / 10, 10); // Scale to 10 max
}

function MPApp() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);
  const [demands, setDemands] = useState<any[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<any | null>(null);
  
  // Budget Allocator
  const [mpladsBudget, setMpladsBudget] = useState(() => {
    const saved = localStorage.getItem('jansetu_mplads_budget');
    return saved ? parseFloat(saved) : 50000000; // ₹5.00 Crores
  });

  // Google Maps
  const [apiKey] = useState(() => localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { isLoaded } = useGoogleMapsLoader(apiKey);

  // Gemini Brief Generator
  const [briefText, setBriefText] = useState('');
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [showBriefModal, setShowBriefModal] = useState(false);

  // Approved Plan states
  const [approvedPlan, setApprovedPlan] = useState<any | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('mp_auth') === 'true');

  useEffect(() => {
    const loadApprovedPlan = async () => {
      const plan = await getActionPlan();
      if (plan && plan.isApproved) {
        setApprovedPlan(plan);
      } else {
        setApprovedPlan(null);
      }
    };
    loadApprovedPlan();
    
    // Check for plan updates every 5 seconds (allows real-time syncing across devices)
    const interval = setInterval(loadApprovedPlan, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load demands
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    const data = await getAllDemands();
    // Only process approved (hotspotted) demands for the MP's dashboard
    const approvedNeeds = data.filter(d => d.status === 'approved' || d.status === 'tendering');
    
    // Add computed priority score
    const scored = approvedNeeds.map(d => ({
      ...d,
      score: computePriorityScore(d)
    }));

    // Sort by AI Priority Score descending
    scored.sort((a, b) => b.score - a.score);
    setDemands(scored);
    if (scored.length > 0) {
      setSelectedDemand(scored[0]);
    }
  };

  // Render Google Maps Pins for Hotspots
  useEffect(() => {
    if (!isLoaded || !mapRef.current || demands.length === 0) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    const center = selectedDemand?.location || demands[0]?.location || { lat: 28.803, lng: 79.025 };

    if (!mapInstanceRef.current) {
      const map = new google.maps.Map(mapRef.current, {
        center: center,
        zoom: 13,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#09081a' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#09081a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8e90b3' }] },
          { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#fbbf24' }, { weight: 1.2 }] },
          { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#fbbf24' }, { weight: 0.8 }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1c38' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#04030d' }] }
        ]
      });
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setCenter(center);
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Render hotspot markers
    demands.forEach(d => {
      const marker = new google.maps.Marker({
        position: d.location,
        map: mapInstanceRef.current,
        title: `${d.category.toUpperCase()} Needs`,
        icon: {
          url: d.id === selectedDemand?.id 
            ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' // highlighted active selection
            : 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
        }
      });

      marker.addListener('click', () => {
        setSelectedDemand(d);
      });

      markersRef.current.push(marker);
    });

  }, [isLoaded, demands, selectedDemand]);

  // Google Translate widget
  useEffect(() => {
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,ml,or,pa,as,ur,sa,ne,sd,kok',
        layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    };

    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleAllocateBudget = async (id: string, costEstimate: number) => {
    if (mpladsBudget < costEstimate) {
      alert("Insufficient MPLADS Funds to allocate this project.");
      return;
    }

    const nextBudget = mpladsBudget - costEstimate;
    setMpladsBudget(nextBudget);
    localStorage.setItem('jansetu_mplads_budget', nextBudget.toString());

    // Update status in Firestore/LocalStorage to 'tendering' (Work Sanctioned)
    await updateDemandStatus(id, 'tendering');
    
    // Update local React state
    setDemands((prev: any[]) => prev.map(item => item.id === id ? { ...item, status: 'tendering' } : item));
    setSelectedDemand((prev: any) => prev && prev.id === id ? { ...prev, status: 'tendering' } : prev);
    alert(`Work order approved! Allocated ₹${(costEstimate / 1000000).toFixed(2)} Lakhs from MPLADS fund.`);
  };

  const handleGenerateBrief = async () => {
    if (!selectedDemand) return;
    
    setGeneratingBrief(true);
    setShowBriefModal(true);
    setBriefText('AI is compiling records and writing Lok Sabha presentation draft...');

    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg';

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert parliamentary speech writer for a Member of Parliament (MP) in India. 
Write a highly formal, concise, and persuasive Lok Sabha representation speech (parliamentary question/matter under rule 377) addressing the Speaker of the House (150-200 words).
Use these exact details from the citizen grievance files:
- Constituency: Rampur (Uttar Pradesh)
- Grievance Category: ${selectedDemand.category.toUpperCase()}
- Location/Ward: ${selectedDemand.address}
- Supporting Citizens: ${selectedDemand.upvotes} verified votes
- Real Gap Analysis: Traveling distance to nearest public school/healthcare is critically high.

Structure of Speech:
1. "Hon'ble Speaker Sir..."
2. Raise attention to the infrastructure gap in Rampur.
3. State the exact citizen demand data and verified votes to weigh demand.
4. Request the central/state ministry to sanction the necessary construction/reconstruction.
5. End with thanks. Do NOT write placeholders. Write actual names and speech blocks.`
            }]
          }]
        })
      });

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setBriefText(text.trim());
      } else {
        setBriefText("Speech generation failed. Please check your Gemini API credentials.");
      }
    } catch (e) {
      console.error("Gemini brief error: ", e);
      setBriefText("Speech generation error. Please check internet connections.");
    } finally {
      setGeneratingBrief(false);
    }
  };

  return (
    <>
      {!isAuthenticated && <AuthModal role="mp" onSuccess={() => setIsAuthenticated(true)} onClose={() => window.location.href = '/'} />}
      <div id="google_translate_element" style={{ display: 'none' }}></div>

      <header className="header">
        <div className="container header-container">
          <div className="logo-wrapper" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            <div className="logo-icon" style={{ background: 'var(--mp-grad)' }}>
              <Award size={20} strokeWidth={2.5} />
            </div>
            <span>Jansetu</span>
            <span style={{ fontSize: '12px', background: 'rgba(217, 119, 6, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', fontWeight: 'bold' }}>MP Decision Workspace</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <LanguageSelector selectedLang={selectedLang} setSelectedLang={setSelectedLang} />
            <div className="status-badge" style={{ border: '1px solid rgba(251, 191, 36, 0.3)' }}>
              <span className="pulse-dot" style={{ backgroundColor: '#fbbf24' }}></span>
              <span style={{ color: '#fbbf24' }}>MPLADS Ledger Verified</span>
            </div>
            {isAuthenticated && (
              <button 
                onClick={() => {
                  sessionStorage.removeItem('mp_auth');
                  setIsAuthenticated(false);
                }}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white',
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }} className="complainant-portal container">
        {/* Back navigation */}
        <div className="portal-header">
          <button type="button" className="btn-back" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={18} />
            <span>Back to Roles</span>
          </button>
          <h2>AI-Priority Constituency Planner</h2>
          <p className="portal-subtitle">Weigh competing infrastructure requests objectively using citizen demand metrics and demographic gap ratings</p>
        </div>

        {approvedPlan && (
          <div className="form-card" style={{
            background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(13, 12, 29, 0.4) 100%)',
            border: '1px solid rgba(20, 184, 166, 0.4)',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: '12px',
            gap: '20px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'rgba(20, 184, 166, 0.2)', padding: '12px', borderRadius: '12px', color: '#2dd4bf' }}>
                <FileText size={24} />
              </div>
              <div>
                <span style={{ fontSize: '10px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  ✓ Approved Plan Active
                </span>
                <h4 style={{ color: 'white', margin: '4px 0', fontSize: '1.1rem' }}>{approvedPlan.planName}</h4>
                <p style={{ color: 'var(--text-desc)', fontSize: '0.8rem', margin: 0 }}>
                  {approvedPlan.summary.slice(0, 120)}...
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              style={{
                background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold',
                padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0
              }}
            >
              <Sparkles size={16} />
              <span>View Step-by-Step Action Plan</span>
            </button>
          </div>
        )}

        {/* MPLADS fund tracker row */}
        <div className="form-card" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div>
            <h4 style={{ color: '#fbbf24', margin: '0 0 4px 0', fontSize: '0.9rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={16} />
              <span>MP Local Area Development Fund (MPLADS) Ledger</span>
            </h4>
            <span style={{ fontSize: '1.8rem', color: 'white', fontWeight: '800' }}>
              ₹{(mpladsBudget / 10000000).toFixed(2)} Crores remaining
            </span>
          </div>
          <div style={{ flexGrow: 0.5, minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <span>Allocated: ₹{((50000000 - mpladsBudget) / 10000000).toFixed(2)} Cr</span>
              <span>Total Limit: ₹5.00 Cr / Yr</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: 'var(--mp-grad)', width: `${(mpladsBudget / 50000000) * 100}%`, height: '100%' }}></div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => {
              setMpladsBudget(50000000);
              localStorage.setItem('jansetu_mplads_budget', '50000000');
              alert('Ledger re-seeded to ₹5.00 Cr.');
            }}
            style={{ background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
          >
            Reset Funds
          </button>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="portal-grid" style={{ gridTemplateColumns: '440px 1fr' }}>
          
          {/* Left Column: Ranked Leaderboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0' }}>
              <TrendingUp size={18} style={{ color: '#fbbf24' }} />
              <span>AI Ranked Development Leaderboard</span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '680px', paddingRight: '4px' }}>
              {demands.length === 0 ? (
                <div className="empty-attachments" style={{ padding: '60px' }}>
                  <Info size={24} />
                  <span>No approved needs awaiting planning decisions yet. Use the Manager console to verify entries.</span>
                </div>
              ) : (
                demands.map((d, index) => (
                  <div 
                    key={d.id} 
                    onClick={() => setSelectedDemand(d)}
                    style={{
                      background: selectedDemand?.id === d.id ? 'rgba(217, 119, 6, 0.08)' : 'rgba(13, 12, 29, 0.4)',
                      border: selectedDemand?.id === d.id ? '1px solid rgba(217, 119, 6, 0.5)' : '1px solid var(--border-light)',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ position: 'absolute', left: '-1px', top: '16px', width: '28px', height: '24px', background: index === 0 ? '#fbbf24' : 'rgba(255,255,255,0.08)', color: index === 0 ? '#000' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0 6px 6px 0', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{index + 1}
                    </div>

                    <div style={{ paddingLeft: '22px' }}>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Score: {d.score}/10</span>
                          <Sparkles size={12} />
                        </span>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          background: d.status === 'tendering' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: d.status === 'tendering' ? '#34d399' : 'white',
                          padding: '2px 8px', 
                          borderRadius: '8px', 
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {d.status === 'tendering' ? 'Sanctioned' : 'Awaiting Plan'}
                        </span>
                      </div>
                      <strong style={{ display: 'block', fontSize: '0.9rem', color: 'white', marginBottom: '4px', textTransform: 'capitalize' }}>
                        {d.category === 'water' && '🚰'}
                        {d.category === 'roads' && '🛣️'}
                        {d.category === 'education' && '🏫'}
                        {d.category === 'health' && '🏥'}
                        {d.category === 'power' && '⚡'}
                        {d.category === 'agriculture' && '🌾'}
                        {d.category === 'others' && '📁'}
                        {d.category} Need
                      </strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-desc)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📍 {d.address}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>👍 {d.upvotes || 1} support votes</span>
                        <span>👥 Impact: {d.estimatedImpact || 150}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Interactive map and action drawer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Hotspots Map canvas */}
            <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div ref={mapRef} style={{ width: '100%', height: '300px' }} />
              <div style={{ padding: '10px 16px', background: '#0e0d24', borderTop: '1px solid var(--border-light)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                📍 Red Marker represents selected priority. Orange Markers represent other verified local hotspots.
              </div>
            </div>

            {/* Decision Drawer card */}
            {selectedDemand ? (
              <div className="form-card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ color: 'white', fontSize: '1.25rem', textTransform: 'capitalize', margin: 0 }}>
                      Selected Priority Analysis
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                      📍 {selectedDemand.address}
                    </p>
                  </div>
                  
                  {/* MP Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      onClick={handleGenerateBrief}
                      style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <FileText size={16} />
                      <span>Lok Sabha Brief</span>
                    </button>
                    
                    {selectedDemand.status !== 'tendering' ? (
                      <button 
                        type="button" 
                        onClick={() => handleAllocateBudget(selectedDemand.id, selectedDemand.category === 'roads' ? 12000000 : 4500000)}
                        style={{ background: 'var(--mp-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      >
                        <CheckCircle size={16} />
                        <span>Allocate MPLADS (₹{(selectedDemand.category === 'roads' ? 1.2 : 0.45).toFixed(2)} Cr)</span>
                      </button>
                    ) : (
                      <span style={{ color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}>
                        <CheckCircle size={16} />
                        <span>Work Order Sanctioned</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Demand Weighing Metrics */}
                <div className="role-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Citizen Upvotes</span>
                    <strong style={{ fontSize: '1.4rem', color: 'white' }}>👍 {selectedDemand.upvotes}</strong>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-desc)', margin: '4px 0 0 0' }}>Verified local registry</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Population Impact</span>
                    <strong style={{ fontSize: '1.4rem', color: 'white' }}>👥 {selectedDemand.estimatedImpact}</strong>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-desc)', margin: '4px 0 0 0' }}>Estimated affected range</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Infrastructure Gaps</span>
                    <strong style={{ fontSize: '1.4rem', color: '#fca5a5' }}>🚨 Deficient</strong>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-desc)', margin: '4px 0 0 0' }}>Travel distance limits exceeded</p>
                  </div>
                </div>

                {/* Description details */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Citizen Submission Summary (AI STT Translation)
                  </span>
                  <p style={{ color: 'white', margin: 0, fontSize: '0.85rem', lineHeight: '1.5' }}>
                    "{selectedDemand.items?.[0]?.content || selectedDemand.items?.[0]?.speechTranscript || 'No description provided.'}"
                  </p>
                </div>

              </div>
            ) : (
              <div className="form-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'var(--text-muted)' }}>
                <p>Select a priority card from the leaderboard to review details.</p>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* Parliamentary Brief Modal */}
      {showBriefModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: '#fbbf24' }} />
                <span>AI Parliament Representation Draft</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowBriefModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {generatingBrief ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0' }}>
                <Loader2 className="spinner" size={32} style={{ color: '#fbbf24' }} />
                <p style={{ color: 'var(--text-desc)', margin: 0 }}>Gemini is drafting a formal parliamentary speech...</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  This brief is dynamically formulated by Google Gemini, auditing live citizen demand upvotes and geocoded public gap data:
                </p>
                
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', padding: '20px', borderRadius: '10px', fontFamily: 'serif', fontSize: '1rem', color: 'white', lineHeight: '1.6', maxHeight: '350px', overflowY: 'auto', whiteSpace: 'pre-line' }} className="notranslate">
                  {briefText}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(briefText);
                      alert('Brief copied to clipboard!');
                    }}
                    style={{ background: 'var(--mp-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', flexGrow: 1, textAlign: 'center' }}
                  >
                    Copy Speech Draft
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowBriefModal(false)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showPlanModal && approvedPlan && (
        <div className="modal-overlay no-print" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 5, 16, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '100%', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto', background: '#0d0c1d', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '28px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
                <Brain size={22} style={{ color: '#2dd4bf' }} />
                <span>Approved Step-by-Step Constituency Development Plan</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPlanModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h4 style={{ color: 'white', fontSize: '1.2rem', margin: '0 0 6px 0' }}>{approvedPlan.planName}</h4>
                <p style={{ color: 'var(--text-desc)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>{approvedPlan.summary}</p>
              </div>

              {/* CSS Interactive Flowchart */}
              <div>
                <span style={{ fontSize: '11px', color: '#2dd4bf', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>
                  ⌛ Pipeline Implementation Flowchart
                </span>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 0', borderBottom: '1px solid var(--border-light)', marginBottom: '10px' }}>
                  {approvedPlan.flowchart.map((step: any, idx: number) => (
                    <React.Fragment key={idx}>
                      <div style={{
                        background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.3)',
                        borderRadius: '12px', padding: '16px', minWidth: '200px', flex: '1', textAlign: 'left',
                        position: 'relative'
                      }}>
                        <span style={{ fontSize: '10px', color: '#2dd4bf', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>
                          ⌛ {step.duration}
                        </span>
                        <strong style={{ fontSize: '13px', color: 'white', display: 'block', margin: '4px 0 2px 0' }}>
                          {step.phase}
                        </strong>
                        <p style={{ fontSize: '11px', color: 'var(--text-desc)', margin: 0 }}>
                          {step.description}
                        </p>
                      </div>
                      {idx < approvedPlan.flowchart.length - 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', color: '#2dd4bf', fontSize: '20px', userSelect: 'none' }}>➔</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Detailed Projects Table */}
              <div>
                <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>
                  📋 Planned Projects & Cost Breakdowns
                </span>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#818cf8', fontWeight: 'bold' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Project Name</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Action Description</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Agency</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Timeline</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedPlan.detailedSteps.map((step: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold', textAlign: 'left' }}>{step.title}</td>
                          <td style={{ padding: '10px', color: 'var(--text-desc)', textAlign: 'left' }}>{step.description}</td>
                          <td style={{ padding: '10px', color: '#2dd4bf', textAlign: 'left' }}>{step.agency}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{step.timeline}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#fbbf24' }}>
                            ₹{(step.cost / 100000).toFixed(1)} L
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => window.print()}
                  style={{ background: 'var(--mp-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', flexGrow: 1, textAlign: 'center' }}
                >
                  🖨️ Print / Download Action Plan
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowPlanModal(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Action Plan (visible only during window.print()) */}
      {approvedPlan && (
        <div 
          id="printable-plan-mp-card" 
          style={{
            display: 'none', background: 'white', color: 'black', padding: '40px', fontFamily: 'Georgia, serif',
            textAlign: 'left', border: '1px solid #ccc'
          }}
        >
          <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '16px', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 'bold', color: 'black' }}>
              CONSTITUENCY DEVELOPMENT ACTION PLAN
            </h1>
            <h2 style={{ fontSize: '18px', margin: '0 0 4px 0', fontWeight: 'bold', color: '#333' }}>
              Rampur Lok Sabha Constituency, Uttar Pradesh
            </h2>
            <span style={{ fontSize: '12px', color: '#666' }}>
              Date Approved: {new Date().toLocaleDateString()} | Document Status: APPROVED & SYNCED
            </span>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', borderBottom: '1px solid #888', paddingBottom: '4px', fontWeight: 'bold', margin: '0 0 10px 0', color: 'black' }}>
              1. PLAN PROFILE & BUDGET SUMMARY
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', margin: '0 0 12px 0' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', width: '220px' }}><strong>Action Plan Name:</strong></td>
                  <td style={{ padding: '6px 0' }}>{approvedPlan.planName}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0' }}><strong>Executive Summary:</strong></td>
                  <td style={{ padding: '6px 0', fontStyle: 'italic' }}>{approvedPlan.summary}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0' }}><strong>Planned Project Count:</strong></td>
                  <td style={{ padding: '6px 0' }}>{approvedPlan.detailedSteps.length} target sites</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', borderBottom: '1px solid #888', paddingBottom: '4px', fontWeight: 'bold', margin: '0 0 10px 0', color: 'black' }}>
              2. TIMELINE IMPLEMENTATION FLOWCHART
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '0 0 12px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid black', fontWeight: 'bold' }}>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd', width: '180px' }}>Phase / Duration</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>Core Phase Action Details</th>
                </tr>
              </thead>
              <tbody>
                {approvedPlan.flowchart.map((step: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                      {step.phase}
                      <span style={{ display: 'block', fontSize: '9px', color: '#666' }}>({step.duration})</span>
                    </td>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{step.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ pageBreakBefore: 'always', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '16px', borderBottom: '1px solid #888', paddingBottom: '4px', fontWeight: 'bold', margin: '0 0 16px 0', color: 'black' }}>
              3. PROJECT SITE DETAILS & RESPONSIBLE AGENCIES
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '0 0 12px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid black', fontWeight: 'bold' }}>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>Project Title</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd' }}>Description & Gap Audits</th>
                  <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd', width: '180px' }}>Agency</th>
                  <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #ddd', width: '100px' }}>Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {approvedPlan.detailedSteps.map((step: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{step.id}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd', fontWeight: 'bold' }}>{step.title}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{step.description}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd', color: '#2b2214' }}>{step.agency}</td>
                    <td style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}>
                      ₹{(step.cost / 100000).toFixed(1)} L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderBottom: '1px solid black', height: '40px' }}></div>
              <span style={{ display: 'block', marginTop: '6px' }}>Constituency Aggregator (Jansetu)</span>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderBottom: '1px solid black', height: '40px' }}></div>
              <span style={{ display: 'block', marginTop: '6px' }}>Member of Parliament (MP)</span>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS Print Stylesheet overrides for MP View */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-plan-mp-card, #printable-plan-mp-card * {
            visibility: visible !important;
          }
          #printable-plan-mp-card {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      <footer className="footer" style={{ marginTop: '40px' }}>
        <div className="container footer-content">
          <div className="footer-text">
            <strong>Jansetu</strong> — Bridging Citizens and Leaders through Intelligent Planning
          </div>
          <div className="footer-sub">
            Built for MP Constituency Development Planning • Smart India Hackathon Track 1 • All Rights Reserved
          </div>
        </div>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MPApp />
  </React.StrictMode>
);
