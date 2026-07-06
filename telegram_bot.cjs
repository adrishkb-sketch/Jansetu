/**
 * Jansetu Live Telegram Chatbot Gateway - SYNCHRONIZED VERSION
 * Run this bot locally or host it. It polls @JanSetuBot, transcribes audio,
 * analyzes photos via Gemini, geolocates constituencies, and writes directly
 * to the shared Firestore database.
 * 
 * Install dependencies:
 *   npm install node-telegram-bot-api firebase
 * 
 * Run the bot:
 *   node telegram_bot.cjs
 */

const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api').TelegramBot || require('node-telegram-bot-api');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  increment,
  orderBy,
  limit 
} = require('firebase/firestore');

// 1. Firebase Configuration (Matches db.ts)
const firebaseConfig = {
  apiKey: "AIzaSyADllQ8Um7qsJ4trH5WkRCWfVvHVh_qpp4",
  authDomain: "jansetu-ef57d.firebaseapp.com",
  projectId: "jansetu-ef57d",
  storageBucket: "jansetu-ef57d.firebasestorage.app",
  messagingSenderId: "219029213168",
  appId: "1:219029213168:web:a6767bd2efe3bfa3101735",
  measurementId: "G-4X9G3G92V1"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// 2. Telegram Bot API Settings
const BOT_TOKEN = "8724667418:AAFSz9FkGQd0DlyCf6TnrsVKdke-4xnx1Aw";

// Load backup/custom key config
let geminiKeys = [];
try {
  const filepath = path.join(__dirname, 'bot_config.json');
  if (fs.existsSync(filepath)) {
    const configData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (configData.gemini_key) {
      geminiKeys.push(configData.gemini_key);
    }
  }
} catch (e) {
  console.warn("Failed to read bot_config.json, using default fallback.", e.message);
}

try {
  const keyEnv = process.env.JANSETU_GEMINI_KEY || '';
  if (keyEnv) {
    const envKeys = keyEnv.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    geminiKeys = [...geminiKeys, ...envKeys];
  }
} catch (e) {}

if (geminiKeys.length === 0) {
  geminiKeys.push('AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw');
}

// Sequence rotation helper for Gemini
let currentKeyIndex = 0;
function getActiveGeminiKey() {
  if (geminiKeys.length === 0) return 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';
  return geminiKeys[currentKeyIndex % geminiKeys.length];
}
function rotateGeminiKey() {
  currentKeyIndex++;
  console.log(`Rotated to backup Gemini key: index ${currentKeyIndex % geminiKeys.length}`);
}

async function fetchGeminiWithFallback(contents, customSystemPrompt = '') {
  const maxRetries = Math.max(3, geminiKeys.length);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const key = getActiveGeminiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    try {
      const payload = { contents };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        return response;
      }
      console.warn(`Gemini API call returned status ${response.status}. Attempting key rotation...`);
      rotateGeminiKey();
    } catch (err) {
      console.warn(`Gemini call error on attempt ${attempt}:`, err.message);
      rotateGeminiKey();
    }
  }
  throw new Error("All backup Gemini API keys exhausted or failed.");
}

// 3. Supported Languages List
const LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'हिंदी (Hindi)', code: 'hi' },
  { name: 'বাংলা (Bengali)', code: 'bn' },
  { name: 'తెలుగు (Telugu)', code: 'te' },
  { name: 'मराठी (Marathi)', code: 'mr' },
  { name: 'தமிழ் (Tamil)', code: 'ta' },
  { name: 'ગુજરાતી (Gujarati)', code: 'gu' },
  { name: 'ಕನ್ನಡ (Kannada)', code: 'kn' },
  { name: 'മലയാളം (Malayalam)', code: 'ml' },
  { name: 'ଓଡ଼ିଆ (Odia)', code: 'or' },
  { name: 'ਪੰਜਾਬੀ (Punjabi)', code: 'pa' },
  { name: 'অসমীয়া (Assamese)', code: 'as' },
  { name: 'اردو (Urdu)', code: 'ur' },
  { name: 'संस्कृतम् (Sanskrit)', code: 'sa' },
  { name: 'नेपाली (Nepali)', code: 'ne' },
  { name: 'सिंधी (Sindhi)', code: 'sd' },
  { name: 'कोंकणी (Konkani)', code: 'kok' },
  { name: 'डोगरी (Dogri)', code: 'doi' },
  { name: 'मैथिली (Maithili)', code: 'mai' },
  { name: 'मणिपुरी (Manipuri)', code: 'mni' },
  { name: 'बोडो (Bodo)', code: 'brx' },
  { name: 'संथाली (Santali)', code: 'sat' },
  { name: 'कश्मीरी (Kashmiri)', code: 'ks' }
];

