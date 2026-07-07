const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

const config = {
  apiKey: "AIzaSyADllQ8Um7qsJ4trH5WkRCWfVvHVh_qpp4",
  authDomain: "jansetu-ef57d.firebaseapp.com",
  projectId: "jansetu-ef57d",
  storageBucket: "jansetu-ef57d.firebasestorage.app",
  messagingSenderId: "219029213168",
  appId: "1:219029213168:web:a6767bd2efe3bfa3101735",
  measurementId: "G-4X9G3G92V1"
};

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  try {
    const docRef = doc(db, 'demands', 'JS-RAM-2026-WUX8F');
    await updateDoc(docRef, { status: 'needs_info', needsMoreInfo: true });
    console.log('Success updating JS-RAM-2026-WUX8F');
  } catch (e) {
    console.error(e);
  }
}
run();
