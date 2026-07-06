import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  ArrowLeft, 
  Award, 
  Sparkles, 
  CheckCircle, 
  Info, 
  Loader2, 
  Volume2, 
  Layers, 
  Play, 
  Clock, 
  Plus
} from 'lucide-react';
import { 
  getAllDemands, 
  updateDemandStatus, 
  getActionPlanByConstituency, 
  saveActionPlanByConstituency,
  getMPFunds,
  saveMPFunds 
} from './services/db';
import { LanguageSelector, getInitialLanguage, GeminiKeysFooter } from './App';
import { fetchGemini } from './services/gemini_api';
import { AuthModal } from './AuthModal';
import { ALL_CONSTITUENCIES_DATA } from './services/constituency_datasets';
import './index.css';

function MPApp() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('mp_auth') === 'true');
  
  // Constituency Selection
  const [selectedConstituency, setSelectedConstituency] = useState<string>('Rampur');
  
  // Funds Configuration State
  const [mpladsFunds, setMpladsFunds] = useState<number>(0);
  const [resetFrequency, setResetFrequency] = useState<string>('yearly');
  const [extraFunds, setExtraFunds] = useState<string>('');

  // Search States
  const [searchMode, setSearchMode] = useState<'constituency' | 'issue'>('constituency');
  const [searchConstituencyName, setSearchConstituencyName] = useState<string>('Rampur');
  const [searchIssueQuery, setSearchIssueQuery] = useState<string>('water');

  // Matching Demands
  const [demands, setDemands] = useState<any[]>([]);
  const [matchingDemands, setMatchingDemands] = useState<any[]>([]);
  
  // Gemini AI Summary States
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [problemSummary, setProblemSummary] = useState<string>('');

  // Speech script generation
  const [generatingSpeech, setGeneratingSpeech] = useState(false);
  const [speechMinutes, setSpeechMinutes] = useState<number>(2);
  const [speechDraft, setSpeechDraft] = useState<string>('');
  const [speechSlides, setSpeechSlides] = useState<string[]>([]);
  const [activeSpeechSlide, setActiveSpeechSlide] = useState<number>(0);
  const [aiActionAuditReport, setAiActionAuditReport] = useState<string | null>(null);
  const [isAuditingAction, setIsAuditingAction] = useState<boolean>(false);

  // Action Plan from Manager
  const [approvedPlan, setApprovedPlan] = useState<any | null>(null);
  const [selectedPlanType, setSelectedPlanType] = useState<'constituency' | 'category'>('constituency');
  const [selectedPlanCategory, setSelectedPlanCategory] = useState<string>('water');
 
  // Load MP Funds & Demands
  useEffect(() => {
    if (isAuthenticated) {
      loadFundsConfig();
      loadData();
    }
  }, [isAuthenticated, selectedConstituency]);
 
  // Load Action Plan whenever selection or search criteria changes
  useEffect(() => {
    if (isAuthenticated) {
      loadActionPlan();
    }
  }, [isAuthenticated, selectedConstituency, selectedPlanType, selectedPlanCategory]);
 
  const loadFundsConfig = async () => {
    const fundsData = await getMPFunds(selectedConstituency);
    if (fundsData) {
      setMpladsFunds(fundsData.totalFunds || 0);
      setResetFrequency(fundsData.resetFrequency || 'yearly');
    } else {
      setMpladsFunds(0);
      setResetFrequency('yearly');
    }
  };
 
  const loadActionPlan = async () => {
    let planKey = '';
    if (selectedPlanType === 'constituency') {
      planKey = selectedConstituency;
    } else {
      planKey = `category_${selectedPlanCategory.toLowerCase()}`;
    }
 
    const plan = await getActionPlanByConstituency(planKey);
    if (plan && plan.isApproved) {
      setApprovedPlan(plan);
    } else {
      setApprovedPlan(null);
    }
  };
 
  const loadData = async () => {
    const data = await getAllDemands();
    setDemands(data);
  };
 
  // Filter demands based on search criteria, scoped to selectedConstituency
  useEffect(() => {
    let filtered = demands.filter(d => (d.constituency || 'Rampur').toLowerCase() === selectedConstituency.toLowerCase());
    
    if (searchMode === 'issue') {
      filtered = filtered.filter(d => 
        (d.category || '').toLowerCase().includes(searchIssueQuery.toLowerCase()) || 
        (d.address || '').toLowerCase().includes(searchIssueQuery.toLowerCase()) ||
        (d.items && d.items.some((item: any) => 
          (item.content && item.content.toLowerCase().includes(searchIssueQuery.toLowerCase())) ||
          (item.speechTranscript && item.speechTranscript.toLowerCase().includes(searchIssueQuery.toLowerCase()))
        ))
      );
    }
    setMatchingDemands(filtered);
  }, [demands, searchMode, selectedConstituency, searchIssueQuery]);

  // Save Funds Configuration
  const handleSaveFunds = async () => {
    await saveMPFunds(selectedConstituency, {
      totalFunds: mpladsFunds,
      resetFrequency
    });
    alert(`Funds Configuration updated successfully for ${selectedConstituency}!`);
  };

  // Add Extra Funds
  const handleAddExtraFunds = async () => {
    const val = parseFloat(extraFunds);
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid positive number for extra funds.");
      return;
    }
    const nextFunds = mpladsFunds + val;
    setMpladsFunds(nextFunds);
    await saveMPFunds(selectedConstituency, {
      totalFunds: nextFunds,
      resetFrequency
    });
    setExtraFunds('');
    alert(`Extra funds of ₹${val.toLocaleString()} successfully credited to ${selectedConstituency} ledger!`);
  };

  // Generate Gemini-powered Clubbed Summary
  const handleGenerateSummary = async () => {
    if (matchingDemands.length === 0) {
      alert("No matching citizen complaints found to summarize.");
      return;
    }
    setGeneratingSummary(true);
    setProblemSummary('AI is summarizing constituent grievances, aggregating upvotes, and evaluating priority indices...');
    
    const complaintsText = matchingDemands.map((d, index) => 
      `Complaint #${index+1}: Category: ${d.category}, Location: ${d.address}, Support Signatures: ${d.upvotes || 1}, Description: ${d.items?.[0]?.content || d.items?.[0]?.speechTranscript || 'No details'}`
    ).join('\n');

    const prompt = `
      You are an expert parliamentary advisor to a Member of Parliament in India.
      The following is a list of citizen grievances for search query "${searchMode === 'constituency' ? searchConstituencyName : searchIssueQuery}":
      
      ${complaintsText}
      
      Please compile these complaints and provide a concise, high-level summary suitable for a political leader:
      1. What are the core themes and main problems?
      2. What is the total aggregated citizen upvotes / support count across these issues?
      3. Recommend what priority level this should receive.
      Provide a clean, bulleted response without markdown fences or headers.
    `;

    try {
      const response = await fetchGemini({ contents: [{ parts: [{ text: prompt }] }] });

      if (!response.ok) throw new Error("API error");
      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to synthesize summary.';
      setProblemSummary(text.trim());
    } catch (err) {
      setProblemSummary('Failed to communicate with Gemini. Please verify your internet connection.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Generate Parliamentary Speech
  const handleGenerateSpeech = async () => {
    if (matchingDemands.length === 0) {
      alert("No citizen issues found to structure a speech.");
      return;
    }
    setGeneratingSpeech(true);
    setSpeechDraft('AI is writing a Lok Sabha speech draft and splitting it into slide outlines...');

    const complaintsText = matchingDemands.slice(0, 5).map((d, index) => 
      `Issue #${index+1} (${d.category}): Located at ${d.address} with ${d.upvotes || 1} signatures.`
    ).join('\n');

    const prompt = `
      Write a formal, persuasive parliamentary speech (Lok Sabha Question / Matter under Rule 377) for a Member of Parliament representing the constituency.
      The speech length must match a target reading time of ${speechMinutes} minutes.
      Incorporate these citizen grievances:
      ${complaintsText}
      
      Format the output in two sections:
      Section 1: The full speech starting with "Hon'ble Speaker Sir..."
      Section 2: A slide-by-slide split of the speech for a visual deck (exactly 3 slides).
      Format Slide splits like:
      SLIDE 1: Title & Core Problem
      SLIDE 2: Citizen support stats and evidence
      SLIDE 3: Formal demands to the Minister
      
      Separate the two sections with the text "---SLIDE_SPLIT---". Do not include markdown code fence formatting.
    `;

    try {
      const response = await fetchGemini({ contents: [{ parts: [{ text: prompt }] }] });

      if (!response.ok) throw new Error("API error");
      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const parts = text.split('---SLIDE_SPLIT---');
      setSpeechDraft(parts[0]?.trim() || '');
      
      if (parts[1]) {
        const slides = parts[1].split(/SLIDE \d+:/i).map((s: string) => s.trim()).filter(Boolean);
        setSpeechSlides(slides);
      } else {
        setSpeechSlides([
          "Slide 1: Core constituency concerns",
          "Slide 2: Statistical citizen backing",
          "Slide 3: Proposed ministerial action steps"
        ]);
      }
      setActiveSpeechSlide(0);
    } catch (err) {
      setSpeechDraft('Speech generation failed. Please review internet connectivity and API keys.');
    } finally {
      setGeneratingSpeech(false);
    }
  };

  const runParliamentActionAudit = async (actionType: 'raise' | 'fund', dataDetail: any) => {
    setIsAuditingAction(true);
    setAiActionAuditReport("🤖 Gemini is conducting a Parliamentary Action & Local Grievance Alignment Audit...");

    const raisedDemands = matchingDemands;
    const raisedDemandsCount = raisedDemands.length;

    const similarDemands = demands.filter(d => 
      (d.constituency || 'Rampur').toLowerCase() === selectedConstituency.toLowerCase() &&
      d.status !== 'raised' && d.status !== 'funded' && d.status !== 'completed'
    );

    let prompt = '';
    if (actionType === 'raise') {
      prompt = `
        You are the Parliamentary AI Audit Assistant for Jansetu.
        The MP has just clicked the "Raise in Parliament" button, marking ${raisedDemandsCount} citizen complaints as "Speech Raised" in ${selectedConstituency}.
        Here is the real data of the complaints raised:
        ${JSON.stringify(raisedDemands.map(d => ({ category: d.category, content: d.items?.[0]?.content, address: d.address, upvotes: d.upvotes || 1 })))}

        Other similar unresolved grievances in this constituency (${selectedConstituency}) that still need voice representation:
        ${JSON.stringify(similarDemands.slice(0, 10).map(d => ({ category: d.category, content: d.items?.[0]?.content, address: d.address, upvotes: d.upvotes || 1 })))}

        Please analyze this parliamentary action and output a concise, professional report (3-4 bullet points) containing:
        1. An impact verification of the specific complaints that were just voiced in parliament.
        2. A comparison showing what fraction of the constituency's total grievances this addresses.
        3. A list of remaining similar unresolved issues in the constituency that still require voice representation or attention.
        
        Use ONLY the real data provided. Do not invent any issues. Output clean, readable text.
      `;
    } else {
      prompt = `
        You are the Parliamentary AI Audit Assistant for Jansetu.
        The MP has just allocated MPLADS funding for: "${dataDetail.planName || 'Development Plan'}" in constituency "${selectedConstituency}".
        Detail of funded action steps:
        ${JSON.stringify(dataDetail.steps)}

        The citizen complaints associated with this plan:
        ${JSON.stringify(raisedDemands.slice(0, 5).map(d => ({ category: d.category, content: d.items?.[0]?.content, address: d.address, upvotes: d.upvotes || 1 })))}

        Other similar unresolved grievances in this constituency (${selectedConstituency}) that still need budget allocation:
        ${JSON.stringify(similarDemands.slice(0, 10).map(d => ({ category: d.category, content: d.items?.[0]?.content, address: d.address, upvotes: d.upvotes || 1 })))}

        Please analyze this budget allocation and output a concise, professional report (3-4 bullet points) containing:
        1. An impact audit showing how this funding addresses the primary infrastructure gaps and citizens' demands.
        2. A summary of similar unresolved grievances in the constituency that still need budget/resources.
        3. A recommendation on which related projects to fund next in this area based on the remaining demands.

        Use ONLY the real data provided. Do not invent any issues. Output clean, readable text.
      `;
    }

    try {
      const res = await fetchGemini({ contents: [{ parts: [{ text: prompt }] }] });
      if (!res.ok) throw new Error("API failure");
      const resData = await res.json();
      const report = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'Audit completed with no output.';
      setAiActionAuditReport(report);
    } catch (err) {
      setAiActionAuditReport("⚠️ AI Audit Generation failed. Please ensure a valid Gemini API Key is entered in settings.");
    } finally {
      setIsAuditingAction(false);
    }
  };

  const handleRaiseInParliament = async () => {
    if (matchingDemands.length === 0) {
      alert("No matching citizen complaints found to raise in parliament.");
      return;
    }

    for (const d of matchingDemands) {
      await updateDemandStatus(d.id, 'raised');
    }

    if (approvedPlan) {
      const updatedPlan = { ...approvedPlan };
      updatedPlan.detailedSteps = (updatedPlan.detailedSteps || []).map((step: any) => ({
        ...step,
        status: 'raised'
      }));
      const planKey = approvedPlan.id ? approvedPlan.id.replace(/^plan_/, '') : selectedConstituency;
      await saveActionPlanByConstituency(planKey, updatedPlan);
      setApprovedPlan(updatedPlan);
    }

    alert(`Successfully raised the issues in Parliament! Marked all plan steps and ${matchingDemands.length} citizen complaints as "Speech Raised".`);
    loadData();
    runParliamentActionAudit('raise', null);
  };

  // Fund Approved Plan Entirely
  const handleFundEntireProject = async () => {
    if (!approvedPlan) return;
    
    let totalCostToFund = 0;
    const stepsToFundIndices: number[] = [];
    (approvedPlan.detailedSteps || []).forEach((step: any, idx: number) => {
      if (step.status !== 'funded' && step.status !== 'completed' && step.status !== 'work_started') {
        totalCostToFund += step.cost || 0;
        stepsToFundIndices.push(idx);
      }
    });

    if (stepsToFundIndices.length === 0) {
      alert("All steps of this project have already been funded!");
      return;
    }

    if (mpladsFunds < totalCostToFund) {
      alert(`Insufficient funds! The project requires ₹${totalCostToFund.toLocaleString()} but only ₹${mpladsFunds.toLocaleString()} is available in your MPLADS ledger.`);
      return;
    }

    const remainingFunds = mpladsFunds - totalCostToFund;
    setMpladsFunds(remainingFunds);
    
    await saveMPFunds(selectedConstituency, {
      totalFunds: remainingFunds,
      resetFrequency
    });

    const updatedPlan = { ...approvedPlan };
    stepsToFundIndices.forEach(idx => {
      updatedPlan.detailedSteps[idx].status = 'funded';
    });
    
    const planKey = approvedPlan.id ? approvedPlan.id.replace(/^plan_/, '') : selectedConstituency;
    await saveActionPlanByConstituency(planKey, updatedPlan);
    setApprovedPlan(updatedPlan);

    for (const complaintId of approvedPlan.associatedComplaintIds || []) {
      await updateDemandStatus(complaintId, 'funded');
    }

    alert(`Successfully allocated ₹${totalCostToFund.toLocaleString()}! Entire project has been funded and authorized!`);
    loadData();
    runParliamentActionAudit('fund', {
      planName: approvedPlan.planName,
      steps: stepsToFundIndices.map(idx => approvedPlan.detailedSteps[idx])
    });
  };

  // Fund Approved Plan Individual Step
  const handleFundIndividualStep = async (idx: number) => {
    if (!approvedPlan) return;
    const step = approvedPlan.detailedSteps[idx];
    const cost = step.cost || 0;

    if (mpladsFunds < cost) {
      alert(`Insufficient funds! This step requires ₹${cost.toLocaleString()} but you only have ₹${mpladsFunds.toLocaleString()} available in your MPLADS ledger.`);
      return;
    }

    const remainingFunds = mpladsFunds - cost;
    setMpladsFunds(remainingFunds);
    
    await saveMPFunds(selectedConstituency, {
      totalFunds: remainingFunds,
      resetFrequency
    });

    const updatedPlan = { ...approvedPlan };
    updatedPlan.detailedSteps[idx].status = 'funded';
    
    const planKey = approvedPlan.id ? approvedPlan.id.replace(/^plan_/, '') : selectedConstituency;
    await saveActionPlanByConstituency(planKey, updatedPlan);
    setApprovedPlan(updatedPlan);

    // Sync corresponding citizen complaint status to 'funded'
    if (step.id) {
      await updateDemandStatus(step.id, 'funded');
    }

    alert(`Successfully allocated ₹${cost.toLocaleString()} to step "${step.title}"!`);
    loadData();
    runParliamentActionAudit('fund', {
      planName: approvedPlan.planName,
      steps: [step]
    });
  };

  // Play audio morning briefing
  const handlePlayBriefing = () => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-Speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const count = matchingDemands.length;
    const text = `Honorable Member of Parliament, you have ${count} critical issues logged in ${selectedConstituency}. Your remaining available fund is ${ (mpladsFunds/100000).toFixed(1) } Lakhs. Please review the recommended AI Action plans to authorize work orders.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      {!isAuthenticated && <AuthModal role="mp" onSuccess={() => setIsAuthenticated(true)} onClose={() => window.location.href = '/'} />}
      
      <header className="header no-print">
        <div className="container header-container">
          <div className="logo-wrapper" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            <div className="logo-icon" style={{ background: 'var(--mp-grad)' }}>
              <Award size={20} strokeWidth={2.5} />
            </div>
            <span>Jansetu</span>
            <span style={{ fontSize: '12px', background: 'rgba(217, 119, 6, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', fontWeight: 'bold' }}>
              MP Parliamentary Workspace
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={handlePlayBriefing}
              style={{
                background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc',
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Volume2 size={14} />
              <span>Audio Briefing</span>
            </button>
            <LanguageSelector selectedLang={selectedLang} setSelectedLang={setSelectedLang} />
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

      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }} className="complainant-portal container no-print">
        <div className="portal-header" style={{ textAlign: 'left', marginBottom: '24px' }}>
          <button type="button" className="btn-back" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={18} />
            <span>Back to Roles</span>
          </button>
          <h2>Parliamentary Leadership Workspace</h2>
          <p className="portal-subtitle">Configure regional constituency funds, review clubbed citizen grievances, draft speech scripts, and authorize project budgets</p>
        </div>

        {/* SECTION 1: CONSTITUENCY SETUP & LEDGER SETTINGS */}
        <div className="form-card" style={{ padding: '24px 30px', marginBottom: '24px', textAlign: 'left' }}>
          <h3 style={{ color: 'white', fontSize: '1.2rem', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
            ⚙️ Constituency Ledger & MPLADS Configuration
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', color: '#c7d2fe', fontWeight: 'bold' }}>Select Constituency</label>
              <select
                value={selectedConstituency}
                onChange={e => {
                  setSelectedConstituency(e.target.value);
                  setSearchConstituencyName(e.target.value);
                }}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '10px 14px', borderRadius: '8px', fontWeight: '600' }}
              >
                {Object.keys(ALL_CONSTITUENCIES_DATA).sort().map(cName => (
                  <option key={cName} value={cName}>{cName}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', color: '#c7d2fe', fontWeight: 'bold' }}>Available Funds (MPLADS Ledger)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#8e90b3', fontWeight: 'bold' }}>₹</span>
                <input
                  type="number"
                  placeholder="Ledger limit"
                  value={mpladsFunds}
                  onChange={e => setMpladsFunds(parseFloat(e.target.value) || 0)}
                  style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '10px 14px 10px 24px', borderRadius: '8px', width: '100%', fontWeight: 'bold' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', color: '#c7d2fe', fontWeight: 'bold' }}>Reset Frequency</label>
              <select
                value={resetFrequency}
                onChange={e => setResetFrequency(e.target.value)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '10px 14px', borderRadius: '8px', fontWeight: '600' }}
              >
                <option value="monthly">Monthly Reset</option>
                <option value="quarterly">Quarterly Reset</option>
                <option value="yearly">Yearly Reset</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <button
              onClick={handleSaveFunds}
              style={{ background: 'var(--mp-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
            >
              Save Funds Setup
            </button>

            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Extra funds amount"
                value={extraFunds}
                onChange={e => setExtraFunds(e.target.value)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', width: '180px', fontSize: '13px' }}
              />
              <button
                onClick={handleAddExtraFunds}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                <Plus size={14} />
                <span>Add Extra Funds</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 2: SEARCH CONSTITUENCY VS SEARCH BY ISSUE */}
        <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', marginBottom: '24px' }}>
          
          {/* Left Block: Search Panel */}
          <div className="form-card" style={{ padding: '24px 20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: 'white', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>🔎 Search & Filter Workspace</h4>
            
            <div style={{ display: 'flex', border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setSearchMode('constituency')}
                style={{ flex: 1, padding: '8px', background: searchMode === 'constituency' ? 'rgba(217, 119, 6, 0.15)' : 'transparent', color: searchMode === 'constituency' ? '#fbbf24' : '#8e90b3', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
              >
                By Constituency
              </button>
              <button
                onClick={() => setSearchMode('issue')}
                style={{ flex: 1, padding: '8px', background: searchMode === 'issue' ? 'rgba(217, 119, 6, 0.15)' : 'transparent', color: searchMode === 'issue' ? '#fbbf24' : '#8e90b3', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
              >
                By Issue/Query
              </button>
            </div>

            {searchMode === 'constituency' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: '#8e90b3' }}>Constituency Name</label>
                <select
                  value={searchConstituencyName}
                  onChange={e => {
                    setSearchConstituencyName(e.target.value);
                    setSelectedConstituency(e.target.value);
                  }}
                  style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                >
                  {Object.keys(ALL_CONSTITUENCIES_DATA).sort().map(cName => (
                    <option key={cName} value={cName}>{cName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: '#8e90b3' }}>Issue Keyword / Category</label>
                <input
                  type="text"
                  placeholder="e.g. water, road, school"
                  value={searchIssueQuery}
                  onChange={e => setSearchIssueQuery(e.target.value)}
                  style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', color: '#8e90b3' }}>Matching Citizen Reports</span>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {matchingDemands.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No reports match this criteria.</span>
                ) : (
                  matchingDemands.map(d => (
                    <div key={d.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '6px', fontSize: '11.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e90b3' }}>
                        <span>📍 {d.address.slice(0, 20)}... {d.source === 'telegram' ? '✈️' : '🌐'}</span>
                        <span>👍 {d.upvotes || 1}</span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.items?.[0]?.content || d.items?.[0]?.speechTranscript}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Block: Gemini Synthesizer & Speech Generator */}
          <div className="form-card" style={{ padding: '24px 30px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>
                💡 Parliamentary Speech & AI Synthesizer
              </h3>
              <button
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)', color: '#fbbf24', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {generatingSummary ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Synthesize Complaints Summary</span>
              </button>
            </div>

            {problemSummary && (
              <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', fontSize: '12.5px', color: 'white', lineHeight: '1.5' }}>
                <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '6px' }}>📋 AI Synthesized Grievances Ledger:</strong>
                <p style={{ margin: 0, fontStyle: 'italic', whiteSpace: 'pre-line' }}>{problemSummary}</p>
              </div>
            )}

            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ color: '#818cf8' }} />
                  <label style={{ fontSize: '12.5px', color: '#c7d2fe', fontWeight: 'bold' }}>Target Minutes:</label>
                  <select
                    value={speechMinutes}
                    onChange={e => setSpeechMinutes(parseInt(e.target.value) || 2)}
                    style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                  >
                    {[1, 2, 3, 4, 5].map(m => <option key={m} value={m}>{m} Mins</option>)}
                  </select>
                </div>
                
                <button
                  onClick={handleGenerateSpeech}
                  disabled={generatingSpeech}
                  style={{ background: 'var(--mp-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {generatingSpeech ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  <span>Generate Lok Sabha Speech & Slides</span>
                </button>
              </div>

              {speechDraft && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '16px' }}>
                    <div style={{ background: '#0e0d24', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '13px', lineHeight: '1.6', color: 'white', maxHeight: '240px', overflowY: 'auto' }}>
                      <strong style={{ display: 'block', marginBottom: '6px', color: '#818cf8' }}>🎤 Speech Script Draft:</strong>
                      <p style={{ margin: 0, fontStyle: 'serif', whiteSpace: 'pre-line' }}>{speechDraft}</p>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <strong style={{ color: '#60a5fa', fontSize: '12px' }}>📊 Parliamentary Deck Slides:</strong>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {speechSlides.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveSpeechSlide(idx)}
                            style={{ flex: 1, padding: '4px', background: activeSpeechSlide === idx ? '#60a5fa' : 'rgba(255,255,255,0.05)', color: activeSpeechSlide === idx ? 'black' : 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            S{idx+1}
                          </button>
                        ))}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '6px', fontSize: '11px', flexGrow: 1, minHeight: '100px' }}>
                        {speechSlides[activeSpeechSlide] || "No slide content generated."}
                      </div>
                    </div>
                  </div>
                  
                   <button
                    onClick={handleRaiseInParliament}
                    disabled={isAuditingAction}
                    style={{ background: '#818cf8', border: 'none', color: 'white', fontWeight: 'bold', padding: '12px 24px', borderRadius: '8px', fontSize: '13.5px', cursor: isAuditingAction ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', alignSelf: 'flex-start', opacity: isAuditingAction ? 0.7 : 1 }}
                  >
                    {isAuditingAction ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                    <span>📢 Raise in Parliament (Mark as Speech Raised)</span>
                  </button>

                  {aiActionAuditReport && (
                    <div style={{
                      marginTop: '20px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '8px',
                      padding: '16px 20px',
                      fontSize: '12.5px',
                      color: '#c7d2fe',
                      lineHeight: '1.5',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                        <Sparkles size={16} />
                        <span>🤖 Live Parliamentary Action & Grievance Alignment Audit:</span>
                      </h4>
                      <div style={{ whiteSpace: 'pre-line' }}>
                        {aiActionAuditReport}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: MANAGER APPROVED ACTION PLAN & BUDGET ALLOCATION */}
        <div className="form-card" style={{ padding: '24px 30px', textAlign: 'left', marginBottom: '32px' }}>
          <h3 style={{ color: 'white', fontSize: '1.25rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} style={{ color: '#2dd4bf' }} />
            <span>Approved Development Action Plan & Funding Allocations</span>
          </h3>

          {/* Plan Selector Tab Header */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setSelectedPlanType('constituency')}
              style={{
                background: selectedPlanType === 'constituency' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
                border: selectedPlanType === 'constituency' ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                color: selectedPlanType === 'constituency' ? '#2dd4bf' : '#8e90b3',
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
              }}
            >
              🏛️ Constituency Plan ({selectedConstituency})
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlanType('category')}
              style={{
                background: selectedPlanType === 'category' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.2)',
                border: selectedPlanType === 'category' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                color: selectedPlanType === 'category' ? '#a5b4fc' : '#8e90b3',
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
              }}
            >
              🏷️ General Topic-Wise Plan
            </button>
            {selectedPlanType === 'category' && (
              <select
                value={selectedPlanCategory}
                onChange={e => setSelectedPlanCategory(e.target.value)}
                style={{
                  background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white',
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', marginLeft: 'auto'
                }}
              >
                <option value="water">Water & Sanitation</option>
                <option value="roads">Roads & Transport</option>
                <option value="education">Education & Schools</option>
                <option value="health">Healthcare Clinics</option>
                <option value="power">Power & Electricity</option>
                <option value="agriculture">Agriculture & Irrigation</option>
                <option value="safety">Public Safety & Police</option>
                <option value="environment">Environment & Parks</option>
                <option value="welfare">Social Welfare & Pensions</option>
                <option value="housing">Housing & Urban Dev</option>
                <option value="anticorruption">Anti-Corruption & Vigilance</option>
                <option value="digital">Digital Infrastructure</option>
                <option value="disaster">Disaster Management</option>
                <option value="women">Women & Child Development</option>
                <option value="justice">Justice & Law Enforcement</option>
                <option value="economy">Job Creation & Economy</option>
                <option value="consumer">Consumer Rights</option>
                <option value="taxes">Taxes, Revenue & Land</option>
                <option value="tourism">Arts, Culture & Tourism</option>
                <option value="youth">Youth Affairs & Sports</option>
                <option value="innovation">Science & Innovation</option>
                <option value="rural">Rural Development</option>
                <option value="security">National Security & Defense</option>
                <option value="cyber">AI & Cyber Security</option>
                <option value="climate">Climate & Sustainability</option>
                <option value="space">Space & Advanced Tech</option>
                <option value="foreign">International Relations</option>
                <option value="others">Others / General</option>
              </select>
            )}
          </div>

          {!approvedPlan ? (
            <div style={{ textAlign: 'center', padding: '30px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
              <Info size={28} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>
                No active Approved Action Plan found for the selected {selectedPlanType === 'constituency' ? `constituency "${selectedConstituency}"` : `topic "${selectedPlanCategory}"`}.
              </p>
              <p style={{ color: 'var(--text-desc)', fontSize: '11px', marginTop: '4px' }}>
                Please have the aggregation manager generate and approve a plan in the Manager portal first.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'rgba(20, 184, 166, 0.04)', border: '1px solid rgba(20, 184, 166, 0.2)', padding: '16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.75rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  ACTIVE MANAGER SYNCED PLAN
                </span>
                <h4 style={{ color: 'white', margin: '6px 0 2px 0', fontSize: '1rem' }}>{approvedPlan.planName}</h4>
                <p style={{ color: 'var(--text-desc)', fontSize: '12.5px', margin: 0 }}>{approvedPlan.summary}</p>
              </div>

              {aiActionAuditReport && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  fontSize: '12.5px',
                  color: '#c7d2fe',
                  lineHeight: '1.5',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                    <Sparkles size={16} />
                    <span>🤖 Live Parliamentary Action & Grievance Alignment Audit:</span>
                  </h4>
                  <div style={{ whiteSpace: 'pre-line' }}>
                    {aiActionAuditReport}
                  </div>
                </div>
              )}

              {/* Progress Tracker Visual Timeline */}
              <div>
                <span style={{ fontSize: '12px', color: '#c7d2fe', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
                  ⏳ Visual Implementation Timeline & Progress Status
                </span>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 0' }}>
                  {(approvedPlan.detailedSteps || []).map((step: any, idx: number) => {
                    const status = step.status || 'proposed';
                    const color = status === 'completed' ? '#34d399' :
                                  status === 'work_started' ? '#60a5fa' :
                                  status === 'funded' ? '#fbbf24' :
                                  status === 'speech_raised' || status === 'raised' ? '#818cf8' : '#8e90b3';
                    return (
                      <div key={idx} style={{ flex: 1, minWidth: '160px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}`, borderRadius: '6px', padding: '10px 14px' }}>
                        <span style={{ fontSize: '9px', color: color, fontWeight: 'bold', textTransform: 'uppercase' }}>
                          STEP {idx+1} — {status.toUpperCase()}
                        </span>
                        <strong style={{ display: 'block', fontSize: '12px', color: 'white', marginTop: '2px' }}>{step.title}</strong>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Agency: {step.agency}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Funding Table */}
              <div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#c7d2fe', fontWeight: 'bold' }}>
                    💼 Total Project Cost: ₹{( (approvedPlan.detailedSteps || []).reduce((acc: any, s: any) => acc + (s.cost || 0), 0) ).toLocaleString()}
                  </span>
                  {(approvedPlan.detailedSteps || []).every((s: any) => s.status === 'funded' || s.status === 'work_started' || s.status === 'completed') ? (
                    <span style={{ fontSize: '12px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>
                      ✓ Entire Project Fully Funded
                    </span>
                  ) : (
                    <button
                      onClick={handleFundEntireProject}
                      style={{ background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <CheckCircle size={14} />
                      <span>Fund & Authorize Entire Project</span>
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#818cf8', fontWeight: 'bold' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', width: '80px' }}>Step ID</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Action Step Title</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Details</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Responsible Agency</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Cost Estimate</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status / Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(approvedPlan.detailedSteps || []).map((step: any, idx: number) => {
                        const status = step.status || 'proposed';
                        const isFunded = status === 'funded' || status === 'completed' || status === 'work_started';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{step.id}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{step.title}</td>
                            <td style={{ padding: '10px', color: 'var(--text-desc)' }}>{step.description}</td>
                            <td style={{ padding: '10px', color: '#2dd4bf' }}>{step.agency}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#fbbf24' }}>
                              ₹{(step.cost || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', background: isFunded ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.08)', color: isFunded ? '#34d399' : 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  {status}
                                </span>
                                {!isFunded && (
                                  <button
                                    onClick={() => handleFundIndividualStep(idx)}
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399',
                                      padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                                    }}
                                  >
                                    Allot Funds
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      <footer className="footer no-print" style={{ marginTop: '40px' }}>
        <div className="container footer-content">
          <div className="footer-text">
            <strong>Jansetu</strong> — Bridging Citizens and Leaders through Intelligent Planning
          </div>
          <div className="footer-sub">
            Built for MP Constituency Development Planning • Smart India Hackathon Track 1 • All Rights Reserved
          </div>
          <GeminiKeysFooter />
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
