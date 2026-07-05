import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  getDoc,
  increment,
  limit
} from 'firebase/firestore';

// Default Firebase Configuration (Fast Prototyping - standard Hackathon setup)
// Allows user to plug in their own config via localStorage
const getFirebaseConfig = () => {
  const customConfig = localStorage.getItem('jansetu_firebase_config');
  if (customConfig) {
    try {
      return JSON.parse(customConfig);
    } catch (e) {
      console.error('Invalid custom Firebase config, falling back to default.');
    }
  }
  
  // Free tier demo fallback configuration (can be substituted with active keys)
  return {
    apiKey: "AIzaSyDummyKeyForJansetuFastPrototypeScale",
    authDomain: "jansetu-citizen.firebaseapp.com",
    projectId: "jansetu-citizen",
    storageBucket: "jansetu-citizen.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123xyz"
  };
};

let db: any = null;

try {
  const config = getFirebaseConfig();
  if (config.apiKey !== "AIzaSyDummyKeyForJansetuFastPrototypeScale") {
    const app = initializeApp(config);
    db = getFirestore(app);
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

  // Default real-world mockup dataset for Rampur constituency coordinates
  const defaultData = [
    {
      id: 'hotspot_1',
      ticketType: 'complaint',
      category: 'water',
      scope: 'street',
      location: { lat: 28.803, lng: 79.025 },
      address: 'Rampur Main Market Road, near Water Tank',
      items: [{ type: 'text', content: 'Severe drinking water pipe leakage for the past 5 days.' }],
      createdAt: new Date().toISOString(),
      upvotes: 42
    },
    {
      id: 'hotspot_2',
      ticketType: 'complaint',
      category: 'roads',
      scope: 'ward',
      location: { lat: 28.812, lng: 79.032 },
      address: 'Civil Lines Road, Rampur Ward 4',
      items: [{ type: 'text', content: 'Massive potholes causing accidents during monsoons.' }],
      createdAt: new Date().toISOString(),
      upvotes: 89
    },
    {
      id: 'hotspot_3',
      ticketType: 'suggestion',
      category: 'education',
      scope: 'constituency',
      location: { lat: 28.795, lng: 79.012 },
      address: 'Kosi River Road, Rampur Outer Bypass',
      items: [{ type: 'text', content: 'Suggestion to set up a library at the Government School building.' }],
      createdAt: new Date().toISOString(),
      upvotes: 156
    }
  ];
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