// All 28 Category Mappings matching the Complainant website tag overrides
const CATEGORY_MAP = {
  water: { label: "Water & Sanitation", emoji: "🚰" },
  roads: { label: "Roads & Transport", emoji: "🛣️" },
  education: { label: "Education & Schools", emoji: "🏫" },
  health: { label: "Healthcare Clinics", emoji: "🏥" },
  power: { label: "Power & Electricity", emoji: "⚡" },
  agriculture: { label: "Agriculture & Irrigation", emoji: "🌾" },
  safety: { label: "Public Safety & Police", emoji: "🚓" },
  environment: { label: "Environment & Parks", emoji: "🌳" },
  welfare: { label: "Social Welfare & Pensions", emoji: "🤝" },
  housing: { label: "Housing & Urban Dev", emoji: "🏗️" },
  anticorruption: { label: "Anti-Corruption & Vigilance", emoji: "🛡️" },
  digital: { label: "Digital Infrastructure", emoji: "💻" },
  disaster: { label: "Disaster Management", emoji: "🚨" },
  women: { label: "Women & Child Development", emoji: "👩👧" },
  justice: { label: "Justice & Law Enforcement", emoji: "⚖️" },
  economy: { label: "Job Creation & Economy", emoji: "📈" },
  consumer: { label: "Consumer Rights", emoji: "🛒" },
  taxes: { label: "Taxes, Revenue & Land", emoji: "📜" },
  tourism: { label: "Arts, Culture & Tourism", emoji: "🎭" },
  youth: { label: "Youth Affairs & Sports", emoji: "⚽" },
  innovation: { label: "Science & Innovation", emoji: "🚀" },
  rural: { label: "Rural Development", emoji: "🏡" },
  security: { label: "National Security & Defense", emoji: "🪖" },
  cyber: { label: "AI & Cyber Security", emoji: "🤖" },
  climate: { label: "Climate & Sustainability", emoji: "🌱" },
  space: { label: "Space & Advanced Tech", emoji: "🛰️" },
  foreign: { label: "International Relations", emoji: "🌍" },
  others: { label: "Others / General", emoji: "📁" }
};

// Scope mappings matching user sliders
const SCOPE_MAP = {
  household: { label: "Household (1-10)", defaultPopulation: 5 },
  street: { label: "Street (~150)", defaultPopulation: 150 },
  ward: { label: "Ward (~5k)", defaultPopulation: 5000 },
  constituency: { label: "Constituency (10k+)", defaultPopulation: 10000 }
};

// Load 543 constituencies dataset for geolocation matching
let constituenciesData = {};
try {
  const filepath = path.join(__dirname, 'src', 'services', 'constituencies_543.json');
  const raw = fs.readFileSync(filepath, 'utf8');
  constituenciesData = JSON.parse(raw);
} catch (e) {
  console.warn("Failed to load constituencies_543.json, defaulting to standard matching.", e.message);
}

// Haversine Distance helper to find closest constituency
function getHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getConstituencyFromCoords(lat, lng) {
  let closestName = 'Rampur';
  let minDistance = Infinity;

  Object.keys(constituenciesData).forEach(name => {
    const coords = constituenciesData[name]?.centerCoords;
    if (coords && coords.lat && coords.lng) {
      const dist = getHaversineDistance(lat, lng, coords.lat, coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestName = name;
      }
    }
  });

  return closestName;
}

// In-Memory state management for user conversation flow
const userState = new Map();

// Helper translations templates
const T = {
  welcome: "Welcome to Jansetu Bot! Please choose your preferred language:",
  locationRequest: "Please share your current location (GPS) by tapping the button below so we can find your parliamentary constituency.",
  locationBtn: "📍 Share Current Location",
  constituencySelected: (constituency) => `Location matched! Your Parliamentary Constituency is: *${constituency}*`,
  mainMenuTitle: "Main Menu - What would you like to do?",
  option1: "📝 Register Complaint",
  option2: "💡 Send Suggestion",
  option3: "🔍 Track Status",
  option4: "🗳️ Upvote Local Gaps",
  promptMedia: "Please submit your detail: You can type text, send a photo of the issue, or record a voice note.",
  processing: "⏳ Jansetu AI is processing your input...",
  promptTrackId: "Please enter your Ticket Reference ID:",
  noTicket: "❌ No ticket found with that reference ID.",
  ticketStatusMsg: (id, category, status) => `📌 *Ticket details:* \nID: ${id}\nCategory: ${category}\nStatus: *${status}*`,
  upvoteListTitle: "Select a local grievance to support/upvote:",
  noIssues: "No active verified grievances found in your constituency.",
  upvoteDone: "👍 Upvoted successfully! Thank you for your support."
};

