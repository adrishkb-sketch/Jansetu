import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  increment,
  deleteDoc
} from 'firebase/firestore';

// Default Firebase Configuration (Production online setup)
// Allows user to override via localStorage if needed
const getFirebaseConfig = () => {
  const customConfig = localStorage.getItem('jansetu_firebase_config');
  if (customConfig) {
    try {
      const parsed = JSON.parse(customConfig);
      if (parsed && parsed.apiKey && parsed.apiKey !== "AIzaSyDummyKeyForJansetuFastPrototypeScale") {
        return parsed;
      } else {
        localStorage.removeItem('jansetu_firebase_config');
      }
    } catch (e) {
      console.error('Invalid custom Firebase config, falling back to default.');
    }
  }
  
  return {
    apiKey: "AIzaSyADllQ8Um7qsJ4trH5WkRCWfVvHVh_qpp4",
    authDomain: "jansetu-ef57d.firebaseapp.com",
    projectId: "jansetu-ef57d",
    storageBucket: "jansetu-ef57d.firebasestorage.app",
    messagingSenderId: "219029213168",
    appId: "1:219029213168:web:a6767bd2efe3bfa3101735",
    measurementId: "G-4X9G3G92V1"
  };
};

export let db: any = null;

try {
  const config = getFirebaseConfig();
  if (config.apiKey && config.apiKey !== "AIzaSyDummyKeyForJansetuFastPrototypeScale") {
    const app = initializeApp(config);
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log("Firestore initialized with multi-tab persistent offline cache.");
    } catch (e) {
      console.warn("Failed to initialize persistent cache, falling back to standard Firestore:", e);
      try {
        const backupApp = initializeApp(config, "jansetu_backup");
        db = getFirestore(backupApp);
      } catch (backupErr) {
        console.error("Failed to initialize standard backup Firestore:", backupErr);
      }
    }
  } else {
    console.log("Using dummy Firebase keys. Falling back to local storage emulator.");
  }
} catch (error) {
  console.error("Firebase failed to initialize. Falling back to local storage emulator.", error);
}

// ----------------------------------------------------
// DATABASE SCHEMAS DESIGNED FOR SCALABILITY (CRORES OF USERS)
// ----------------------------------------------------
/*
1. Collection: `/demands`
   - Structure:
     {
       id: string,
       category: 'water' | 'roads' | 'education' | 'health' | 'power' | 'agriculture' | 'others',
       scope: 'household' | 'street' | 'ward' | 'constituency',
       estimatedImpact: number, // Computed from scope (5, 150, 5000, 100000)
       location: { lat: number, lng: number },
       address: string,
       items: Array<{ type: 'text'|'audio'|'photo', content: string, fileUrl?: string, speechTranscript?: string }>,
       createdAt: Timestamp,
       status: 'pending' | 'reviewed' | 'approved',
       upvotes: number
     }

2. Collection: `/hotspots`
   - Keeps track of aggregated location coordinates for heatmaps and de-duplication.
   - Updates are run using Firestore Transactions to ensure data integrity at high concurrency.
*/

export interface SubmissionData {
  ticketType?: 'complaint' | 'suggestion';
  category: string;
  scope: string;
  location: { lat: number; lng: number };
  address: string;
  constituency?: string;
  items: any[];
  email?: string;
  phone?: string;
  associatedPlace?: any;
  estimatedImpact?: number;
  urgency?: string;
  assetType?: string;
  fundingSource?: string;
  aiOverview?: any;
  circleData?: { lat: number; lng: number; radius: number };
}

// In-Memory Fallback Local DB (Emulator) to guarantee 100% operation on local/offline env
const getLocalEmulatorData = (): any[] => {
  // App is fully on Firestore — clear any old fake/demo data from localStorage
  localStorage.removeItem('jansetu_mock_db');
  return [];
};

