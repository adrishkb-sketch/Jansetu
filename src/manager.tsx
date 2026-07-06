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
  Sliders,
  Brain,
  FileBarChart,
  FileText,
  Printer,
  Clock,
  Briefcase,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

const safeJsonParse = (text: string) => {
  let cleanText = text.trim();
  const match = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/```\s*([\s\S]*?)\s*```/);
  if (match) {
    cleanText = match[1];
  }
  return JSON.parse(cleanText.trim());
};
import { getAllDemands, updateDemandStatus, saveActionPlan, getActionPlan, updateDemandDetails, getAllActionPlans, saveActionPlanByConstituency, getActionPlanByConstituency, clearDatabaseCollections } from './services/db';
import { LanguageSelector, getInitialLanguage, GoogleMapComponent } from './App';
import { AuthModal } from './AuthModal';
import { 
  evaluateInfrastructureGap, 
  calculateCombinedPriorityIndex, 
  getClosestConstituencySegment,
  getConstituencyOfLocation,
  ALL_CONSTITUENCIES_DATA,
  getConstituencySegments
} from './services/constituency_datasets';
import './index.css';

const getCategoryColor = (category: string) => {
  const categoriesList = ["water", "roads", "education", "health", "power", "agriculture", "safety", "environment", "welfare", "housing", "anticorruption", "digital", "disaster", "women", "justice", "economy", "consumer", "taxes", "tourism", "youth", "innovation", "rural", "security", "cyber", "climate", "space", "foreign", "others"];
  const idx = categoriesList.indexOf(category.toLowerCase());
  if (idx === -1) return '#818cf8';
  const hue = (idx * (360 / categoriesList.length)) % 360;
  return `hsl(${hue}, 75%, 60%)`;
};