const translationCache = {}; // Simple in-memory translation caching

async function translateBotText(text, targetLang) {
  if (!targetLang || targetLang === 'en') {
    return text;
  }
  
  const cacheKey = `${text}_${targetLang}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  // Use Google Translate Single Endpoint
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    if (res.ok) {
      const json = await res.json();
      const translated = json[0].map(x => x[0]).join('');
      if (translated) {
        translationCache[cacheKey] = translated.trim();
        return translated.trim();
      }
    }
  } catch (err) {
    console.warn("Google Translate failed on chatbot translation helper, falling back to Gemini:", err);
  }

  // Find language name
  const langObj = LANGUAGES.find(l => l.code === targetLang);
  const langName = langObj ? langObj.name : targetLang;

  try {
    const prompt = `You are a professional translator. Translate this text into ${langName}. The translation must be clean, natural, and friendly for a chat bot, keeping any emoji and bracketed terms (like [Ticket ID]) or tags intact. Output ONLY the translated text, nothing else.
Text: "${text}"`;
    const res = await fetchGeminiWithFallback([{ parts: [{ text: prompt }] }]);
    const json = await res.json();
    const result = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (result) {
      translationCache[cacheKey] = result;
      return result;
    }
  } catch (err) {
    console.error("Gemini translation failed:", err);
  }
  return text; // Fallback
}

// Initialize Bot API
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("Jansetu Telegram Bot is long-polling (Google Translate synchronized sync)...");

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text || '';
  
  // Clean states on start
  if (userText === '/start') {
    userState.set(chatId, { step: 'LANG' });
    
    // Group languages into columns of 2
    const inlineKeyboard = [];
    for (let i = 0; i < LANGUAGES.length; i += 2) {
      const row = [];
      row.push({ text: LANGUAGES[i].name, callback_data: `lang_${LANGUAGES[i].code}` });
      if (i + 1 < LANGUAGES.length) {
        row.push({ text: LANGUAGES[i + 1].name, callback_data: `lang_${LANGUAGES[i + 1].code}` });
      }
      inlineKeyboard.push(row);
    }

    bot.sendMessage(chatId, T.welcome, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
    return;
  }

  const session = userState.get(chatId);
  if (!session) {
    bot.sendMessage(chatId, "Please type /start to initialize the bot.");
    return;
  }

  const lang = session.lang || 'en';

  // Handle Location sharing response
  if (msg.location) {
    const lat = msg.location.latitude;
    const lng = msg.location.longitude;
    
    const constituency = getConstituencyFromCoords(lat, lng);
    session.constituency = constituency;
    session.location = { lat, lng };
    session.step = 'MENU';
    userState.set(chatId, session);

    const templateText = T.constituencySelected(constituency);
    const msgText = await translateBotText(templateText, lang);
    await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
    sendMainMenu(chatId, lang);
    return;
  }

  // Handle population input override state
  if (session.step === 'OVERRIDE_POP_INPUT') {
    const pop = parseInt(userText.trim(), 10);
    if (!isNaN(pop) && pop > 0) {
      session.tempSubmission.population = pop;
      await sendPreSubmissionDashboard(chatId, session);
    } else {
      const errorMsg = await translateBotText("Please enter a valid positive number for population:", lang);
      await bot.sendMessage(chatId, errorMsg);
    }
    return;
  }

  // Handle clarification response message
  if (session.step === 'COMPLAINT_CLARIFY') {
    session.tempSubmission.inputText += `\nAdditional user clarification: ${userText}`;
    userState.set(chatId, session);
    
    const procText = await translateBotText(T.processing, lang);
    await bot.sendMessage(chatId, procText);
    
    await runBotInputAnalysis(chatId, session);
    return;
  }

  // Awaiting Media (Complaint or Suggestion)
  if (session.step === 'COMPLAINT_MEDIA' || session.step === 'SUGGESTION_MEDIA') {
    const type = session.step === 'COMPLAINT_MEDIA' ? 'complaint' : 'suggestion';
    
    // Initialize temporary submission parameters
    session.tempSubmission = {
      type: type,
      inputText: '',
      category: 'others',
      scope: 'ward',
      population: 5000,
      urgency: '🚨 Immediate Attention',
      fundingSource: '🏦 Municipality Budget',
      assetType: '🪠 Sanitation & Drainage',
      priorityScore: 50,
      priorityLabel: 'Medium Priority',
      safetyRisk: 'Low Risk',
      estimatedBudget: 'Medium Budget',
      aiSummary: '',
      boundingBoxes: [],
      photoFileId: null,
      photoUrl: '',
      submittedAsIs: false
    };

    let content = userText;
    let voiceFileId = msg.voice ? msg.voice.file_id : null;
    let photoFileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    
    let fileBase64 = '';

    const processText = await translateBotText(T.processing, lang);
    await bot.sendMessage(chatId, processText);

    // Handle Voice notes
    if (voiceFileId) {
      try {
        const directLink = await bot.getFileLink(voiceFileId);
        const fileRes = await fetch(directLink);
        const buffer = await fileRes.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString('base64');
        
        // Transcribe voice verbatim in spoken language
        const geminiRes = await fetchGeminiWithFallback([
          { inlineData: { mimeType: 'audio/ogg', data: fileBase64 } },
          { text: "You are the voice transcriber for Jansetu. Please transcribe this audio file verbatim. The speaker may speak in any of the 22 Indian languages or English. Output ONLY the plain transcription in the spoken language. Do not add any greeting or meta-text." }
        ]);
        const data = await geminiRes.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Voice input received.";
      } catch (err) {
        console.error(err);
        content = "Voice note received (Transcription failed).";
      }
    } 
    // Handle Photo uploads
    else if (photoFileId) {
      try {
        const directLink = await bot.getFileLink(photoFileId);
        session.tempSubmission.photoUrl = directLink;
        session.tempSubmission.photoFileId = photoFileId;

        const fileRes = await fetch(directLink);
        const buffer = await fileRes.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString('base64');

        // Gemini Visual Analysis & Bounding Box estimates
        const imgPrompt = `You are the AI engine of Jansetu. Analyze this image of a public infrastructure or community issue. Output a detailed description of the problem in English. Localize the key objects representing the damage or issue by generating bounding box estimates representing percentage coordinates (0 to 100). For each box, provide: x, y, width, height (as integers), label (e.g., "pothole", "garbage"), and severity (e.g. "Immediate Attention", "Moderate"). Output strictly in JSON format: { "description": "...", "boundingBoxes": [ { "x": 10, "y": 20, "width": 40, "height": 30, "label": "pothole", "severity": "Immediate Attention" } ] }`;

        const geminiRes = await fetchGeminiWithFallback([
          { inlineData: { mimeType: 'image/jpeg', data: fileBase64 } },
          { text: imgPrompt }
        ]);
        const data = await geminiRes.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
        const imgResult = JSON.parse(rawText.replace(/```json|```/g, ''));
        
        content = imgResult.description || "Photo input received.";
        const boundingBoxes = imgResult.boundingBoxes || [];
        session.tempSubmission.boundingBoxes = boundingBoxes;

        // Overlay boxes and send to user
        if (boundingBoxes.length > 0) {
          const tempInputPath = path.join(__dirname, `temp_input_${chatId}.jpg`);
          const tempOutputPath = path.join(__dirname, `temp_output_${chatId}.jpg`);
          fs.writeFileSync(tempInputPath, Buffer.from(buffer));
          
          await new Promise((resolve) => {
            const boxesJson = JSON.stringify(boundingBoxes);
            const { exec } = require('child_process');
            exec(`python3 draw_boxes.py "${tempInputPath}" "${tempOutputPath}" '${boxesJson.replace(/'/g, "'\\''")}'`, async (error) => {
              if (!error) {
                try {
                  const drawInfo = await translateBotText("AI visual detection: anomalies highlighted in red.", lang);
                  await bot.sendPhoto(chatId, tempOutputPath, { caption: drawInfo });
                } catch (e) {
                  console.error("Failed to send annotated photo:", e);
                }
              }
              try { fs.unlinkSync(tempInputPath); } catch (e) {}
              try { fs.unlinkSync(tempOutputPath); } catch (e) {}
              resolve();
            });
          });
        }
      } catch (err) {
        console.error("Photo processing error:", err);
        content = "Photo attachment received (Analysis failed).";
      }
    }

    session.tempSubmission.inputText = content;
    userState.set(chatId, session);

    // Call classification & overview loop
    await runBotInputAnalysis(chatId, session);
    return;
  }

  // Awaiting status track query
  if (session.step === 'TRACK') {
    try {
      const docRef = doc(db, 'demands', userText.trim());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const d = docSnap.data();
        const detailMsg = T.ticketStatusMsg(docSnap.id, d.category, d.status);
        const translatedDetail = await translateBotText(detailMsg, lang);
        await bot.sendMessage(chatId, translatedDetail, { parse_mode: 'Markdown' });
      } else {
        const noTicketMsg = await translateBotText(T.noTicket, lang);
        await bot.sendMessage(chatId, noTicketMsg);
      }
    } catch {
      const noTicketMsg = await translateBotText(T.noTicket, lang);
      await bot.sendMessage(chatId, noTicketMsg);
    }

    session.step = 'MENU';
    userState.set(chatId, session);
    sendMainMenu(chatId, lang);
    return;
  }
});

