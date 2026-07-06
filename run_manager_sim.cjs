const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyADllQ8Um7qsJ4trH5WkRCWfVvHVh_qpp4",
  authDomain: "jansetu-ef57d.firebaseapp.com",
  projectId: "jansetu-ef57d",
  storageBucket: "jansetu-ef57d.firebasestorage.app",
  messagingSenderId: "219029213168",
  appId: "1:219029213168:web:a6767bd2efe3bfa3101735",
  measurementId: "G-4X9G3G92V1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mock implementation of helper functions to trace issues
const RAMPUR_SEGMENTS_DATA = {
  rampur_town: { name: 'Rampur Town Assembly Segment', centerCoords: { lat: 28.803, lng: 79.025 }, waterCoverage: 91.5, unconnectedHabitations: 0, avgDistanceToPHC: 2.1, rteCompliance: 98.4, toiletAccess: 97.2, aqiLevel: 145, electricityHours: 22, cropYieldIndex: 44.5, soilHealthSaturation: 95.0 }
};

function getClosestConstituencySegment(lat, lng) {
  return RAMPUR_SEGMENTS_DATA.rampur_town;
}

function calculateCombinedPriorityIndex(d, constituencyName) {
  const isNeedsInfo = d.status === 'needs_info' || d.needsMoreInfo;
  const firstItemContent = d.items?.[0]?.content || '';
  const hasPhoto = d.items?.some((i) => i.type === 'photo');
  const isComplete = !isNeedsInfo && (firstItemContent.length >= 35 || hasPhoto);
  const completenessBonus = isComplete ? 25 : 0;
  const votes = d.upvotes || 1;
  const voteScore = Math.min(100, (votes / 50) * 100);
  let basePriority = d.aiOverview?.priorityScore || 50;
  
  const segment = RAMPUR_SEGMENTS_DATA.rampur_town;
  const literacyVuln = Math.max(0, 100 - segment.literacyRate);
  const scstVuln = segment.scStPercentage || 0;
  const ruralVuln = 100 - segment.urbanization || 0;
  const demographicVulnerability = (literacyVuln * 0.5) + (scstVuln * 2.0) + (ruralVuln * 0.3);
  const normDemographicVuln = Math.min(100, demographicVulnerability);
  const cpi = (basePriority * 0.45) + (voteScore * 0.35) + (normDemographicVuln * 0.2) + completenessBonus;
  return Math.min(100, Math.round(cpi * 10) / 10);
}

function evaluateInfrastructureGap(lat, lng, category, constituencyName) {
  return { gapPercentage: 10, localMetric: 'N/A', benchmarkMetric: 'N/A', standard: {}, assemblyName: 'Rampur' };
}

async function main() {
  const colRef = collection(db, 'demands');
  const qSnapshot = await getDocs(colRef);
  const data = [];
  qSnapshot.forEach(docSnap => {
    const docData = docSnap.data();
    if (docSnap.id !== 'config_gemini' && !docData.isConfig && !docData.isBotSession) {
      data.push({ id: docSnap.id, ...docData });
    }
  });

  console.log("Simulating loading", data.length, "documents...");

  try {
    // 1. Sort demands
    data.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    console.log("Sort succeeded!");

    // 2. Map filtered demands
    const filteredDemands = data;

    // 3. Category count
    const categoryCounts = filteredDemands.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {});
    console.log("Category counts succeeded!");

    const sortedCategories = Object.keys(categoryCounts).map(cat => ({
      category: cat,
      count: categoryCounts[cat]
    })).sort((a, b) => b.count - a.count);
    console.log("Sorted categories mapping succeeded!");

    // 4. Zone calculations
    const zones = {};
    filteredDemands.forEach(d => {
      const loc = d.location || { lat: 28.803, lng: 79.025 };
      const wardKey = `Ward Zone (${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)})`;
      if (!zones[wardKey]) {
        zones[wardKey] = { name: wardKey, address: (d.address || 'Submitted via Chatbot').split(',')[0], water: 0, roads: 0, education: 0, health: 0, power: 0, others: 0, total: 0 };
      }
      const cat = d.category;
      if (['water', 'roads', 'education', 'health', 'power'].includes(cat)) {
        zones[wardKey][cat]++;
      } else {
        zones[wardKey].others++;
      }
      zones[wardKey].total++;
    });
    console.log("Zone calculations succeeded!");

    // 5. Sorted demands calculations
    const sortedDemands = [...filteredDemands].sort((a, b) => {
      const scoreA = calculateCombinedPriorityIndex(a);
      const scoreB = calculateCombinedPriorityIndex(b);
      return scoreB - scoreA;
    });
    console.log("CPI sorting succeeded!");

    // 6. Grid rendering test
    sortedDemands.forEach(d => {
      const loc = d.location || { lat: 28.803, lng: 79.025 };
      const gapDetails = evaluateInfrastructureGap(loc.lat, loc.lng, d.category, d.constituency);
      
      // Let's test properties that might throw on undefined category/scope
      const firstItem = d.items?.[0] || {};
      const contentText = (firstItem.content || firstItem.speechTranscript || '').toLowerCase();
      const addressText = (d.address || '').toLowerCase();
      const categoryText = (d.category || '').toLowerCase();
      const ticketCode = (d.id || '').toLowerCase();
    });
    console.log("Grid rendering simulation succeeded!");

    console.log("SIMULATION COMPLETED WITH 100% SUCCESS!");
  } catch (err) {
    console.error("SIMULATION CRASHED WITH ERROR:", err);
  }

  process.exit(0);
}

main();