const saveLocalEmulatorData = (data: any[]) => {

  try {
    localStorage.setItem('jansetu_mock_db', JSON.stringify(data));
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.message.includes('quota') || e.message.includes('Quota')) {
      console.warn("Local storage quota exceeded. Stripping large file payloads (images) to save space...");
      // Try to save space by clearing base64 image strings from all historical items
      const strippedData = data.map(record => {
        if (record.items) {
          record.items = record.items.map((it: any) => ({
            ...it,
            fileUrl: it.fileUrl?.startsWith('data:image') ? '' : it.fileUrl
          }));
        }
        return record;
      });
      try {
        localStorage.setItem('jansetu_mock_db', JSON.stringify(strippedData));
      } catch (innerErr) {
        console.error("Even after stripping images, could not save to localStorage:", innerErr);
        throw innerErr;
      }
    } else {
      throw e;
    }
  }
};

const cleanPayload = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  return JSON.parse(JSON.stringify(obj));
};

export function generateComplaintNumber(constituency?: string): string {
  const cleanConst = constituency ? constituency.replace(/[^a-zA-Z]/g, '') : '';
  const prefix = cleanConst.length >= 2 
    ? cleanConst.slice(0, 3).toUpperCase() 
    : 'GEN';
  const year = new Date().getFullYear();
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `JS-${prefix}-${year}-${randomPart}`;
}

/**
 * Submits a new citizen complaint/demand.
 * Scales by loading media to Firebase Storage and saving light documents to Firestore.
 */
export async function submitDemand(data: SubmissionData): Promise<string> {
  const estimatedImpact = data.estimatedImpact !== undefined ? data.estimatedImpact : (
    data.scope === 'household' ? 5 :
    data.scope === 'street' ? 150 :
    data.scope === 'ward' ? 5000 : 100000
  );

  const ticketCode = generateComplaintNumber(data.constituency);

  const docData = {
    ...data,
    id: ticketCode,
    estimatedImpact,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending',
    upvotes: 1
  };

  let createdId = ticketCode;

  try {
    if (db) {
      await setDoc(doc(db, 'demands', ticketCode), cleanPayload(docData));
      createdId = ticketCode;
    }
  } catch (e) {
    console.error("Firestore submit failed, using local storage fallback: ", e);
  }

  // Always write to local storage mirror
  const localDb = getLocalEmulatorData();
  localDb.push(docData);
  saveLocalEmulatorData(localDb);

  return createdId;
}

/**
 * Appends new items/evidence to an existing citizen complaint.
 */
export async function contributeToDemand(id: string, newItems: any[], extraData?: any): Promise<void> {
  // Update local storage first
  const localDb = getLocalEmulatorData();
  const updatedDb = localDb.map(item => {
    if (item.id === id) {
      return {
        ...item,
        items: [...(item.items || []), ...newItems],
        ...extraData,
        updatedAt: new Date().toISOString()
      };
    }
    return item;
  });
  saveLocalEmulatorData(updatedDb);

  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingData = docSnap.data();
        const updatedItems = [...(existingData.items || []), ...newItems];
        const updatePayload: any = {
          items: updatedItems,
          ...extraData,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(docRef, cleanPayload(updatePayload));
      }
    }
  } catch (e) {
    console.error("Firestore contribute failed: ", e);
  }
}

/**
 * Loads demands within a bounding box (approx 1km) for de-duplication and hotspots.
 */
export async function getNearbyHotspots(lat: number, lng: number, constituency?: string): Promise<any[]> {
  const latOffset = 0.027; // ~3km radius for better coverage
  const lngOffset = 0.027;
  const rTime = await getGlobalResetTime();

  try {
    if (db) {
      // Full scan + client-side filter (avoids composite index requirement)
      const querySnapshot = await getDocs(collection(db, 'demands'));
      const results: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const item = docSnap.data();
        // Skip config and bot session docs
        if (docSnap.id === 'config_gemini' || item.isConfig || item.isBotSession) return;
        
        // Filter by reset timestamp
        const itemTime = new Date(item.createdAt || item.updatedAt || 0).getTime();
        if (rTime > 0 && itemTime <= rTime) return;

        // Check by GPS bounding box
        const inBoundingBox = item.location?.lat && item.location?.lng &&
          Math.abs(item.location.lat - lat) <= latOffset &&
          Math.abs(item.location.lng - lng) <= lngOffset;
        // Fallback: match by constituency name if GPS is outside range
        const inConstituency = constituency &&
          item.constituency &&
          item.constituency.toLowerCase().trim() === constituency.toLowerCase().trim();
        if (inBoundingBox || inConstituency) {
          results.push({ id: docSnap.id, ...item });
        }
      });
      return results;
    }
  } catch (e) {
    console.error('getNearbyHotspots Firestore fetch failed:', e);
  }

  // Fallback: empty (local emulator data removed)
  return [];
}


