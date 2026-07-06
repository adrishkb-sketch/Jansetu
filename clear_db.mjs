import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

async function clearCollection(colName) {
  console.log(`Clearing collection: ${colName}...`);
  const colRef = collection(db, colName);
  const qSnapshot = await getDocs(colRef);
  let count = 0;
  for (const document of qSnapshot.docs) {
    await deleteDoc(doc(db, colName, document.id));
    count++;
  }
  console.log(`Deleted ${count} documents from ${colName}.`);
}

async function main() {
  await clearCollection('demands');
  await clearCollection('plans');
  await clearCollection('mp_funds');
  console.log("Database cleared successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