// Run AI analysis prompt equivalent to website checks
async function runBotInputAnalysis(chatId, session) {
  const text = session.tempSubmission.inputText;
  const lang = session.lang || 'en';

  // Translate input to English first for classification pipeline
  let englishContent = text;
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
    if (res.ok) {
      const json = await res.json();
      const translated = json[0].map(x => x[0]).join('');
      if (translated) englishContent = translated.trim();
    }
  } catch (err) {
    console.warn("Input translation failed, falling back to raw text:", err);
  }

  const analysisPrompt = `
    Analyze this citizen suggestion/complaint details: "${englishContent}".
    Verify the issue and classify it. Output strictly a JSON object matching this schema:
    {
      "category": "Choose exactly one from: water, roads, education, health, power, agriculture, safety, environment, welfare, housing, anticorruption, digital, disaster, women, justice, economy, consumer, taxes, tourism, youth, innovation, rural, security, cyber, climate, space, foreign, others",
      "scope": "Choose exactly one from: household, street, ward, constituency",
      "estimatedPopulation": number (e.g. 5, 150, 5000, 10000),
      "urgency": "🚨 Immediate Attention" | "🔔 Normal Attention",
      "fundingSource": "🏦 Municipality Budget" | "MPLADS Fund" | "State Government Fund",
      "assetType": "🪠 Sanitation & Drainage" | "Roadway Infrastructure" | "Building Facility" | "Public Safety Asset",
      "priorityScore": number (0 to 100),
      "priorityLabel": "Critical Priority" | "High Priority" | "Medium Priority" | "Low Priority",
      "safetyRisk": "⚠️ High Threat / Hazard" | "Medium Risk" | "Low Risk",
      "estimatedBudget": "Mega Project" | "High Budget" | "🪙 Medium Budget" | "Low Budget",
      "problemBrief": "A 2-3 sentence clear summary outlining the infrastructure deficits, risks, and impact.",
      "requiresClarification": boolean (true if details are vague, missing outage duration, street markers, or dimensions),
      "clarificationQuestion": "A clear question asking for the missing parameter, or null if requiresClarification is false"
    }
  `;

  try {
    const res = await fetchGeminiWithFallback([{ parts: [{ text: analysisPrompt }] }]);
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const result = JSON.parse(rawText.replace(/```json|```/g, ''));
    
    // Write back classification parameters
    session.tempSubmission.category = result.category || 'others';
    session.tempSubmission.scope = result.scope || 'ward';
    session.tempSubmission.population = result.estimatedPopulation || 5000;
    session.tempSubmission.urgency = result.urgency || '🚨 Immediate Attention';
    session.tempSubmission.fundingSource = result.fundingSource || '🏦 Municipality Budget';
    session.tempSubmission.assetType = result.assetType || '🪠 Sanitation & Drainage';
    session.tempSubmission.priorityScore = result.priorityScore || 50;
    session.tempSubmission.priorityLabel = result.priorityLabel || 'Medium Priority';
    session.tempSubmission.safetyRisk = result.safetyRisk || 'Low Risk';
    session.tempSubmission.estimatedBudget = result.estimatedBudget || 'Medium Budget';
    session.tempSubmission.aiSummary = result.problemBrief || '';

    // Handle clarification questions unless user requested "Submit As Is"
    if (result.requiresClarification && !session.tempSubmission.submittedAsIs) {
      session.step = 'COMPLAINT_CLARIFY';
      userState.set(chatId, session);
      
      const transQuestion = await translateBotText(result.clarificationQuestion, lang);
      const submitAsIsText = await translateBotText("Submit as is anyway", lang);
      
      await bot.sendMessage(chatId, transQuestion, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚠️ ${submitAsIsText}`, callback_data: 'submit_as_is' }]
          ]
        }
      });
    } else {
      await sendPreSubmissionDashboard(chatId, session);
    }
  } catch (err) {
    console.error("AI Analysis failed:", err);
    await sendPreSubmissionDashboard(chatId, session);
  }
}

// Show interactive overrides dashboard
async function sendPreSubmissionDashboard(chatId, session) {
  session.step = 'PRE_SUBMIT_DASHBOARD';
  userState.set(chatId, session);
  
  const sub = session.tempSubmission;
  const lang = session.lang || 'en';
  
  const catObj = CATEGORY_MAP[sub.category] || { label: "Others", emoji: "📁" };
  const scopeLabel = SCOPE_MAP[sub.scope]?.label || sub.scope;

  const rawDashboard = `🤖 *AI Summary & Pre-Submission Overview*

*Problem Summary:* ${sub.aiSummary}

*AI Classification & Parameter Overrides:*
${catObj.emoji} *CATEGORY:* ${catObj.label}
🌐 *SCOPE:* ${scopeLabel} (Est. ${sub.population} citizens affected)
🚨 *URGENCY LEVEL:* ${sub.urgency}
🏦 *SUGGESTED FUNDING:* ${sub.fundingSource}
🔧 *ASSET TYPE:* ${sub.assetType}
📈 *PRIORITY LEVEL:* ${sub.priorityLabel} (${sub.priorityScore}/100)
⚠️ *SAFETY RISK:* ${sub.safetyRisk}
🪙 *ESTIMATED BUDGET:* ${sub.estimatedBudget}`;

  const translatedDashboard = await translateBotText(rawDashboard, lang);
  
  const changeCatText = await translateBotText("🏷️ Change Category", lang);
  const changeScopeText = await translateBotText("🌐 Change Scope", lang);
  const editPopText = await translateBotText("👥 Edit Population Impact", lang);
  const confirmText = await translateBotText("✅ Confirm & Submit", lang);
  const cancelText = await translateBotText("❌ Cancel", lang);

  bot.sendMessage(chatId, translatedDashboard, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: changeCatText, callback_data: 'override_category' },
          { text: changeScopeText, callback_data: 'override_scope' }
        ],
        [
          { text: editPopText, callback_data: 'override_pop' }
        ],
        [
          { text: confirmText, callback_data: 'submit_final' },
          { text: cancelText, callback_data: 'cancel_submission' }
        ]
      ]
    }
  });
}

function cleanUndefined(obj) {
  if (obj === null || obj === undefined) return null;
  const result = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = cleanUndefined(val);
      } else if (Array.isArray(val)) {
        result[key] = val.map(item => (item && typeof item === 'object') ? cleanUndefined(item) : item);
      } else {
        result[key] = val;
      }
    }
  });
  return result;
}

// Write to Firestore & generate tracking outputs
async function submitFinalComplaint(chatId, session) {
  const sub = session.tempSubmission;
  const lang = session.lang || 'en';
  
  const docData = {
    ticketType: sub.type || 'complaint',
    category: sub.category || 'others',
    scope: sub.scope || 'ward',
    source: 'telegram',
    location: session.location || { lat: 28.803, lng: 79.025 },
    address: 'Submitted via JanSetuBot',
    constituency: session.constituency || 'Rampur',
    items: [{
      type: sub.photoFileId ? 'photo' : 'text',
      content: sub.inputText || '',
      fileUrl: sub.photoUrl || '',
      boundingBoxes: sub.boundingBoxes && sub.boundingBoxes.length > 0 ? sub.boundingBoxes : undefined,
      createdAt: new Date().toISOString()
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending',
    upvotes: 1,
    estimatedImpact: sub.population || 5000,
    urgency: (sub.urgency || 'Immediate Attention').replace(/🚨|🔔/g, '').trim(),
    assetType: (sub.assetType || 'others').replace(/🪠|🔧/g, '').trim(),
    fundingSource: (sub.fundingSource || 'MPLADS Fund').replace(/🏦/g, '').trim(),
    aiOverview: {
      brief: sub.aiSummary || '',
      priorityScore: sub.priorityScore || 50,
      priorityLabel: sub.priorityLabel || 'Medium Priority',
      safetyRisk: sub.safetyRisk || 'Low Risk',
      estimatedBudget: sub.estimatedBudget || 'Medium Budget',
      urgency: sub.urgency || '🚨 Immediate Attention',
      fundingSource: sub.fundingSource || '🏦 Municipality Budget'
    }
  };

  try {
    const cleaned = cleanUndefined(docData);
    const docRef = await addDoc(collection(db, 'demands'), cleaned);
    const ticketId = docRef.id;
    
    const trackingUrl = `https://jansetu-ef57d.web.app/track.html?id=${ticketId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(trackingUrl)}`;

    const rawSuccess = `✅ *Grievance Registered Successfully via JanSetuBot!*\n\nTicket Reference ID:\n\`${ticketId}\`\n\nYou can track this ticket live on the portal using the link below or by scanning the generated QR code.`;
    const successMsg = await translateBotText(rawSuccess, lang);

    await bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
    await bot.sendPhoto(chatId, qrUrl, { caption: `QR Code: Scan to track Reference ID ${ticketId}` });
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, "Failed to submit. Please try again.");
  }

  // Clear session
  session.step = 'MENU';
  session.tempSubmission = null;
  userState.set(chatId, session);
  sendMainMenu(chatId, lang);
}

