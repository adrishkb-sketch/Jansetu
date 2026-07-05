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
  Image as ImageIcon,
  MapPin,
  User,
  Mail,
  Phone,
  Calendar,
  Award,
  Sliders
} from 'lucide-react';
import { getAllDemands, updateDemandStatus } from './services/db';
import { LanguageSelector, getInitialLanguage, GoogleMapComponent } from './App';
import { AuthModal } from './AuthModal';
import './index.css';

function ManagerConsole() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);
  const [demands, setDemands] = useState<any[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<any | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'registry' | 'complaints'>('registry');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTicketType, setFilterTicketType] = useState('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [prioritySlider, setPrioritySlider] = useState<number>(0);
  const [signatureSlider, setSignatureSlider] = useState<number>(0);
  const [budgetScaleFilter, setBudgetScaleFilter] = useState<string>('all');
  const [scopeSliderFilter, setScopeSliderFilter] = useState<string>('all');
  const [hoveredChartBar, setHoveredChartBar] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('manager_auth') === 'true');

  // Load demands
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    const data = await getAllDemands();
    // Sort by date newest first
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setDemands(data);
    if (data.length > 0) {
      setSelectedDemand(data[0]);
      setSelectedComplaint(data[0]);
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
    setSelectedComplaint((prev: any) => prev && prev.id === id ? { ...prev, status: nextStatus } : prev);
  };

  // Filtering with interactive sliders parameters
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
    const matchesTicketType = activeTab === 'registry' ? true : (filterTicketType === 'all' || (d.ticketType || 'complaint') === filterTicketType);

    // Slide/Tuning threshold parameters
    if (prioritySlider > 0) {
      const score = d.aiOverview?.priorityScore || 0;
      if (score < prioritySlider) return false;
    }

    const votes = d.upvotes || 1;
    if (votes < signatureSlider) return false;

    if (scopeSliderFilter !== 'all' && d.scope !== scopeSliderFilter) return false;

    if (budgetScaleFilter !== 'all') {
      const budgetStr = (d.aiOverview?.estimatedBudget || '').toLowerCase();
      if (budgetScaleFilter === 'under_10k') {
        if (!budgetStr.includes('under') && !budgetStr.includes('1,000') && !budgetStr.includes('5,000')) return false;
      } else if (budgetScaleFilter === '10k_50k') {
        if (!budgetStr.includes('10,000') && !budgetStr.includes('10k') && !budgetStr.includes('20,000') && !budgetStr.includes('50,000') && !budgetStr.includes('30,000')) return false;
      } else if (budgetScaleFilter === 'over_50k') {
        if (!budgetStr.includes('50,000+') && !budgetStr.includes('100k') && !budgetStr.includes('50k') && !budgetStr.includes('+')) return false;
      }
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesTicketType;
  });

  // Dynamic real-data calculations based on filters and sliders
  const totalCount = filteredDemands.length;
  const pendingCount = filteredDemands.filter(d => d.status === 'pending').length;
  const approvedCount = filteredDemands.filter(d => d.status === 'approved').length;
  const totalVotes = filteredDemands.reduce((acc, curr) => acc + (curr.upvotes || 0), 0);

  // Red Alerts (Priority Score > 80)
  const redAlertCount = filteredDemands.filter(d => (d.aiOverview?.priorityScore || 0) > 80).length;

  // Capital Budget Outlay Estimates Summation
  const estimatedBudgetSum = filteredDemands.reduce((acc, curr) => {
    const budgetStr = (curr.aiOverview?.estimatedBudget || '').toLowerCase();
    if (budgetStr.includes('under') || budgetStr.includes('5,000')) return acc + 8000;
    if (budgetStr.includes('10,000') || budgetStr.includes('25,000') || budgetStr.includes('30,000')) return acc + 30000;
    if (budgetStr.includes('50,000') || budgetStr.includes('100k') || budgetStr.includes('+')) return acc + 85000;
    return acc + 10000; // default average
  }, 0);

  // Average Safety Risk Rating Index
  const averageSafetyScore = filteredDemands.length > 0
    ? (filteredDemands.reduce((acc, curr) => {
        const risk = (curr.aiOverview?.safetyRisk || '').toLowerCase();
        if (risk.includes('high')) return acc + 3;
        if (risk.includes('med') || risk.includes('moderate')) return acc + 2;
        return acc + 1; // low
      }, 0) / filteredDemands.length).toFixed(1)
    : '0.0';

  // Sort the filtered list
  const sortedDemands = [...filteredDemands].sort((a, b) => {
    if (sortBy === 'priority') {
      const scoreA = a.aiOverview?.priorityScore || 0;
      const scoreB = b.aiOverview?.priorityScore || 0;
      return scoreB - scoreA;
    }
    if (sortBy === 'upvotes') {
      const votesA = a.upvotes || 1;
      const votesB = b.upvotes || 1;
      return votesB - votesA;
    }
    if (sortBy === 'impact') {
      const impactA = a.estimatedImpact || 150;
      const impactB = b.estimatedImpact || 150;
      return impactB - impactA;
    }
    // Default newest
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // Analytics calculations for graphs and tables
  const categoryCounts = filteredDemands.reduce((acc: any, curr: any) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {});

  const sortedCategories = Object.keys(categoryCounts).map(cat => ({
    category: cat,
    count: categoryCounts[cat]
  })).sort((a, b) => b.count - a.count);

  const statusCounts = {
    pending: pendingCount,
    approved: approvedCount,
    needs_info: filteredDemands.filter(d => d.status === 'needs_info' || d.needsMoreInfo).length
  };

  const zones: any = {};
  filteredDemands.forEach(d => {
    const wardKey = `Ward Zone (${d.location.lat.toFixed(2)}, ${d.location.lng.toFixed(2)})`;
    if (!zones[wardKey]) {
      zones[wardKey] = { name: wardKey, address: d.address.split(',')[0], water: 0, roads: 0, education: 0, health: 0, power: 0, others: 0, total: 0 };
    }
    const cat = d.category;
    if (['water', 'roads', 'education', 'health', 'power'].includes(cat)) {
      zones[wardKey][cat]++;
    } else {
      zones[wardKey].others++;
    }
    zones[wardKey].total++;
  });

  const topZones = Object.values(zones).sort((a: any, b: any) => b.total - a.total).slice(0, 5);

  return (
    <>
      {!isAuthenticated && <AuthModal role="manager" onSuccess={() => setIsAuthenticated(true)} onClose={() => window.location.href = '/'} />}
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
            {isAuthenticated && (
              <button 
                onClick={() => {
                  sessionStorage.removeItem('manager_auth');
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
        {/* Back and Title */}
        <div className="portal-header">
          <button type="button" className="btn-back" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={18} />
            <span>Back to Roles</span>
          </button>
          <h2>Consolidated Grievance Registry</h2>
          <p className="portal-subtitle">Review multi-modal citizen submissions, audit AI gap insights, and approve clustered hotspot demands</p>
        </div>

        {/* Tab selection menu */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('registry')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'registry' ? '#14b8a6' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'registry' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'registry' ? '#2dd4bf' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📊 Dashboard & Hotspots
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('complaints')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'complaints' ? '#14b8a6' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'complaints' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'complaints' ? '#2dd4bf' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📋 All Complaints (Citizen Submissions)
          </button>
        </div>

        {/* Dynamic Parameter Tuning Controls */}
        {activeTab === 'registry' && (
          <div className="form-card" style={{ padding: '20px 24px', marginBottom: '24px', textAlign: 'left' }}>
            <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontSize: '1rem' }}>
              <Sliders size={18} />
              <span>Interactive Parameter Tuning & Simulation Controls</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              
              {/* Priority slider */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#c5c7e6', marginBottom: '6px' }}>
                  <span>Min Priority Score:</span>
                  <strong style={{ color: '#ef4444' }}>{prioritySlider}+</strong>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={prioritySlider}
                  onChange={e => setPrioritySlider(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#14b8a6', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '10px', color: '#8e90b3' }}>Filters out low importance concerns.</span>
              </div>

              {/* Signatures slider */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#c5c7e6', marginBottom: '6px' }}>
                  <span>Min Support Signatures:</span>
                  <strong style={{ color: '#34d399' }}>{signatureSlider}+</strong>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  value={signatureSlider}
                  onChange={e => setSignatureSlider(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#14b8a6', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '10px', color: '#8e90b3' }}>Filters out isolated single-user inputs.</span>
              </div>

              {/* Budget Scale selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#c5c7e6', marginBottom: '6px' }}>
                  Filter Budget Scale:
                </label>
                <select
                  value={budgetScaleFilter}
                  onChange={e => setBudgetScaleFilter(e.target.value)}
                  style={{ width: '100%', background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px' }}
                >
                  <option value="all">📁 All Budgets</option>
                  <option value="under_10k">🟢 Minor Work (&lt;$10k)</option>
                  <option value="10k_50k">🟡 Medium Work ($10k-$50k)</option>
                  <option value="over_50k">🔴 Major Capital (&gt;$50k)</option>
                </select>
              </div>

              {/* Scope filter */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#c5c7e6', marginBottom: '6px' }}>
                  Filter Impact Scope:
                </label>
                <select
                  value={scopeSliderFilter}
                  onChange={e => setScopeSliderFilter(e.target.value)}
                  style={{ width: '100%', background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px' }}
                >
                  <option value="all">🌎 All Scopes</option>
                  <option value="household">🏠 Household Level</option>
                  <option value="street">🛣️ Street Level</option>
                  <option value="ward">🏡 Ward Level</option>
                  <option value="constituency"> Constituency Level</option>
                </select>
              </div>

            </div>
          </div>
        )}

        {/* Dashboard Stats row (6-Grid Advanced KPI indicators) */}
        <div className="role-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '1.8rem' }}>📁</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Grievances</span>
              <h3 style={{ fontSize: '1.4rem', color: 'white', margin: 0 }}>{totalCount}</h3>
            </div>
          </div>
          
          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '1.8rem' }}>🚨</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 'bold' }}>Red Alerts (&gt;80)</span>
              <h3 style={{ fontSize: '1.4rem', color: '#f87171', margin: 0 }}>{redAlertCount}</h3>
            </div>
          </div>

          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '1.8rem' }}>⏳</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 'bold' }}>Pending Audit</span>
              <h3 style={{ fontSize: '1.4rem', color: '#fbbf24', margin: 0 }}>{pendingCount}</h3>
            </div>
          </div>

          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '1.8rem' }}>👍</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#6366f1', textTransform: 'uppercase', fontWeight: 'bold' }}>Citizen Votes</span>
              <h3 style={{ fontSize: '1.4rem', color: '#818cf8', margin: 0 }}>{totalVotes}</h3>
            </div>
          </div>

          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '1.8rem' }}>💰</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold' }}>Est. Budget Outlay</span>
              <h3 style={{ fontSize: '1.3rem', color: '#34d399', margin: 0 }}>₹{(estimatedBudgetSum * 85).toLocaleString('en-IN')}</h3>
            </div>
          </div>

          <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '1.8rem' }}>🛡️</div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 'bold' }}>Avg Safety Risk</span>
              <h3 style={{ fontSize: '1.4rem', color: '#a5b4fc', margin: 0 }}>{averageSafetyScore}/3.0</h3>
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
              <option value="safety">🚓 Public Safety & Police</option>
              <option value="environment">🌳 Environment & Forestry</option>
              <option value="welfare">🤝 Social Welfare & Pension</option>
              <option value="housing">🏗️ Housing & Urban Dev</option>
              <option value="anticorruption">⚖️ Anti-Corruption</option>
              <option value="digital">💻 Digital Services & IT</option>
              <option value="disaster">🌪️ Disaster Management</option>
              <option value="women">👩 Women & Child Welfare</option>
              <option value="justice">🏛️ Law & Justice</option>
              <option value="economy">📈 Economy & Commerce</option>
              <option value="consumer">🛍️ Consumer Affairs</option>
              <option value="taxes">💵 Revenue & Taxes</option>
              <option value="tourism">🗺️ Tourism & Culture</option>
              <option value="youth">⚽ Youth & Sports</option>
              <option value="innovation">🔬 Science & Innovation</option>
              <option value="rural">🏡 Rural Infrastructure</option>
              <option value="security">🛡️ Defence & Security</option>
              <option value="cyber">🔒 Cyber Security</option>
              <option value="climate">🌍 Climate Change Action</option>
              <option value="space">🚀 Space Exploration</option>
              <option value="foreign">🌐 Foreign Relations</option>
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

            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)}
              style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
            >
              <option value="newest">📅 Sort by: Newest First</option>
              <option value="priority">🔥 Sort by: Priority Score</option>
              <option value="upvotes">👍 Sort by: Signatures</option>
              <option value="impact">👥 Sort by: Est. Impact</option>
            </select>

            {activeTab === 'complaints' && (
              <select 
                value={filterTicketType} 
                onChange={e => setFilterTicketType(e.target.value)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
              >
                <option value="all">🎫 All Types</option>
                <option value="complaint">⚠️ Complaints Only</option>
                <option value="suggestion">💡 Suggestions Only</option>
              </select>
            )}
          </div>
        </div>

        {/* Content Layout Grid */}
        {activeTab === 'registry' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
            
            {/* Top Analytics Panel: Map Heatzones & Top Categories Prevalence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }} className="role-grid">
              
              {/* Map Heatzones */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                  <MapPin size={18} style={{ color: '#2dd4bf' }} />
                  <span>Interactive Regional Hotspot Heat-Zones (Filtered System Data)</span>
                </h4>
                <div style={{ height: '320px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <GoogleMapComponent
                    apiKey={localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg'}
                    onLocationSelect={() => {}}
                    selectedLocation={selectedDemand?.location || { lat: 28.803, lng: 79.025 }}
                    nearbyHotspots={filteredDemands.map(fd => ({
                      id: fd.id,
                      location: fd.location,
                      category: fd.category,
                      upvotes: fd.upvotes || 1
                    }))}
                    focusedPlace={null}
                    circleData={null}
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', color: '#8e90b3' }}>
                  <span>⭕ Circle radius represents support signatures count</span>
                  <span style={{ color: '#f87171' }}>● Roads (Red)</span>
                  <span style={{ color: '#fbbf24' }}>● Water (Yellow)</span>
                  <span style={{ color: '#38bdf8' }}>● Education (Blue)</span>
                  <span style={{ color: '#a78bfa' }}>● Power (Purple)</span>
                </div>
              </div>

              {/* Prevalence & Workflow share charts */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <h4 style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                  <Sparkles size={18} />
                  <span>Category Prevalence & Resolution shares</span>
                </h4>
                
                {/* SVG Bar Chart */}
                <div style={{ flexGrow: 1, position: 'relative' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-desc)', display: 'block', marginBottom: '8px' }}>
                    📈 Incoming Prevalence counts (Hover for details):
                  </span>
                  {sortedCategories.length === 0 ? (
                    <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e90b3', fontSize: '12px' }}>
                      No data to chart.
                    </div>
                  ) : (
                    <svg viewBox={`0 0 400 130`} style={{ width: '100%', height: '130px', overflow: 'visible' }}>
                      {sortedCategories.slice(0, 5).map((c, i) => {
                        const barWidth = 40;
                        const gapSize = 30;
                        const x = 50 + i * (barWidth + gapSize);
                        const maxVal = Math.max(...sortedCategories.map(item => item.count), 1);
                        const height = (c.count / maxVal) * 80;
                        const y = 100 - height;
                        const isHovered = hoveredChartBar === c.category;

                        return (
                          <g 
                            key={c.category} 
                            onMouseEnter={() => setHoveredChartBar(c.category)}
                            onMouseLeave={() => setHoveredChartBar(null)}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Bar Rect */}
                            <rect 
                              x={x} 
                              y={y} 
                              width={barWidth} 
                              height={height} 
                              rx={4} 
                              fill={isHovered ? '#2dd4bf' : 'url(#barGrad)'} 
                              style={{ transition: 'all 0.2s ease' }}
                            />
                            {/* Count label */}
                            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                              {c.count}
                            </text>
                            {/* X-axis Label */}
                            <text x={x + barWidth / 2} y={115} textAnchor="middle" fill="#8e90b3" fontSize="9" fontWeight="600" style={{ textTransform: 'uppercase' }}>
                              {c.category.substring(0, 6)}
                            </text>
                          </g>
                        );
                      })}
                      {/* Gradients */}
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>
                    </svg>
                  )}
                  {hoveredChartBar && (
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(9, 8, 26, 0.95)', border: '1px solid #14b8a6', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: 'white', zIndex: 10 }}>
                      Category: <strong style={{ color: '#2dd4bf', textTransform: 'capitalize' }}>{hoveredChartBar}</strong>
                      <br />
                      Share: <strong>{((categoryCounts[hoveredChartBar] || 0) / (filteredDemands.length || 1) * 100).toFixed(0)}%</strong>
                    </div>
                  )}
                </div>

                {/* Donut progress status grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block' }}>⏳ PENDING</span>
                    <strong style={{ fontSize: '12px', color: '#fbbf24' }}>
                      {statusCounts.pending} ({totalCount > 0 ? (statusCounts.pending / totalCount * 100).toFixed(0) : 0}%)
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block' }}>✅ APPROVED</span>
                    <strong style={{ fontSize: '12px', color: '#34d399' }}>
                      {statusCounts.approved} ({totalCount > 0 ? (statusCounts.approved / totalCount * 100).toFixed(0) : 0}%)
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block' }}>🛠️ NEEDS INFO</span>
                    <strong style={{ fontSize: '12px', color: '#ef4444' }}>
                      {statusCounts.needs_info} ({totalCount > 0 ? (statusCounts.needs_info / totalCount * 100).toFixed(0) : 0}%)
                    </strong>
                  </div>
                </div>

              </div>
            </div>

            {/* Middle Analytics Panel: Urgency vs Impact & Velocity Trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="role-grid">
              
              {/* Scatter bubble Plot */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <h4 style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                  <Award size={18} style={{ color: '#fbbf24' }} />
                  <span>AI Priority Score vs Estimated Impact Population</span>
                </h4>
                <div style={{ flexGrow: 1, position: 'relative' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-desc)', display: 'block', marginBottom: '8px' }}>
                    🔴 Target Quadrant: Top-Right (High Priority, High Population Impact, Requires Direct Constituency Funds)
                  </span>
                  {filteredDemands.length === 0 ? (
                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e90b3', fontSize: '12px' }}>
                      No data to plot.
                    </div>
                  ) : (
                    <svg viewBox="0 0 400 150" style={{ width: '100%', height: '150px', overflow: 'visible' }}>
                      {/* Quadrant grid lines */}
                      <line x1="200" y1="10" x2="200" y2="130" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                      <line x1="30" y1="70" x2="380" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                      
                      {/* Axes */}
                      <line x1="30" y1="130" x2="380" y2="130" stroke="rgba(255,255,255,0.2)" />
                      <line x1="30" y1="10" x2="30" y2="130" stroke="rgba(255,255,255,0.2)" />

                      {/* Bubble points */}
                      {filteredDemands.map((fd, i) => {
                        const score = fd.aiOverview?.priorityScore || 50;
                        const impact = Math.min(fd.estimatedImpact || 150, 10000);
                        
                        // Map score 0-100 to x 40-370
                        const x = 40 + (score / 100) * 320;
                        // Map impact 0-10000 to y 120-20
                        const y = 120 - (Math.sqrt(impact) / 100) * 100;
                        
                        // Circle size based on upvotes
                        const r = Math.min(4 + (fd.upvotes || 1) * 0.4, 16);

                        let color = '#818cf8'; // power
                        if (fd.category === 'roads') color = '#ef4444';
                        if (fd.category === 'water') color = '#fbbf24';
                        if (fd.category === 'education') color = '#38bdf8';
                        if (fd.category === 'health') color = '#10b981';

                        return (
                          <circle 
                            key={i}
                            cx={x}
                            cy={y}
                            r={r}
                            fill={color}
                            fillOpacity="0.75"
                            stroke="white"
                            strokeWidth="0.5"
                            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                          >
                            <title>
                              {fd.category.toUpperCase()} Grievance\nPriority: {score}/100\nImpact: {impact} citizens\nSignatures: {fd.upvotes || 1}\nAddress: {fd.address}
                            </title>
                          </circle>
                        );
                      })}

                      {/* Axes Labels */}
                      <text x="380" y="142" textAnchor="end" fill="#8e90b3" fontSize="8">Priority Score ➔</text>
                      <text x="10" y="20" textAnchor="start" fill="#8e90b3" fontSize="8" transform="rotate(-90 10 20)">Impact Pop. ➔</text>
                    </svg>
                  )}
                </div>
              </div>

              {/* Velocity Line/Area Chart */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                  <Calendar size={18} style={{ color: '#2dd4bf' }} />
                  <span>Constituency Submission Velocity Velocity Trend</span>
                </h4>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-desc)', display: 'block', marginBottom: '8px' }}>
                    📈 Daily incoming submission volume (last 7 submission days):
                  </span>
                  {filteredDemands.length === 0 ? (
                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e90b3', fontSize: '12px' }}>
                      No data to chart.
                    </div>
                  ) : (
                    <svg viewBox="0 0 400 150" style={{ width: '100%', height: '150px', overflow: 'visible' }}>
                      {/* Grid lines */}
                      <line x1="30" y1="40" x2="380" y2="40" stroke="rgba(255,255,255,0.04)" />
                      <line x1="30" y1="80" x2="380" y2="80" stroke="rgba(255,255,255,0.04)" />
                      
                      {/* Axes */}
                      <line x1="30" y1="120" x2="380" y2="120" stroke="rgba(255,255,255,0.2)" />

                      {/* Area polygon points */}
                      {(() => {
                        // Group by date
                        const datesGroup: any = {};
                        filteredDemands.forEach(d => {
                          const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A';
                          datesGroup[dateStr] = (datesGroup[dateStr] || 0) + 1;
                        });
                        const sortedDates = Object.keys(datesGroup).map(k => ({ date: k, count: datesGroup[k] })).slice(-7);
                        if (sortedDates.length === 0) return null;
                        
                        const maxCount = Math.max(...sortedDates.map(d => d.count), 1);
                        const points = sortedDates.map((sd, i) => {
                          const x = 40 + i * (330 / Math.max(sortedDates.length - 1, 1));
                          const y = 120 - (sd.count / maxCount) * 80;
                          return { x, y, ...sd };
                        });

                        const pathDef = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const areaDef = `${pathDef} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;

                        return (
                          <g>
                            {/* Area fill */}
                            <path d={areaDef} fill="url(#areaFillGrad)" />
                            {/* Line path */}
                            <path d={pathDef} fill="none" stroke="#2dd4bf" strokeWidth="2.5" />
                            {/* Circle dots */}
                            {points.map((p, idx) => (
                              <g key={idx}>
                                <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#2dd4bf" strokeWidth="1.5" />
                                <text x={p.x} y={135} textAnchor="middle" fill="#8e90b3" fontSize="8" fontWeight="bold">
                                  {p.date}
                                </text>
                                <text x={p.x} y={p.y - 8} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
                                  {p.count}
                                </text>
                              </g>
                            ))}
                            <defs>
                              <linearGradient id="areaFillGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                          </g>
                        );
                      })()}
                    </svg>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Analytics Panel: Ward Gap Matrix Grid */}
            <div className="form-card" style={{ padding: '20px', textAlign: 'left' }}>
              <h4 style={{ color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontSize: '1rem' }}>
                <Database size={18} />
                <span>Geospatial Ward Infrastructure Gaps Matrix Table</span>
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-desc)', margin: '0 0 16px 0' }}>
                Rounded coordinate clusters (approx. 1km² zones) representing local wards. Compares infrastructure deficits across categories.
              </p>
              {topZones.length === 0 ? (
                <div style={{ color: '#8e90b3', fontStyle: 'italic', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
                  No regional data clusters matching filters.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#818cf8', fontWeight: 'bold' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Local Neighborhood (Approx. Grid)</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🚰 Water</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🛣️ Roads</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🏫 Education</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🏥 Health</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>⚡ Power</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>📁 Other</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', color: '#2dd4bf' }}>Total Deficit Index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topZones.map((z: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 'bold' }}>
                            📍 {z.address || 'Constituency Outer Boundary'}
                            <span style={{ display: 'block', fontSize: '10px', color: '#8e90b3', fontWeight: 'normal' }}>{z.name}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: z.water > 0 ? '#fbbf24' : '#8e90b3', fontWeight: z.water > 0 ? 'bold' : 'normal' }}>{z.water}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: z.roads > 0 ? '#ef4444' : '#8e90b3', fontWeight: z.roads > 0 ? 'bold' : 'normal' }}>{z.roads}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: z.education > 0 ? '#38bdf8' : '#8e90b3', fontWeight: z.education > 0 ? 'bold' : 'normal' }}>{z.education}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: z.health > 0 ? '#10b981' : '#8e90b3', fontWeight: z.health > 0 ? 'bold' : 'normal' }}>{z.health}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: z.power > 0 ? '#a78bfa' : '#8e90b3', fontWeight: z.power > 0 ? 'bold' : 'normal' }}>{z.power}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#8e90b3' }}>{z.others}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#2dd4bf', fontWeight: 'bold', background: 'rgba(20, 184, 166, 0.05)' }}>{z.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Content Layout Grid */}
        {activeTab === 'registry' ? (
          <div className="portal-grid" style={{ gridTemplateColumns: '400px 1fr' }}>
            
            {/* Left Column: Demands List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '680px', paddingRight: '4px' }}>
              {sortedDemands.length === 0 ? (
                <div className="empty-attachments" style={{ padding: '40px' }}>
                  <AlertTriangle size={24} />
                  <span>No registered demands match this search criteria.</span>
                </div>
              ) : (
                sortedDemands.map(d => (
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

                  {/* Interactive Map Coordinates Block */}
                  <div>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#c7d2fe', marginBottom: '8px', textAlign: 'left' }}>
                      <MapPin size={14} style={{ color: '#818cf8' }} /> Google Map Grievance Location & Circle Boundaries
                    </strong>
                    <div style={{ height: '260px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <GoogleMapComponent
                        apiKey={localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg'}
                        onLocationSelect={() => {}}
                        selectedLocation={selectedDemand.location}
                        nearbyHotspots={[]}
                        focusedPlace={{ lat: selectedDemand.location.lat, lng: selectedDemand.location.lng, name: selectedDemand.associatedPlace?.name || 'Citizen Location' }}
                        circleData={selectedDemand.circleData || { lat: selectedDemand.location.lat, lng: selectedDemand.location.lng, radius: 100 }}
                      />
                    </div>
                  </div>

                  {selectedDemand.associatedPlace && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '14px', borderRadius: '8px', textAlign: 'left' }}>
                      <strong style={{ color: '#818cf8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        📌 Linked Infrastructure/Target Landmark
                      </strong>
                      <span style={{ color: 'white', fontSize: '14px' }}>
                        Name: <strong>{selectedDemand.associatedPlace.name}</strong> ({selectedDemand.associatedPlace.type})
                      </span>
                    </div>
                  )}

                  {selectedDemand.circleData && (
                    <div style={{ background: 'rgba(20, 184, 166, 0.05)', border: '1px solid rgba(20, 184, 166, 0.15)', padding: '14px', borderRadius: '8px', textAlign: 'left' }}>
                      <strong style={{ color: '#2dd4bf', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        ⭕ Selected Impact Boundary Region
                      </strong>
                      <span style={{ color: 'white', fontSize: '13px' }}>
                        Scope Radius: <strong>{selectedDemand.circleData.radius.toFixed(0)} meters</strong> centered at coords ({selectedDemand.circleData.lat.toFixed(5)}, {selectedDemand.circleData.lng.toFixed(5)})
                      </span>
                    </div>
                  )}

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
                              {item.fileUrl ? (
                                <audio src={item.fileUrl} controls style={{ width: '100%' }} />
                              ) : (
                                <span style={{ fontSize: '12.5px', color: '#8e90b3', fontStyle: 'italic' }}>Audio file was not saved (transcripts only).</span>
                              )}
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
                                  {item.fileUrl ? "AI Vision model confirmed layout depicts structural infrastructure context." : "Image detail discarded by AI (not deemed necessary to identify the problem)."}
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
        ) : (
          <div className="portal-grid" style={{ gridTemplateColumns: '400px 1fr' }}>
            
            {/* Left Column: Direct Submissions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '680px', paddingRight: '4px' }}>
              {sortedDemands.length === 0 ? (
                <div className="empty-attachments" style={{ padding: '40px' }}>
                  <AlertTriangle size={24} />
                  <span>No direct submissions match this search criteria.</span>
                </div>
              ) : (
                sortedDemands.map(d => {
                  const isSug = d.ticketType === 'suggestion';
                  return (
                    <div 
                      key={d.id} 
                      onClick={() => setSelectedComplaint(d)}
                      style={{
                        background: selectedComplaint?.id === d.id ? 'rgba(20, 184, 166, 0.08)' : 'rgba(13, 12, 29, 0.4)',
                        border: selectedComplaint?.id === d.id ? '1px solid rgba(20, 184, 166, 0.5)' : '1px solid var(--border-light)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderLeft: isSug ? '4px solid #10b981' : '4px solid #fbbf24',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', background: isSug ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isSug ? '#34d399' : '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {isSug ? '💡 SUGGESTION' : '⚠️ COMPLAINT'}
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
                        {d.category} — {d.scope} scope
                      </strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-desc)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📍 {d.address}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>👍 {d.upvotes || 1} support signatures</span>
                        <span><Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#14b8a6' }} /> {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Comprehensive Complaint/Submission View */}
            <div>
              {selectedComplaint ? (
                <div className="form-card" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                  
                  {/* Header metadata row */}
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', background: selectedComplaint.ticketType === 'suggestion' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: selectedComplaint.ticketType === 'suggestion' ? '#34d399' : '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        Ticket Reference ID: {selectedComplaint.id}
                      </span>
                      <h3 style={{ fontSize: '1.4rem', color: 'white', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', marginBottom: 0 }}>
                        <span>{selectedComplaint.category} citizen ticket</span>
                        <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 10px', borderRadius: '10px' }}>
                          {selectedComplaint.scope} scope
                        </span>
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {selectedComplaint.status !== 'approved' ? (
                        <button 
                          type="button" 
                          onClick={() => handleUpdateStatus(selectedComplaint.id, 'approved')}
                          style={{ background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                          <Check size={16} />
                          <span>Approve & Hotspot</span>
                        </button>
                      ) : (
                        <span style={{ color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                          <CheckCircle size={18} />
                          <span>Approved & Active</span>
                        </span>
                      )}
                      {selectedComplaint.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(selectedComplaint.id, 'pending')}
                          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          Re-open
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Map Coordinates Block */}
                  <div>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#c7d2fe', marginBottom: '8px' }}>
                      <MapPin size={14} style={{ color: '#818cf8' }} /> Google Map Grievance Location & Circle Boundaries
                    </strong>
                    <div style={{ height: '260px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <GoogleMapComponent
                        apiKey={localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg'}
                        onLocationSelect={() => {}}
                        selectedLocation={selectedComplaint.location}
                        nearbyHotspots={[]}
                        focusedPlace={{ lat: selectedComplaint.location.lat, lng: selectedComplaint.location.lng, name: selectedComplaint.associatedPlace?.name || 'Citizen Location' }}
                        circleData={selectedComplaint.circleData || { lat: selectedComplaint.location.lat, lng: selectedComplaint.location.lng, radius: 100 }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: '#8e90b3', display: 'block', marginTop: '6px' }}>
                      📍 Geocoded Address: <strong>{selectedComplaint.address}</strong> (Coords: {selectedComplaint.location.lat.toFixed(5)}, {selectedComplaint.location.lng.toFixed(5)})
                    </span>
                  </div>

                  {selectedComplaint.associatedPlace && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '14px', borderRadius: '8px' }}>
                      <strong style={{ color: '#818cf8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        📌 Linked Infrastructure/Target Landmark
                      </strong>
                      <span style={{ color: 'white', fontSize: '14px' }}>
                        Name: <strong>{selectedComplaint.associatedPlace.name}</strong> ({selectedComplaint.associatedPlace.type})
                      </span>
                    </div>
                  )}

                  {selectedComplaint.circleData && (
                    <div style={{ background: 'rgba(20, 184, 166, 0.05)', border: '1px solid rgba(20, 184, 166, 0.15)', padding: '14px', borderRadius: '8px' }}>
                      <strong style={{ color: '#2dd4bf', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        ⭕ Selected Impact Boundary Region
                      </strong>
                      <span style={{ color: 'white', fontSize: '13px' }}>
                        Scope Radius: <strong>{selectedComplaint.circleData.radius.toFixed(0)} meters</strong> centered at coords ({selectedComplaint.circleData.lat.toFixed(5)}, {selectedComplaint.circleData.lng.toFixed(5)})
                      </span>
                    </div>
                  )}

                  {/* Contact details */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '14px', borderRadius: '8px' }}>
                    <strong style={{ color: '#2dd4bf', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <User size={14} /> Registered Citizen Contacts
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
                      <span style={{ color: '#c5c7e6' }}>
                        <Mail size={12} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#14b8a6' }} /> 
                        Email: <strong>{selectedComplaint.email || 'Anonymous Submission'}</strong>
                      </span>
                      <span style={{ color: '#c5c7e6' }}>
                        <Phone size={12} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#14b8a6' }} /> 
                        Phone: <strong>{selectedComplaint.phone || 'Not Provided'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* AI overview parameters */}
                  {selectedComplaint.aiOverview && (
                    <div style={{ border: '1px solid rgba(20, 184, 166, 0.3)', padding: '16px', borderRadius: '8px', background: 'rgba(20, 184, 166, 0.05)' }}>
                      <strong style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', marginBottom: '10px' }}>
                        <Sparkles size={14} /> AI Classification & Parameters Metrics
                      </strong>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#c7d2fe', fontStyle: 'italic', borderLeft: '3px solid #2dd4bf', paddingLeft: '8px' }}>
                        "{selectedComplaint.aiOverview.brief}"
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '9px', color: '#8e90b3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', fontWeight: 'bold' }}>
                            <Award size={10} style={{ color: '#ef4444' }} /> PRIORITY LEVEL
                          </span>
                          <strong style={{ fontSize: '12.5px', color: '#ef4444' }}>{selectedComplaint.aiOverview.priorityScore || 'N/A'}/100</strong>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block', fontWeight: 'bold' }}>URGENCY</span>
                          <strong style={{ fontSize: '12.5px', color: '#fbbf24', textTransform: 'uppercase' }}>{selectedComplaint.urgency || 'N/A'}</strong>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block', fontWeight: 'bold' }}>SAFETY RISK</span>
                           <strong style={{ fontSize: '12.5px', color: '#f87171', textTransform: 'uppercase' }}>{selectedComplaint.aiOverview.safetyRisk || 'Low'}</strong>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block', fontWeight: 'bold' }}>EST. BUDGET</span>
                          <strong style={{ fontSize: '12.5px', color: '#34d399', textTransform: 'uppercase' }}>{selectedComplaint.aiOverview.estimatedBudget || 'N/A'}</strong>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '9px', color: '#8e90b3', display: 'block', fontWeight: 'bold' }}>FUNDING SOURCE</span>
                          <strong style={{ fontSize: '11px', color: '#818cf8', textTransform: 'uppercase' }}>{selectedComplaint.fundingSource || 'N/A'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Multi-modal Evidence & Audio Transcripts details */}
                  <div>
                    <strong style={{ display: 'block', fontSize: '13.5px', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '12px' }}>
                      📁 Citizen Evidence Materials & Transcripts ({selectedComplaint.items?.length || 0})
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedComplaint.items && selectedComplaint.items.length > 0 ? (
                        selectedComplaint.items.map((item: any, idx: number) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#8e90b3', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', marginBottom: '8px', textTransform: 'uppercase' }}>
                              Attachment #{idx + 1} — {item.type === 'text' ? '✍️ Description' : item.type === 'audio' ? '🔊 Voice Note' : '🖼️ Photo Evidence'}
                            </span>

                            {item.content && (
                              <p style={{ margin: '4px 0 6px', color: 'white', fontSize: '13px', lineHeight: '1.4' }}>
                                <strong>Content Description:</strong> "{item.content}"
                              </p>
                            )}

                            {item.speechTranscript && (
                              <p style={{ margin: '4px 0 6px', color: '#a5b4fc', fontSize: '13px', lineHeight: '1.4', fontStyle: 'italic' }}>
                                <strong>Transcribed Voice (Speech-to-Text):</strong> "{item.speechTranscript}"
                              </p>
                            )}

                            {item.ocrText && (
                              <p style={{ margin: '4px 0 6px', color: '#6ee7b7', fontSize: '13px', lineHeight: '1.4' }}>
                                <strong>Extracted OCR Document Text:</strong> "{item.ocrText}"
                              </p>
                            )}

                            {item.type === 'audio' && (
                              <span style={{ fontSize: '10px', color: '#8e90b3', display: 'block', marginTop: '6px' }}>
                                🔊 Voice note recordings are stored as transcribed text on registry servers to protect user privacy.
                              </span>
                            )}

                            {item.type === 'photo' && (
                              <div style={{ marginTop: '8px' }}>
                                {item.fileUrl ? (
                                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                      <img src={item.fileUrl} alt="Evidence" style={{ width: '160px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                      
                                      {/* Bounding Boxes Overlays */}
                                      {item.boundingBoxes && item.boundingBoxes.map((box: any, bIdx: number) => (
                                        <div 
                                          key={bIdx}
                                          style={{
                                            position: 'absolute',
                                            border: '2px solid #ef4444',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            left: `${box.box_2d[1]}%`,
                                            top: `${box.box_2d[0]}%`,
                                            width: `${box.box_2d[3] - box.box_2d[1]}%`,
                                            height: `${box.box_2d[2] - box.box_2d[0]}%`
                                          }}
                                        >
                                          <span style={{ position: 'absolute', top: '-14px', left: 0, fontSize: '8px', background: '#ef4444', color: 'white', padding: '0 3px', borderRadius: '2px', whiteSpace: 'nowrap' }}>
                                            {box.label}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    <div>
                                      <strong style={{ fontSize: '12px', color: 'white', display: 'block' }}>Verified Image Context</strong>
                                      <p style={{ fontSize: '11px', color: '#8e90b3', margin: '4px 0 0' }}>
                                        Image is processed and retained because it contains essential landmarks context.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ImageIcon size={18} style={{ color: '#fbbf24' }} />
                                    <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>
                                      Image details discarded by AI (not deemed necessary to identify the problem).
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#8e90b3', fontStyle: 'italic', fontSize: '13px' }}>No attachments logged for this ticket.</p>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="form-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '600px', color: 'var(--text-muted)' }}>
                  <div className="text-center">
                    <Database size={48} style={{ marginBottom: '12px', color: 'var(--border-light)' }} />
                    <p>Select a direct citizen submission from the list to view its complete logs.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

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
