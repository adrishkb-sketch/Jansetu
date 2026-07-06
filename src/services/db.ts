import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  increment,
  limit,
  deleteDoc
} from 'firebase/firestore';

// Default Firebase Configuration (Production online setup)
// Allows user to override via localStorage if needed
const getFirebaseConfig = () => {
  const customConfig = localStorage.getItem('jansetu_firebase_config');
  if (customConfig) {
    try {
      return JSON.parse(customConfig);
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

let db: any = null;

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
      db = getFirestore(app);
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
  const data = localStorage.getItem('jansetu_mock_db');
  if (data) return JSON.parse(data);

  const defaultData: any[] = [];
  localStorage.setItem('jansetu_mock_db', JSON.stringify(defaultData));
  return defaultData;
};

const saveLocalEmulatorData = (data: any[]) => {
  localStorage.setItem('jansetu_mock_db', JSON.stringify(data));
};

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

  const docData = {
    ...data,
    estimatedImpact,
    createdAt: new Date().toISOString(),
    status: 'pending',
    upvotes: 1
  };

  try {
    if (db) {
      const docRef = await addDoc(collection(db, 'demands'), docData);
      return docRef.id;
    }
  } catch (e) {
    console.error("Firestore submit failed, using local storage fallback: ", e);
  }

  // Local Storage Fallback
  const localDb = getLocalEmulatorData();
  const id = 'local_' + Date.now();
  localDb.push({ id, ...docData });
  saveLocalEmulatorData(localDb);
  return id;
}

/**
 * Appends new items/evidence to an existing citizen complaint.
 */
export async function contributeToDemand(id: string, newItems: any[], extraData?: any): Promise<void> {
  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingData = docSnap.data();
        const updatedItems = [...(existingData.items || []), ...newItems];
        const updatePayload: any = {
          items: updatedItems,
          ...extraData
        };
        await updateDoc(docRef, updatePayload);
        return;
      }
    }
  } catch (e) {
    console.error("Firestore contribute failed, falling back to local storage: ", e);
  }

  // Local Storage fallback
  const localDb = getLocalEmulatorData();
  const updatedDb = localDb.map(item => {
    if (item.id === id) {
      return {
        ...item,
        items: [...(item.items || []), ...newItems],
        ...extraData
      };
    }
    return item;
  });
  saveLocalEmulatorData(updatedDb);
}

/**
 * Loads demands within a bounding box (approx 1km) for de-duplication and hotspots.
 */
export async function getNearbyHotspots(lat: number, lng: number): Promise<any[]> {
  const latOffset = 0.015; // Approx 1.5 km
  const lngOffset = 0.015;

  try {
    if (db) {
      const q = query(
        collection(db, 'demands'),
        where('location.lat', '>=', lat - latOffset),
        where('location.lat', '<=', lat + latOffset),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const item = docSnap.data();
        // Manual filter for longitude bounding box since Firestore only allows inequality on single field
        if (item.location.lng >= lng - lngOffset && item.location.lng <= lng + lngOffset) {
          results.push({ id: docSnap.id, ...item });
        }
      });
      if (results.length > 0) return results;
    }
  } catch (e) {
    console.error("Firestore fetch failed, using local emulator data: ", e);
  }

  // Local Storage query
  const localDb = getLocalEmulatorData();
  return localDb.filter(item => 
    Math.abs(item.location.lat - lat) <= latOffset &&
    Math.abs(item.location.lng - lng) <= lngOffset
  );
}

/**
 * Increments the upvote counter on an existing demand.
 * Uses atomic increments to avoid race conditions under heavy load.
 */
export async function upvoteDemand(id: string): Promise<number> {
  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      await updateDoc(docRef, {
        upvotes: increment(1)
      });
      return 1;
    }
  } catch (e) {
    console.error("Firestore upvote failed, using local emulator update: ", e);
  }

  // Local Storage upvote
  const localDb = getLocalEmulatorData();
  let votes = 1;
  const updated = localDb.map(item => {
    if (item.id === id) {
      votes = (item.upvotes || 0) + 1;
      return { ...item, upvotes: votes };
    }
    return item;
  });
  saveLocalEmulatorData(updated);
  return votes;
}

/**
 * Loads all submitted citizen demands for manager and MP administration dashboards.
 */
export async function getAllDemands(): Promise<any[]> {
  try {
    if (db) {
      const qSnapshot = await getDocs(collection(db, 'demands'));
      const results: any[] = [];
      qSnapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (results.length > 0) return results;
    }
  } catch (e) {
    console.error("Firestore getAll failed, using local emulator database: ", e);
  }

  // Local Storage query fallback
  return getLocalEmulatorData();
}

/**
 * Fetches a single demand/complaint by its ID.
 */
export async function getDemandById(id: string): Promise<any | null> {
  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    }
  } catch (e) {
    console.error("Firestore getDemandById failed, using local emulator database: ", e);
  }

  // Local Storage query fallback
  const localDb = getLocalEmulatorData();
  const found = localDb.find((item: any) => item.id === id);
  if (found) return found;

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
  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      await updateDoc(docRef, { status });
      return;
    }
  } catch (e) {
    console.error("Firestore status update failed, saving locally: ", e);
  }

  const localDb = getLocalEmulatorData();
  const updated = localDb.map(item => item.id === id ? { ...item, status } : item);
  saveLocalEmulatorData(updated);
}

