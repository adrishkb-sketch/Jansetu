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
import { ALL_CONSTITUENCIES_DATA, initializeDatasets } from './services/constituency_datasets';
import './index.css';

function MPApp() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);
  const [activeTab, setActiveTab] = useState<'grievances' | 'budget' | 'audits'>('grievances');
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('mp_auth') === 'true');
  
  // Constituency Selection
  const [selectedConstituency, setSelectedConstituency] = useState<string>('Rampur');
  const [constituencySearchQuery, setConstituencySearchQuery] = useState<string>('Rampur');
  const [showConstituencyDropdown, setShowConstituencyDropdown] = useState<boolean>(false);

  useEffect(() => {
    setConstituencySearchQuery(selectedConstituency);
  }, [selectedConstituency]);
  
  // Funds Configuration State
  const [mpladsFunds, setMpladsFunds] = useState<number>(0);
  const [resetFrequency, setResetFrequency] = useState<string>('yearly');
  const [extraFunds, setExtraFunds] = useState<string>('');

  // Search & Filter States
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Matching Demands
  const [demands, setDemands] = useState<any[]>([]);
  const [matchingDemands, setMatchingDemands] = useState<any[]>([]);
  
  // Gemini AI Summary States
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [problemSummary, setProblemSummary] = useState<string>('');
  const [searchSummaryText, setSearchSummaryText] = useState<string>('');
  const [isGeneratingSearchSummary, setIsGeneratingSearchSummary] = useState<boolean>(false);

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
 
  // Load MP Funds & Demands
  // Google Translate widget initialization
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
    } else if ((window as any).google && (window as any).google.translate) {
      // Re-trigger immediately if script is already present
      (window as any).googleTranslateElementInit();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFundsConfig();
      loadData();
    }
  }, [isAuthenticated, selectedConstituency]);
  
  useEffect(() => {
    // Fetch demographic datasets from Firestore BigQuery mock
    initializeDatasets();
  }, []);
 
  // Load Action Plan whenever selection changes
  useEffect(() => {
    if (isAuthenticated) {
      loadActionPlan();
    }
  }, [isAuthenticated, selectedConstituency]);
 
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
    const planKey = selectedConstituency;
 
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
 
  // Filter demands based on search criteria, scoped to selectedConstituency and restricted to issues used in the manager's action plan
  useEffect(() => {
    let filtered = demands.filter(d => (d.constituency || 'Rampur').toLowerCase() === selectedConstituency.toLowerCase());
    
    // Filter to ONLY include complaints that the manager included in the approved action plan
    const allowedIds = approvedPlan?.associatedComplaintIds || [];
    filtered = filtered.filter(d => allowedIds.includes(d.id));

    if (selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(d => 
        (d.category || '').toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
    }

    if (searchKeyword.trim() !== '') {
      const query = searchKeyword.toLowerCase();
      filtered = filtered.filter(d => {
        const contentText = (d.items?.[0]?.content || d.items?.[0]?.speechTranscript || '').toLowerCase();
        const addressText = (d.address || '').toLowerCase();
        const categoryText = (d.category || '').toLowerCase();
        const ticketCode = (d.id || '').toLowerCase();
        return contentText.includes(query) || addressText.includes(query) || categoryText.includes(query) || ticketCode.includes(query);
      });
    }

    setMatchingDemands(filtered);
    setSearchSummaryText('');
  }, [demands, selectedConstituency, selectedCategoryFilter, searchKeyword, approvedPlan]);

  // Auto-run constituency audit when entering the audits tab or when constituency/action plan changes
  useEffect(() => {
    if (activeTab === 'audits' && selectedConstituency) {
      runParliamentActionAudit('audit', null);
    }
  }, [activeTab, selectedConstituency, approvedPlan]);

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
      The following is a list of citizen grievances in constituency "${selectedConstituency}" under active category filter "${selectedCategoryFilter}" and keyword search query "${searchKeyword || 'none'}":
      
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

  const handleGenerateSearchSummary = async () => {
    if (matchingDemands.length === 0) {
      alert("No grievances selected to summarize.");
      return;
    }
    setIsGeneratingSearchSummary(true);
    setSearchSummaryText("AI is compiling a summary of the selected grievances...");

    const textPayload = matchingDemands.map((d, i) => 
      `Grievance #${i+1}: Category: ${d.category}, Location: ${d.address}, Scope: ${d.scope}, Upvotes: ${d.upvotes || 1}. Content: ${d.items?.[0]?.content || d.items?.[0]?.speechTranscript}`
    ).join('\n\n');

    const prompt = `
      You are an expert constituency planning assistant.
      Provide a highly concise, executive summary (3-4 sentences maximum) of the following citizen grievances in ${selectedConstituency}. 
      Highlight the main recurring infrastructure gaps and the estimated total community impact.
      
      Citizen Grievances Data:
      ${textPayload}
    `;

    try {
      const response = await fetchGemini({ contents: [{ parts: [{ text: prompt }] }] });
      if (response.ok) {
        const resData = await response.json();
        const summary = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not compile summary.';
        setSearchSummaryText(summary);
      } else {
        setSearchSummaryText("Could not compile summary.");
      }
    } catch (e) {
      setSearchSummaryText("Failed to compile AI summary. Check your Gemini API connection.");
    } finally {
      setIsGeneratingSearchSummary(false);
    }
  };

  // Generate Parliamentary Speech (Only targets pending/unvoiced grievances)
  const handleGenerateSpeech = async () => {
    const unvoicedDemands = matchingDemands.filter(d => !d.status || ['pending', 'needs_info'].includes(d.status));
    
    if (unvoicedDemands.length === 0) {
      alert("All active citizen issues for this category/constituency have already been raised or funded! No new unvoiced concerns found.");
      return;
    }
    setGeneratingSpeech(true);
    setSpeechDraft('AI is writing a Lok Sabha speech draft and splitting it into slide outlines based on pending grievances...');

    const complaintsText = unvoicedDemands.slice(0, 5).map((d, index) => 
      `Issue #${index+1} (${d.category}): Located at ${d.address} with ${d.upvotes || 1} signatures. Details: ${d.items?.[0]?.content || d.items?.[0]?.speechTranscript}`
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

  const runParliamentActionAudit = async (actionType: 'raise' | 'fund' | 'audit', dataDetail: any) => {
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
    } else if (actionType === 'fund') {
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
    } else {
      // General Constituency Audit
      prompt = `
        You are the Senior Parliamentary AI Alignment Auditor for Jansetu.
        Constituency under audit: ${selectedConstituency}.

        Real-Time Citizen Grievances Data for this Constituency:
        ${JSON.stringify(matchingDemands.map(d => ({ category: d.category, content: d.items?.[0]?.content || d.items?.[0]?.speechTranscript, address: d.address, upvotes: d.upvotes || 1, status: d.status || 'pending' })))}

        Current Approved Development & Funding Action Plan:
        Plan Name: ${approvedPlan ? approvedPlan.planName : 'None'}
        Plan Details: ${approvedPlan ? JSON.stringify(approvedPlan.detailedSteps) : 'No plan approved yet by manager.'}

        MPLADS Ledger Balance: ₹${mpladsFunds.toLocaleString()}

        Please analyze the overall alignment between the citizen demands and the MP's actions (raised speeches, funded project steps, remaining ledger balance).
        Provide a comprehensive constituency audit report containing:
        1. An AI Alignment Score (e.g. 85% Aligned) indicating how closely the active project steps match high-upvote citizen issues.
        2. Highlights of successfully matched and resolved areas (where public works have started or been funded).
        3. Critical gaps where citizens have voiced massive complaints (e.g. key roads, water) but the manager's action plan has not funded them yet.
        4. Actionable recommendations on which specific steps/issues the MP should focus on next.

        Use ONLY the real data provided. Do not invent any issues. Output clean, professional markdown.
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

  // Play audio morning briefing (Dynamically translated by Gemini)
  const handlePlayBriefing = async () => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-Speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const count = matchingDemands.length;
    const baseText = `Honorable Member of Parliament, you have ${count} critical issues logged in ${selectedConstituency}. Your remaining available fund is ${(mpladsFunds/100000).toFixed(1)} Lakhs. Please review the recommended AI Action plans to authorize work orders.`;
    
    let speakText = baseText;

    if (selectedLang && selectedLang !== 'en') {
      try {
        const langNames: Record<string, string> = {
          hi: 'Hindi', bn: 'Bengali', te: 'Telugu', mr: 'Marathi', ta: 'Tamil',
          gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', or: 'Odia', pa: 'Punjabi',
          ur: 'Urdu', sa: 'Sanskrit', ne: 'Nepali', sd: 'Sindhi', kok: 'Konkani', as: 'Assamese'
        };
        const targetLang = langNames[selectedLang] || 'Hindi';
        const prompt = `Translate the following text into natural, spoken ${targetLang}. Return ONLY the translated speech text, nothing else:\n\n"${baseText}"`;
        
        const response = await fetchGemini({ contents: [{ parts: [{ text: prompt }] }] });
        if (response.ok) {
          const resData = await response.json();
          const translated = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (translated) {
            speakText = translated.trim();
          }
        }
      } catch (e) {
        console.error("Gemini TTS translation failed: ", e);
      }
    }

    const utterance = new SpeechSynthesisUtterance(speakText);
    utterance.rate = 0.95;

    try {
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = selectedLang === 'en' ? 'en' : selectedLang;
      const matchingVoice = voices.find(v => v.lang.startsWith(langPrefix) || v.lang.includes(`-${langPrefix.toUpperCase()}`));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
        utterance.lang = matchingVoice.lang;
      }
    } catch (_) {}

    window.speechSynthesis.speak(utterance);
  };

  if (!isAuthenticated) {
    return <AuthModal role="mp" onSuccess={() => setIsAuthenticated(true)} onClose={() => window.location.href = '/'} />;
  }

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none' }}></div>
      
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
            <span>Back to Home</span>
          </button>
          <h2>Parliamentary Leadership Workspace</h2>
          <p className="portal-subtitle">Configure regional constituency funds, review clubbed citizen grievances, draft speech scripts, and authorize project budgets</p>
        </div>

        {/* Universal Constituency Autocomplete Search Selector */}
        <div className="form-card" style={{ padding: '20px 24px', marginBottom: '24px', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', maxWidth: '500px' }}>
            <label style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏛️ Select Parliamentary Constituency</label>
            {showConstituencyDropdown && (
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                onClick={() => setShowConstituencyDropdown(false)} 
              />
            )}
            <input
              type="text"
              value={constituencySearchQuery}
              placeholder="🔍 Type to search constituency (e.g. Howrah, Rampur)..."
              onChange={e => {
                setConstituencySearchQuery(e.target.value);
                setShowConstituencyDropdown(true);
              }}
              onFocus={() => setShowConstituencyDropdown(true)}
              style={{ 
                background: '#0e0d24', 
                border: '1px solid var(--border-light)', 
                color: 'white', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                fontWeight: '600',
                boxSizing: 'border-box',
                fontSize: '13.5px',
                width: '100%',
                position: 'relative',
                zIndex: 1000
              }}
            />
            {showConstituencyDropdown && (() => {
              const filtered = Object.keys(ALL_CONSTITUENCIES_DATA)
                .filter(c => c.toLowerCase().includes(constituencySearchQuery.toLowerCase()))
                .sort();
              return (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  background: '#0d0c22', 
                  border: '1px solid rgba(255,255,255,0.15)', 
                  borderRadius: '8px', 
                  maxHeight: '220px', 
                  overflowY: 'auto', 
                  zIndex: 1001, 
                  marginTop: '4px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
                }}>
                  {filtered.length > 0 ? (
                    filtered.map(cName => (
                      <div 
                        key={cName}
                        onClick={() => {
                          setSelectedConstituency(cName);
                          setConstituencySearchQuery(cName);
                          setShowConstituencyDropdown(false);
                        }}
                        style={{
                          padding: '10px 14px',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: selectedConstituency === cName ? 'rgba(217, 119, 6, 0.2)' : 'transparent',
                          textAlign: 'left'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = selectedConstituency === cName ? 'rgba(217, 119, 6, 0.2)' : 'transparent'}
                      >
                        🏛️ {cName}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
                      No constituency found
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* MP Hero Stats Bar */}
        {(() => {
          const constDemands = matchingDemands;
          const pendingToRaise = constDemands.filter((d: any) => !d.status || ['pending','needs_info'].includes(d.status)).length;
          const alreadyRaised = constDemands.filter((d: any) => ['raised','funded','work_started','completed','solved'].includes(d.status)).length;
          const totalImpact = constDemands.reduce((s: number, d: any) => s + (d.estimatedImpact || 1), 0);
          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0',
              marginBottom: '24px',
              background: 'rgba(217,119,6,0.05)',
              border: '1px solid rgba(217,119,6,0.2)',
              borderRadius: '14px',
              overflow: 'hidden'
            }}>
              {[
                { label: 'Pending to be Raised', value: pendingToRaise, color: '#fbbf24', icon: '⏳', sub: 'Awaiting parliament' },
                { label: 'Citizens Impacted', value: totalImpact.toLocaleString(), color: '#818cf8', icon: '👥', sub: selectedConstituency },
                { label: 'Already Raised', value: alreadyRaised, color: '#34d399', icon: '🏛️', sub: 'Raised in Lok Sabha' },
                { label: 'MPLADS Funds Left', value: `₹${(mpladsFunds/100000).toFixed(1)}L`, color: '#f87171', icon: '💰', sub: 'Available budget' },
              ].map((stat, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  padding: '20px 16px',
                  borderRight: i < 3 ? '1px solid rgba(217,119,6,0.12)' : 'none'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{stat.icon}</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{stat.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Tab Navigation Menu */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', flexWrap: 'wrap' }} className="no-print">
          <button
            type="button"
            onClick={() => setActiveTab('grievances')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'grievances' ? '#fbbf24' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'grievances' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'grievances' ? '#fbbf24' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            📥 Grievance Inbox & AI Speech
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'budget' ? '#34d399' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'budget' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'budget' ? '#34d399' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            💼 MPLADS Budget & Action Plan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audits')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'audits' ? '#a5b4fc' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'audits' ? 'rgba(129, 140, 248, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'audits' ? '#a5b4fc' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            🤖 AI Alignment Audits
          </button>
        </div>

        {/* SECTION 1: CONSTITUENCY SETUP & LEDGER SETTINGS */}
        <div className="form-card" style={{ padding: '24px 30px', marginBottom: '24px', textAlign: 'left' }}>
          <h3 style={{ color: 'white', fontSize: '1.2rem', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
            ⚙️ Constituency Ledger & MPLADS Configuration
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            
            
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
        {activeTab === 'grievances' && (
          <div className="mp-dashboard-grid" style={{ marginBottom: '24px' }}>
          
          {/* Left Block: Search Panel */}
          <div className="form-card" style={{ padding: '24px 20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: 'white', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>🔎 Search & Filter Workspace</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11.5px', color: '#c7d2fe', fontWeight: 'bold' }}>🔍 Text Keyword Search</label>
              <input
                type="text"
                value={searchKeyword}
                placeholder="Type to filter concerns (e.g. road, pipe)..."
                onChange={e => setSearchKeyword(e.target.value)}
                style={{
                  background: '#0e0d24',
                  border: '1px solid var(--border-light)',
                  color: 'white',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  width: '100%',
                  fontWeight: '600'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11.5px', color: '#c7d2fe', fontWeight: 'bold' }}>🏷️ Category Filter</label>
              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                style={{
                  background: '#0e0d24',
                  border: '1px solid var(--border-light)',
                  color: 'white',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                <option value="all">📂 All Categories</option>
                <option value="water">💧 Water & Sanitation</option>
                <option value="roads">🛣️ Roads & Transport</option>
                <option value="education">🎓 Education & Schools</option>
                <option value="health">🏥 Healthcare Clinics</option>
                <option value="power">⚡ Power & Electricity</option>
                <option value="agriculture">🌾 Agriculture & Irrigation</option>
                <option value="safety">🛡️ Public Safety & Police</option>
                <option value="environment">🌳 Environment & Parks</option>
                <option value="welfare">👥 Social Welfare & Pensions</option>
                <option value="housing">🏢 Housing & Urban Dev</option>
              </select>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* AI Summarize Selected Grievances Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGenerateSearchSummary}
                  disabled={isGeneratingSearchSummary || matchingDemands.length === 0}
                  style={{
                    width: '100%',
                    background: 'rgba(20, 184, 166, 0.15)',
                    border: '1px solid #14b8a6',
                    color: '#2dd4bf',
                    fontWeight: 'bold',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isGeneratingSearchSummary ? (
                    <>
                      <Loader2 className="animate-spin" size={12} />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>AI Summarize Selected ({matchingDemands.length})</span>
                    </>
                  )}
                </button>

                {searchSummaryText && (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(20, 184, 166, 0.3)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginTop: '8px',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    lineHeight: '1.45'
                  }}>
                    <strong style={{ color: '#2dd4bf', display: 'block', marginBottom: '2px', fontSize: '11.5px' }}>🧙‍♂️ AI Planning Brief:</strong>
                    {searchSummaryText}
                  </div>
                )}
              </div>

              {/* Grievance Inbox (Awaiting Review) */}
              {(() => {
                const list = matchingDemands.filter(d => !d.status || ['pending', 'needs_info'].includes(d.status));
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold' }}>📥 Grievance Inbox (New)</span>
                      <span style={{ fontSize: '9px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>{list.length}</span>
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {list.length === 0 ? (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No new grievances.</span>
                      ) : (
                        list.map(d => (
                          <div key={d.id} style={{ background: 'rgba(251,191,36,0.03)', border: '1px solid rgba(251,191,36,0.12)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e90b3' }}>
                              <span>📍 {d.address.slice(0, 18)}... {d.source === 'telegram' ? '✈️' : '🌐'}</span>
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
                );
              })()}

              {/* Raised in Parliament */}
              {(() => {
                const list = matchingDemands.filter(d => d.status === 'raised');
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 'bold' }}>🏛️ Raised in Lok Sabha</span>
                      <span style={{ fontSize: '9px', background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>{list.length}</span>
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {list.length === 0 ? (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No raised issues.</span>
                      ) : (
                        list.map(d => (
                          <div key={d.id} style={{ background: 'rgba(129,140,248,0.03)', border: '1px solid rgba(129,140,248,0.12)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e90b3' }}>
                              <span>📍 {d.address.slice(0, 18)}...</span>
                              <span>👍 {d.upvotes || 1}</span>
                            </div>
                            <p style={{ margin: '2px 0 0 0', color: '#c7d2fe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {d.items?.[0]?.content || d.items?.[0]?.speechTranscript}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Funded & Active Work */}
              {(() => {
                const list = matchingDemands.filter(d => ['funded', 'work_started'].includes(d.status));
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 'bold' }}>💰 Funded & Active Work</span>
                      <span style={{ fontSize: '9px', background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>{list.length}</span>
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {list.length === 0 ? (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active projects.</span>
                      ) : (
                        list.map(d => (
                          <div key={d.id} style={{ background: 'rgba(96,165,250,0.03)', border: '1px solid rgba(96,165,250,0.12)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e90b3' }}>
                              <span>📍 {d.address.slice(0, 18)}...</span>
                              <span>👍 {d.upvotes || 1}</span>
                            </div>
                            <p style={{ margin: '2px 0 0 0', color: '#93c5fd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {d.items?.[0]?.content || d.items?.[0]?.speechTranscript}
                            </p>
                            <div style={{ marginTop: '6px' }}>
                              <span style={{ 
                                fontSize: '9px', 
                                background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)', 
                                color: '#2dd4bf', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontWeight: 'bold', 
                                border: '1px solid rgba(20, 184, 166, 0.4)',
                                display: 'inline-block'
                              }}>
                                🏛️ Raised & Funded 💰
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Resolved & Completed */}
              {(() => {
                const list = matchingDemands.filter(d => ['completed', 'solved'].includes(d.status));
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 'bold' }}>✅ Resolved & Completed</span>
                      <span style={{ fontSize: '9px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>{list.length}</span>
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {list.length === 0 ? (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No completed issues.</span>
                      ) : (
                        list.map(d => (
                          <div key={d.id} style={{ background: 'rgba(52,211,153,0.03)', border: '1px solid rgba(52,211,153,0.12)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e90b3' }}>
                              <span>📍 {d.address.slice(0, 18)}...</span>
                              <span>👍 {d.upvotes || 1}</span>
                            </div>
                            <p style={{ margin: '2px 0 0 0', color: '#a7f3d0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {d.items?.[0]?.content || d.items?.[0]?.speechTranscript}
                            </p>
                            <div style={{ marginTop: '6px' }}>
                              <span style={{ 
                                fontSize: '9px', 
                                background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)', 
                                color: '#2dd4bf', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontWeight: 'bold', 
                                border: '1px solid rgba(20, 184, 166, 0.4)',
                                display: 'inline-block'
                              }}>
                                🏛️ Raised & Funded 💰
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

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
        )}

        {/* SECTION 3: MANAGER APPROVED ACTION PLAN & BUDGET ALLOCATION */}
        {activeTab === 'budget' && (
          <div className="form-card" style={{ padding: '24px 30px', textAlign: 'left', marginBottom: '32px' }}>
          <h3 style={{ color: 'white', fontSize: '1.25rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} style={{ color: '#2dd4bf' }} />
            <span>Approved Development Action Plan & Funding Allocations</span>
          </h3>

          {/* Header spacer only */}
          <div style={{ marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#8e90b3', fontWeight: 'bold' }}>
              🏛️ Scoped Action Plan for Lok Sabha Constituency: {selectedConstituency}
            </span>
          </div>

          {!approvedPlan ? (
            <div style={{ textAlign: 'center', padding: '30px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
              <Info size={28} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>
                No active Approved Action Plan found for the constituency "{selectedConstituency}".
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
                             <td style={{ padding: '12px 10px', minWidth: '320px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(step.description || '').split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence: string, sIdx: number) => (
                                  <div key={sIdx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                                    <span style={{ color: '#2dd4bf', flexShrink: 0, marginTop: '3px', fontSize: '10px' }}>✦</span>
                                    <span>{sentence.trim()}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
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
        )}

        {/* TAB 3: AI ALIGNMENT AUDITS */}
        {activeTab === 'audits' && (
          <div className="form-card" style={{ padding: '24px 30px', textAlign: 'left', marginBottom: '32px' }}>
            <h3 style={{ color: 'white', fontSize: '1.25rem', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={22} style={{ color: '#818cf8' }} />
              <span>AI Constituency Planning Alignment & Audit Desk</span>
            </h3>
            <p style={{ color: 'var(--text-desc)', fontSize: '13px', marginBottom: '20px' }}>
              Automatically verifies your legislative actions (parliamentary questions, MPLADS budget releases) against the real-time ground truth of citizen grievances.
            </p>
            
            {aiActionAuditReport ? (
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '8px',
                padding: '20px 24px',
                fontSize: '13px',
                color: '#c7d2fe',
                lineHeight: '1.6',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold' }}>
                  <Sparkles size={18} />
                  <span>🤖 Live Parliamentary Action & Grievance Alignment Audit Report:</span>
                </h4>
                <div style={{ whiteSpace: 'pre-line' }}>
                  {aiActionAuditReport}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                <Sparkles size={28} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '8px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>
                  No active audit report generated yet.
                </p>
                <p style={{ color: 'var(--text-desc)', fontSize: '11px', marginTop: '4px' }}>
                  Audits trigger automatically when you voice constituency concerns in parliament or allocate funding to approved public work steps.
                </p>
              </div>
            )}
          </div>
        )}
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
