/**
 * Database Wipe Script
 * Connects to Firestore and deletes all demands and plans to start fresh.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function wipe() {
  console.log("Connecting to Firestore to clear all collections...");
  
  try {
    // 1. Wipe demands
    const demandsRef = collection(db, 'demands');
    const demandsSnap = await getDocs(demandsRef);
    console.log(`Found ${demandsSnap.size} demands. Deleting...`);
    for (const d of demandsSnap.docs) {
      await deleteDoc(doc(db, 'demands', d.id));
    }
    
    // 2. Wipe plans
    const plansRef = collection(db, 'plans');
    const plansSnap = await getDocs(plansRef);
    console.log(`Found ${plansSnap.size} plans. Deleting...`);
    for (const p of plansSnap.docs) {
      await deleteDoc(doc(db, 'plans', p.id));
    }
    
    console.log("Database cleared successfully!");
  } catch (err) {
    console.error("Wipe failed:", err);
  }
}

wipe().then(() => process.exit(0));