function ManagerConsole() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);
  const [demands, setDemands] = useState<any[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<any | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'registry' | 'complaints' | 'clustering' | 'datasets' | 'proposal' | 'tracking'>('registry');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTicketType, setFilterTicketType] = useState('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  const [filterConstituency, setFilterConstituency] = useState<string>('all');
  const [clubbingMode, setClubbingMode] = useState<'none' | 'category' | 'constituency'>('none');
  const [allActionPlans, setAllActionPlans] = useState<any[]>([]);
  const [selectedTrackingPlan, setSelectedTrackingPlan] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<string>('cpi');
  const [prioritySlider, setPrioritySlider] = useState<number>(0);
  const [signatureSlider, setSignatureSlider] = useState<number>(0);
  const [scopeSliderFilter, setScopeSliderFilter] = useState<string>('all');
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('manager_auth') === 'true');
  const [selectedGlobalConstituency, setSelectedGlobalConstituency] = useState<string>('Rampur');
  const [constituencySearchQuery, setConstituencySearchQuery] = useState('Rampur');
  const [showConstituencyDropdown, setShowConstituencyDropdown] = useState(false);

  useEffect(() => {
    setConstituencySearchQuery(selectedGlobalConstituency);
  }, [selectedGlobalConstituency]);

  // AI Thematic Clustering States
  const [clusteringResults, setClusteringResults] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('jansetu_clustering_results');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isClustering, setIsClustering] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Record<number, boolean>>({});
  const [aiClusterMode, setAiClusterMode] = useState<'constituency' | 'category'>('constituency');
  const [aiClusterTargetConstituency, setAiClusterTargetConstituency] = useState<string>('Rampur');
  const [aiClusterTargetCategory, setAiClusterTargetCategory] = useState<string>('water');
  const [aiClusterConstituencySearchQuery, setAiClusterConstituencySearchQuery] = useState('Rampur');
  const [showAiClusterConstituencyDropdown, setShowAiClusterConstituencyDropdown] = useState(false);
  const [aiClusterStartDate, setAiClusterStartDate] = useState<string>('');
  const [aiClusterEndDate, setAiClusterEndDate] = useState<string>('');

  // Constituency Plan & Proposal Builder States
  const [selectedConstituencyPlanIds, setSelectedConstituencyPlanIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jansetu_constituency_plan_ids');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selectedCategoryPlanIds, setSelectedCategoryPlanIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jansetu_category_plan_ids');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [proposalType, setProposalType] = useState<'constituency' | 'category'>('constituency');
  const [targetPlanCategory, setTargetPlanCategory] = useState<string>('water');

  const selectedPlanIds = proposalType === 'constituency' ? selectedConstituencyPlanIds : selectedCategoryPlanIds;

  const setSelectedPlanIds = (val: string[] | ((prev: string[]) => string[])) => {
    if (proposalType === 'constituency') {
      if (typeof val === 'function') {
        setSelectedConstituencyPlanIds(prev => val(prev));
      } else {
        setSelectedConstituencyPlanIds(val);
      }
    } else {
      if (typeof val === 'function') {
        setSelectedCategoryPlanIds(prev => val(prev));
      } else {
        setSelectedCategoryPlanIds(val);
      }
    }
  };

  const handleTogglePin = (tid: string, pinType: 'constituency' | 'category') => {
    const demandItem = demands.find(d => d.id === tid);
    if (!demandItem) return;

    if (pinType === 'constituency') {
      const isPinned = selectedConstituencyPlanIds.includes(tid);
      if (isPinned) {
        setSelectedConstituencyPlanIds(prev => prev.filter(id => id !== tid));
      } else {
        // Validation check
        const currentConstituency = selectedConstituencyPlanIds.length > 0
          ? demands.find(d => d.id === selectedConstituencyPlanIds[0])?.constituency || 'Rampur'
          : null;
        const itemConstituency = demandItem.constituency || 'Rampur';
        
        if (currentConstituency && currentConstituency.toLowerCase() !== itemConstituency.toLowerCase()) {
          alert(`You cannot mix different constituencies in a Constituency-Based Action Plan.\n\nCurrent plan constituency: ${currentConstituency}\nNew item constituency: ${itemConstituency}\n\nPlease use a Category-Based Plan or clear the current list.`);
          return;
        }
        setSelectedConstituencyPlanIds(prev => [...prev, tid]);
      }
    } else {
      const isPinned = selectedCategoryPlanIds.includes(tid);
      if (isPinned) {
        setSelectedCategoryPlanIds(prev => prev.filter(id => id !== tid));
      } else {
        setSelectedCategoryPlanIds(prev => [...prev, tid]);
      }
    }
  };

  const [actionPlan, setActionPlan] = useState<any | null>(null);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isAuditingProgress, setIsAuditingProgress] = useState(false);
  const [progressAuditResult, setProgressAuditResult] = useState<string>('');
  const [customPlanName, setCustomPlanName] = useState(() => localStorage.getItem('jansetu_plan_name') || 'Rampur Lok Sabha Constituency Action Plan');

  // Load Action Plan from online database / local storage on mount
  useEffect(() => {
    const fetchPlan = async () => {
      const plan = await getActionPlan();
      if (plan) {
        setActionPlan(plan);
      }
    };
    fetchPlan();
  }, []);

  // Persist Plan states
  useEffect(() => {
    localStorage.setItem('jansetu_constituency_plan_ids', JSON.stringify(selectedConstituencyPlanIds));
  }, [selectedConstituencyPlanIds]);

  useEffect(() => {
    localStorage.setItem('jansetu_category_plan_ids', JSON.stringify(selectedCategoryPlanIds));
  }, [selectedCategoryPlanIds]);

  useEffect(() => {
    localStorage.setItem('jansetu_plan_name', customPlanName);
  }, [customPlanName]);

  useEffect(() => {
    localStorage.setItem('jansetu_clustering_results', JSON.stringify(clusteringResults));
  }, [clusteringResults]);



  // Load demands
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, activeTab]);

  const loadData = async () => {
    const data = await getAllDemands();
    // Sort by date newest first
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Retroactively backfill constituency for existing complaints that are missing it
    const backfillPromises = data
      .filter(d => !d.constituency && d.location?.lat && d.location?.lng)
      .map(async d => {
        const detectedConstituency = getConstituencyOfLocation(d.location.lat, d.location.lng, d.address || '');
        d.constituency = detectedConstituency; // mutate in-memory immediately
        try {
          await updateDemandDetails(d.id, { constituency: detectedConstituency });
        } catch (e) {
          console.warn('Backfill constituency write failed for', d.id, e);
        }
      });
    await Promise.all(backfillPromises);

    setDemands(data);
    if (data.length > 0) {
      setSelectedDemand(data[0]);
      setSelectedComplaint(data[0]);
    }
    const plans = await getAllActionPlans();
    setAllActionPlans(plans);
  };

  const runThematicClustering = async () => {
    // 1. Only verified complaints are eligible for AI clustering
    let filteredDemands = demands.filter(d => d.status === 'verified');

    // 2. Apply constituency or category filter
    if (aiClusterMode === 'constituency') {
      filteredDemands = filteredDemands.filter(d => (d.constituency || 'Rampur').toLowerCase() === aiClusterTargetConstituency.toLowerCase());
    } else {
      filteredDemands = filteredDemands.filter(d => d.category.toLowerCase() === aiClusterTargetCategory.toLowerCase());
    }

    // 3. Apply date range filter
    if (aiClusterStartDate) {
      const start = new Date(aiClusterStartDate);
      start.setHours(0, 0, 0, 0);
      filteredDemands = filteredDemands.filter(d => new Date(d.createdAt) >= start);
    }
    if (aiClusterEndDate) {
      const end = new Date(aiClusterEndDate);
      end.setHours(23, 59, 59, 999);
      filteredDemands = filteredDemands.filter(d => new Date(d.createdAt) <= end);
    }

    if (filteredDemands.length === 0) {
      alert(`No verified complaints found matching your filters.\n\nOnly complaints marked as "Verified" by a manager are eligible for AI clustering.\n\nCheck the Complaint Registry tab to verify complaints first.`);
      return;
    }

    setIsClustering(true);
    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';

    const submissionsForClustering = filteredDemands.map(d => ({
      id: d.id,
      ticketType: d.ticketType || 'complaint',
      category: d.category,
      scope: d.scope,
      address: d.address,
      description: d.items?.[0]?.content || d.items?.[0]?.speechTranscript || '',
      upvotes: d.upvotes || 1
    }));

    if (geminiKey) {
      try {
        const prompt = `You are an AI data scientist specializing in civic technology and constituency development.
We have a set of citizen submissions (both complaints and suggestions) containing categories, addresses, descriptions, and user upvotes.
Please group these submissions into 3-5 high-level "Thematic Topic Clusters" (grouped by issue topic / subcategory).
For each cluster, you must produce:
1. A concise, professional Title (e.g., "Drinking Water Quality & Drainage Gaps").
2. A Summary/Rationale explaining the issues and listing any specific addresses/landmarks/locations tagged or mentioned in the complaints (e.g., "Drinking water pipeline leakages near Howrah Junction and surrounding areas").
3. A list of Ticket IDs that belong to this cluster.
4. An estimated overall Priority Level (High/Moderate/Medium/Urgent).
5. A Recommended Action (e.g., "Sanction a Jal Jeevan Mission maintenance crew to overhaul the main market feeder pipeline").

Here is the JSON list of active citizen submissions:
${JSON.stringify(submissionsForClustering)}

Please return the results as a valid JSON array of objects. Do not wrap it in markdown code blocks. The JSON array must look exactly like this:
[
  {
    "title": "...",
    "summary": "...",
    "ticketIds": ["...", "..."],
    "priority": "...",
    "recommendedAction": "..."
  }
]`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        });

        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = safeJsonParse(text);
          setClusteringResults(parsed);
          setIsClustering(false);
          return;
        }
      } catch (e) {
        console.error("Gemini clustering failed, falling back to local emulator: ", e);
      }
    }

    // Mock fallback logic
    setTimeout(() => {
      const clustersMap: Record<string, { title: string; summary: string; ticketIds: string[]; priority: string; recommendedAction: string }> = {};

      filteredDemands.forEach(d => {
        const categoryKey = d.category.toLowerCase();
        const regionName = d.constituency || 'Rampur';
        let clusterKey = `${categoryKey}_${regionName.toLowerCase().replace(/\s+/g, '_')}`;

        if (!clustersMap[clusterKey]) {
          let title = '';
          let summary = '';
          let recommendedAction = '';
          let priority = 'Medium';

          if (categoryKey === 'water') {
            title = `💧 Potable Water & Pipe Network Deficits in ${regionName}`;
            summary = `Multiple citizen grievances reporting water logging, tank leakages near ${d.address}, and pipeline failures.`;
            recommendedAction = `Upgrade local feeder pipelines and install regional water filtration systems.`;
            priority = 'Urgent';
          } else if (categoryKey === 'roads') {
            title = `🛣️ Rural Road Connectivity & Pothole Upgrades in ${regionName}`;
            summary = `Reports of extensive monsoonal potholes at ${d.address} causing water accumulation, combined with road widening suggestions.`;
            recommendedAction = `Sanction public works to reconstruct key link roads and connect outlying habitations.`;
            priority = 'High';
          } else if (categoryKey === 'health') {
            title = `🏥 Primary Health Proximity & Staff Saturation in ${regionName}`;
            summary = `Submissions detailing high traveling distances (avg > 9km) to nearest health facilities from ${d.address}.`;
            recommendedAction = `Establish a new Ayushman Bharat Health and Wellness Sub-Centre.`;
            priority = 'Urgent';
          } else if (categoryKey === 'education') {
            title = `🏫 School Infrastructure & RTE Alignment in ${regionName}`;
            summary = `Suggestions for school repairs and solar setups at ${d.address}, alongside complaints of teacher-student ratio deficits.`;
            recommendedAction = `Allocate local area development budgets to repair primary school classrooms.`;
            priority = 'Moderate';
          } else {
            title = `📁 General Infrastructure & Public Welfare in ${regionName}`;
            summary = `Aggregated municipal needs, waste management complaints near ${d.address}.`;
            recommendedAction = `Direct municipal corporation workers to address street sanitation and community lighting.`;
            priority = 'Medium';
          }

          clustersMap[clusterKey] = {
            title,
            summary,
            ticketIds: [],
            priority,
            recommendedAction
          };
        }

        clustersMap[clusterKey].ticketIds.push(d.id);
      });

      const results = Object.values(clustersMap);
      setClusteringResults(results);
      setIsClustering(false);
    }, 1200);
  };

  const runAIProgressAudit = async (plan: any) => {
    if (!plan) return;
    setIsAuditingProgress(true);
    setProgressAuditResult('Evaluating MP parliamentary activity and dedicated funds...');
    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';

    const planSummary = `
      Plan Name: ${plan.planName}
      Constituency: ${plan.constituency}
      Steps & Statuses:
      ${(plan.detailedSteps || []).map((s: any, i: number) => 
        `Step #${i+1}: ${s.title} (Cost: ₹${s.cost || 0}, Status: ${s.status || 'proposed'}, Responsible Agency: ${s.agency || 'N/A'})`
      ).join('\n')}
    `;

    const prompt = `
      You are an expert parliamentary progress monitoring officer.
      Analyze the following development action plan status for a Lok Sabha constituency:
      ${planSummary}
      
      Provide a concise 2-3 sentence executive audit report. Detail:
      1. What has been raised in Parliament vs funded vs pending?
      2. If all steps are funded/started, praise the MP's execution speed.
      Keep it professional, direct, and non-technical. Do not use markdown code blocks.
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) throw new Error("API error");
      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';
      setProgressAuditResult(text.trim());
    } catch (err: any) {
      setProgressAuditResult(`Failed to run progress audit: ${err.message}`);
    } finally {
      setIsAuditingProgress(false);
    }
  };

  const runGeminiGrievanceAudit = async (complaint: any) => {
    if (!complaint) return;
    setIsAuditing(true);
    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';

    const compiledEvidence = (complaint.items || []).map((item: any, index: number) => {
      let details = `[Item #${index + 1} - Type: ${item.type}]`;
      if (item.content) details += ` Description: "${item.content}"`;
      if (item.speechTranscript) details += ` Voice Transcript: "${item.speechTranscript}"`;
      if (item.ocrText) details += ` OCR Text: "${item.ocrText}"`;
      return details;
    }).join('\n');

    const ticketDetails = {
      id: complaint.id,
      category: complaint.category,
      scope: complaint.scope,
      address: complaint.address,
      allSubmissionsAndFollowUps: compiledEvidence
    };

    if (geminiKey) {
      try {
        const prompt = `You are an AI civic auditor evaluating municipal and infrastructure grievances.
Please analyze the following citizen submission details:
${JSON.stringify(ticketDetails)}

Based on the description, transcripts, and OCR documents, perform a diagnostics audit. Determine:
1. "brief": A 1-2 sentence executive summary of the core issue.
2. "priorityScore": A numeric score from 1 to 100 indicating priority (higher is more critical).
3. "safetyRisk": Safety level hazard ('Low', 'Moderate', 'High', 'Severe').
4. "estimatedBudget": An estimated cost range in Indian Rupees (Lakhs/Crores) to fix this.
5. "citizenResponse": A professional, polite, and reassuring response draft from the MP's office to send to the citizen.

You must return your output strictly as a valid JSON object matching this structure:
{
  "brief": "...",
  "priorityScore": 75,
  "safetyRisk": "...",
  "estimatedBudget": "...",
  "citizenResponse": "..."
}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = safeJsonParse(text);
          parsed.estimatedBudget = parsed.estimatedBudget || "₹5 - ₹10 Lakhs";
          parsed.safetyRisk = parsed.safetyRisk || "Moderate";
          
          const updatedOverview = {
            ...parsed,
            urgency: parsed.priorityScore > 80 ? 'Critical' : parsed.priorityScore > 50 ? 'High' : 'Normal',
            fundingSource: complaint.category === 'water' ? 'Jal Jeevan Mission' : complaint.category === 'roads' ? 'PMGSY' : 'MPLADS Fund'
          };
          
          await updateDemandDetails(complaint.id, { 
            aiOverview: updatedOverview,
            urgency: updatedOverview.urgency,
            fundingSource: updatedOverview.fundingSource
          });

          const updatedComplaint = { 
            ...complaint, 
            aiOverview: updatedOverview,
            urgency: updatedOverview.urgency,
            fundingSource: updatedOverview.fundingSource
          };
          setSelectedComplaint(updatedComplaint);
          setDemands(prev => prev.map(d => d.id === complaint.id ? updatedComplaint : d));
          setIsAuditing(false);
          return;
        }
      } catch (e) {
        console.error("Gemini ticket audit failed, using mock fallback: ", e);
      }
    }

    // Mock Fallback Audit
    setTimeout(async () => {
      const isSug = complaint.ticketType === 'suggestion';
      const score = Math.floor(Math.random() * 40) + (isSug ? 35 : 60);
      const mockOverview = {
        brief: `Data-driven audit of citizen ${complaint.category} ticket in ${complaint.address.split(',')[0]}. Identifies municipal maintenance needs.`,
        priorityScore: score,
        safetyRisk: score > 75 ? 'High' : 'Moderate',
        estimatedBudget: complaint.category === 'water' ? '₹8 Lakhs - ₹12 Lakhs' : complaint.category === 'roads' ? '₹20 Lakhs - ₹35 Lakhs' : '₹3 Lakhs - ₹5 Lakhs',
        urgency: score > 75 ? 'Critical' : score > 50 ? 'High' : 'Normal',
        fundingSource: complaint.category === 'water' ? 'Jal Jeevan Mission' : complaint.category === 'roads' ? 'PMGSY' : 'MPLADS Fund',
        citizenResponse: `Dear Citizen, thank you for submitting your feedback regarding ${complaint.category} issues at ${complaint.address.split(',')[0]}. Our technical planning teams have verified the hotspot location. We have queued this request for inclusion in our upcoming ward project review. We appreciate your partnership in building a better community.`
      };

      await updateDemandDetails(complaint.id, { 
        aiOverview: mockOverview,
        urgency: mockOverview.urgency,
        fundingSource: mockOverview.fundingSource
      });

      const updatedComplaint = { 
        ...complaint, 
        aiOverview: mockOverview,
        urgency: mockOverview.urgency,
        fundingSource: mockOverview.fundingSource
      };
      setSelectedComplaint(updatedComplaint);
      setDemands(prev => prev.map(d => d.id === complaint.id ? updatedComplaint : d));
      setIsAuditing(false);
    }, 1200);
  };

  const handleSaveActivePlan = async (planToSave: any) => {
    if (!planToSave) return;
    const selectedDemands = demands.filter(d => selectedPlanIds.includes(d.id));
    const planConstituency = planToSave.constituency || selectedDemands[0]?.constituency || 'Rampur';
    
    let planKey = '';
    const updatedPlan = {
      ...planToSave,
      planType: proposalType,
      updatedAt: new Date().toISOString()
    };

    if (proposalType === 'constituency') {
      planKey = planConstituency;
      updatedPlan.constituency = planConstituency;
      updatedPlan.id = `plan_${planConstituency.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    } else {
      planKey = `category_${targetPlanCategory.toLowerCase()}`;
      updatedPlan.category = targetPlanCategory;
      updatedPlan.id = `plan_category_${targetPlanCategory.toLowerCase()}`;
    }

    // Save draft or approved
    await saveActionPlan(updatedPlan); // compatibility
    await saveActionPlanByConstituency(planKey, updatedPlan);

    // Refresh local list of plans
    const plans = await getAllActionPlans();
    setAllActionPlans(plans);
  };

  const generateParliamentBrief = async () => {
    setIsGeneratingProposal(true);
    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';

    const selectedDemands = demands.filter(d => selectedPlanIds.includes(d.id));
    if (selectedDemands.length === 0) {
      alert("No issues selected in your plan. Please select at least one item first!");
      setIsGeneratingProposal(false);
      return;
    }

    const planConstituency = selectedDemands[0]?.constituency || 'Rampur';

    const compiledItemsText = selectedDemands.map((d, index) => {
      const segment = getClosestConstituencySegment(d.location.lat, d.location.lng);
      return `Item #${index + 1}:
- ID: ${d.id}
- Category: ${d.category}
- Ticket Type: ${d.ticketType || 'complaint'}
- Coordinates Address: ${d.address} (Closest Segment: ${segment.name})
- Citizen Support: ${d.upvotes || 1} verified votes
- Summary of Citizen Input: "${d.items?.[0]?.content || d.items?.[0]?.speechTranscript || 'No description'}"
- Local Government Metric: ${segment.waterCoverage}% JJM tap water coverage, ${segment.unconnectedHabitations} unconnected PMGSY habitations, ${segment.avgDistanceToPHC}km average distance to healthcare PHC.`;
    }).join('\n\n');

    if (geminiKey) {
      try {
        const prompt = proposalType === 'constituency'
          ? `You are a constituency development expert. Create a structured step-by-step action plan for ${planConstituency} Lok Sabha constituency based on these selected citizen priorities:
${compiledItemsText}

Provide your response ONLY as a valid JSON object matching the following schema. Do NOT include markdown blocks or any text outside the JSON.
{
  "planName": "Title of the plan",
  "summary": "Brief executive summary paragraph highlighting demographics and ministry guidelines",
  "flowchart": [
    {
      "phase": "Phase Title (e.g. Phase 1: Mobilization)",
      "duration": "Timeline range (e.g. Weeks 1-2)",
      "description": "Specific action details"
    }
  ],
  "detailedSteps": [
    {
      "id": "Matching Ticket ID from the compiled items",
      "title": "Specific Project Name",
      "description": "Step-by-step implementation details comparing against ministry norms (Jal Jeevan, PMGSY, NHM, RTE)",
      "cost": number (Estimated cost in Rupees),
      "timeline": "Duration (e.g. 30 Days)",
      "agency": "Government body responsible (e.g. Public Works Department (PWD))"
    }
  ]
}`
          : `You are a public policy expert. Create a general topic-based structured action plan focusing on category "${targetPlanCategory}" across multiple regions, based on these selected citizen priorities:
${compiledItemsText}

Provide your response ONLY as a valid JSON object matching the following schema. Do NOT include markdown blocks or any text outside the JSON.
{
  "planName": "Title of the plan",
  "summary": "Brief executive summary paragraph detailing target guidelines and inter-agency efforts",
  "flowchart": [
    {
      "phase": "Phase Title (e.g. Phase 1: Mobilization)",
      "duration": "Timeline range (e.g. Weeks 1-2)",
      "description": "Specific action details"
    }
  ],
  "detailedSteps": [
    {
      "id": "Matching Ticket ID from the compiled items",
      "title": "Specific Project Name",
      "description": "Step-by-step implementation details comparing against ministry norms (Jal Jeevan, PMGSY, NHM, RTE)",
      "cost": number (Estimated cost in Rupees),
      "timeline": "Duration (e.g. 30 Days)",
      "agency": "Government body responsible"
    }
  ]
}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          })
        });

        const json = await response.json();
        let responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsedPlan = safeJsonParse(responseText);
        
        if (parsedPlan && parsedPlan.planName) {
          parsedPlan.isApproved = false;
          parsedPlan.planType = proposalType;
          if (proposalType === 'constituency') {
            parsedPlan.constituency = planConstituency;
          } else {
            parsedPlan.category = targetPlanCategory;
          }
          parsedPlan.associatedComplaintIds = selectedDemands.map(d => d.id);
          setActionPlan(parsedPlan);
          await handleSaveActivePlan(parsedPlan);
          setIsGeneratingProposal(false);
          return;
        }
      } catch (e) {
        console.error("Gemini action plan generation failed, falling back to mock: ", e);
      }
    }

    // Dynamic Mock Fallback action plan builder:
    setTimeout(async () => {
      const mockDetailedSteps = selectedDemands.map((d, index) => {
        const cost = getProjectCostEstimate(d.category, d.scope);
        const segment = getClosestConstituencySegment(d.location.lat, d.location.lng);
        const desc = d.items?.[0]?.content || d.items?.[0]?.speechTranscript || `Remediation for ${d.category} issues in ${segment.name}`;
        
        let agency = 'District Development Authority';
        if (d.category === 'roads') agency = 'Public Works Department (PWD)';
        else if (d.category === 'water') agency = 'Jal Nigam & Jal Shakti Division';
        else if (d.category === 'health') agency = 'Chief Medical Officer & NHM';
        else if (d.category === 'education') agency = 'Basic Shiksha Adhikari (BSA)';

        return {
          id: d.id,
          title: `Project ${index + 1}: ${d.category.charAt(0).toUpperCase() + d.category.slice(1)} Intervention at ${d.address.split(',')[0]}`,
          description: `A data-driven project to address infrastructure gaps in ${segment.name}. Action description: ${desc}. Assessed against Ministry Guidelines.`,
          cost: cost,
          timeline: d.scope === 'constituency' ? '90 Days' : d.scope === 'ward' ? '45 Days' : '15 Days',
          agency: agency
        };
      });

      const mockFlowchart = [
        {
          phase: "Phase 1: Mobilization & Feasibility",
          duration: "Weeks 1-2",
          description: `Initiating surveys, land clearance checks, and soil stability audits for selected sites in ${planConstituency}.`
        },
        {
          phase: "Phase 2: Budget Sanction & Tender",
          duration: "Weeks 3-4",
          description: "Allocating funds and initiating transparent digital bids."
        },
        {
          phase: "Phase 3: Civil Construction",
          duration: "Months 2-3",
          description: "Execution of civil works, concrete layering, and pipe laying on-site."
        },
        {
          phase: "Phase 4: Inspection & Verification",
          duration: "Month 4",
          description: "Verification of works against RTE, JJM, and national safety standards prior to handover."
        }
      ];

      const mockPlan = {
        planName: customPlanName || (proposalType === 'constituency' ? `${planConstituency} Constituency Development Plan` : `General ${targetPlanCategory.charAt(0).toUpperCase() + targetPlanCategory.slice(1)} Action Plan`),
        summary: proposalType === 'constituency'
          ? `A data-driven development blueprint prioritizing ${selectedDemands.length} civic gaps in ${planConstituency} constituency. Resolves critical deficiencies using MPLADS funding compared against state benchmarks.`
          : `A policy action brief addressing category ${targetPlanCategory} across multiple regions. Compiles ministry guidelines and outlines targets for coordinated inter-agency execution.`,
        flowchart: mockFlowchart,
        detailedSteps: mockDetailedSteps,
        isApproved: false,
        planType: proposalType,
        constituency: proposalType === 'constituency' ? planConstituency : undefined,
        category: proposalType === 'category' ? targetPlanCategory : undefined,
        associatedComplaintIds: selectedDemands.map(d => d.id)
      };

      setActionPlan(mockPlan);
      await handleSaveActivePlan(mockPlan);
      setIsGeneratingProposal(false);
    }, 1500);
  };

  const handleUpdatePlanWithGemini = async () => {
    if (!actionPlan) return;
    setIsGeneratingProposal(true);
    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';

    try {
      const prompt = `You are a constituency development expert. The user (manager) has typed manual changes or updates to the action plan. Here is the current state of the plan:
${JSON.stringify(actionPlan, null, 2)}

Please review these updates. Use your AI intelligence to:
1. Understand the manager's changes.
2. Refine the executive summary to match the new details and keep it highly professional.
3. Align any descriptions with ministry norms (Jal Jeevan, PMGSY, NHM, RTE) where applicable.
4. Ensure the flowchart timelines match the detailed steps.
5. output the updated plan.

Return ONLY a clean JSON object matching the original schema. Do NOT include markdown blocks or any text outside the JSON.
{
  "planName": "Title of the plan",
  "summary": "Refined executive summary paragraph",
  "flowchart": [
    {
      "phase": "Phase Title",
      "duration": "Timeline range",
      "description": "Specific action details"
    }
  ],
  "detailedSteps": [
    {
      "id": "Matching Ticket ID",
      "title": "Specific Project Name",
      "description": "Details aligned with ministry guidelines",
      "cost": number (Cost in Rupees),
      "timeline": "Duration",
      "agency": "Responsible government body"
    }
  ]
}`;

      let responsePlan = actionPlan;

      if (geminiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (response.ok) {
          const json = await response.json();
          let responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const parsedPlan = safeJsonParse(responseText);
          if (parsedPlan && parsedPlan.planName) {
            responsePlan = {
              ...actionPlan,
              ...parsedPlan,
              isApproved: false // Keep draft status
            };
          }
        } else {
          throw new Error(`API error: HTTP ${response.status}`);
        }
      } else {
        // Mock fallback if default/dummy key is used
        alert("Using Gemini offline simulation. Plan changes have been analyzed and synced locally.");
        responsePlan = {
          ...actionPlan,
          summary: `[AI Simulated Audit] Refined plan summary matching ${actionPlan.detailedSteps.length} projects. Audited against Jal Jeevan and NHM standards.`,
          updatedAt: new Date().toISOString()
        };
      }

      setActionPlan(responsePlan);
      await handleSaveActivePlan(responsePlan);
      alert("Gemini AI successfully processed and refined the updated plan!");
    } catch (e: any) {
      console.error("Gemini plan update failed: ", e);
      alert(`Gemini was unable to parse the updated plan. Please check your inputs or try again. Error: ${e.message}`);
    } finally {
      setIsGeneratingProposal(false);
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

  const handleApproveAllPending = async () => {
    const pendingDemands = demands.filter(d => d.status === 'pending');
    if (pendingDemands.length === 0) {
      alert("No pending complaints found to verify.");
      return;
    }
    for (const d of pendingDemands) {
      await updateDemandStatus(d.id, 'approved');
    }
    await loadData();
    alert(`Marked ${pendingDemands.length} pending issues as verified/approved!`);
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

    // Timeline filter
    if (filterTime !== 'all') {
      const createdDate = new Date(d.createdAt);
      const now = new Date();
      const diffMs = now.getTime() - createdDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (filterTime === 'today') {
        const isSameDay = createdDate.toDateString() === now.toDateString();
        if (!isSameDay) return false;
      } else if (filterTime === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = createdDate.toDateString() === yesterday.toDateString();
        if (!isYesterday) return false;
      } else if (filterTime === 'week') {
        if (diffDays > 7) return false;
      } else if (filterTime === 'month') {
        if (diffDays > 30) return false;
      } else if (filterTime === '6months') {
        if (diffDays > 180) return false;
      }
    }

    // Slide/Tuning threshold parameters
    if (prioritySlider > 0) {
      const score = d.aiOverview?.priorityScore || 0;
      if (score < prioritySlider) return false;
    }

    const votes = d.upvotes || 1;
    if (votes < signatureSlider) return false;

    if (scopeSliderFilter !== 'all' && d.scope !== scopeSliderFilter) return false;


    const matchesConstituency = filterConstituency === 'all' || (d.constituency || 'Rampur') === filterConstituency;

    return matchesSearch && matchesCategory && matchesStatus && matchesTicketType && matchesConstituency;
  });

  const getClubbedGroups = () => {
    if (clubbingMode === 'none') return [];
    const groups: Record<string, any[]> = {};
    
    // Sort demands by date or CPI
    const sourceDemands = [...filteredDemands];
    if (sortBy === 'cpi') {
      sourceDemands.sort((a, b) => (b.cpi || 0) - (a.cpi || 0));
    } else if (sortBy === 'priority') {
      sourceDemands.sort((a, b) => (b.aiOverview?.priorityScore || 0) - (a.aiOverview?.priorityScore || 0));
    } else if (sortBy === 'upvotes') {
      sourceDemands.sort((a, b) => (b.upvotes || 1) - (a.upvotes || 1));
    } else {
      sourceDemands.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    sourceDemands.forEach(d => {
      const key = clubbingMode === 'category' ? d.category : (d.constituency || 'Rampur');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(d);
    });

    return Object.keys(groups).map(key => {
      const groupDemands = groups[key];
      const totalUpvotes = groupDemands.reduce((acc, curr) => acc + (curr.upvotes || 0), 0);
      const avgCPI = Math.round(groupDemands.reduce((acc, curr) => acc + (curr.cpi || 0), 0) / groupDemands.length);
      const statusCounts = groupDemands.reduce((acc: any, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});
      
      const statusSummary = Object.keys(statusCounts)
        .map(s => `${statusCounts[s]} ${s.toUpperCase()}`)
        .join(', ');

      const displayName = clubbingMode === 'category' 
        ? `${key.charAt(0).toUpperCase() + key.slice(1)} Issues` 
        : `${key} Constituency`;

      return {
        id: `clubbed_${clubbingMode}_${key}`,
        key: clubbingMode === 'category' ? `category_${key}` : key,
        clusterType: clubbingMode,
        name: displayName,
        demands: groupDemands,
        totalUpvotes,
        avgCPI,
        statusSummary,
        category: clubbingMode === 'category' ? key : 'general',
        constituency: clubbingMode === 'constituency' ? key : 'all',
        ticketType: 'clubbed'
      };
    }).sort((a, b) => b.avgCPI - a.avgCPI);
  };

  const clubbedGroups = getClubbedGroups();

  // Dynamic real-data calculations based on filters and sliders
  const totalCount = filteredDemands.length;
  const pendingCount = filteredDemands.filter(d => d.status === 'pending').length;
  const totalVotes = filteredDemands.reduce((acc, curr) => acc + (curr.upvotes || 0), 0);

  // Red Alerts (Priority Score > 80)
  const redAlertCount = filteredDemands.filter(d => (d.aiOverview?.priorityScore || 0) > 80).length;

  // Average Citizen Support (average votes per complaint)
  const averageVotesPerComplaint = filteredDemands.length > 0
    ? (totalVotes / filteredDemands.length).toFixed(1)
    : '0.0';

  // Find the category with the highest average priority score
  let mostUrgentSector = 'None';
  if (filteredDemands.length > 0) {
    const categoryPrioritySums: any = {};
    const categoryPriorityCounts: any = {};
    filteredDemands.forEach(d => {
      const cat = d.category;
      const score = d.aiOverview?.priorityScore || 50;
      categoryPrioritySums[cat] = (categoryPrioritySums[cat] || 0) + score;
      categoryPriorityCounts[cat] = (categoryPriorityCounts[cat] || 0) + 1;
    });
    
    let highestAveragePriority = 0;
    Object.keys(categoryPrioritySums).forEach(cat => {
      const avg = categoryPrioritySums[cat] / categoryPriorityCounts[cat];
      if (avg > highestAveragePriority) {
        highestAveragePriority = avg;
        mostUrgentSector = cat;
      }
    });
  }

  // Sort the filtered list
  const sortedDemands = [...filteredDemands].sort((a, b) => {
    if (sortBy === 'cpi') {
      const scoreA = calculateCombinedPriorityIndex(a);
      const scoreB = calculateCombinedPriorityIndex(b);
      return scoreB - scoreA;
    }
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

  // Priority histogram calculation
  const priorityBands = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
  filteredDemands.forEach(d => {
    const score = d.aiOverview?.priorityScore || 50;
    if (score <= 20) priorityBands[0]++;
    else if (score <= 40) priorityBands[1]++;
    else if (score <= 60) priorityBands[2]++;
    else if (score <= 80) priorityBands[3]++;
    else priorityBands[4]++;
  });

  // Scope count calculations
  const scopeCounts = { household: 0, street: 0, ward: 0, constituency: 0 };
  filteredDemands.forEach(d => {
    if (d.scope === 'household') scopeCounts.household++;
    else if (d.scope === 'street') scopeCounts.street++;
    else if (d.scope === 'ward') scopeCounts.ward++;
    else if (d.scope === 'constituency') scopeCounts.constituency++;
  });

  const getProjectCostEstimate = (category: string, scope: string) => {
    const scopeKey = scope.toLowerCase();
    const catKey = category.toLowerCase();
    if (catKey === 'roads') {
      if (scopeKey === 'constituency') return 30000000; // ₹3.00 Cr
      if (scopeKey === 'ward') return 12000000; // ₹1.20 Cr
      if (scopeKey === 'street') return 3500000; // ₹35 L
      return 1500000; // ₹15 L
    }
    if (catKey === 'water') {
      if (scopeKey === 'constituency') return 15000000; // ₹1.50 Cr
      if (scopeKey === 'ward') return 4500000; // ₹45 L
      if (scopeKey === 'street') return 1200000; // ₹12 L
      return 500000; // ₹5 L
    }
    if (catKey === 'health') {
      if (scopeKey === 'constituency') return 20000000; // ₹2.00 Cr
      if (scopeKey === 'ward') return 6500000; // ₹65 L
      if (scopeKey === 'street') return 1500000; // ₹15 L
      return 800000; // ₹8 L
    }
    if (catKey === 'education') {
      if (scopeKey === 'constituency') return 10000000; // ₹1.00 Cr
      if (scopeKey === 'ward') return 3000000; // ₹30 L
      if (scopeKey === 'street') return 800000; // ₹8 L
      return 400000; // ₹4 L
    }
    // general default
    if (scopeKey === 'constituency') return 8000000; // ₹80 L
    if (scopeKey === 'ward') return 2500000; // ₹25 L
    if (scopeKey === 'street') return 600000; // ₹6 L
    return 300000; // ₹3 L
  };



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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleApproveAllPending}
                  style={{
                    background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)', color: '#fbbf24',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                  }}
                >
                  [DEV] Mark All Verified
                </button>
                <button 
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to completely wipe out all complaints, action plans, and reset the local storage cache? This will make the system 100% fresh and clean.")) {
                      await clearDatabaseCollections();
                      alert("Database collections and local storage cache have been successfully cleared!");
                      window.location.reload();
                    }
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444',
                    padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                  }}
                >
                  [DEV] Reset Database & Cache
                </button>
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
              </div>
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
          <h2>Citizen Issues Dashboard</h2>
          <p className="portal-subtitle">Review citizen submissions, local deficits table, and hotspots map</p>
        </div>

        {/* Tab selection menu */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', flexWrap: 'wrap' }} className="no-print">
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
            📋 Complaints Registry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clustering')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'clustering' ? '#14b8a6' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'clustering' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'clustering' ? '#2dd4bf' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Brain size={16} />
            AI Thematic Clustering
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('datasets')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'datasets' ? '#14b8a6' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'datasets' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'datasets' ? '#2dd4bf' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileBarChart size={16} />
            Demographic Gaps
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('proposal')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'proposal' ? '#14b8a6' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'proposal' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'proposal' ? '#2dd4bf' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileText size={16} />
            Lok Sabha Proposal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13.5px',
              border: '1px solid',
              borderColor: activeTab === 'tracking' ? '#14b8a6' : 'rgba(255,255,255,0.1)',
              background: activeTab === 'tracking' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'tracking' ? '#2dd4bf' : '#8e90b3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle size={16} />
            Progress Tracking
          </button>
        </div>

        {/* Dynamic Parameter Tuning Controls */}
        {activeTab === 'registry' && (
          <div className="form-card" style={{ padding: '20px 24px', marginBottom: '24px', textAlign: 'left' }}>
            <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontSize: '1rem' }}>
              <Sliders size={18} />
              <span>Dashboard Filters & Controls</span>
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

        {/* Dashboard Stats row (6-Grid Advanced KPI indicators in simple English) */}
        {(activeTab === 'registry' || activeTab === 'complaints') && (
          <div className="role-grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '1.8rem' }}>📁</div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Issues</span>
                <h3 style={{ fontSize: '1.4rem', color: 'white', margin: 0 }}>{totalCount}</h3>
              </div>
            </div>
            
            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '1.8rem' }}>🚨</div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 'bold' }}>Urgent Issues</span>
                <h3 style={{ fontSize: '1.4rem', color: '#f87171', margin: 0 }}>{redAlertCount}</h3>
              </div>
            </div>

            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '1.8rem' }}>⏳</div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 'bold' }}>Awaiting Review</span>
                <h3 style={{ fontSize: '1.4rem', color: '#fbbf24', margin: 0 }}>{pendingCount}</h3>
              </div>
            </div>

            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '1.8rem' }}>👍</div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Support Votes</span>
                <h3 style={{ fontSize: '1.4rem', color: '#818cf8', margin: 0 }}>{totalVotes}</h3>
              </div>
            </div>

            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '1.8rem' }}>📈</div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold' }}>Average Support</span>
                <h3 style={{ fontSize: '1.4rem', color: '#34d399', margin: 0 }}>{averageVotesPerComplaint} votes</h3>
              </div>
            </div>

            <div className="form-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '1.8rem' }}>🔥</div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 'bold' }}>Most Urgent Sector</span>
                <h3 style={{ fontSize: '1.25rem', color: '#a5b4fc', margin: 0, textTransform: 'capitalize' }}>{mostUrgentSector}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        {(activeTab === 'registry' || activeTab === 'complaints') && (
          <div className="form-card no-print" style={{ padding: '16px 24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
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
            
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, flexWrap: 'wrap' }}>
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
                value={filterTime} 
                onChange={e => setFilterTime(e.target.value)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
              >
                <option value="all">⏰ All Time</option>
                <option value="today">⏰ Today</option>
                <option value="yesterday">⏰ Yesterday</option>
                <option value="week">⏰ Last 7 Days</option>
                <option value="month">⏰ Last 30 Days</option>
                <option value="6months">⏰ Last 6 Months</option>
              </select>

              <select
                value={filterConstituency}
                onChange={e => setFilterConstituency(e.target.value)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', maxWidth: '200px' }}
              >
                <option value="all">🏛️ All Constituencies</option>
                {Array.from(new Set(demands.map(d => d.constituency).filter(Boolean))).sort().map(cName => (
                  <option key={cName} value={cName}>{cName}</option>
                ))}
              </select>

              <select
                value={clubbingMode}
                onChange={e => setClubbingMode(e.target.value as any)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
              >
                <option value="none">🥞 No Clubbing</option>
                <option value="category">📂 Group by Nature</option>
                <option value="constituency">📍 Group by Constituency</option>
              </select>

              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}
              >
                <option value="cpi">🎯 Sort by: Priority Index (CPI)</option>
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
        )}

        {/* Content Layout Grid */}
        {activeTab === 'registry' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
            
            {/* Top Analytics Panel: Full-Width Geographical Hotspots Map */}
            <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
              <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                <MapPin size={18} style={{ color: '#2dd4bf' }} />
                <span>Geographical Hotspots Map</span>
              </h4>
              <div style={{ height: '480px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <GoogleMapComponent
                  apiKey={localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw'}
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
              
              {/* Category HSL Color Legend for all active categories */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '11px', color: '#8e90b3', width: '100%', marginBottom: '4px', fontWeight: 'bold' }}>
                  ⭕ Circle boundary size represents citizen support count. Map marker color code key:
                </div>
                {sortedCategories.map(c => (
                  <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#c5c7e6' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: getCategoryColor(c.category) }}></span>
                    <span style={{ textTransform: 'capitalize' }}>{c.category}</span>
                    <span style={{ color: '#8e90b3', fontSize: '10.5px' }}>({c.count})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle Analytics Panel: SVG Donut Chart, SVG Histogram, and Gauge Meters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '24px' }} className="role-grid">
              
              {/* SVG Category Shares Pie/Donut Chart */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <h4 style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.05rem' }}>
                  <Sparkles size={18} />
                  <span>Incoming Issues by Category</span>
                </h4>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexGrow: 1 }}>
                  {sortedCategories.length === 0 ? (
                    <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e90b3', fontSize: '12px', width: '100%' }}>
                      No data to chart.
                    </div>
                  ) : (
                    <>
                      <div style={{ width: '45%' }}>
                        {(() => {
                          let accumulatedCircumference = 0;
                          const r = 35;
                          const circumference = 2 * Math.PI * r; // ~219.9
                          
                          return (
                            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '120px', overflow: 'visible' }}>
                              <circle cx="50" cy="50" r={r} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="15" />
                              {sortedCategories.map((c) => {
                                const share = c.count / totalCount;
                                const strokeDash = share * circumference;
                                const strokeDashOffset = -accumulatedCircumference;
                                accumulatedCircumference += strokeDash;
                                
                                return (
                                  <circle
                                    key={c.category}
                                    cx="50"
                                    cy="50"
                                    r={r}
                                    fill="transparent"
                                    stroke={getCategoryColor(c.category)}
                                    strokeWidth="15"
                                    strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                                    strokeDashoffset={strokeDashOffset}
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'all 0.3s ease', cursor: 'pointer' }}
                                  >
                                    <title>{c.category.toUpperCase()}: {c.count} ({Math.round(share * 100)}%)</title>
                                  </circle>
                                );
                              })}
                            </svg>
                          );
                        })()}
                      </div>
                      <div style={{ width: '55%', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '140px', paddingRight: '4px' }}>
                        {sortedCategories.map(c => {
                          const share = c.count / totalCount;
                          return (
                            <div key={c.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#c5c7e6' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: getCategoryColor(c.category), flexShrink: 0 }}></span>
                                <span style={{ textTransform: 'capitalize' }}>{c.category}</span>
                              </div>
                              <strong>{Math.round(share * 100)}%</strong>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Priority Histogram Chart */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                <h4 style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                  <Award size={18} style={{ color: '#fbbf24' }} />
                  <span>Issue Priority Score Spread</span>
                </h4>
                <div style={{ flexGrow: 1 }}>
                  {filteredDemands.length === 0 ? (
                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e90b3', fontSize: '12px' }}>
                      No score data available.
                    </div>
                  ) : (
                    (() => {
                      const maxBandCount = Math.max(...priorityBands, 1);
                      const labels = ["Low", "Mod", "Med", "High", "Urgent"];
                      return (
                        <svg viewBox="0 0 320 130" style={{ width: '100%', height: '130px', overflow: 'visible' }}>
                          {priorityBands.map((count, i) => {
                            const barWidth = 32;
                            const gap = 16;
                            const x = 30 + i * (barWidth + gap);
                            const height = (count / maxBandCount) * 85;
                            const y = 100 - height;
                            
                            return (
                              <g key={i}>
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={height}
                                  rx={4}
                                  fill="url(#priorityGrad)"
                                  style={{ transition: 'all 0.3s ease' }}
                                />
                                <text x={x + barWidth/2} y={y - 6} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
                                  {count}
                                </text>
                                <text x={x + barWidth/2} y="115" textAnchor="middle" fill="#8e90b3" fontSize="9.5" fontWeight="600">
                                  {labels[i]}
                                </text>
                              </g>
                            );
                          })}
                          <defs>
                            <linearGradient id="priorityGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ef4444" />
                              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
                            </linearGradient>
                          </defs>
                          <line x1="15" y1="100" x2="305" y2="100" stroke="rgba(255,255,255,0.15)" />
                        </svg>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Scope Hierarchy & Citizen Support Radial Gauge */}
              <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'left' }}>
                <h4 style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                  <Calendar size={18} style={{ color: '#38bdf8' }} />
                  <span>Scope Ratios & Support Meter</span>
                </h4>
                
                {/* Scope segmented progress bar */}
                <div>
                  <span style={{ fontSize: '11px', color: '#8e90b3', display: 'block', marginBottom: '6px' }}>Impact Level Breakdowns:</span>
                  {(() => {
                    const totalScope = Object.values(scopeCounts).reduce((a, b) => a + b, 0) || 1;
                    const sh = scopeCounts.household / totalScope * 100;
                    const ss = scopeCounts.street / totalScope * 100;
                    const sw = scopeCounts.ward / totalScope * 100;
                    const sc = scopeCounts.constituency / totalScope * 100;
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                          {sh > 0 && <div style={{ width: `${sh}%`, background: '#f59e0b' }} title="Household" />}
                          {ss > 0 && <div style={{ width: `${ss}%`, background: '#3b82f6' }} title="Street" />}
                          {sw > 0 && <div style={{ width: `${sw}%`, background: '#10b981' }} title="Ward" />}
                          {sc > 0 && <div style={{ width: `${sc}%`, background: '#8b5cf6' }} title="Constituency" />}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', fontSize: '9.5px', color: '#a5b4fc' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', background: '#f59e0b', borderRadius: '1px' }}></span> Household ({scopeCounts.household})
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '1px' }}></span> Street ({scopeCounts.street})
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '1px' }}></span> Ward ({scopeCounts.ward})
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', background: '#8b5cf6', borderRadius: '1px' }}></span> Constituency ({scopeCounts.constituency})
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Support Radial Progress Dial */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  {(() => {
                    const value = Math.min(Number(averageVotesPerComplaint), 25);
                    const target = 25;
                    const percentage = value / target;
                    const radius = 24;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - percentage * circumference;
                    
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <svg viewBox="0 0 60 60" style={{ width: '48px', height: '48px', overflow: 'visible', flexShrink: 0 }}>
                          <circle cx="30" cy="30" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                          <circle
                            cx="30"
                            cy="30"
                            r={radius}
                            fill="transparent"
                            stroke="#2dd4bf"
                            strokeWidth="6"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'all 0.4s ease' }}
                          />
                          <text x="30" y="34" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                            {averageVotesPerComplaint}
                          </text>
                        </svg>
                        <div>
                          <span style={{ fontSize: '10px', color: '#8e90b3', display: 'block', textTransform: 'uppercase' }}>Average Support Votes</span>
                          <span style={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}>
                            {percentage >= 0.8 ? '🎉 Active Engagement' : '📢 Moderate Engagement'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>

            {/* Bottom Analytics Panel: Submission Velocity History Trend */}
            <div className="form-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
              <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}>
                <Calendar size={18} style={{ color: '#2dd4bf' }} />
                <span>Submission History (Last 7 Days)</span>
              </h4>
              <div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-desc)', display: 'block', marginBottom: '8px' }}>
                  📈 Number of daily incoming citizen submissions:
                </span>
                {filteredDemands.length === 0 ? (
                  <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e90b3', fontSize: '12px' }}>
                    No historical logs.
                  </div>
                ) : (
                  <svg viewBox="0 0 400 120" style={{ width: '100%', height: '120px', overflow: 'visible' }}>
                    <line x1="30" y1="30" x2="380" y2="30" stroke="rgba(255,255,255,0.03)" />
                    <line x1="30" y1="60" x2="380" y2="60" stroke="rgba(255,255,255,0.03)" />
                    <line x1="30" y1="90" x2="380" y2="90" stroke="rgba(255,255,255,0.15)" />

                    {(() => {
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
                        const y = 90 - (sd.count / maxCount) * 65;
                        return { x, y, ...sd };
                      });

                      const pathDef = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      const areaDef = `${pathDef} L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`;

                      return (
                        <g>
                          <path d={areaDef} fill="url(#areaFillGradSimple)" />
                          <path d={pathDef} fill="none" stroke="#2dd4bf" strokeWidth="2.5" />
                          {points.map((p, idx) => (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#2dd4bf" strokeWidth="1.5" />
                              <text x={p.x} y="105" textAnchor="middle" fill="#8e90b3" fontSize="8.5" fontWeight="bold">
                                {p.date}
                              </text>
                              <text x={p.x} y={p.y - 8} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">
                                {p.count}
                              </text>
                            </g>
                          ))}
                          <defs>
                            <linearGradient id="areaFillGradSimple" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" />
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

            {/* Bottom Grid: Deficits Table by Neighborhood Grid */}
            <div className="form-card" style={{ padding: '20px', textAlign: 'left' }}>
              <h4 style={{ color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontSize: '1rem' }}>
                <Database size={18} />
                <span>Deficits Table by Neighborhood Grid</span>
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-desc)', margin: '0 0 16px 0' }}>
                Shows infrastructure gap indicators aggregated by coordinates (approx. 1km² zones).
              </p>
              {topZones.length === 0 ? (
                <div style={{ color: '#8e90b3', fontStyle: 'italic', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
                  No regional data clusters matching active filters.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#818cf8', fontWeight: 'bold' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left' }}>Neighborhood Grid Coordinates</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🚰 Water</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🛣️ Roads</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🏫 Education</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>🏥 Health</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>⚡ Power</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>📁 Other</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', color: '#2dd4bf' }}>Total Issues Logged</th>
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

        {/* Content Layout Grid (Only for All Submitted Complaints View) */}
        {activeTab === 'complaints' && (
          <div className="portal-grid" style={{ gridTemplateColumns: '400px 1fr' }}>
            
            {/* Left Column: Direct Submissions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '680px', paddingRight: '4px' }}>
              {clubbingMode !== 'none' ? (
                clubbedGroups.length === 0 ? (
                  <div className="empty-attachments" style={{ padding: '40px' }}>
                    <AlertTriangle size={24} />
                    <span>No clubbed issues found matching this filter criteria.</span>
                  </div>
                ) : (
                  clubbedGroups.map(g => (
                    <div 
                      key={g.id} 
                      onClick={() => setSelectedComplaint(g)}
                      style={{
                        background: selectedComplaint?.id === g.id ? 'rgba(20, 184, 166, 0.08)' : 'rgba(13, 12, 29, 0.4)',
                        border: selectedComplaint?.id === g.id ? '1px solid rgba(20, 184, 166, 0.5)' : '1px solid var(--border-light)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          📦 CLUBBED GROUP
                        </span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          background: 'rgba(255,255,255,0.08)',
                          color: 'white',
                          padding: '2px 8px', 
                          borderRadius: '8px', 
                          fontWeight: 'bold' 
                        }}>
                          {g.demands.length} items
                        </span>
                      </div>
                      <strong style={{ display: 'block', fontSize: '1rem', color: 'white', marginBottom: '4px' }}>
                        {g.name}
                      </strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-desc)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🎯 Status: {g.statusSummary}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>👍 {g.totalUpvotes} signatures</span>
                        <span style={{ color: g.avgCPI > 70 ? '#fca5a5' : '#86efac', fontWeight: 'bold' }}>🎯 CPI: {g.avgCPI}/100</span>
                      </div>
                    </div>
                  ))
                )
              ) : (
                sortedDemands.length === 0 ? (
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
                        {d.constituency && (
                          <span style={{
                            display: 'inline-block',
                            marginTop: '5px',
                            fontSize: '0.7rem',
                            background: 'rgba(99,102,241,0.18)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99,102,241,0.35)',
                            padding: '1px 7px',
                            borderRadius: '20px',
                            fontWeight: '600',
                            letterSpacing: '0.01em'
                          }}>
                            🏛️ {d.constituency}
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>👍 {d.upvotes || 1} support signatures</span>
                          <span><Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#14b8a6' }} /> {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Right Column: Comprehensive Complaint/Submission View */}
            <div>
              {selectedComplaint ? (
                selectedComplaint.id.startsWith('clubbed_') ? (
                  <ClubbedDetailPanel 
                    group={selectedComplaint} 
                    onClose={() => setSelectedComplaint(null)} 
                    loadData={loadData}
                  />
                ) : (
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

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {selectedComplaint.status !== 'verified' && selectedComplaint.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(selectedComplaint.id, 'verified')}
                          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                          <CheckCircle size={16} />
                          <span>Mark Verified</span>
                        </button>
                      )}
                      {selectedComplaint.status === 'verified' && (
                        <span style={{ color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', padding: '8px 12px', background: 'rgba(52,211,153,0.1)', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.3)' }}>
                          <CheckCircle size={16} />
                          <span>Verified</span>
                        </span>
                      )}
                      {selectedComplaint.status !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(selectedComplaint.id, 'approved')}
                          style={{ background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                          <Check size={16} />
                          <span>Approve &amp; Hotspot</span>
                        </button>
                      ) : (
                        <span style={{ color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                          <CheckCircle size={18} />
                          <span>Approved &amp; Active</span>
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
                        apiKey={localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw'}
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
                  {!selectedComplaint.aiOverview ? (
                    <div style={{ border: '1px dashed rgba(20, 184, 166, 0.4)', padding: '20px', borderRadius: '10px', background: 'rgba(20, 184, 166, 0.03)', textAlign: 'center' }}>
                      <Brain size={24} style={{ color: '#2dd4bf', marginBottom: '8px', display: 'inline-block' }} />
                      <h5 style={{ color: 'white', margin: '0 0 6px 0', fontSize: '0.95rem' }}>Grievance Awaiting AI Diagnostics Audit</h5>
                      <p style={{ color: 'var(--text-desc)', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
                        Run Google Gemini to analyze the citizen descriptions, transcripts, and OCR inputs against ministry standards to formulate a priority rating, safety risk index, and budget forecast.
                      </p>
                      <button
                        type="button"
                        onClick={() => runGeminiGrievanceAudit(selectedComplaint)}
                        disabled={isAuditing}
                        style={{
                          background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold',
                          padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem'
                        }}
                      >
                        {isAuditing ? (
                          <>
                            <Loader2 className="spinner" size={14} />
                            <span>Auditing Ticket Gaps...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>✨ Run Gemini AI Diagnostic Audit</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid rgba(20, 184, 166, 0.3)', padding: '16px', borderRadius: '8px', background: 'rgba(20, 184, 166, 0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', margin: 0 }}>
                          <Sparkles size={14} /> AI Classification & Parameters Metrics
                        </strong>
                        <button
                          type="button"
                          onClick={() => runGeminiGrievanceAudit(selectedComplaint)}
                          disabled={isAuditing}
                          style={{
                            background: 'transparent', border: '1px solid rgba(20, 184, 166, 0.4)', color: '#2dd4bf',
                            fontSize: '9.5px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                          }}
                        >
                          {isAuditing ? 'Auditing...' : '🔄 Re-Audit'}
                        </button>
                      </div>
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

                      {selectedComplaint.aiOverview.citizenResponse && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                          <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '6px' }}>
                            📝 AI-Generated Citizen Response Draft
                          </span>
                          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '8px', fontSize: '11.5px', color: 'var(--text-desc)', fontStyle: 'italic', lineHeight: '1.4' }}>
                            "{selectedComplaint.aiOverview.citizenResponse}"
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedComplaint.aiOverview.citizenResponse);
                              alert('Response draft copied to clipboard!');
                            }}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'white', fontSize: '10.5px', padding: '6px 12px', borderRadius: '4px', marginTop: '8px', cursor: 'pointer' }}
                          >
                            📋 Copy Response Draft
                          </button>
                        </div>
                      )}
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
                )
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

        {/* Tab 3: AI Thematic Clustering & Topic Synthesis */}
        {activeTab === 'clustering' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px', textAlign: 'left' }} className="no-print">
            <div className="form-card" style={{ padding: '24px 30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Brain size={22} style={{ color: '#2dd4bf' }} />
                    <span>Generative AI Thematic Topic Synthesis</span>
                  </h3>
                  <p style={{ color: 'var(--text-desc)', fontSize: '0.85rem', margin: '6px 0 0 0' }}>
                    Utilize Google Gemini to scan all incoming civic inputs and automatically group similar category or regional demands into actionable topic clusters.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '12px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 'bold' }}>Cluster Mode</span>
                    <select
                      value={aiClusterMode}
                      onChange={e => setAiClusterMode(e.target.value as any)}
                      style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px' }}
                    >
                      <option value="constituency">By Constituency</option>
                      <option value="category">By Topic Category (All India)</option>
                    </select>
                  </div>

                  {aiClusterMode === 'constituency' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', width: '220px' }}>
                      <span style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 'bold' }}>Target Constituency</span>
                      <input 
                        type="text"
                        value={aiClusterConstituencySearchQuery}
                        placeholder="🔍 Search Constituency..."
                        onChange={e => {
                          setAiClusterConstituencySearchQuery(e.target.value);
                          setShowAiClusterConstituencyDropdown(true);
                        }}
                        onFocus={() => setShowAiClusterConstituencyDropdown(true)}
                        style={{ 
                          background: '#0e0d24', 
                          color: 'white', 
                          border: '1px solid var(--border-light)', 
                          padding: '6px 10px', 
                          borderRadius: '6px', 
                          fontSize: '12.5px',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      {showAiClusterConstituencyDropdown && (() => {
                        const filtered = Object.keys(ALL_CONSTITUENCIES_DATA)
                          .filter(c => c.toLowerCase().includes(aiClusterConstituencySearchQuery.toLowerCase()))
                          .sort();
                        return (
                          <div style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            left: 0, 
                            right: 0, 
                            background: '#0d0c22', 
                            border: '1px solid rgba(255,255,255,0.15)', 
                            borderRadius: '6px', 
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
                                    setAiClusterTargetConstituency(cName);
                                    setAiClusterConstituencySearchQuery(cName);
                                    setShowAiClusterConstituencyDropdown(false);
                                  }}
                                  style={{ 
                                    padding: '8px 12px', 
                                    cursor: 'pointer', 
                                    fontSize: '12.5px',
                                    color: cName === aiClusterTargetConstituency ? '#818cf8' : 'white',
                                    background: cName === aiClusterTargetConstituency ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = cName === aiClusterTargetConstituency ? 'rgba(129, 140, 248, 0.15)' : 'transparent'; }}
                                >
                                  📍 {cName} <span style={{ color: '#8e90b3', fontSize: '11px', float: 'right' }}>({ALL_CONSTITUENCIES_DATA[cName].state})</span>
                                </div>
                              ))
                            ) : (
                              <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>No matches</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 'bold' }}>Target Category</span>
                      <select
                        value={aiClusterTargetCategory}
                        onChange={e => setAiClusterTargetCategory(e.target.value)}
                        style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px' }}
                      >
                        {["water", "roads", "education", "health", "power", "agriculture", "safety", "environment", "welfare", "housing", "anticorruption", "digital", "disaster", "women", "justice", "economy", "consumer", "taxes", "tourism", "youth", "innovation", "rural", "security", "cyber", "climate", "space", "foreign", "others"].map(cat => (
                          <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Date Range Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 'bold' }}>Start Date</span>
                    <input
                      type="date"
                      value={aiClusterStartDate}
                      onChange={e => setAiClusterStartDate(e.target.value)}
                      style={{
                        background: '#0e0d24',
                        border: '1px solid var(--border-light)',
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        colorScheme: 'dark'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#c7d2fe', fontWeight: 'bold' }}>End Date</span>
                    <input
                      type="date"
                      value={aiClusterEndDate}
                      onChange={e => setAiClusterEndDate(e.target.value)}
                      style={{
                        background: '#0e0d24',
                        border: '1px solid var(--border-light)',
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        colorScheme: 'dark'
                      }}
                    />
                  </div>
                </div>

                {/* Verified-only notice */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(52,211,153,0.07)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  color: '#6ee7b7'
                }}>
                  <CheckCircle size={14} style={{ flexShrink: 0 }} />
                  <span>Only complaints marked <strong>Verified</strong> in the Registry are eligible for clustering.</span>
                </div>

                <button
                  type="button"
                  onClick={runThematicClustering}
                  disabled={isClustering}
                  style={{
                    background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold',
                    padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  {isClustering ? (
                    <>
                      <Clock className="spinner" size={16} />
                      <span>Synthesizing Clusters...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Analyze & Cluster Submissions</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {isClustering && (
              <div className="form-card" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                <Brain className="spinner" size={48} style={{ color: '#2dd4bf' }} />
                <h4 style={{ color: 'white', margin: 0 }}>Gemini AI is Auditing Citizen Grievances...</h4>
                <p style={{ color: 'var(--text-desc)', fontSize: '0.9rem', maxWidth: '500px', textAlign: 'center', margin: 0 }}>
                  Analyzing multilingual speech transcripts, photos, and descriptions. Grouping files by semantic similarity and geocoded zones to build consensus.
                </p>
              </div>
            )}

            {!isClustering && clusteringResults.length === 0 && (
              <div className="form-card" style={{ padding: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                <Brain size={48} style={{ color: 'var(--border-light)' }} />
                <h4 style={{ color: 'var(--text-desc)', margin: 0 }}>No Surfaced Topic Clusters Yet</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Click the button above to execute the AI topic modeling engine on your current active database entries.
                </p>
              </div>
            )}

            {!isClustering && clusteringResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#2dd4bf', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    💡 Gemini surfaced {clusteringResults.length} Consolidated Development Projects
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Click cards to view detailed citizen comments and geolocations.
                  </span>
                </div>

                {clusteringResults.map((c, idx) => {
                  const allInPlan = c.ticketIds.every((id: string) => selectedPlanIds.includes(id));
                  const isExpanded = !!expandedClusters[idx];
                  
                  // Priority color
                  const priColor = 
                    c.priority.toLowerCase() === 'urgent' ? '#ef4444' : 
                    c.priority.toLowerCase() === 'high' ? '#fbbf24' :
                    c.priority.toLowerCase() === 'medium' ? '#818cf8' : '#34d399';

                  return (
                    <div 
                      key={idx}
                      className="form-card"
                      style={{
                        borderLeft: `5px solid ${priColor}`,
                        padding: '24px 28px',
                        background: 'rgba(13, 12, 29, 0.45)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.75rem', background: `rgba(255,255,255,0.06)`, border: `1px solid ${priColor}`, color: priColor, padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              Priority: {c.priority}
                            </span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              📂 {c.ticketIds.length} Linked Submissions
                            </span>
                          </div>
                          <h4 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>{c.title}</h4>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (allInPlan) {
                                // Remove all
                                setSelectedPlanIds(prev => prev.filter(id => !c.ticketIds.includes(id)));
                              } else {
                                // Add all
                                setSelectedPlanIds(prev => {
                                  const next = [...prev];
                                  c.ticketIds.forEach((id: string) => {
                                    if (!next.includes(id)) next.push(id);
                                  });
                                  return next;
                                });
                              }
                            }}
                            style={{
                              background: allInPlan ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                              border: allInPlan ? '1px solid #10b981' : '1px solid var(--border-light)',
                              color: allInPlan ? '#34d399' : 'white',
                              fontWeight: 'bold', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem'
                            }}
                          >
                            {allInPlan ? '✓ Pinned to Plan' : '📌 Pin Cluster to Plan'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedClusters(prev => ({ ...prev, [idx]: !prev[idx] }))}
                            style={{
                              background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-desc)',
                              padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <span>{isExpanded ? 'Hide Tickets' : 'View Tickets'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <strong style={{ color: '#818cf8', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>AI Cluster Rationale</strong>
                        <p style={{ color: 'var(--text-desc)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>{c.summary}</p>
                      </div>

                      <div style={{ background: 'rgba(20, 184, 166, 0.05)', border: '1px solid rgba(20, 184, 166, 0.15)', padding: '12px 16px', borderRadius: '8px' }}>
                        <strong style={{ color: '#2dd4bf', fontSize: '0.8rem', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>AI Suggested Ministry Intervention</strong>
                        <p style={{ color: 'white', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>{c.recommendedAction}</p>
                      </div>

                      {/* Accordion List of Demands */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>CONSTITUENT COMPLAINTS & SUGGESTIONS MATCHED:</span>
                          {c.ticketIds.map((tid: string) => {
                            const matchDemand = demands.find(d => d.id === tid);
                            if (!matchDemand) return null;
                            return (
                              <div 
                                key={tid} 
                                style={{
                                  background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '10px 14px', borderRadius: '6px',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                                }}
                              >
                                <div style={{ textAlign: 'left' }}>
                                  <strong style={{ fontSize: '0.85rem', color: 'white', display: 'block' }}>
                                    {matchDemand.ticketType === 'suggestion' ? '💡 Suggestion' : '⚠️ Complaint'} — {matchDemand.category.toUpperCase()}
                                  </strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-desc)', display: 'block', margin: '2px 0' }}>
                                    📍 {matchDemand.address}
                                  </span>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                                    "{matchDemand.items?.[0]?.content || matchDemand.items?.[0]?.speechTranscript || 'No description'}"
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 'bold' }}>👍 {matchDemand.upvotes || 1} votes</span>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePin(tid, 'constituency')}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: selectedConstituencyPlanIds.includes(tid) ? '#2dd4bf' : 'var(--text-muted)'
                                    }}
                                    title={selectedConstituencyPlanIds.includes(tid) ? "Remove from Constituency Plan" : "Pin to Constituency Plan"}
                                  >
                                    <MapPin size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePin(tid, 'category')}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: selectedCategoryPlanIds.includes(tid) ? '#a5b4fc' : 'var(--text-muted)'
                                    }}
                                    title={selectedCategoryPlanIds.includes(tid) ? "Remove from Category Plan" : "Pin to Category Plan"}
                                  >
                                    <FileText size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Demographic & Infrastructure Gaps Auditor */}
        {activeTab === 'datasets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px', textAlign: 'left' }} className="no-print">
            
            {/* Upper Dashboard Cards Grid */}
            <div className="role-grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              
              {/* Demographic Summary Card */}
              <div className="form-card" style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={20} />
                    <span>Constituency Demographics Profile</span>
                  </div>
                  <div style={{ position: 'relative', width: '280px', display: 'inline-block' }}>
                    {showConstituencyDropdown && (
                      <div 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, cursor: 'default' }} 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConstituencyDropdown(false);
                        }} 
                      />
                    )}
                    <input 
                      type="text"
                      value={constituencySearchQuery}
                      placeholder="🔍 Search Constituency..."
                      onChange={e => {
                        setConstituencySearchQuery(e.target.value);
                        setShowConstituencyDropdown(true);
                      }}
                      onFocus={() => setShowConstituencyDropdown(true)}
                      style={{ 
                        background: 'rgba(255,255,255,0.08)', 
                        color: 'white', 
                        border: '1px solid rgba(255,255,255,0.18)', 
                        padding: '6px 12px', 
                        borderRadius: '6px', 
                        width: '100%', 
                        boxSizing: 'border-box',
                        fontSize: '13px',
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
                          borderRadius: '6px', 
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
                                  setSelectedGlobalConstituency(cName);
                                  setConstituencySearchQuery(cName);
                                  setShowConstituencyDropdown(false);
                                }}
                                style={{ 
                                  padding: '8px 12px', 
                                  cursor: 'pointer', 
                                  fontSize: '12.5px',
                                  color: cName === selectedGlobalConstituency ? '#818cf8' : 'white',
                                  background: cName === selectedGlobalConstituency ? 'rgba(129, 140, 248, 0.15)' : 'transparent',
                                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = cName === selectedGlobalConstituency ? 'rgba(129, 140, 248, 0.15)' : 'transparent'; }}
                              >
                                📍 {cName} <span style={{ color: '#8e90b3', fontSize: '11px', float: 'right' }}>({ALL_CONSTITUENCIES_DATA[cName].state})</span>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: '8px 12px', color: '#8e90b3', fontSize: '12px', textAlign: 'center' }}>No matches found</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '6px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Total Population</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{(ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.population / 1000000).toFixed(2)} Million</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Avg Literacy Rate</span>
                    <strong style={{ fontSize: '1.2rem', color: ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.literacyRate < 60 ? '#fca5a5' : '#86efac' }}>
                      {ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.literacyRate}%
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Sex Ratio</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.sexRatio} F / 1000 M</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>State / UT</span>
                    <strong style={{ fontSize: '1.1rem', color: 'white' }}>{ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.state}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Urbanization</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.urbanization}% Urban</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>SC/ST Proportion</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{ALL_CONSTITUENCIES_DATA[selectedGlobalConstituency]?.scStPercentage}% average</strong>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  * Source: Directorate of Census Operations & NFHS-5. Demographic vulnerabilities heavily weight the Combined Priority Index.
                </span>
              </div>

              {/* Ministry Standard Benchmarks Checklist Card */}
              <div className="form-card" style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <SlidersHorizontal size={20} />
                  <span>Indian Ministry Target Compliance Metrics</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', maxHeight: '180px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'white' }}>💧 Jal Jeevan Mission (JJM)</span>
                    <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>100% tap supply (55 lpcd)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'white' }}>🛣️ Rural Road Connectivity (PMGSY)</span>
                    <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>All-weather roads to pop &gt; 500</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'white' }}>🏥 Healthcare Proximity (NHM)</span>
                    <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>PHC within 8km, sub-centre &lt; 3km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'white' }}>🏫 Primary School Access (RTE Act)</span>
                    <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>Primary school within 1 km walk</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'white' }}>🌳 Clean Air Standard (NCAP)</span>
                    <span style={{ color: '#2dd4bf', fontWeight: 'bold' }}>PM10 annual avg &lt; 60 µg/m³</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-District Deficits Table */}
            <div className="form-card" style={{ padding: '20px 24px' }}>
              <h4 style={{ color: '#2dd4bf', margin: '0 0 12px 0' }}>📂 Sub-District Infrastructure & Agriculture Deficit Auditor Matrix</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-desc)', margin: '0 0 16px 0' }}>
                Cross-referencing active assembly segments against Union Ministry standards (NFHS-5, CPCB NCAP, JJM, Census 2011) to highlight critical regional gaps.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#2dd4bf', fontWeight: 'bold' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Assembly Segment</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Total Population</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Literacy %</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>JJM Water Coverage</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>PMGSY Unconnected Roads</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>NHM Healthcare Proximity</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>RTE School Compliance</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>SBM Toilet Saturation</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>DDUGJY Power Grid</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>NCAP PM10 AQI</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Agri Yield Index</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Soil Health Saturation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getConstituencySegments(selectedGlobalConstituency).map(seg => (
                      <tr key={seg.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', textAlign: 'left' }}>📍 {seg.name}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{seg.population.toLocaleString()}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.literacyRate < 50 ? '#f87171' : 'white' }}>{seg.literacyRate}%</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.waterCoverage < 60 ? '#f87171' : '#34d399', fontWeight: 'bold' }}>
                          {seg.waterCoverage}% {seg.waterCoverage < 60 && '⚠️'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.unconnectedHabitations > 5 ? '#f87171' : 'white' }}>
                          {seg.unconnectedHabitations} villages {seg.unconnectedHabitations > 5 && '⚠️'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.avgDistanceToPHC > 8 ? '#f87171' : 'white' }}>
                          {seg.avgDistanceToPHC} km {seg.avgDistanceToPHC > 8 && '⚠️'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{seg.rteCompliance}%</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.toiletAccess < 80 ? '#f87171' : 'white' }}>{seg.toiletAccess}%</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.electricityHours < 15 ? '#f87171' : 'white' }}>
                          {seg.electricityHours} hrs/day {seg.electricityHours < 15 && '⚠️'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.aqiLevel > 100 ? '#f87171' : '#34d399', fontWeight: 'bold' }}>
                          {seg.aqiLevel} µg/m³ {seg.aqiLevel > 100 && '⚠️'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{seg.cropYieldIndex} q/ha</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: seg.soilHealthSaturation < 75 ? '#f87171' : 'white' }}>
                          {seg.soilHealthSaturation}% {seg.soilHealthSaturation < 75 && '⚠️'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grievances Ranked by Combined Priority Index (CPI) */}
            <div className="form-card" style={{ padding: '20px 24px' }}>
              <h4 style={{ color: '#818cf8', margin: '0 0 8px 0' }}>🎯 Citizen Prioritized works Ranked by CPI</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-desc)', margin: '0 0 16px 0' }}>
                Formula-ranked prioritization: <strong>CPI (0-100) = (Vote weight * 0.4) + (Infrastructure Deficit * 0.4) + (Demographic Vulnerability * 0.2)</strong>.
              </p>
              
              {filteredDemands.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No grievances matching filters to rank.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#818cf8', fontWeight: 'bold' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Ticket ID & Category</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Address / Region</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Signatures</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Govt Deficit Gap</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Demographics factor</th>
                        <th style={{ padding: '10px', textAlign: 'center', color: '#2dd4bf' }}>Combined Priority Index (CPI)</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Constituency Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredDemands]
                        .map(d => ({ ...d, cpi: calculateCombinedPriorityIndex(d, selectedGlobalConstituency) }))
                        .sort((a, b) => b.cpi - a.cpi)
                        .map(d => {
                          const gapDetails = evaluateInfrastructureGap(d.location.lat, d.location.lng, d.category, selectedGlobalConstituency);

                          
                          // CPI Color code
                          const cpiColor = d.cpi > 75 ? '#ef4444' : d.cpi > 50 ? '#fbbf24' : '#2dd4bf';

                          return (
                            <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                              <td style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 'bold' }}>
                                <span style={{ color: 'var(--text-desc)', fontSize: '10px', display: 'block' }}>Ref: {d.id}</span>
                                <span style={{ textTransform: 'capitalize' }}>
                                  {d.ticketType === 'suggestion' ? '💡' : '⚠️'} {d.category}
                                </span>
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'left', color: 'var(--text-desc)' }}>
                                📍 {d.address.split(',')[0]}
                                <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)' }}>{gapDetails.assemblyName}</span>
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>👍 {d.upvotes || 1}</td>
                              <td style={{ padding: '12px 10px', textAlign: 'center', color: gapDetails.gapPercentage > 50 ? '#fca5a5' : 'white' }}>
                                {gapDetails.gapPercentage.toFixed(0)}% Deficit
                                <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-muted)' }}>({gapDetails.localMetric})</span>
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-desc)' }}>
                                {getClosestConstituencySegment(d.location.lat, d.location.lng).scStPercentage > 18 ? 'High SC/ST' : 'General Rural'}
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                                <span style={{ display: 'inline-block', background: `${cpiColor}15`, color: cpiColor, border: `1px solid ${cpiColor}`, padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px' }}>
                                  {d.cpi} / 100
                                </span>
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePin(d.id, 'constituency')}
                                    style={{
                                      background: selectedConstituencyPlanIds.includes(d.id) ? '#14b8a6' : 'transparent',
                                      border: selectedConstituencyPlanIds.includes(d.id) ? 'none' : '1px solid rgba(20, 184, 166, 0.4)',
                                      color: selectedConstituencyPlanIds.includes(d.id) ? '#000' : '#2dd4bf',
                                      fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', width: '130px'
                                    }}
                                  >
                                    {selectedConstituencyPlanIds.includes(d.id) ? '✓ Pinned (Const)' : '🏛️ Pin Constituency'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePin(d.id, 'category')}
                                    style={{
                                      background: selectedCategoryPlanIds.includes(d.id) ? '#6366f1' : 'transparent',
                                      border: selectedCategoryPlanIds.includes(d.id) ? 'none' : '1px solid rgba(99, 102, 241, 0.4)',
                                      color: selectedCategoryPlanIds.includes(d.id) ? '#000' : '#a5b4fc',
                                      fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', width: '130px'
                                    }}
                                  >
                                    {selectedCategoryPlanIds.includes(d.id) ? '✓ Pinned (Categ)' : '🏷️ Pin Category'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 5: Lok Sabha Proposal Builder & Print View */}
        {activeTab === 'proposal' && (
          <div style={{ marginBottom: '32px' }}>
            
            {/* Split Type Selector Tab Header */}
            <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
              <button
                type="button"
                onClick={() => {
                  setProposalType('constituency');
                  setActionPlan(null);
                }}
                style={{
                  background: proposalType === 'constituency' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.2)',
                  border: proposalType === 'constituency' ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                  color: proposalType === 'constituency' ? '#2dd4bf' : '#8e90b3',
                  padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>🏛️ Constituency-Based Plan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProposalType('category');
                  setActionPlan(null);
                }}
                style={{
                  background: proposalType === 'category' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(0,0,0,0.2)',
                  border: proposalType === 'category' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  color: proposalType === 'category' ? '#a5b4fc' : '#8e90b3',
                  padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>🏷️ Category-Based Plan (Topic)</span>
              </button>
            </div>

            {/* Web View workspace layout */}
            <div className="portal-grid no-print" style={{ gridTemplateColumns: '440px 1fr', gap: '24px', textAlign: 'left' }}>
              
              {/* Left Column: Plan and Budget workspace panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Plan profile input card */}
                <div className="form-card" style={{ padding: '20px' }}>
                  <h4 style={{ color: 'white', margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={18} style={{ color: '#2dd4bf' }} />
                    <span>
                      {proposalType === 'constituency' ? 'Constituency Plan Profile' : 'Category Plan Profile'}
                    </span>
                  </h4>
                  <div className="input-group">
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Proposal Title / Name</label>
                    <input 
                      type="text" 
                      value={customPlanName} 
                      onChange={e => setCustomPlanName(e.target.value)} 
                      style={{ padding: '10px', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  {proposalType === 'category' && (
                    <div className="input-group" style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Target Category</label>
                      <select
                        value={targetPlanCategory}
                        onChange={e => setTargetPlanCategory(e.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', fontSize: '13px', background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', width: '100%', fontWeight: '600' }}
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
                    </div>
                  )}
                </div>

                {/* Selected priorities plan items card */}
                <div className="form-card" style={{ padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ color: '#818cf8', margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} />
                    <span>Plan Priority Items ({selectedPlanIds.length})</span>
                  </h4>
                  
                  {selectedPlanIds.length === 0 ? (
                    <div style={{ margin: 'auto 0', padding: '40px 0', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                      No items pinned to this plan. Visit "Demographic Gaps" or "AI Clustering" tabs to pin priorities.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
                      {demands.filter(d => selectedPlanIds.includes(d.id)).map(d => {
                        const cost = getProjectCostEstimate(d.category, d.scope);
                        return (
                          <div 
                            key={d.id}
                            style={{
                              background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '10px 12px', borderRadius: '6px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px'
                            }}
                          >
                            <div style={{ overflow: 'hidden' }}>
                              <strong style={{ fontSize: '0.8rem', color: 'white', textTransform: 'capitalize', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {d.ticketType === 'suggestion' ? '💡' : '⚠️'} {d.category} Need (ref: {d.id})
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Est. Cost: ₹{(cost / 100000).toFixed(1)} Lakhs | {d.constituency || 'Rampur'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPlanIds(prev => prev.filter(id => id !== d.id))}
                              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedPlanIds.length > 0 && (
                    <button
                      type="button"
                      onClick={generateParliamentBrief}
                      disabled={isGeneratingProposal}
                      style={{
                        background: 'var(--mp-grad)', border: 'none', color: 'white', fontWeight: 'bold',
                        padding: '12px', borderRadius: '8px', cursor: 'pointer', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      {isGeneratingProposal ? (
                        <>
                          <Clock className="spinner" size={16} />
                          <span>Generating Action Plan...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Generate AI Action Plan</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>

              {/* Right Column: AI Action Plan Workspace Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-card" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', padding: '24px 30px' }}>
                  
                  {/* Header Actions Panel */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                      <Brain size={20} style={{ color: '#2dd4bf' }} />
                      <span>AI Development Plan & Action Steps</span>
                    </h3>
                    
                    {actionPlan && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (actionPlan.isApproved) return; // Disallow toggle/reverting once approved
                            const next = { ...actionPlan, isApproved: true };
                            setActionPlan(next);
                            await handleSaveActivePlan(next);
                            
                            // Synchronize citizen complaints status to 'approved'
                            for (const id of next.associatedComplaintIds || selectedPlanIds) {
                              await updateDemandStatus(id, 'approved');
                            }
                            
                            alert("Action Plan has been approved and is now visible on the MP's dashboard!");
                            loadData(); // reload approved plans list at the bottom
                          }}
                          disabled={actionPlan.isApproved}
                          style={{
                            background: actionPlan.isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.1)',
                            border: actionPlan.isApproved ? '1px solid #10b981' : '1px solid rgba(251, 191, 36, 0.4)',
                            color: actionPlan.isApproved ? '#34d399' : '#fbbf24',
                            padding: '8px 16px', borderRadius: '6px', cursor: actionPlan.isApproved ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold'
                          }}
                        >
                          {actionPlan.isApproved ? '✓ Approved & Sent' : '⚠️ Approve & Publish'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleUpdatePlanWithGemini}
                          disabled={isGeneratingProposal || actionPlan.isApproved}
                          style={{
                            background: 'rgba(129, 140, 248, 0.15)', border: '1px solid rgba(129, 140, 248, 0.4)', color: '#a5b4fc',
                            padding: '8px 16px', borderRadius: '6px', cursor: actionPlan.isApproved ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          {isGeneratingProposal ? <Loader2 size={12} className="spinner" /> : <Sparkles size={12} />}
                          <span>Refine Edits with AI</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await handleSaveActivePlan(actionPlan);
                            alert("Action Plan draft successfully saved!");
                          }}
                          disabled={actionPlan.isApproved}
                          style={{
                            background: 'rgba(32, 184, 166, 0.1)', border: '1px solid rgba(32, 184, 166, 0.4)', color: '#2dd4bf',
                            padding: '8px 16px', borderRadius: '6px', cursor: actionPlan.isApproved ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold'
                          }}
                        >
                          💾 Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', color: 'white',
                            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold'
                          }}
                        >
                          <Printer size={14} />
                          <span>Print Plan</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {!actionPlan && !isGeneratingProposal && (
                    <div style={{ margin: 'auto', padding: '60px 0', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                      Select plan issues on the left and click "Generate AI Action Plan" to compile citizen priorities with ministry benchmarks using Gemini.
                    </div>
                  )}

                  {isGeneratingProposal && (
                    <div style={{ margin: 'auto', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <Loader2 className="spinner" size={32} style={{ color: '#fbbf24' }} />
                      <span style={{ color: 'var(--text-desc)' }}>Gemini AI is drafting step-by-step actions and comparing data...</span>
                    </div>
                  )}

                  {actionPlan && !isGeneratingProposal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flexGrow: 1 }}>
                      
                      {/* Meta Profile Inputs */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>PLAN TITLE</label>
                          <input 
                            type="text"
                            value={actionPlan.planName}
                            disabled={actionPlan.isApproved}
                            onChange={e => setActionPlan({ ...actionPlan, planName: e.target.value })}
                            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', color: 'white', borderRadius: '6px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>EXECUTIVE PLAN SUMMARY</label>
                          <textarea 
                            value={actionPlan.summary}
                            rows={1}
                            disabled={actionPlan.isApproved}
                            onChange={e => setActionPlan({ ...actionPlan, summary: e.target.value })}
                            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', color: 'white', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }}
                          />
                        </div>
                      </div>

                      {/* Interactive CSS Flowchart Diagram */}
                      <div>
                        <span style={{ fontSize: '11px', color: '#2dd4bf', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '8px' }}>
                          🎯 Project Execution Flowchart Timeline
                        </span>
                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '8px 0', borderBottom: '1px solid var(--border-light)', marginBottom: '10px' }}>
                          {actionPlan.flowchart.map((step: any, idx: number) => (
                            <React.Fragment key={idx}>
                              <div style={{
                                background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.3)',
                                borderRadius: '12px', padding: '12px', minWidth: '200px', flex: '1', textAlign: 'left',
                                position: 'relative'
                              }}>
                                <span style={{ fontSize: '10px', color: '#2dd4bf', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>
                                  ⌛ {step.duration}
                                </span>
                                <input
                                  type="text"
                                  value={step.phase}
                                  disabled={actionPlan.isApproved}
                                  onChange={e => {
                                    const nextFlow = [...actionPlan.flowchart];
                                    nextFlow[idx] = { ...step, phase: e.target.value };
                                    setActionPlan({ ...actionPlan, flowchart: nextFlow });
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'white', fontWeight: 'bold', fontSize: '12px', margin: '4px 0 2px 0', padding: 0, width: '100%' }}
                                />
                                <textarea
                                  value={step.description}
                                  rows={2}
                                  disabled={actionPlan.isApproved}
                                  onChange={e => {
                                    const nextFlow = [...actionPlan.flowchart];
                                    nextFlow[idx] = { ...step, description: e.target.value };
                                    setActionPlan({ ...actionPlan, flowchart: nextFlow });
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-desc)', fontSize: '10.5px', padding: 0, resize: 'none', width: '100%', outline: 'none' }}
                                />
                              </div>
                              {idx < actionPlan.flowchart.length - 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', color: '#2dd4bf', fontSize: '20px', userSelect: 'none' }}>➔</div>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Detailed Project steps spreadsheet */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>
                          🛠️ Target Action Items & Budget Allocations
                        </span>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '280px', paddingRight: '4px' }}>
                          {actionPlan.detailedSteps.map((step: any, idx: number) => (
                            <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px' }}>
                                <input 
                                  type="text"
                                  value={step.title}
                                  disabled={actionPlan.isApproved}
                                  onChange={e => {
                                    const nextSteps = [...actionPlan.detailedSteps];
                                    nextSteps[idx] = { ...step, title: e.target.value };
                                    setActionPlan({ ...actionPlan, detailedSteps: nextSteps });
                                  }}
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', color: 'white', fontSize: '12px', padding: '6px 10px', borderRadius: '4px', fontWeight: 'bold' }}
                                />
                                <input 
                                  type="text"
                                  value={step.agency}
                                  placeholder="Responsible Agency"
                                  disabled={actionPlan.isApproved}
                                  onChange={e => {
                                    const nextSteps = [...actionPlan.detailedSteps];
                                    nextSteps[idx] = { ...step, agency: e.target.value };
                                    setActionPlan({ ...actionPlan, detailedSteps: nextSteps });
                                  }}
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', color: '#2dd4bf', fontSize: '11px', padding: '6px 10px', borderRadius: '4px' }}
                                />
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₹</span>
                                  <input 
                                    type="number"
                                    value={step.cost}
                                    disabled={actionPlan.isApproved}
                                    onChange={e => {
                                      const nextSteps = [...actionPlan.detailedSteps];
                                      nextSteps[idx] = { ...step, cost: parseFloat(e.target.value) || 0 };
                                      setActionPlan({ ...actionPlan, detailedSteps: nextSteps });
                                    }}
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', color: '#fbbf24', fontSize: '11px', padding: '6px 10px', borderRadius: '4px', width: '100%', fontWeight: 'bold' }}
                                  />
                                </div>
                              </div>
                              <textarea 
                                value={step.description}
                                rows={2}
                                disabled={actionPlan.isApproved}
                                onChange={e => {
                                  const nextSteps = [...actionPlan.detailedSteps];
                                  nextSteps[idx] = { ...step, description: e.target.value };
                                  setActionPlan({ ...actionPlan, detailedSteps: nextSteps });
                                }}
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', color: 'var(--text-desc)', fontSize: '11px', padding: '8px 10px', borderRadius: '4px', resize: 'vertical' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Section: Approved Action Plans categorized by type */}
            <div className="form-card no-print" style={{ marginTop: '24px', padding: '24px 30px', textAlign: 'left' }}>
              <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <CheckCircle size={20} style={{ color: '#10b981' }} />
                <span>Approved Action Plans Ledger</span>
              </h3>
              
              {allActionPlans.filter(p => p.isApproved).length === 0 ? (
                <div style={{ padding: '30px 0', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                  No approved action plans found. Publish a plan above to sync it with the MP Portal.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Category 1: Constituency Plans */}
                  <div>
                    <h4 style={{ color: '#2dd4bf', fontSize: '14px', margin: '0 0 10px 0', borderBottom: '1px dashed rgba(20, 184, 166, 0.2)', paddingBottom: '6px' }}>
                      🏛️ Constituency-Based Development Blueprints
                    </h4>
                    {allActionPlans.filter(p => p.isApproved && !(p.planType === 'category' || p.id.startsWith('plan_category_'))).length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No approved constituency action plans.</span>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {allActionPlans.filter(p => p.isApproved && !(p.planType === 'category' || p.id.startsWith('plan_category_'))).map((plan) => (
                          <div key={plan.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(20, 184, 166, 0.3)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                              <strong style={{ fontSize: '14px', color: 'white', display: 'block' }}>{plan.planName}</strong>
                              <span style={{ fontSize: '11px', color: '#2dd4bf' }}>Constituency: {plan.constituency}</span>
                              <p style={{ color: 'var(--text-desc)', fontSize: '12px', margin: '8px 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {plan.summary}
                              </p>
                            </div>
                            <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                              <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>
                                ₹{((plan.detailedSteps || []).reduce((acc: number, s: any) => acc + (s.cost || 0), 0) / 100000).toFixed(1)} Lakhs
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProposalType('constituency');
                                  setActionPlan(plan);
                                  setSelectedPlanIds(plan.associatedComplaintIds || []);
                                }}
                                style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                View details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category 2: Topic Plans */}
                  <div>
                    <h4 style={{ color: '#a5b4fc', fontSize: '14px', margin: '0 0 10px 0', borderBottom: '1px dashed rgba(99, 102, 241, 0.2)', paddingBottom: '6px' }}>
                      🏷️ Category-Based Topic Plans (Pan-India Context)
                    </h4>
                    {allActionPlans.filter(p => p.isApproved && (p.planType === 'category' || p.id.startsWith('plan_category_'))).length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No approved category topic action plans.</span>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {allActionPlans.filter(p => p.isApproved && (p.planType === 'category' || p.id.startsWith('plan_category_'))).map((plan) => (
                          <div key={plan.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                              <strong style={{ fontSize: '14px', color: 'white', display: 'block' }}>{plan.planName}</strong>
                              <span style={{ fontSize: '11px', color: '#a5b4fc', textTransform: 'capitalize' }}>Category Focus: {plan.category}</span>
                              <p style={{ color: 'var(--text-desc)', fontSize: '12px', margin: '8px 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {plan.summary}
                              </p>
                            </div>
                            <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                              <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>
                                ₹{((plan.detailedSteps || []).reduce((acc: number, s: any) => acc + (s.cost || 0), 0) / 100000).toFixed(1)} Lakhs
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProposalType('category');
                                  setTargetPlanCategory(plan.category || 'water');
                                  setActionPlan(plan);
                                  setSelectedPlanIds(plan.associatedComplaintIds || []);
                                }}
                                style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                View details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Hidden Printable Card: Rendered only during window.print() */}
            {actionPlan && (
              <div 
                id="printable-proposal-card" 
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
                    {proposalType === 'constituency' ? `${actionPlan.constituency} Lok Sabha Constituency` : `Topic focus: ${actionPlan.category?.toUpperCase()}`}
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
                        <td style={{ padding: '6px 0' }}>{actionPlan.planName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0' }}><strong>Executive Summary:</strong></td>
                        <td style={{ padding: '6px 0', fontStyle: 'italic' }}>{actionPlan.summary}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0' }}><strong>Planned Project Count:</strong></td>
                        <td style={{ padding: '6px 0' }}>{actionPlan.detailedSteps?.length || 0} target sites</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0' }}><strong>Total Fund Ledger Cost:</strong></td>
                        <td style={{ padding: '6px 0', fontWeight: 'bold' }}>₹{(((actionPlan.detailedSteps || []).reduce((acc: number, s: any) => acc + (s.cost || 0), 0)) / 100000).toFixed(1)} Lakhs</td>
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
                      {(actionPlan.flowchart || []).map((step: any, idx: number) => (
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
                      {(actionPlan.detailedSteps || []).map((step: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{step.id}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #ddd', fontWeight: 'bold' }}>{step.title}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #ddd' }}>{step.description}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #ddd', color: '#2b2214' }}>{step.agency}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}>
                            ₹{((step.cost || 0) / 100000).toFixed(1)} L
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

            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-proposal-card, #printable-proposal-card * {
                  visibility: visible !important;
                }
                #printable-proposal-card {
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
          </div>
        )}

        {/* Tab 6: Progress Tracking Page */}
        {activeTab === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px', textAlign: 'left' }} className="no-print">
            <div className="form-card" style={{ padding: '24px 30px' }}>
              <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0' }}>
                <CheckCircle size={22} style={{ color: '#2dd4bf' }} />
                <span>AI Constituency Action Plan Progress & Execution Tracker</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', color: '#c7d2fe', fontWeight: 'bold' }}>
                  Select Development Plan to Track:
                </label>
                <select
                  value={selectedTrackingPlan?.id || ''}
                  onChange={e => {
                    const plan = allActionPlans.find(p => p.id === e.target.value);
                    setSelectedTrackingPlan(plan || null);
                  }}
                  style={{ background: '#0e0d24', border: '1px solid var(--border-light)', color: 'white', padding: '10px 14px', borderRadius: '8px', fontWeight: '600', maxWidth: '400px' }}
                >
                  <option value="">-- Choose an Approved Action Plan --</option>
                  <optgroup label="🏛️ Constituency-Based Action Plans">
                    {allActionPlans.filter(p => p.isApproved && !(p.planType === 'category' || p.id.startsWith('plan_category_'))).map(p => (
                      <option key={p.id} value={p.id}>{p.planName || p.id} ({p.constituency})</option>
                    ))}
                  </optgroup>
                  <optgroup label="🏷️ Category-Based Topic Plans">
                    {allActionPlans.filter(p => p.isApproved && (p.planType === 'category' || p.id.startsWith('plan_category_'))).map(p => (
                      <option key={p.id} value={p.id}>{p.planName || p.id} ({p.category || 'General'})</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {!selectedTrackingPlan ? (
                <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                  <Database size={36} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '8px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                    Please select an approved development action plan from the dropdown above to track its execution.
                  </p>
                  <p style={{ color: 'var(--text-desc)', fontSize: '12px', marginTop: '6px' }}>
                    If no plans appear, go to <strong>Lok Sabha Proposal</strong> or use the <strong>Group by Constituency/Nature</strong> option in Tab 2 to generate and approve an Action Plan.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Plan Header details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <h4 style={{ fontSize: '1.25rem', color: 'white', margin: 0 }}>{selectedTrackingPlan.planName}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-desc)', margin: '6px 0 0 0' }}>{selectedTrackingPlan.summary}</p>
                      <p style={{ fontSize: '11px', color: '#8e90b3', margin: '4px 0 0 0' }}>Target Constituency: <strong>{selectedTrackingPlan.constituency}</strong> | Last Updated: {new Date(selectedTrackingPlan.updatedAt || '').toLocaleString()}</p>
                      
                      <div style={{ marginTop: '12px' }}>
                        <button
                          onClick={() => runAIProgressAudit(selectedTrackingPlan)}
                          disabled={isAuditingProgress}
                          style={{
                            background: 'rgba(45, 212, 191, 0.15)', border: '1px solid rgba(45, 212, 191, 0.4)', color: '#2dd4bf',
                            padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          {isAuditingProgress ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          <span>Run AI Implementation Audit</span>
                        </button>
                        {progressAuditResult && (
                          <div style={{ marginTop: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-light)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: '#c7d2fe', lineHeight: '1.4' }}>
                            <strong>🤖 Gemini Progress Insight:</strong> {progressAuditResult}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>TOTAL BUDGET LEDGER</span>
                      <strong style={{ fontSize: '1.4rem', color: '#fbbf24' }}>
                        ₹{((selectedTrackingPlan.detailedSteps || []).reduce((acc: number, s: any) => acc + (s.cost || 0), 0) / 100000).toFixed(1)} Lakhs
                      </strong>
                    </div>
                  </div>

                  {/* Step list with progress checkmarks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h4 style={{ color: 'white', fontSize: '15px', margin: '0 0 4px 0' }}>Plan Implementation Progress Checklist</h4>
                    
                    {(selectedTrackingPlan.detailedSteps || []).map((step: any, idx: number) => {
                      const currentStatus = step.status || 'proposed';
                      
                      const handleStatusChange = async (newStatus: string) => {
                        const updatedPlan = { ...selectedTrackingPlan };
                        updatedPlan.detailedSteps[idx].status = newStatus;
                        
                        const planKey = selectedTrackingPlan.id.replace(/^plan_/, '');
                        await saveActionPlanByConstituency(planKey, updatedPlan);
                        setSelectedTrackingPlan(updatedPlan);
                        
                        let complaintStatus = 'reviewed';
                        if (newStatus === 'completed') complaintStatus = 'completed';
                        else if (newStatus === 'work_started') complaintStatus = 'work_started';
                        else if (newStatus === 'funded') complaintStatus = 'funded';
                        else if (newStatus === 'raised') complaintStatus = 'raised';

                        for (const complaintId of selectedTrackingPlan.associatedComplaintIds || []) {
                          await updateDemandStatus(complaintId, complaintStatus);
                        }
                        
                        alert(`Step "${step.title}" marked as ${newStatus.toUpperCase()}. Associated citizen complaints status synchronized successfully!`);
                        loadData();
                      };

                      return (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <h5 style={{ color: 'white', fontSize: '14px', margin: 0 }}>
                                <span style={{ color: '#2dd4bf', marginRight: '6px' }}>{step.id}:</span> {step.title}
                              </h5>
                              <p style={{ fontSize: '12.5px', color: 'var(--text-desc)', margin: '4px 0 0 0' }}>{step.description}</p>
                              <span style={{ fontSize: '11px', color: '#8e90b3', display: 'block', marginTop: '4px' }}>
                                Responsible Agency: <strong>{step.agency || 'N/A'}</strong> | Budget: <strong>₹{(step.cost || 0).toLocaleString()}</strong>
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {[
                                { val: 'proposed', label: 'Proposed', color: '#8e90b3' },
                                { val: 'raised', label: 'Speech Raised', color: '#818cf8' },
                                { val: 'funded', label: 'Funded', color: '#fbbf24' },
                                { val: 'work_started', label: 'Work Started', color: '#60a5fa' },
                                { val: 'completed', label: 'Completed', color: '#34d399' }
                              ].map(st => {
                                const active = currentStatus === st.val;
                                return (
                                  <button
                                    key={st.val}
                                    type="button"
                                    onClick={() => handleStatusChange(st.val)}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      border: '1px solid',
                                      borderColor: active ? st.color : 'rgba(255,255,255,0.08)',
                                      background: active ? `${st.color}1c` : 'transparent',
                                      color: active ? st.color : '#8e90b3',
                                      fontWeight: active ? 'bold' : 'normal',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {active ? '● ' : ''}{st.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

interface ClubbedDetailPanelProps {
  group: any;
  onClose: () => void;
  loadData: () => Promise<void>;
}

function ClubbedDetailPanel({ group, onClose, loadData }: ClubbedDetailPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [planDraft, setPlanDraft] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const checkExistingPlan = async () => {
      const plan = await getActionPlanByConstituency(group.key);
      if (plan) {
        setPlanDraft(plan);
      } else {
        setPlanDraft(null);
      }
    };
    checkExistingPlan();
  }, [group.key]);

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setAiError(null);
    const geminiKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';

    try {
      const complaintsText = group.demands.map((d: any, idx: number) => 
        `Grievance #${idx+1}: Category: ${d.category}, Address: ${d.address}, Scope: ${d.scope}, Description: ${d.items?.[0]?.content || d.items?.[0]?.speechTranscript || 'No description'}, Upvotes: ${d.upvotes || 1}`
      ).join('\n');

      const prompt = `
        You are an expert public policy advisor. The following is a list of citizen grievances in ${group.name}:
        
        ${complaintsText}
        
        Generate a 4-step Development Plan with action steps, a cost estimate (in Rupees) for each step, and funding recommendations.
        Return ONLY a clean JSON object containing the plan, formatted exactly like this (do not wrap in markdown blocks or backticks, just raw json):
        {
          "planName": "AI Development Plan for ${group.name}",
          "summary": "Provide a 1-2 sentence executive summary of the plan.",
          "detailedSteps": [
            {
              "id": "STEP-1",
              "title": "Title of step 1",
              "description": "Action step details",
              "agency": "Responsible government department",
              "cost": 1500000,
              "status": "proposed"
            },
            {
              "id": "STEP-2",
              "title": "Title of step 2",
              "description": "Action step details",
              "agency": "Responsible government department",
              "cost": 2200000,
              "status": "proposed"
            },
            {
              "id": "STEP-3",
              "title": "Title of step 3",
              "description": "Action step details",
              "agency": "Responsible government department",
              "cost": 800000,
              "status": "proposed"
            },
            {
              "id": "STEP-4",
              "title": "Title of step 4",
              "description": "Action step details",
              "agency": "Responsible government department",
              "cost": 3500000,
              "status": "proposed"
            }
          ],
          "flowchart": [
            { "phase": "Phase 1", "duration": "1-2 Months", "description": "Phase 1 activities" },
            { "phase": "Phase 2", "duration": "2-4 Months", "description": "Phase 2 activities" },
            { "phase": "Phase 3", "duration": "4-6 Months", "description": "Phase 3 activities" },
            { "phase": "Phase 4", "duration": "6-12 Months", "description": "Phase 4 activities" }
          ]
        }
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate: HTTP ${response.status}`);
      }

      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsedPlan = safeJsonParse(text);
      
      parsedPlan.associatedComplaintIds = group.demands.map((d: any) => d.id);
      parsedPlan.constituency = group.constituency;
      parsedPlan.category = group.category;
      parsedPlan.planType = group.clusterType;
      parsedPlan.isApproved = false;
      
      setPlanDraft(parsedPlan);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error communicating with Gemini');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    if (!planDraft) return;
    const steps = [...planDraft.detailedSteps];
    if (direction === 'up' && idx > 0) {
      const temp = steps[idx];
      steps[idx] = steps[idx - 1];
      steps[idx - 1] = temp;
    } else if (direction === 'down' && idx < steps.length - 1) {
      const temp = steps[idx];
      steps[idx] = steps[idx + 1];
      steps[idx + 1] = temp;
    }
    steps.forEach((step: any, i: number) => {
      step.id = `STEP-${i + 1}`;
    });
    setPlanDraft({ ...planDraft, detailedSteps: steps });
  };

  const handleApprovePlan = async () => {
    if (!planDraft) return;
    try {
      const planPayload = {
        ...planDraft,
        isApproved: true,
        updatedAt: new Date().toISOString()
      };
      await saveActionPlanByConstituency(group.key, planPayload);
      
      for (const id of planPayload.associatedComplaintIds || []) {
        await updateDemandStatus(id, 'approved');
      }

      alert('AI Development Plan successfully approved and published to the MP Portal!');
      setPlanDraft(planPayload);
      loadData();
    } catch (err: any) {
      alert(`Failed to save plan: ${err.message}`);
    }
  };

  return (
    <div className="form-card" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left', padding: '24px 30px' }}>
      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
            CLUBBED GROUP DETAILS
          </span>
          <h3 style={{ fontSize: '1.4rem', color: 'white', marginTop: '8px', marginBottom: 0 }}>
            {group.name}
          </h3>
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Back
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SUPPORT SUMMARY</span>
          <h4 style={{ fontSize: '1.2rem', color: '#fbbf24', margin: '4px 0 0 0' }}>👍 {group.totalUpvotes} Support Signatures</h4>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PRIORITY ORDER</span>
          <h4 style={{ fontSize: '1.2rem', color: '#fca5a5', margin: '4px 0 0 0' }}>🎯 Avg CPI: {group.avgCPI}/100</h4>
        </div>
      </div>

      <div>
        <h4 style={{ color: 'white', fontSize: '14px', marginBottom: '10px' }}>Constituent Tickets ({group.demands.length})</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {group.demands.map((d: any) => (
            <div key={d.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e90b3', marginBottom: '4px' }}>
                <span>ID: {d.id} ({d.category})</span>
                <span style={{ color: '#fbbf24' }}>👍 {d.upvotes} votes</span>
              </div>
              <p style={{ margin: 0, color: 'white', fontWeight: 'bold' }}>📍 {d.address}</p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-desc)', fontStyle: 'italic' }}>
                "{d.items?.[0]?.content || d.items?.[0]?.speechTranscript || 'No text content'}"
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sparkles size={18} style={{ color: '#2dd4bf' }} />
          <span>AI Constituency Development Plan & Action Steps</span>
        </h3>

        {aiError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '14px' }}>
            ⚠️ {aiError}
          </div>
        )}

        {!planDraft ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--text-desc)', fontSize: '13px', marginBottom: '16px' }}>
              No Development Action Plan configured for this clubbed group. Generate one to map out execution phases and budget allocations.
            </p>
            <button
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              style={{ background: 'var(--manager-grad)', border: 'none', color: 'white', fontWeight: 'bold', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>{isGenerating ? 'Generating Plan...' : 'Generate Plan using Gemini AI'}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ color: '#a5b4fc', margin: 0 }}>Proposed Plan: {planDraft.planName}</h4>
              {planDraft.isApproved ? (
                <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={14} /> Approved & Published
                </span>
              ) : (
                <button
                  onClick={handleApprovePlan}
                  style={{ background: '#10b981', border: 'none', color: 'white', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                >
                  Approve & Publish to MP Portal
                </button>
              )}
            </div>
            <p style={{ fontStyle: 'italic', fontSize: '12.5px', color: 'var(--text-desc)', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '6px', margin: 0 }}>
              "{planDraft.summary}"
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {planDraft.detailedSteps.map((step: any, idx: number) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: 'white', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {step.id}: <input 
                        type="text" 
                        value={step.title} 
                        disabled={planDraft.isApproved}
                        onChange={e => {
                          const steps = [...planDraft.detailedSteps];
                          steps[idx].title = e.target.value;
                          setPlanDraft({ ...planDraft, detailedSteps: steps });
                        }}
                        style={{ background: 'transparent', border: planDraft.isApproved ? 'none' : '1px solid var(--border-light)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', width: '220px' }}
                      />
                      {!planDraft.isApproved && (
                        <span style={{ display: 'inline-flex', gap: '2px' }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStep(idx, 'up')}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '1px 5px', borderRadius: '3px', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: '9px' }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === planDraft.detailedSteps.length - 1}
                            onClick={() => handleMoveStep(idx, 'down')}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '1px 5px', borderRadius: '3px', cursor: idx === planDraft.detailedSteps.length - 1 ? 'not-allowed' : 'pointer', fontSize: '9px' }}
                          >
                            ▼
                          </button>
                        </span>
                      )}
                    </span>
                    <span style={{ color: '#fbbf24', fontSize: '12.5px', fontWeight: 'bold' }}>
                      Est Cost: ₹
                      <input 
                        type="number" 
                        value={step.cost}
                        disabled={planDraft.isApproved}
                        onChange={e => {
                          const steps = [...planDraft.detailedSteps];
                          steps[idx].cost = parseFloat(e.target.value) || 0;
                          setPlanDraft({ ...planDraft, detailedSteps: steps });
                        }}
                        style={{ background: 'transparent', border: planDraft.isApproved ? 'none' : '1px solid var(--border-light)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '12.5px', width: '100px', fontWeight: 'bold', textAlign: 'right' }}
                      />
                    </span>
                  </div>
                  <textarea
                    value={step.description}
                    disabled={planDraft.isApproved}
                    rows={2}
                    onChange={e => {
                      const steps = [...planDraft.detailedSteps];
                      steps[idx].description = e.target.value;
                      setPlanDraft({ ...planDraft, detailedSteps: steps });
                    }}
                    style={{ background: 'transparent', border: planDraft.isApproved ? 'none' : '1px solid var(--border-light)', color: 'var(--text-desc)', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', resize: 'vertical' }}
                  />
                  <div style={{ fontSize: '11px', color: '#8e90b3' }}>
                    Responsible Agency: <input 
                      type="text" 
                      value={step.agency} 
                      disabled={planDraft.isApproved}
                      onChange={e => {
                        const steps = [...planDraft.detailedSteps];
                        steps[idx].agency = e.target.value;
                        setPlanDraft({ ...planDraft, detailedSteps: steps });
                      }}
                      style={{ background: 'transparent', border: planDraft.isApproved ? 'none' : '1px solid var(--border-light)', color: '#8e90b3', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', width: '150px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!planDraft.isApproved && (
              <button 
                onClick={() => setPlanDraft(null)}
                style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-start' }}
              >
                Reset Draft
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ManagerConsole />
  </React.StrictMode>
);