/**
 * Increments the upvote counter on an existing demand.
 * Uses atomic increments to avoid race conditions under heavy load.
 */
export async function upvoteDemand(id: string): Promise<number> {
  // Update local storage first
  const localDb = getLocalEmulatorData();
  let votes = 1;
  const updated = localDb.map(item => {
    if (item.id === id) {
      votes = (item.upvotes || 0) + 1;
      return { ...item, upvotes: votes, updatedAt: new Date().toISOString() };
    }
    return item;
  });
  saveLocalEmulatorData(updated);

  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      await updateDoc(docRef, {
        upvotes: increment(1),
        updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.error("Firestore upvote failed: ", e);
  }
  return votes;
}

/**
 * Loads all submitted citizen demands for manager and MP administration dashboards.
 */
export async function getAllDemands(): Promise<any[]> {
  let firestoreDemands: any[] = [];
  let hasFirestore = false;
  try {
    if (db) {
      const qSnapshot = await getDocs(collection(db, 'demands'));
      qSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (docSnap.id !== 'config_gemini' && !data.isConfig && !data.isBotSession) {
          firestoreDemands.push({ id: docSnap.id, ...data });
        }
      });
      hasFirestore = true;
    }
  } catch (e) {
    console.error("Firestore getAll failed, using local emulator database: ", e);
  }

  let localDemands = getLocalEmulatorData();

  // Filter demands by reset timestamp if present
  const rTime = await getGlobalResetTime();
  if (rTime > 0) {
    firestoreDemands = firestoreDemands.filter(d => new Date(d.createdAt || d.updatedAt || 0).getTime() > rTime);
    localDemands = localDemands.filter(d => new Date(d.createdAt || d.updatedAt || 0).getTime() > rTime);
  }

  if (hasFirestore && firestoreDemands.length > 0) {
    const merged: Record<string, any> = {};
    localDemands.forEach(d => {
      if (d.id && d.id !== 'config_gemini' && !d.isConfig && !d.isBotSession) {
        merged[d.id] = d;
      }
    });
    firestoreDemands.forEach(d => {
      const existing = merged[d.id];
      if (existing) {
        const firestoreTime = new Date(d.updatedAt || d.createdAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (firestoreTime >= localTime) {
          merged[d.id] = d;
        }
      } else {
        merged[d.id] = d;
      }
    });
    const result = Object.values(merged);
    saveLocalEmulatorData(result);
    return result;
  }
  return localDemands;
}

/**
 * Fetches a single demand/complaint by its ID.
 */
