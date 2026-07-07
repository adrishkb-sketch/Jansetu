const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyADllQ8Um7qsJ4trH5WkRCWfVvHVh_qpp4",
  authDomain: "jansetu-ef57d.firebaseapp.com",
  projectId: "jansetu-ef57d",
  storageBucket: "jansetu-ef57d.firebasestorage.app",
  messagingSenderId: "219029213168",
  appId: "1:219029213168:web:a6767bd2efe3bfa3101735",
  measurementId: "G-4X9G3G92V1"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const RAMPUR_SEGMENTS_DATA = {
  rampur_town: {
    name: 'Rampur Town Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.803, lng: 79.025 },
    population: 325410,
    sexRatio: 982,
    literacyRate: 67.8,
    urbanization: 95.2,
    scStPercentage: 8.4,
    unemploymentRate: 9.2,
    waterCoverage: 91.5,
    unconnectedHabitations: 0,
    avgDistanceToPHC: 2.1,
    rteCompliance: 98.4,
    toiletAccess: 97.2,
    aqiLevel: 145,
    electricityHours: 22,
    cropYieldIndex: 44.5,
    soilHealthSaturation: 95.0
  },
  swar: {
    name: 'Swar Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 29.020, lng: 79.070 },
    population: 412580,
    sexRatio: 989,
    literacyRate: 42.7,
    urbanization: 15.6,
    scStPercentage: 16.2,
    unemploymentRate: 7.4,
    waterCoverage: 62.0,
    unconnectedHabitations: 9,
    avgDistanceToPHC: 11.2,
    rteCompliance: 91.8,
    toiletAccess: 86.5,
    aqiLevel: 88,
    electricityHours: 14,
    cropYieldIndex: 58.2,
    soilHealthSaturation: 76.5
  },
  chamraua: {
    name: 'Chamraua Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.830, lng: 78.910 },
    population: 389250,
    sexRatio: 980,
    literacyRate: 37.02,
    urbanization: 8.4,
    scStPercentage: 19.5,
    unemploymentRate: 8.1,
    waterCoverage: 48.5,
    unconnectedHabitations: 15,
    avgDistanceToPHC: 9.8,
    rteCompliance: 87.5,
    toiletAccess: 81.2,
    aqiLevel: 75,
    electricityHours: 12,
    cropYieldIndex: 61.4,
    soilHealthSaturation: 68.2
  },
  bilaspur: {
    name: 'Bilaspur Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.890, lng: 79.270 },
    population: 395120,
    sexRatio: 992,
    literacyRate: 46.67,
    urbanization: 22.8,
    scStPercentage: 14.8,
    unemploymentRate: 6.8,
    waterCoverage: 76.5,
    unconnectedHabitations: 5,
    avgDistanceToPHC: 6.2,
    rteCompliance: 94.2,
    toiletAccess: 89.8,
    aqiLevel: 98,
    electricityHours: 16,
    cropYieldIndex: 64.8,
    soilHealthSaturation: 84.1
  },
  milak: {
    name: 'Milak Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.620, lng: 79.180 },
    population: 432450,
    sexRatio: 986,
    literacyRate: 48.26,
    urbanization: 12.1,
    scStPercentage: 22.8,
    unemploymentRate: 8.9,
    waterCoverage: 51.2,
    unconnectedHabitations: 12,
    avgDistanceToPHC: 13.5,
    rteCompliance: 82.3,
    toiletAccess: 78.6,
    aqiLevel: 68,
    electricityHours: 11,
    cropYieldIndex: 59.7,
    soilHealthSaturation: 71.9
  }
};

async function uploadData() {
  console.log("Starting upload of public datasets to Firestore...");
  
  try {
    // 1. Upload Rampur segments
    console.log("Uploading Rampur Segments...");
    await setDoc(doc(db, 'demands', 'dataset_rampur_segments'), RAMPUR_SEGMENTS_DATA);
    
    // 2. Upload constituencies data
    console.log("Reading constituencies JSON...");
    const constData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/services/constituencies_543.json'), 'utf8'));
    console.log("Uploading 543 Constituencies...");
    
    // Split into smaller chunks if necessary, but 300KB is well under Firestore's 1MB doc limit.
    await setDoc(doc(db, 'demands', 'dataset_constituencies_543'), constData);
    
    // 3. Upload segments mapping
    console.log("Reading segments mapping JSON...");
    const mappingData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/services/constituency_segments_mapping.json'), 'utf8'));
    console.log("Uploading Constituencies Mapping...");
    await setDoc(doc(db, 'demands', 'dataset_constituencies_mapping'), mappingData);
    
    console.log("Successfully uploaded all demographic datasets to Firestore.");
    process.exit(0);
  } catch (error) {
    console.error("Error uploading data:", error);
    process.exit(1);
  }
}

uploadData();