// Inline Buttons Handler
bot.on('callback_query', async (queryData) => {
  const chatId = queryData.message.chat.id;
  const data = queryData.data;

  const session = userState.get(chatId) || {};
  const lang = session.lang || 'en';

  // Handle Language selection
  if (data.startsWith('lang_')) {
    const chosenLang = data.split('_')[1];
    session.lang = chosenLang;
    session.step = 'LOCATION';
    userState.set(chatId, session);

    const reqText = await translateBotText(T.locationRequest, chosenLang);
    const btnText = await translateBotText(T.locationBtn, chosenLang);

    bot.sendMessage(chatId, reqText, {
      reply_markup: {
        keyboard: [[{ text: btnText, request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  // Handle Menu clicks
  if (data === 'menu_1') {
    session.step = 'COMPLAINT_MEDIA';
    userState.set(chatId, session);
    const msgText = await translateBotText(T.promptMedia, lang);
    bot.sendMessage(chatId, msgText);
  } else if (data === 'menu_2') {
    session.step = 'SUGGESTION_MEDIA';
    userState.set(chatId, session);
    const msgText = await translateBotText(T.promptMedia, lang);
    bot.sendMessage(chatId, msgText);
  } else if (data === 'menu_3') {
    session.step = 'TRACK';
    userState.set(chatId, session);
    const msgText = await translateBotText(T.promptTrackId, lang);
    bot.sendMessage(chatId, msgText);
  } else if (data === 'menu_4') {
    const consty = session.constituency || 'Rampur';
    try {
      const q = query(
        collection(db, 'demands'),
        where('constituency', '==', consty),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        const noIssuesMsg = await translateBotText(T.noIssues, lang);
        bot.sendMessage(chatId, noIssuesMsg);
      } else {
        const upvoteTitle = await translateBotText(T.upvoteListTitle, lang);
        await bot.sendMessage(chatId, upvoteTitle);
        
        for (const docSnap of snap.docs) {
          const item = docSnap.data();
          const detailMsg = `📍 *Grievance:* ${item.category.toUpperCase()} issue\nStatus: ${item.status}\n👍 Upvotes: ${item.upvotes || 1}\nDetail: "${item.aiOverview?.brief || item.items?.[0]?.content?.slice(0, 100)}"`;
          const translatedDetail = await translateBotText(detailMsg, lang);
          const upvoteBtnText = await translateBotText("👍 Upvote Issue", lang);
          
          await bot.sendMessage(chatId, translatedDetail, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: upvoteBtnText, callback_data: `upvote_${docSnap.id}` }]
              ]
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
      const noIssuesMsg = await translateBotText(T.noIssues, lang);
      bot.sendMessage(chatId, noIssuesMsg);
    }
  }

  // Handle Upvotes
  if (data.startsWith('upvote_')) {
    const docId = data.replace('upvote_', '');
    try {
      const docRef = doc(db, 'demands', docId);
      await updateDoc(docRef, {
        upvotes: increment(1)
      });
      const upvoteDoneText = await translateBotText(T.upvoteDone, lang);
      bot.answerCallbackQuery(queryData.id, { text: upvoteDoneText, show_alert: true });
    } catch {
      const errText = await translateBotText("Error upvoting.", lang);
      bot.answerCallbackQuery(queryData.id, { text: errText, show_alert: true });
    }
  }

  // Handle pre-submission overrides dashboard clicks
  if (data === 'submit_as_is') {
    if (session.tempSubmission) {
      session.tempSubmission.submittedAsIs = true;
      await sendPreSubmissionDashboard(chatId, session);
    }
    bot.answerCallbackQuery(queryData.id);
  }

  if (data === 'override_category') {
    const inlineKeyboard = [];
    const keys = Object.keys(CATEGORY_MAP);
    for (let i = 0; i < keys.length; i += 2) {
      const row = [];
      const k1 = keys[i];
      row.push({ text: `${CATEGORY_MAP[k1].emoji} ${CATEGORY_MAP[k1].label}`, callback_data: `setcat_${k1}` });
      if (i + 1 < keys.length) {
        const k2 = keys[i + 1];
        row.push({ text: `${CATEGORY_MAP[k2].emoji} ${CATEGORY_MAP[k2].label}`, callback_data: `setcat_${k2}` });
      }
      inlineKeyboard.push(row);
    }
    inlineKeyboard.push([{ text: "⬅️ Back", callback_data: "back_to_dashboard" }]);

    const overrideTitle = await translateBotText("Select Category Override:", lang);
    bot.sendMessage(chatId, overrideTitle, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    bot.answerCallbackQuery(queryData.id);
  }

  if (data.startsWith('setcat_')) {
    const newCat = data.replace('setcat_', '');
    if (session.tempSubmission) {
      session.tempSubmission.category = newCat;
      await sendPreSubmissionDashboard(chatId, session);
    }
    bot.answerCallbackQuery(queryData.id);
  }

  if (data === 'override_scope') {
    const inlineKeyboard = [
      [{ text: "🏠 Household (1-10)", callback_data: "setscope_household" }],
      [{ text: "🛣️ Street (~150)", callback_data: "setscope_street" }],
      [{ text: "🏢 Ward (~5k)", callback_data: "setscope_ward" }],
      [{ text: "🏛️ Constituency (10k+)", callback_data: "setscope_constituency" }],
      [{ text: "⬅️ Back", callback_data: "back_to_dashboard" }]
    ];
    const overrideTitle = await translateBotText("Select Scope Override:", lang);
    bot.sendMessage(chatId, overrideTitle, {
      reply_markup: { inline_keyboard }
    });
    bot.answerCallbackQuery(queryData.id);
  }

  if (data.startsWith('setscope_')) {
    const newScope = data.replace('setscope_', '');
    if (session.tempSubmission) {
      session.tempSubmission.scope = newScope;
      // Prepopulate default population count for scope
      if (SCOPE_MAP[newScope]) {
        session.tempSubmission.population = SCOPE_MAP[newScope].defaultPopulation;
      }
      await sendPreSubmissionDashboard(chatId, session);
    }
    bot.answerCallbackQuery(queryData.id);
  }

  if (data === 'override_pop') {
    session.step = 'OVERRIDE_POP_INPUT';
    userState.set(chatId, session);
    const askMsg = await translateBotText("Please type the exact number of estimated citizens affected by this complaint: (e.g. 80)", lang);
    bot.sendMessage(chatId, askMsg);
    bot.answerCallbackQuery(queryData.id);
  }

  if (data === 'back_to_dashboard') {
    await sendPreSubmissionDashboard(chatId, session);
    bot.answerCallbackQuery(queryData.id);
  }

  if (data === 'submit_final') {
    if (session.tempSubmission) {
      await submitFinalComplaint(chatId, session);
    }
    bot.answerCallbackQuery(queryData.id);
  }

  if (data === 'cancel_submission') {
    session.tempSubmission = null;
    session.step = 'MENU';
    userState.set(chatId, session);
    const cancelMsg = await translateBotText("Submission cancelled.", lang);
    await bot.sendMessage(chatId, cancelMsg);
    sendMainMenu(chatId, lang);
    bot.answerCallbackQuery(queryData.id);
  }
});

// Helper: Show Main Menu Inline Buttons
async function sendMainMenu(chatId, lang) {
  const menuTitle = await translateBotText(T.mainMenuTitle, lang);
  const opt1 = await translateBotText(T.option1, lang);
  const opt2 = await translateBotText(T.option2, lang);
  const opt3 = await translateBotText(T.option3, lang);
  const opt4 = await translateBotText(T.option4, lang);

  bot.sendMessage(chatId, menuTitle, {
    reply_markup: {
      inline_keyboard: [
        [{ text: opt1, callback_data: "menu_1" }],
        [{ text: opt2, callback_data: "menu_2" }],
        [{ text: opt3, callback_data: "menu_3" }],
        [{ text: opt4, callback_data: "menu_4" }]
      ]
    }
  });
}