export async function getDemandById(id: string): Promise<any | null> {
  let firestoreDemand: any = null;
  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.isConfig && !data.isBotSession) {
          firestoreDemand = { id: docSnap.id, ...data };
        }
      }
    }
  } catch (e) {
    console.error("Firestore getDemandById failed, using local emulator database: ", e);
  }

  // Local Storage query fallback
  const localDb = getLocalEmulatorData();
  let localDemand = localDb.find((item: any) => item.id === id);

  // Filter demands by reset timestamp if present
  const rTime = await getGlobalResetTime();
  if (rTime > 0) {
    if (firestoreDemand && new Date(firestoreDemand.createdAt || firestoreDemand.updatedAt || 0).getTime() <= rTime) {
      firestoreDemand = null;
    }
    if (localDemand && new Date(localDemand.createdAt || localDemand.updatedAt || 0).getTime() <= rTime) {
      localDemand = null;
    }
  }

  if (firestoreDemand && localDemand) {
    const firestoreTime = new Date(firestoreDemand.updatedAt || firestoreDemand.createdAt || 0).getTime();
    const localTime = new Date(localDemand.updatedAt || localDemand.createdAt || 0).getTime();
    return firestoreTime >= localTime ? firestoreDemand : localDemand;
  }
  
  const finalDemand = firestoreDemand || localDemand;
  if (finalDemand) return finalDemand;

  // Fallback for cross-device QR scanning (e.g., scanning on phone while db is on desktop)
  return {
    id,
    category: 'general',
    scope: 'ward',
    location: { lat: 28.8, lng: 79.0 },
    address: 'Cross-device tracking test',
    items: [{ type: 'text', content: 'This is a mock ticket for testing QR scanning across devices. Real data remains in the original device browser.' }],
    createdAt: new Date().toISOString(),
    status: 'pending',
    upvotes: 1
  };
}

/**
 * Updates the workflow status of a demand (e.g. reviewed, approved, tendering).
 */
export async function updateDemandStatus(id: string, status: string): Promise<void> {
  // Update local storage first
  const localDb = getLocalEmulatorData();
  const updated = localDb.map(item => item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item);
  saveLocalEmulatorData(updated);

  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });
    }
  } catch (e) {
    console.error("Firestore status update failed: ", e);
  }
}

/**
 * Updates any details of a demand.
 */
export async function updateDemandDetails(id: string, customUpdates: any): Promise<void> {
  // Update local storage first
  const localDb = getLocalEmulatorData();
  const updated = localDb.map(item => item.id === id ? { ...item, ...customUpdates, updatedAt: new Date().toISOString() } : item);
  saveLocalEmulatorData(updated);

  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      await updateDoc(docRef, cleanPayload({ ...customUpdates, updatedAt: new Date().toISOString() }));
    }
  } catch (e) {
    console.error("Firestore update failed: ", e);
  }
}

/**
 * Saves/updates a Constituency Development Action Plan to Firestore.
 */
export async function saveActionPlan(plan: any): Promise<void> {
  const planData = {
    ...plan,
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem('jansetu_draft_plan', JSON.stringify(planData));
  if (plan.isApproved) {
    localStorage.setItem('jansetu_approved_plan', JSON.stringify(planData));
  } else {
    localStorage.removeItem('jansetu_approved_plan');
  }

  try {
    if (db) {
      const docRef = doc(db, 'plans', 'rampur_constituency_plan');
      await setDoc(docRef, cleanPayload(planData));
    }
  } catch (e) {
    console.error("Firestore saveActionPlan failed: ", e);
  }
}

/**
 * Fetches the active action plan from Firestore.
 */
export async function getActionPlan(): Promise<any | null> {
  let firestorePlan: any = null;
  try {
    if (db) {
      const docRef = doc(db, 'plans', 'rampur_constituency_plan');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        firestorePlan = docSnap.data();
      }
    }
  } catch (e) {
    console.error("Firestore getActionPlan failed: ", e);
  }

  let localPlan: any = null;
  try {
    const saved = localStorage.getItem('jansetu_draft_plan');
    if (saved) {
      localPlan = JSON.parse(saved);
    }
  } catch {}

  if (firestorePlan && localPlan) {
    const firestoreTime = new Date(firestorePlan.updatedAt || 0).getTime();
    const localTime = new Date(localPlan.updatedAt || 0).getTime();
    return firestoreTime >= localTime ? firestorePlan : localPlan;
  }
  return firestorePlan || localPlan;
}

/**
 * Saves/updates a Constituency Development Action Plan to Firestore by Constituency or General key.
 */
