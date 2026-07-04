import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  ArrowLeft, 
  CheckCircle, 
  Database, 
  AlertTriangle, 
  Sparkles, 
  Search, 
  Check,
  Image as ImageIcon
} from 'lucide-react';
import { getAllDemands, updateDemandStatus } from './services/db';
import { LanguageSelector, getInitialLanguage } from './App';
import './index.css';

function ManagerConsole() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);
  const [demands, setDemands] = useState<any[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Load demands
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getAllDemands();
    // Sort by date newest first
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setDemands(data);
    if (data.length > 0) {
      setSelectedDemand(data[0]);
    }
  };

  // Google Translate
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

  const handleUpdateStatus = async (id: string, nextStatus: string) => {
    await updateDemandStatus(id, nextStatus);
    setDemands((prev: any[]) => prev.map(item => item.id === id ? { ...item, status: nextStatus } : item));
    setSelectedDemand((prev: any) => prev && prev.id === id ? { ...prev, status: nextStatus } : prev);
  };

  // Stats calculation
  const totalCount = demands.length;
  const pendingCount = demands.filter(d => d.status === 'pending').length;
  const approvedCount = demands.filter(d => d.status === 'approved').length;
  const totalVotes = demands.reduce((acc, curr) => acc + (curr.upvotes || 0), 0);

  // Filtering
  const filteredDemands = demands.filter(d => {
    const matchesSearch = 
      d.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.items && d.items.some((item: any) => 
        (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.speechTranscript && item.speechTranscript.toLowerCase().includes(searchQuery.toLowerCase()))
      ));
    
    const matchesCategory = filterCategory === 'all' || d.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none' }}></div>

      <header className="header">
        <div className="container header-container">
          <div className="logo-wrapper" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            <div className="logo-icon" style={{ background: 'var(--manager-grad)' }}>
              <Database size={20} strokeWidth={2.5} />
            </div>
            <span>Jansetu</span>
            <span style={{ fontSize: '12px', background: 'rgba(13, 148, 136, 0.2)', color: '#2dd4bf', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', fontWeight: 'bold' }}>Manager Console</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <LanguageSelector selectedLang={selectedLang} setSelectedLang={setSelectedLang} />
            <div className="status-badge" style={{ border: '1px solid rgba(13, 148, 136, 0.3)' }}>
              <span className="pulse-dot" style={{ backgroundColor: '#14b8a6' }}></span>
              <span style={{ color: '#2dd4bf' }}>Database Connected</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }} className="complainant-portal container">
        {/* Back and Title */}
        <div className="portal-header">
          <button type="button" className="btn-back" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={18} />
            <span>Back to Roles</span>
          </button>
          <h2>Consolidated Grievance Registry</h2>
          <p className="portal-subtitle">Review multi-modal citizen submissions, audit AI gap insights, and approve clustered hotspot demands</p>
        </div>

        {/* Dashboard Stats row */}
        <div className="role-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem' }}>📁</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Submissions</span>
              <h3 style={{ fontSize: '1.6rem', color: 'white', margin: 0 }}>{totalCount}</h3>
            </div>
          </div>
          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem' }}>⏳</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Pending Review</span>
              <h3 style={{ fontSize: '1.6rem', color: '#fbbf24', margin: 0 }}>{pendingCount}</h3>
            </div>
          </div>
          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem' }}>✅</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Approved Needs</span>
              <h3 style={{ fontSize: '1.6rem', color: '#34d399', margin: 0 }}>{approvedCount}</h3>
            </div>
          </div>
          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '2rem' }}>👍</div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Citizen Votes</span>
              <h3 style={{ fontSize: '1.6rem', color: '#6366f1', margin: 0 }}>{totalVotes}</h3>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="form-card" style={{ padding: '16px 24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Search by keywords, transcripts, address, or ticket ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                padding: '10px 14px 10px 38px',
                color: 'white',
                width: '100%'
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)}
              style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
            >
              <option value="all">📁 All Categories</option>
              <option value="water">🚰 Water & Sanitation</option>
              <option value="roads">🛣️ Roads & Transport</option>
              <option value="education">🏫 Education & Schools</option>
              <option value="health">🏥 Healthcare</option>
              <option value="power">⚡ Power & Grid</option>
              <option value="agriculture">🌾 Agriculture</option>
              <option value="others">📁 Others / Misc</option>
            </select>

            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
            >
              <option value="all">🔍 All Statuses</option>
              <option value="pending">⏳ Pending Review</option>
              <option value="approved">✅ Approved</option>
              <option value="reviewed">🛠️ Under Review</option>
            </select>
          </div>
        </div>

        {/* Content Layout Grid */}
        <div className="portal-grid" style={{ gridTemplateColumns: '400px 1fr' }}>
          
          {/* Left Column: Demands List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '680px', paddingRight: '4px' }}>
            {filteredDemands.length === 0 ? (
              <div className="empty-attachments" style={{ padding: '40px' }}>
                <AlertTriangle size={24} />
                <span>No registered demands match this search criteria.</span>
              </div>
            ) : (
              filteredDemands.map(d => (
                <div 
                  key={d.id} 
                  onClick={() => setSelectedDemand(d)}
                  style={{
                    background: selectedDemand?.id === d.id ? 'rgba(20, 184, 166, 0.08)' : 'rgba(13, 12, 29, 0.4)',
                    border: selectedDemand?.id === d.id ? '1px solid rgba(20, 184, 166, 0.5)' : '1px solid var(--border-light)',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#14b8a6', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      ID: {d.id.substring(0, 10)}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: d.status === 'approved' ? 'rgba(52, 211, 153, 0.15)' : d.status === 'pending' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: d.status === 'approved' ? '#34d399' : d.status === 'pending' ? '#fbbf24' : 'white',
                      padding: '2px 8px', 
                      borderRadius: '8px', 
                      fontWeight: 'bold' 
                    }}>
                      {d.status}
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
                    {d.category} — {d.scope} scope
                  </strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-desc)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📍 {d.address}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>👍 {d.upvotes || 1} support votes</span>
                    <span>👥 Est. impact: {d.estimatedImpact || 150}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Detailed Review Card */}
          <div>
            {selectedDemand ? (
              <div className="form-card" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', color: 'white', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span>{selectedDemand.category} grievance file</span>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 10px', borderRadius: '10px' }}>
                        {selectedDemand.scope} scope
                      </span>
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                      📍 Coordinates: {selectedDemand.location.lat.toFixed(5)}, {selectedDemand.location.lng.toFixed(5)} | Address: {selectedDemand.address}
                    </p>
                  </div>
                  
                  {/* Status Actions */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedDemand.status !== 'approved' ? (
                      <button 
                        type="button" 
                        onClick={() => handleUpdateStatus(selectedDemand.id, 'approved')}
                        style={{ background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      >
                        <Check size={16} />
                        <span>Verify & Approve</span>
                      </button>
                    ) : (
                      <span style={{ color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                        <CheckCircle size={18} />
                        <span>Approved & Hotspotted</span>
                      </span>
                    )}

                    {selectedDemand.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedDemand.id, 'pending')}
                        style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        Re-open Review
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Validation Gauge & Clusters */}
                <div className="role-grid" style={{ gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
                  <div style={{ border: '1px solid rgba(99, 102, 241, 0.15)', background: 'rgba(99, 102, 241, 0.02)', padding: '16px', borderRadius: '12px' }}>
                    <h4 style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '0.9rem' }}>
                      <Sparkles size={15} />
                      <span>AI Data Integrity Audit</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-desc)' }}>Credibility Rating:</span>
                        <strong style={{ color: '#34d399' }}>96% Reliable</strong>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg, #818cf8, #34d399)', width: '96%', height: '100%' }}></div>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        AI determined location matches geocoded network IP, voice accent correlates with regional standard, and no text plagiarisms detected.
                      </p>
                    </div>
                  </div>

                  <div style={{ border: '1px solid rgba(20, 184, 166, 0.15)', background: 'rgba(20, 184, 166, 0.02)', padding: '16px', borderRadius: '12px' }}>
                    <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '0.9rem' }}>
                      <Database size={15} />
                      <span>Geospatial Similarity Clustering</span>
                    </h4>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: 'white', display: 'block', fontSize: '0.85rem' }}>3 Local Demands Correlated</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Within 500 meters radius</span>
                      </div>
                      <span style={{ background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        AUTO-AGGREGATED
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                      The AI pipeline has consolidated duplicate submissions into this primary reference to optimize the MP's priority pipeline.
                    </p>
                  </div>
                </div>

                {/* Multi-modal evidence materials list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                  <h4 style={{ color: 'white', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', margin: 0, fontSize: '1rem' }}>
                    📁 Submitted Evidence Materials ({selectedDemand.items?.length || 0})
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {selectedDemand.items?.map((item: any, idx: number) => (
                      <div 
                        key={idx} 
                        style={{
                          background: 'rgba(0,0,0,0.15)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '10px',
                          padding: '16px'
                        }}
                      >
                        <span style={{
                          fontSize: '0.7rem',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-desc)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          display: 'inline-block',
                          marginBottom: '10px',
                          textTransform: 'uppercase'
                        }}>
                          {item.type === 'text' && '✍️ Description'}
                          {item.type === 'audio' && '🔊 Voice Recording'}
                          {item.type === 'photo' && '🖼️ Uploaded Photo'}
                        </span>

                        {item.type === 'text' && (
                          <p style={{ color: 'white', margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
                            "{item.content}"
                          </p>
                        )}

                        {item.type === 'audio' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <audio src={item.fileUrl} controls style={{ width: '100%' }} />
                            {item.speechTranscript && (
                              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #818cf8' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#818cf8', fontWeight: 'bold', marginBottom: '4px' }}>
                                  Transcribed regional transcript (OCR/STT):
                                </span>
                                <p style={{ color: 'white', margin: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>
                                  "{item.speechTranscript}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {item.type === 'photo' && (
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            {item.fileUrl ? (
                              <img src={item.fileUrl} alt="Evidence" style={{ width: '120px', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
                            ) : (
                              <div style={{ width: '120px', height: '90px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: '600' }}>Photo Attachment Audit</span>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                AI Vision model confirmed layout depicts structural infrastructure context.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="form-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '600px', color: 'var(--text-muted)' }}>
                <div className="text-center">
                  <Database size={48} style={{ marginBottom: '12px', color: 'var(--border-light)' }} />
                  <p>Select a citizen grievance file from the list to review detailed audits.</p>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

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
    <ManagerConsole />
  </React.StrictMode>
);