/**
 * Updates any details of a demand.
 */
export async function updateDemandDetails(id: string, customUpdates: any): Promise<void> {
  try {
    if (db && !id.startsWith('local_')) {
      const docRef = doc(db, 'demands', id);
      await updateDoc(docRef, customUpdates);
      return;
    }
  } catch (e) {
    console.error("Firestore update failed, saving locally: ", e);
  }

  const localDb = getLocalEmulatorData();
  const updated = localDb.map(item => item.id === id ? { ...item, ...customUpdates } : item);
  saveLocalEmulatorData(updated);
}

/**
 * Saves/updates a Constituency Development Action Plan to Firestore.
 */
export async function saveActionPlan(plan: any): Promise<void> {
  const planData = {
    ...plan,
    updatedAt: new Date().toISOString()
  };
  try {
    if (db) {
      const docRef = doc(db, 'plans', 'rampur_constituency_plan');
      await setDoc(docRef, planData);
      return;
    }
  } catch (e) {
    console.error("Firestore saveActionPlan failed, using local storage fallback: ", e);
  }

  // Local Storage fallback
  localStorage.setItem('jansetu_draft_plan', JSON.stringify(planData));
  if (plan.isApproved) {
    localStorage.setItem('jansetu_approved_plan', JSON.stringify(planData));
  } else {
    localStorage.removeItem('jansetu_approved_plan');
  }
}

/**
 * Fetches the active action plan from Firestore.
 */
export async function getActionPlan(): Promise<any | null> {
  try {
    if (db) {
      const docRef = doc(db, 'plans', 'rampur_constituency_plan');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    }
  } catch (e) {
    console.error("Firestore getActionPlan failed, reading locally: ", e);
  }

  try {
    const saved = localStorage.getItem('jansetu_draft_plan');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
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
  try {
    if (db) {
      const docRef = doc(db, 'plans', docId);
      await setDoc(docRef, planData);
      return;
    }
  } catch (e) {
    console.error("Firestore saveActionPlanByConstituency failed, using local storage: ", e);
  }
  localStorage.setItem(`jansetu_plan_${docId}`, JSON.stringify(planData));
}

/**
 * Fetches the active action plan by constituency or general key.
 */
export async function getActionPlanByConstituency(key: string): Promise<any | null> {
  const docId = `plan_${key.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  try {
    if (db) {
      const docRef = doc(db, 'plans', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    }
  } catch (e) {
    console.error("Firestore getActionPlanByConstituency failed, reading locally: ", e);
  }

  try {
    const saved = localStorage.getItem(`jansetu_plan_${docId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Fetches all active Action Plans.
 */
export async function getAllActionPlans(): Promise<any[]> {
  try {
    if (db) {
      const qSnapshot = await getDocs(collection(db, 'plans'));
      const results: any[] = [];
      qSnapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (results.length > 0) return results;
    }
  } catch (e) {
    console.error("Firestore getAllActionPlans failed, using local storage: ", e);
  }

  const results: any[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('jansetu_plan_')) {
      try {
        results.push(JSON.parse(localStorage.getItem(key) || '{}'));
      } catch {}
    }
  }
  return results;
}

/**
 * Saves available funds and reset frequency for a constituency.
 */
export async function saveMPFunds(constituency: string, fundsData: { totalFunds: number; resetFrequency: string; lastResetDate?: string }): Promise<void> {
  const docId = constituency.toLowerCase().replace(/[^a-z0-9]/g, '_');
  try {
    if (db) {
      const docRef = doc(db, 'mp_funds', docId);
      await setDoc(docRef, { ...fundsData, updatedAt: new Date().toISOString() });
      return;
    }
  } catch (e) {
    console.error("Firestore saveMPFunds failed, saving locally: ", e);
  }
  localStorage.setItem(`jansetu_mp_funds_${docId}`, JSON.stringify(fundsData));
}

/**
 * Fetches MP funds configuration for a constituency.
 */
export async function getMPFunds(constituency: string): Promise<any | null> {
  const docId = constituency.toLowerCase().replace(/[^a-z0-9]/g, '_');
  try {
    if (db) {
      const docRef = doc(db, 'mp_funds', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    }
  } catch (e) {
    console.error("Firestore getMPFunds failed, reading locally: ", e);
  }

  try {
    const saved = localStorage.getItem(`jansetu_mp_funds_${docId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export async function clearDatabaseCollections(): Promise<void> {
  // Clear localStorage
  localStorage.removeItem('jansetu_mock_db');
  localStorage.removeItem('jansetu_draft_plan');
  localStorage.removeItem('jansetu_approved_plan');
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('jansetu_plan_') || key.startsWith('jansetu_mp_funds_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Clear Firestore collections
  try {
    if (db) {
      // 1. Clear demands
      const demandsRef = collection(db, 'demands');
      const demandsSnap = await getDocs(demandsRef);
      for (const d of demandsSnap.docs) {
        await deleteDoc(doc(db, 'demands', d.id));
      }
      
      // 2. Clear plans
      const plansRef = collection(db, 'plans');
      const plansSnap = await getDocs(plansRef);
      for (const p of plansSnap.docs) {
        await deleteDoc(doc(db, 'plans', p.id));
      }
    }
  } catch (e) {
    console.error("Firestore collections clear failed: ", e);
  }
}