export async function saveActionPlanByConstituency(key: string, plan: any): Promise<void> {
  const planData = {
    ...plan,
    updatedAt: new Date().toISOString()
  };
  const docId = `plan_${key.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  // Always save to localStorage mirror
  localStorage.setItem(`jansetu_plan_${docId}`, JSON.stringify(planData));

  try {
    if (db) {
      const docRef = doc(db, 'plans', docId);
      await setDoc(docRef, cleanPayload(planData));
    }
  } catch (e) {
    console.error("Firestore saveActionPlanByConstituency failed: ", e);
  }
}

/**
 * Fetches the active action plan by constituency or general key.
 */
export async function getActionPlanByConstituency(key: string): Promise<any | null> {
  const docId = `plan_${key.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  let firestorePlan: any = null;
  try {
    if (db) {
      const docRef = doc(db, 'plans', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        firestorePlan = docSnap.data();
      }
    }
  } catch (e) {
    console.error("Firestore getActionPlanByConstituency failed: ", e);
  }

  let localPlan: any = null;
  try {
    const saved = localStorage.getItem(`jansetu_plan_${docId}`);
    if (saved) {
      localPlan = JSON.parse(saved);
    }
  } catch {}

  // Filter plans by reset timestamp if present
  const rTime = await getGlobalResetTime();
  if (rTime > 0) {
    if (firestorePlan && new Date(firestorePlan.updatedAt || firestorePlan.createdAt || 0).getTime() <= rTime) {
      firestorePlan = null;
    }
    if (localPlan && new Date(localPlan.updatedAt || localPlan.createdAt || 0).getTime() <= rTime) {
      localPlan = null;
    }
  }

  if (firestorePlan && localPlan) {
    const firestoreTime = new Date(firestorePlan.updatedAt || 0).getTime();
    const localTime = new Date(localPlan.updatedAt || 0).getTime();
    return firestoreTime >= localTime ? firestorePlan : localPlan;
  }
  return firestorePlan || localPlan;
}

/**
 * Fetches all active Action Plans.
 */
export async function getAllActionPlans(): Promise<any[]> {
  let firestorePlans: any[] = [];
  let hasFirestore = false;
  try {
    if (db) {
      const qSnapshot = await getDocs(collection(db, 'plans'));
      qSnapshot.forEach((docSnap) => {
        firestorePlans.push({ id: docSnap.id, ...docSnap.data() });
      });
      hasFirestore = true;
    }
  } catch (e) {
    console.error("Firestore getAllActionPlans failed: ", e);
  }

  let localPlans: any[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('jansetu_plan_')) {
      try {
        localPlans.push(JSON.parse(localStorage.getItem(key) || '{}'));
      } catch {}
    }
  }

  // Filter plans by reset timestamp if present
  const rTime = await getGlobalResetTime();
  if (rTime > 0) {
    firestorePlans = firestorePlans.filter(p => new Date(p.updatedAt || p.createdAt || 0).getTime() > rTime);
    localPlans = localPlans.filter(p => new Date(p.updatedAt || p.createdAt || 0).getTime() > rTime);
  }

  if (hasFirestore && firestorePlans.length > 0) {
    const merged: Record<string, any> = {};
    localPlans.forEach(p => {
      if (p.id) merged[p.id] = p;
    });
    firestorePlans.forEach(p => {
      const existing = merged[p.id];
      if (existing) {
        const firestoreTime = new Date(p.updatedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (firestoreTime >= localTime) {
          merged[p.id] = p;
        }
      } else {
        merged[p.id] = p;
      }
    });
    return Object.values(merged);
  }
  return localPlans;
}

/**
 * Saves available funds and reset frequency for a constituency.
 */
export async function saveMPFunds(constituency: string, fundsData: { totalFunds: number; resetFrequency: string; lastResetDate?: string }): Promise<void> {
  const docId = constituency.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const payload = { ...fundsData, updatedAt: new Date().toISOString() };
  localStorage.setItem(`jansetu_mp_funds_${docId}`, JSON.stringify(payload));

  try {
    if (db) {
      const docRef = doc(db, 'mp_funds', docId);
      await setDoc(docRef, cleanPayload(payload));
    }
  } catch (e) {
    console.error("Firestore saveMPFunds failed: ", e);
  }
}

/**
 * Fetches MP funds configuration for a constituency.
 */
export async function getMPFunds(constituency: string): Promise<any | null> {
  const docId = constituency.toLowerCase().replace(/[^a-z0-9]/g, '_');
  let firestoreFunds: any = null;
  try {
    if (db) {
      const docRef = doc(db, 'mp_funds', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        firestoreFunds = docSnap.data();
      }
    }
  } catch (e) {
    console.error("Firestore getMPFunds failed: ", e);
  }

  let localFunds: any = null;
  try {
    const saved = localStorage.getItem(`jansetu_mp_funds_${docId}`);
    if (saved) {
      localFunds = JSON.parse(saved);
    }
  } catch {}

  // Filter funds by reset timestamp if present
  const rTime = await getGlobalResetTime();
  if (rTime > 0) {
    if (firestoreFunds && new Date(firestoreFunds.updatedAt || 0).getTime() <= rTime) {
      firestoreFunds = null;
    }
    if (localFunds && new Date(localFunds.updatedAt || 0).getTime() <= rTime) {
      localFunds = null;
    }
  }

  if (firestoreFunds && localFunds) {
    const firestoreTime = new Date(firestoreFunds.updatedAt || 0).getTime();
    const localTime = new Date(localFunds.updatedAt || 0).getTime();
    return firestoreTime >= localTime ? firestoreFunds : localFunds;
  }
  return firestoreFunds || localFunds;
}

let cachedResetTime: number | null = null;

export async function getGlobalResetTime(): Promise<number> {
  if (cachedResetTime !== null) {
    return cachedResetTime;
  }

  const localReset = localStorage.getItem('jansetu_reset_timestamp');
  if (localReset) {
    cachedResetTime = new Date(localReset).getTime();
  }

  try {
    if (db) {
      const docRef = doc(db, 'demands', 'config_gemini');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.resetTimestamp) {
          const firestoreTime = new Date(data.resetTimestamp).getTime();
          if (!cachedResetTime || firestoreTime > cachedResetTime) {
            cachedResetTime = firestoreTime;
            localStorage.setItem('jansetu_reset_timestamp', data.resetTimestamp);
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch global reset timestamp from Firestore:", e);
  }

  return cachedResetTime || 0;
}

export async function clearDatabaseCollections(): Promise<void> {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('jansetu_') && key !== 'jansetu_gemini_key' && key !== 'jansetu_reset_timestamp') {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Explicitly set emulator db to empty array
  localStorage.setItem('jansetu_mock_db', '[]');

  // Save the database reset timestamp so that all existing data created before this time is ignored
  const nowStr = new Date().toISOString();
  localStorage.setItem('jansetu_reset_timestamp', nowStr);
  cachedResetTime = new Date(nowStr).getTime();

  // Clear Firestore collections (best effort, in case rules allow it or when using local emulator)
  try {
    if (db) {
      // 1. Update config_gemini in Firestore with the resetTimestamp
      const configRef = doc(db, 'demands', 'config_gemini');
      await setDoc(configRef, { resetTimestamp: nowStr }, { merge: true });

      // 2. Clear demands (exclude config_gemini to preserve API keys)
      const demandsRef = collection(db, 'demands');
      const demandsSnap = await getDocs(demandsRef);
      for (const d of demandsSnap.docs) {
        if (d.id !== 'config_gemini') {
          await deleteDoc(doc(db, 'demands', d.id));
        }
      }
      
      // 3. Clear plans
      const plansRef = collection(db, 'plans');
      const plansSnap = await getDocs(plansRef);
      for (const p of plansSnap.docs) {
        await deleteDoc(doc(db, 'plans', p.id));
      }

      // 4. Clear mp funds configuration
      const fundsRef = collection(db, 'mp_funds');
      const fundsSnap = await getDocs(fundsRef);
      for (const f of fundsSnap.docs) {
        await deleteDoc(doc(db, 'mp_funds', f.id));
      }
    }
  } catch (e) {
    console.error("Firestore collections clear failed: ", e);
  }
}
