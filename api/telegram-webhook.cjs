const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const TelegramBot = require("node-telegram-bot-api").default || require("node-telegram-bot-api").TelegramBot || require("node-telegram-bot-api");
const { initializeApp } = require("firebase/app");
const { 
  getFirestore, 
  collection, 
  setDoc, 
  getDoc, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  increment,
  orderBy,
  limit 
} = require("firebase/firestore");

// 1. Firebase Configuration
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

// 2. Telegram Bot API Settings
const BOT_TOKEN = "8724667418:AAFSz9FkGQd0DlyCf6TnrsVKdke-4xnx1Aw";
const bot = new TelegramBot(BOT_TOKEN);

// Load backup/custom key config
let geminiKeys = [
  Buffer.from('QVEuQWI4Uk42S09xQ2RrQUhiZERJaV9ydzNrVjN3aW4weFB1RUJFTkowZ2cyTkhubk5hRlE=', 'base64').toString('utf8'),
  Buffer.from('QVEuQWI4Uk42TC1SQzN4MjlBQUc5UVVQRXo5S3FWWlB6UEMzaE1EUXNqRVZfUVVUZkxNd1E=', 'base64').toString('utf8'),
  Buffer.from('QVEuQWI4Uk42S1ZmX1dWbjJlbTVUZkZvcVMyQ3E4S040eUJ4emdFUE5tZzdyTl8xU24zbXc=', 'base64').toString('utf8')
];
try {
  const filepath = path.join(__dirname, "bot_config.json");
  if (fs.existsSync(filepath)) {
    const configData = JSON.parse(fs.readFileSync(filepath, "utf8"));
    if (configData.gemini_key) {
      geminiKeys.push(configData.gemini_key);
    }
  }
} catch (e) {}

if (geminiKeys.length === 0) {
  geminiKeys.push("AIzaSyDummyKeyForJansetuFastPrototypeScale");
}

let currentKeyIndex = 0;
function getActiveGeminiKey() {
  if (geminiKeys.length === 0) return "AIzaSyDummyKeyForJansetuFastPrototypeScale";
  return geminiKeys[currentKeyIndex % geminiKeys.length];
}
function rotateGeminiKey() {
  currentKeyIndex++;
}

let globalResetTimestamp = 0;

// Sync API keys from Firestore demands/config_gemini
async function syncKeysFromFirestore() {
  try {
    const docRef = doc(db, "demands", "config_gemini");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.keys) {
        const fetched = data.keys.trim();
        const parsedKeys = fetched.split(/[\n\r,;]+/).map(k => k.trim()).filter(Boolean);
        if (parsedKeys.length > 0) {
          geminiKeys = [...new Set([
            Buffer.from('QVEuQWI4Uk42S09xQ2RrQUhiZERJaV9ydzNrVjN3aW4weFB1RUJFTkowZ2cyTkhubk5hRlE=', 'base64').toString('utf8'),
            Buffer.from('QVEuQWI4Uk42TC1SQzN4MjlBQUc5UVVQRXo5S3FWWlB6UEMzaE1EUXNqRVZfUVVUZkxNd1E=', 'base64').toString('utf8'),
            Buffer.from('QVEuQWI4Uk42S1ZmX1dWbjJlbTVUZkZvcVMyQ3E4S040eUJ4emdFUE5tZzdyTl8xU24zbXc=', 'base64').toString('utf8'),
            ...parsedKeys,
            ...geminiKeys
          ])];
        }
      }
    }
  } catch (err) {
    console.warn("[Bot Gemini] Failed to sync keys:", err.message);
  }

  try {
    const resetRef = doc(db, "demands", "reset_timestamp");
    const resetSnap = await getDoc(resetRef);
    if (resetSnap.exists()) {
      const resetData = resetSnap.data();
      if (resetData && resetData.resetTimestamp) {
        globalResetTimestamp = new Date(resetData.resetTimestamp).getTime();
        console.log(`[Bot Sync] Synced global reset timestamp: ${resetData.resetTimestamp}`);
      }
    }
  } catch (err) {
    console.warn("[Bot Sync] Failed to sync reset timestamp:", err.message);
  }
}

// Crowdsourcing clarification details question
async function askGeminiWhatDetailsAreNeeded(gap) {
  const itemsText = (gap.items || [])
    .map((item, idx) => `[Contribution ${idx + 1}]: ${item.content || item.speechTranscript || ""}`)
    .join("\n");
  const prompt = `You are the AI coordinator of Jansetu. We have an incomplete civic complaint/suggestion:
Category: ${gap.category}, Scope: ${gap.scope}.
Here is all the description and evidence collected so far:
${itemsText}

Analyze this context and write a polite, friendly 1-sentence question in English asking the user to provide the exact missing detail that is still needed to understand the problem fully and solve it (like specific landmark, landmark markers, street name, pothole dimensions, water smell/color, timing, or duration of the issue). Output ONLY the direct question, no meta-text.`;
  try {
    const res = await fetchGeminiWithFallback([{ parts: [{ text: prompt }] }]);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return text;
  } catch (e) {
    console.error("Gemini details prompt call failed:", e);
  }
  return gap.clarificationQuestion || "Please provide more details or pictures of the issue to help us verify it.";
}

// Auto-detect actual MIME type from base64 header bytes
function detectMimeFromBase64(base64) {
  const sig = base64.substring(0, 8);
  if (sig.startsWith("/9j/"))    return "image/jpeg";
  if (sig.startsWith("iVBORw")) return "image/png";
  if (sig.startsWith("R0lGOD")) return "image/gif";
  if (sig.startsWith("UklGRi") || sig.startsWith("AAABAA")) return "image/webp";
  return "image/jpeg";
}

function normalizeBoxes(rawBoxes) {
  if (!Array.isArray(rawBoxes)) return [];
  return rawBoxes.map(b => {
    if (Array.isArray(b) && b.length >= 4) {
      const is1000 = Math.max(...b) > 100;
      const scale = is1000 ? 10 : 1;
      const y1 = b[0] / scale;
      const x1 = b[1] / scale;
      const y2 = b[2] / scale;
      const x2 = b[3] / scale;
      return {
        x: Math.round(x1),
        y: Math.round(y1),
        width: Math.round(x2 - x1),
        height: Math.round(y2 - y1),
        label: "Issue",
        severity: "Immediate Attention"
      };
    }
    if (typeof b === "object" && b !== null) {
      let x = b.x !== undefined ? Number(b.x) : (b.xmin !== undefined ? Number(b.xmin) : (b.left !== undefined ? Number(b.left) : 0));
      let y = b.y !== undefined ? Number(b.y) : (b.ymin !== undefined ? Number(b.ymin) : (b.top !== undefined ? Number(b.top) : 0));
      let w = b.width !== undefined ? Number(b.width) : (b.w !== undefined ? Number(b.w) : -1);
      let h = b.height !== undefined ? Number(b.height) : (b.h !== undefined ? Number(b.h) : -1);

      if (w === -1 && b.xmax !== undefined) w = Number(b.xmax) - x;
      if (h === -1 && b.ymax !== undefined) h = Number(b.ymax) - y;
      if (w === -1 && b.right !== undefined) w = Number(b.right) - x;
      if (h === -1 && b.bottom !== undefined) h = Number(b.bottom) - y;

      if (w === -1) w = 20;
      if (h === -1) h = 20;

      if (x > 100 || y > 100 || w > 100 || h > 100) {
        x = Math.round(x / 10);
        y = Math.round(y / 10);
        w = Math.round(w / 10);
        h = Math.round(h / 10);
      }

      return {
        x: Math.max(0, Math.min(100, Math.round(x))),
        y: Math.max(0, Math.min(100, Math.round(y))),
        width: Math.max(1, Math.min(100, Math.round(w))),
        height: Math.max(1, Math.min(100, Math.round(h))),
        label: b.label || b.name || "Issue",
        severity: b.severity || "Immediate Attention"
      };
    }
    return null;
  }).filter(Boolean);
}

// Text-only fallback — tries all keys across multiple models (same strategy as fetchGeminiVision)
async function fetchGeminiWithFallback(contents) {
  await syncKeysFromFirestore();
  const TEXT_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];

  for (const model of TEXT_MODELS) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[(currentKeyIndex + i) % geminiKeys.length];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          }),
        });
        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          console.warn(`[Gemini] ${model} key[${i}] HTTP ${response.status}: ${errBody.slice(0, 120)}`);
          continue;
        }
        const json = await response.json();
        if (!json.candidates || json.candidates.length === 0) {
          console.warn(`[Gemini] ${model} key[${i}] returned empty candidates`);
          continue;
        }
        const jsonStr = JSON.stringify(json);
        return { json: async () => JSON.parse(jsonStr), ok: true };
      } catch (err) {
        console.warn(`[Gemini] ${model} key[${i}] threw: ${err.message}`);
      }
    }
  }
  throw new Error("All Gemini API keys and models exhausted.");
}

// Vision-specific cascade
async function fetchGeminiVision(parts) {
  await syncKeysFromFirestore();
  const VISION_MODELS = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of VISION_MODELS) {
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[(currentKeyIndex + i) % geminiKeys.length];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
          }),
        });
        if (!response.ok) continue;
        const json = await response.json();
        if (!json.candidates || json.candidates.length === 0) continue;
        const text = json.candidates[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err) {}
    }
  }
  return null;
}

// 3. Supported Languages List
const LANGUAGES = [
  { name: "English", code: "en" },
  { name: "हिंदी (Hindi)", code: "hi" },
  { name: "বাংলা (Bengali)", code: "bn" },
  { name: "తెలుగు (Telugu)", code: "te" },
  { name: "मराठी (Marathi)", code: "mr" },
  { name: "தமிழ் (Tamil)", code: "ta" },
  { name: "ગુજરાતી (Gujarati)", code: "gu" },
  { name: "ಕನ್ನಡ (Kannada)", code: "kn" },
  { name: "മലയാളം (Malayalam)", code: "ml" },
  { name: "ଓଡ଼िଆ (Odia)", code: "or" },
  { name: "ਪੰਜਾਬੀ (Punjabi)", code: "pa" },
  { name: "অসমীয়া (Assamese)", code: "as" },
  { name: "اردو (Urdu)", code: "ur" },
  { name: "संस्कृतम् (Sanskrit)", code: "sa" },
  { name: "नेपाली (Nepali)", code: "ne" },
  { name: "सिंधी (Sindhi)", code: "sd" },
  { name: "कोंकणी (Konkani)", code: "kok" },
  { name: "डोगरी (Dogri)", code: "doi" },
  { name: "मैथिली (Maithili)", code: "mai" },
  { name: "मणिपुरी (Manipuri)", code: "mni" },
  { name: "बोडो (Bodo)", code: "brx" },
  { name: "संथाली (Santali)", code: "sat" },
  { name: "कश्मीरी (Kashmiri)", code: "ks" }
];

// All 28 Category Mappings
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

// Scope mappings
const SCOPE_MAP = {
  household: { label: "Household (1-10)", defaultPopulation: 5 },
  street: { label: "Street (~150)", defaultPopulation: 150 },
  ward: { label: "Ward (~5k)", defaultPopulation: 5000 },
  constituency: { label: "Constituency (10k+)", defaultPopulation: 10000 }
};

// Load constituencies
let constituenciesData = {};
try {
  const filepath = path.join(__dirname, "constituencies_543.json");
  const raw = fs.readFileSync(filepath, "utf8");
  constituenciesData = JSON.parse(raw);
} catch (e) {}

// Haversine Distance helper
function getHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getConstituencyFromCoords(lat, lng) {
  let closestName = "Rampur";
  let minDistance = Infinity;

  Object.keys(constituenciesData).forEach((name) => {
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

// Helpers
const T = {
  welcome: "Welcome to Jansetu Bot! Please choose your preferred language:",
  locationRequest: "Please share your current location (GPS) by tapping the button below so we can find your parliamentary constituency.",
  locationBtn: "📍 Share Current Location",
  constituencySelected: (constituency) => `Location matched! Your Parliamentary Constituency is: *${constituency}*`,
  mainMenuTitle: "Main Menu - What would you like to do?",
  option1: "📝 Register Complaint",
  option2: "💡 Send Suggestion",
  option3: "🔍 Track Status",
  option4: "🗳️ Update Local Gaps",
  promptMedia: "Please submit your detail: You can type text, send a photo of the issue, or record a voice note.",
  processing: "⏳ Jansetu AI is processing your input...",
  promptTrackId: "🔍 *Track Your Complaint*\n\nPlease enter your full Complaint Reference ID (e.g., `JS-HOW-2026-X8D2K`):",
  noTicket: "❌ No complaint found with that ID. Please check the ID and try again.",
  ticketStatusMsg: (d, id) => {
    const STATUS_META = {
      pending:      { label: "Submitted — Pending Review", icon: "📥" },
      needs_info:   { label: "Needs More Information", icon: "❓" },
      approved:     { label: "Manager Approved ✅", icon: "✅" },
      reviewed:     { label: "Under Active Review", icon: "🔍" },
      raised:       { label: "Raised in Parliament 🏛️", icon: "🏛️" },
      funded:       { label: "Funds Released 💰", icon: "💰" },
      work_started: { label: "Work Started 🔧", icon: "🔧" },
      completed:    { label: "Completed 🎉", icon: "🎉" },
      solved:       { label: "Fully Resolved 🎯", icon: "🎯" },
    };
    const statusOrder = ["pending","needs_info","approved","reviewed","raised","funded","work_started","completed","solved"];
    const s = STATUS_META[d.status] || STATUS_META["pending"];
    const idx = statusOrder.indexOf(d.status || "pending");
    const check = (n) => idx >= statusOrder.indexOf(n) ? "✅" : "⬜";
    const trackUrl = `https://jansetu-ef57d.web.app/track.html?id=${id}`;
    return [
      `🗳️ *Jansetu Complaint Status*`,
      ``,
      `*Complaint ID:* \`${id}\``,
      `*Status:* ${s.icon} ${s.label}`,
      `*Category:* ${(d.category || "general").toUpperCase()}  |  *Scope:* ${(d.scope || "ward").toUpperCase()}`,
      `*Constituency:* ${d.constituency || "N/A"}`,
      `*Submitted:* ${d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-IN") : "N/A"}`,
      `*👍 Community Support:* ${d.upvotes || 1} neighbour${(d.upvotes || 1) !== 1 ? "s" : ""} have upvoted this`,
      ``,
      `📊 *Milestone Progress:*`,
      `${check("pending")} Complaint Submitted`,
      `${d.aiOverview?.brief ? "✅" : "⬜"} AI Verified & Classified`,
      `${check("approved")} Manager Approved`,
      `${d.linkedPlan ? "✅" : "⬜"} Grouped in AI Action Plan`,
      `${check("raised")} Raised in Parliament`,
      `${check("funded")} Funds Released`,
      `${check("work_started")} Work Started On-site`,
      `${["completed","solved"].includes(d.status) ? "✅" : "⬜"} Issue Resolved`,
      ``,
      `🔗 *Full detailed tracking page:*`,
      `${trackUrl}`,
    ].join("\n");
  },
  upvoteListTitle: "Select a local grievance to support/upvote:",
  noIssues: "No active verified grievances found in your constituency.",
  upvoteDone: "👍 Upvoted successfully! Thank you for your support."
};

const translationCache = {};
async function translateBotText(text, targetLang) {
  if (!targetLang || targetLang === "en") return text;
  const cacheKey = `${text}_${targetLang}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    if (res.ok) {
      const json = await res.json();
      const translated = json[0].map(x => x[0]).join("");
      if (translated) {
        translationCache[cacheKey] = translated.trim();
        return translated.trim();
      }
    }
  } catch (err) {}

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
  } catch (err) {}
  return text;
}

function getSessionDocId(chatId) {
  const hash = crypto.createHash("md5").update(String(chatId)).digest("hex").toUpperCase();
  return `JS-BOT-2026-${hash.slice(0, 5)}`;
}

// Stateless user conversation flow manager using Firestore 'demands' collection
async function getUserSession(chatId) {
  try {
    const docId = getSessionDocId(chatId);
    const docRef = doc(db, "demands", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    console.error("[Jansetu Bot] Error getting session:", err);
  }
  return { step: "LANG" };
}

async function saveUserSession(chatId, session) {
  try {
    const docId = getSessionDocId(chatId);
    const docRef = doc(db, "demands", docId);
    
    const docData = {
      ...session,
      id: docId,
      ticketType: "complaint",
      category: "others",
      scope: "ward",
      source: "telegram",
      location: session.location || { lat: 28.803, lng: 79.025 },
      address: "JanSetuBot Session",
      constituency: session.constituency || "Rampur",
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "pending",
      upvotes: 1,
      estimatedImpact: 5000,
      isBotSession: true
    };

    await setDoc(docRef, docData);
  } catch (err) {
    console.error("[Jansetu Bot] Error saving user session:", err);
  }
}

// Message handler
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userText = msg.text || "";

  if (userText === "/start") {
    const session = { step: "LANG" };
    await saveUserSession(chatId, session);

    const inlineKeyboard = [];
    for (let i = 0; i < LANGUAGES.length; i += 2) {
      const row = [];
      row.push({ text: LANGUAGES[i].name, callback_data: `lang_${LANGUAGES[i].code}` });
      if (i + 1 < LANGUAGES.length) {
        row.push({ text: LANGUAGES[i + 1].name, callback_data: `lang_${LANGUAGES[i + 1].code}` });
      }
      inlineKeyboard.push(row);
    }

    await bot.sendMessage(chatId, T.welcome, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    return;
  }

  const session = await getUserSession(chatId);
  const lang = session.lang || "en";

  if (msg.location) {
    const lat = msg.location.latitude;
    const lng = msg.location.longitude;
    const constituency = getConstituencyFromCoords(lat, lng);
    session.constituency = constituency;
    session.location = { lat, lng };
    session.step = "MENU";
    await saveUserSession(chatId, session);

    const templateText = T.constituencySelected(constituency);
    const msgText = await translateBotText(templateText, lang);
    await bot.sendMessage(chatId, msgText, { parse_mode: "Markdown" });
    await sendMainMenu(chatId, lang);
    return;
  }

  if (session.step === "OVERRIDE_POP_INPUT") {
    const pop = parseInt(userText.trim(), 10);
    if (!isNaN(pop) && pop > 0) {
      session.tempSubmission.population = pop;
      await saveUserSession(chatId, session);
      await sendPreSubmissionDashboard(chatId, session);
    } else {
      const errorMsg = await translateBotText("Please enter a valid positive number for population:", lang);
      await bot.sendMessage(chatId, errorMsg);
    }
    return;
  }

  if (session.step === "PROVIDE_DETAILS") {
    let content = userText;
    let photoFileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    let fileUrl = "";

    await syncKeysFromFirestore();
    const processingMsg = await translateBotText("⏳ Adding your contribution...", lang);
    const sentMsg = await bot.sendMessage(chatId, processingMsg);

    if (photoFileId) {
      try {
        fileUrl = await bot.getFileLink(photoFileId);
        content = content || "Uploaded a photo contribution";
      } catch (err) {}
    }

    try {
      const docRef = doc(db, "demands", session.activeGapDocId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const itemData = docSnap.data();
        const items = itemData.items || [];
        items.push({
          type: photoFileId ? "photo" : "text",
          content: content,
          fileUrl: fileUrl,
          createdAt: new Date().toISOString()
        });

        await updateDoc(docRef, {
          items: items,
          status: "pending",
          needsMoreInfo: false,
          updatedAt: new Date().toISOString()
        });

        try {
          await bot.deleteMessage(chatId, sentMsg.message_id);
        } catch {}

        const successText = await translateBotText("✅ Thank you! Your crowdsourced contribution has been added. The planning team has been notified and the issue is now pending verification.", lang);
        await bot.sendMessage(chatId, successText);
      }
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "Failed to submit details. Please try again.");
    }

    session.step = "MENU";
    session.activeGapDocId = null;
    session.localGaps = null;
    await saveUserSession(chatId, session);
    await sendMainMenu(chatId, lang);
    return;
  }

  if (session.step === "COMPLAINT_CLARIFY") {
    session.tempSubmission.inputText += `\nAdditional user clarification: ${userText}`;
    await saveUserSession(chatId, session);

    const procText = await translateBotText(T.processing, lang);
    await bot.sendMessage(chatId, procText);
    await runBotInputAnalysis(chatId, session);
    return;
  }

  if (session.step === "COMPLAINT_MEDIA" || session.step === "SUGGESTION_MEDIA") {
    const type = session.step === "COMPLAINT_MEDIA" ? "complaint" : "suggestion";

    session.tempSubmission = {
      type: type,
      inputText: "",
      category: "others",
      scope: "ward",
      population: 5000,
      urgency: "🚨 Immediate Attention",
      fundingSource: "🏦 Municipality Budget",
      assetType: "🪠 Sanitation & Drainage",
      priorityScore: 50,
      priorityLabel: "Medium Priority",
      safetyRisk: "Low Risk",
      estimatedBudget: "Medium Budget",
      aiSummary: "",
      boundingBoxes: [],
      photoFileId: null,
      photoUrl: "",
      submittedAsIs: false
    };

    let content = userText;
    let voiceFileId = msg.voice ? msg.voice.file_id : null;
    let photoFileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    let fileBase64 = "";

    const processText = await translateBotText(T.processing, lang);
    await bot.sendMessage(chatId, processText);

    if (voiceFileId) {
      try {
        const directLink = await bot.getFileLink(voiceFileId);
        const fileRes = await fetch(directLink);
        const buffer = await fileRes.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString("base64");

        // Temporarily store voice note base64 in database
        session.tempSubmission.voiceData = fileBase64;
        await saveUserSession(chatId, session);

        const voiceText = await fetchGeminiVision([
          { inlineData: { mimeType: "audio/ogg", data: fileBase64 } },
          { text: "You are the voice transcriber for Jansetu. Please transcribe this audio file verbatim. The speaker may speak in any of the 22 Indian languages or English. First check if there is any real spoken speech. If speech is present, output ONLY the verbatim transcription in the spoken language. If no speech detected, output exactly: NO_SPEECH_DETECTED" }
        ]);

        // Clean up from database immediately after transcription finishes
        session.tempSubmission.voiceData = null;
        await saveUserSession(chatId, session);

        if (voiceText && voiceText.trim() !== "NO_SPEECH_DETECTED" && voiceText.trim().length > 2) {
          content = voiceText.trim();
        } else {
          content = "Voice note received — no clear speech detected.";
        }
      } catch (err) {
        // Safe cleanup on catch block
        session.tempSubmission.voiceData = null;
        await saveUserSession(chatId, session);
        content = "Voice note received (Transcription failed).";
      }
    } else if (photoFileId) {
      try {
        const directLink = await bot.getFileLink(photoFileId);
        session.tempSubmission.photoUrl = directLink;
        session.tempSubmission.photoFileId = photoFileId;

        const fileRes = await fetch(directLink);
        const buffer = await fileRes.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString("base64");

        const detectedMime = detectMimeFromBase64(fileBase64);
        const imgPrompt = `You are the AI engine of Jansetu, an Indian civic grievance platform. Carefully analyze this image.

If you can identify a civic or public infrastructure issue (potholes, overflowing garbage, broken pipe, cracked road, open drain, damaged school/hospital/building, waterlogging, broken streetlight, etc.):
1. Write a detailed English description: type of issue, severity, approximate scale, surroundings, and any visible text/signs/boards.
2. Generate bounding boxes (% of image, 0–100) around the damaged areas. Each box: x, y, width, height (integers), label (short name), severity ("Immediate Attention"/"Moderate"/"Minor").
3. Set requiresMoreContext to false.
4. Set isValidCivicIssue to true.

If the image is blurry, dark, unclear, or doesn't show a public issue (e.g. faces, interiors, unrelated items):
- Set requiresMoreContext to true with a brief description of what is visible.
- Set isValidCivicIssue to false.

Output ONLY valid JSON. No markdown. No explanation outside JSON.
Schema: { "description": "...", "requiresMoreContext": false, "isValidCivicIssue": true, "boundingBoxes": [ { "x": 10, "y": 20, "width": 40, "height": 30, "label": "pothole", "severity": "Immediate Attention" } ] }`;

        let rawText = await fetchGeminiVision([
          { inlineData: { mimeType: detectedMime, data: fileBase64 } },
          { text: imgPrompt }
        ]);

        let imgResult = null;
        if (rawText) {
          const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          try {
            imgResult = JSON.parse(cleaned);
          } catch (_) {
            const repaired = await fetchGeminiVision([
              { text: `Fix this malformed JSON and return ONLY valid JSON, no explanation:\n${cleaned}` }
            ]);
            if (repaired) {
              try {
                imgResult = JSON.parse(repaired.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim());
              } catch (_) {}
            }
          }
        }

        if (imgResult && imgResult.description) {
          if (imgResult.isValidCivicIssue === false) {
            content = "Photo received — AI could not identify any valid civic or infrastructure issue in this image.";
          } else {
            content = imgResult.description;
          }
        } else {
          content = "Photo received — AI could not identify a specific issue. Please add a text description.";
        }

        const rawBoxes = imgResult?.boundingBoxes || imgResult?.bounding_boxes || [];
        session.tempSubmission.boundingBoxes = normalizeBoxes(rawBoxes);

        const descriptionMsg = `🔍 *AI Image Analysis Summary:* \n\n${content}`;
        const transDescription = await translateBotText(descriptionMsg, lang);
        await bot.sendMessage(chatId, transDescription, { parse_mode: "Markdown" });
      } catch (err) {
        content = "Photo received (Analysis failed — please add a text description).";
      }
    }

    session.tempSubmission.inputText = content;
    await saveUserSession(chatId, session);

    // Check for nearby unverified issues before AI analysis
    if (session.location?.lat && session.location?.lng) {
      try {
        const lat = session.location.lat;
        const lng = session.location.lng;
        const latOff = 0.015;
        const lngOff = 0.015;

        await syncKeysFromFirestore();
        const snap = await getDocs(collection(db, "demands"));
        const nearbyUnverified = [];
        snap.forEach(docSnap => {
          const item = docSnap.data();
          if (docSnap.id === "config_gemini" || item.isConfig || item.isBotSession) return;
          if (item.status === "deleted") return;
          
          const itemTime = new Date(item.createdAt || item.updatedAt || 0).getTime();
          if (itemTime <= globalResetTimestamp) return;

          if (item.status === "verified" || item.status === "resolved" || item.status === "closed") return;
          if (!item.location?.lat || !item.location?.lng) return;
          if (Math.abs(item.location.lat - lat) <= latOff && Math.abs(item.location.lng - lng) <= lngOff) {
            nearbyUnverified.push({ id: docSnap.id, ...item });
          }
        });

        if (nearbyUnverified.length > 0) {
          // Store nearby list in session for reference
          session.nearbyIssues = nearbyUnverified.map(h => ({
            id: h.id,
            category: h.category,
            description: h.aiOverview?.brief || h.items?.[0]?.content?.slice(0, 100) || "No description",
            upvotes: h.upvotes || 1,
            ticketType: h.ticketType || "complaint"
          }));
          session.step = "NEARBY_ISSUES_CHECK";
          await saveUserSession(chatId, session);

          const headerText = await translateBotText(
            `⚠️ *${nearbyUnverified.length} existing unverified issue(s) found near your location!*\n\nBefore registering a new complaint, check if any of these already cover your issue. You can upvote them to boost priority:\n`,
            lang
          );
          await bot.sendMessage(chatId, headerText, { parse_mode: "Markdown" });

          // Show each nearby issue with an upvote button (max 5)
          const topIssues = nearbyUnverified.slice(0, 5);
          const rows = topIssues.map(h => {
            const cat = (h.category || "others").toUpperCase();
            const typeEmoji = h.ticketType === "suggestion" ? "💡" : "⚠️";
            const desc = (h.aiOverview?.brief || h.items?.[0]?.content || "No description").slice(0, 80);
            return [{ text: `${typeEmoji} [${cat}] ${desc}... 👍 ${h.upvotes || 1} — Upvote`, callback_data: `nearby_upvote_${h.id}` }];
          });

          const proceedBtnText = await translateBotText("➡️ None match — Register my new complaint", lang);
          rows.push([{ text: proceedBtnText, callback_data: "nearby_proceed" }]);

          await bot.sendMessage(chatId, await translateBotText("Select an issue to upvote it, or proceed to register your new complaint:", lang), {
            reply_markup: { inline_keyboard: rows }
          });
          return;
        }
      } catch (err) {
        console.error("[NearbyCheck] Failed:", err.message);
      }
    }

    await runBotInputAnalysis(chatId, session);
    return;
  }

  if (session.step === "TRACK") {
    const ticketId = userText.trim();
    try {
      await syncKeysFromFirestore();
      const docRef = doc(db, "demands", ticketId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.status === "deleted") {
          const noTicketMsg = await translateBotText(T.noTicket, lang);
          await bot.sendMessage(chatId, noTicketMsg);
          return;
        }
        const itemTime = new Date(d.createdAt || d.updatedAt || 0).getTime();
        if (itemTime > globalResetTimestamp) {
          const detailMsg = T.ticketStatusMsg(d, docSnap.id);
          const translatedDetail = await translateBotText(detailMsg, lang);
          await bot.sendMessage(chatId, translatedDetail, { parse_mode: "Markdown" });

          const trackUrl = `https://jansetu-ef57d.web.app/track.html?id=${docSnap.id}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackUrl)}`;
          const qrCaption = await translateBotText(`📱 Scan this QR code to view the full complaint tracking page with timeline, AI clustering status, parliamentary history, and funding details.`, lang);
          await bot.sendPhoto(chatId, qrUrl, { caption: qrCaption });
        } else {
          const noTicketMsg = await translateBotText(T.noTicket, lang);
          await bot.sendMessage(chatId, noTicketMsg);
        }
      } else {
        const noTicketMsg = await translateBotText(T.noTicket, lang);
        await bot.sendMessage(chatId, noTicketMsg);
      }
    } catch (err) {
      const noTicketMsg = await translateBotText(T.noTicket, lang);
      await bot.sendMessage(chatId, noTicketMsg);
    }

    session.step = "MENU";
    await saveUserSession(chatId, session);
    await sendMainMenu(chatId, lang);
    return;
  }

  // Default handler: If the user types a text message and it is not handled by any step
  if (userText && userText.trim().length > 0) {
    if (!session.constituency) {
      const reqText = await translateBotText(T.locationRequest, lang);
      const btnText = await translateBotText(T.locationBtn, lang);
      await bot.sendMessage(chatId, reqText, {
        reply_markup: {
          keyboard: [[{ text: btnText, request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }

    session.step = "COMPLAINT_MEDIA";
    session.tempSubmission = {
      type: "complaint",
      inputText: userText,
      category: "others",
      scope: "ward",
      population: 5000,
      urgency: "🚨 Immediate Attention",
      fundingSource: "🏦 Municipality Budget",
      assetType: "🪠 Sanitation & Drainage",
      priorityScore: 50,
      priorityLabel: "Medium Priority",
      safetyRisk: "Low Risk",
      estimatedBudget: "Medium Budget",
      aiSummary: "",
      boundingBoxes: [],
      photoFileId: null,
      photoUrl: "",
      submittedAsIs: false
    };
    await saveUserSession(chatId, session);
    
    const processText = await translateBotText(T.processing, lang);
    await bot.sendMessage(chatId, processText);
    await runBotInputAnalysis(chatId, session);
    return;
  }
}

// AI Input Analysis
async function runBotInputAnalysis(chatId, session) {
  const text = session.tempSubmission.inputText;
  const lang = session.lang || "en";

  let englishContent = text;
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
    if (res.ok) {
      const json = await res.json();
      const translated = json[0].map(x => x[0]).join("");
      if (translated) englishContent = translated.trim();
    }
  } catch (err) {}

  const analysisPrompt = `
    Analyze this citizen suggestion/complaint details: "${englishContent}".
    Verify the issue and classify it. Also detect any specific location names, landmarks, streets, institutions, or place names mentioned in the text.
    Output strictly a JSON object matching this schema:
    {
      "category": "Choose exactly one from: water, roads, education, health, power, agriculture, safety, environment, welfare, housing, anticorruption, digital, disaster, women, justice, economy, consumer, taxes, tourism, youth, innovation, rural, security, cyber, climate, space, foreign, others",
      "scope": "Choose exactly one from: household, street, ward, constituency",
      "estimatedPopulation": number,
      "urgency": "🚨 Immediate Attention" | "🔔 Normal Attention",
      "fundingSource": "🏦 Municipality Budget" | "MPLADS Fund" | "State Government Fund",
      "assetType": "🪠 Sanitation & Drainage" | "Roadway Infrastructure" | "Building Facility" | "Public Safety Asset",
      "priorityScore": number,
      "priorityLabel": "Critical Priority" | "High Priority" | "Medium Priority" | "Low Priority",
      "safetyRisk": "⚠️ High Threat / Hazard" | "Medium Risk" | "Low Risk",
      "estimatedBudget": "Mega Project" | "High Budget" | "🪙 Medium Budget" | "Low Budget",
      "problemBrief": "A 2-3 sentence summary.",
      "detectedLocationName": "landmark name or null",
      "detectedLocationType": "school | hospital | police_station | road | market | park | temple | bus_stand | colony | other | null",
      "requiresClarification": boolean (set to true if critical details are still missing or vague, e.g. exact landmark, street/road name, pothole size, duration of issue, or specific timeline/benefits for suggestions. Keep requiresClarification as true and ask a follow-up question unless the description is already fully detailed, complete and actionable. Set to false ONLY when you are fully satisfied that the description is complete and clear.),
      "clarificationQuestion": "A friendly direct 1-sentence question asking the user to clarify the remaining missing parameter, or null if requiresClarification is false",
      "isValidCivicIssue": boolean
    }

    For "isValidCivicIssue":
    - Set to true if the text describes a valid public civic, infrastructure, or community issue (such as water cuts, potholes, broken street lights, sanitation, garbage accumulation, public safety, public schools/hospitals etc.).
    - Set to false if the text is general greeting (e.g. Hi, Hello), testing, gibberish/non-sensical, or explicitly indicates a transcription failure, empty message, or lack of civic relevance.
  `;

  try {
    const res = await fetchGeminiWithFallback([{ parts: [{ text: analysisPrompt }] }]);
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    const result = JSON.parse(rawText.replace(/```json|```/g, ""));
    
    // Rejection rules for invalid/gibberish civic issues or transcription failures
    const textLower = englishContent.toLowerCase();
    const isFailedInput = textLower.includes("no clear speech detected") || 
                          textLower.includes("transcription failed") || 
                          textLower.includes("could not identify a specific issue") || 
                          textLower.includes("could not identify any valid civic") ||
                          textLower.includes("analysis failed") ||
                          textLower.trim().length < 8;

    if (result.isValidCivicIssue === false || isFailedInput) {
      session.step = "MENU";
      await saveUserSession(chatId, session);
      
      const rejectText = await translateBotText(
        "❌ Sorry, I could not identify or verify a valid civic or public infrastructure issue in your message. Please describe the problem in more detail or send a clearer photo/audio describing a real public issue (such as roads, water logging, garbage piles, etc.).",
        lang
      );
      await bot.sendMessage(chatId, rejectText);
      sendMainMenu(chatId, lang);
      return;
    }

    session.tempSubmission.category = result.category || "others";
    session.tempSubmission.scope = result.scope || "ward";
    session.tempSubmission.population = result.estimatedPopulation || 5000;
    session.tempSubmission.urgency = result.urgency || "🚨 Immediate Attention";
    session.tempSubmission.fundingSource = result.fundingSource || "🏦 Municipality Budget";
    session.tempSubmission.assetType = result.assetType || "🪠 Sanitation & Drainage";
    session.tempSubmission.priorityScore = result.priorityScore || 50;
    session.tempSubmission.priorityLabel = result.priorityLabel || "Medium Priority";
    session.tempSubmission.safetyRisk = result.safetyRisk || "Low Risk";
    session.tempSubmission.estimatedBudget = result.estimatedBudget || "Medium Budget";
    session.tempSubmission.aiSummary = result.problemBrief || "";
    session.tempSubmission.requiresClarification = result.requiresClarification || false;
    session.tempSubmission.clarificationQuestion = result.clarificationQuestion || null;

    if (result.detectedLocationName && result.detectedLocationName !== "null") {
      session.tempSubmission.detectedLocationName = result.detectedLocationName;
      session.tempSubmission.detectedLocationType = result.detectedLocationType || "other";
    }

    if (result.requiresClarification && !session.tempSubmission.submittedAsIs) {
      session.step = "COMPLAINT_CLARIFY";
      await saveUserSession(chatId, session);
      
      const transQuestion = await translateBotText(result.clarificationQuestion, lang);
      const submitAsIsText = await translateBotText("Submit as is anyway", lang);
      
      await bot.sendMessage(chatId, transQuestion, {
        reply_markup: {
          inline_keyboard: [[{ text: `⚠️ ${submitAsIsText}`, callback_data: "submit_as_is" }]]
        }
      });
    } else if (result.detectedLocationName && result.detectedLocationName !== "null" && !session.tempSubmission.locationTagged) {
      session.step = "LOCATION_TAG_CONFIRM";
      await saveUserSession(chatId, session);

      const tagMsg = await translateBotText(
        `📌 I detected a location mentioned in your complaint: *${result.detectedLocationName}* (${result.detectedLocationType || "place"}).\n\nWould you like to tag this as the target landmark for your complaint? This helps managers locate the exact issue.`,
        lang
      );
      const tagYesText = await translateBotText("✅ Yes, tag this location", lang);
      const tagNoText = await translateBotText("⏭️ Skip, continue", lang);
      await bot.sendMessage(chatId, tagMsg, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: tagYesText, callback_data: "tag_location_yes" },
            { text: tagNoText, callback_data: "tag_location_no" }
          ]]
        }
      });
    } else {
      await sendPreSubmissionDashboard(chatId, session);
    }
  } catch (err) {
    console.error("AI Analysis failed:", err);
    session.step = "MENU";
    await saveUserSession(chatId, session);
    const failText = await translateBotText(
      "❌ Sorry, the AI processing failed or API rate limits were reached. Please describe the problem in more detail or send a clearer voice note/photo.",
      lang
    );
    await bot.sendMessage(chatId, failText);
    await sendMainMenu(chatId, lang);
  }
}

// Interactive overrides dashboard
async function sendPreSubmissionDashboard(chatId, session) {
  session.step = "PRE_SUBMIT_DASHBOARD";
  await saveUserSession(chatId, session);
  
  const sub = session.tempSubmission;
  const lang = session.lang || "en";
  
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

  await bot.sendMessage(chatId, translatedDashboard, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: changeCatText, callback_data: "override_category" },
          { text: changeScopeText, callback_data: "override_scope" }
        ],
        [
          { text: editPopText, callback_data: "override_pop" }
        ],
        [
          { text: confirmText, callback_data: "submit_final" },
          { text: cancelText, callback_data: "cancel_submission" }
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
      if (val && typeof val === "object" && !Array.isArray(val)) {
        result[key] = cleanUndefined(val);
      } else if (Array.isArray(val)) {
        result[key] = val.map(item => (item && typeof item === "object") ? cleanUndefined(item) : item);
      } else {
        result[key] = val;
      }
    }
  });
  return result;
}

function generateComplaintNumber(constituency) {
  const cleanConst = constituency ? constituency.replace(/[^a-zA-Z]/g, "") : "";
  const prefix = cleanConst.length >= 2 ? cleanConst.slice(0, 3).toUpperCase() : "GEN";
  const year = new Date().getFullYear();
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `JS-${prefix}-${year}-${randomPart}`;
}

async function submitFinalComplaint(chatId, session) {
  const sub = session.tempSubmission;
  const lang = session.lang || "en";

  // Guard: location MUST be set from user's shared GPS — never default to Rampur
  if (!session.location?.lat || !session.location?.lng) {
    const noLocMsg = await translateBotText(
      "⚠️ Your location has not been set. Please go back to the Main Menu and share your GPS location first before submitting a complaint.",
      lang
    );
    await bot.sendMessage(chatId, noLocMsg);
    session.step = "MENU";
    await saveUserSession(chatId, session);
    await sendMainMenu(chatId, lang);
    return;
  }

  const ticketId = generateComplaintNumber(session.constituency || "GEN");
  
  const docData = {
    id: ticketId,
    ticketType: sub.type || "complaint",
    category: sub.category || "others",
    scope: sub.scope || "ward",
    source: "telegram",
    location: session.location,
    address: session.constituency ? `Submitted via JanSetuBot — ${session.constituency} Constituency` : "Submitted via JanSetuBot",
    constituency: session.constituency || "Unknown",
    associatedPlace: sub.associatedPlace || undefined,
    items: [{
      type: sub.photoFileId ? "photo" : "text",
      content: sub.inputText || "",
      fileUrl: sub.photoUrl || "",
      boundingBoxes: sub.boundingBoxes && sub.boundingBoxes.length > 0 ? sub.boundingBoxes : undefined,
      createdAt: new Date().toISOString()
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: (sub.requiresClarification && !sub.submittedAsIs) ? "needs_info" : "pending",
    needsMoreInfo: (sub.requiresClarification && !sub.submittedAsIs),
    clarificationQuestion: sub.clarificationQuestion || undefined,
    upvotes: 1,
    estimatedImpact: sub.population || 5000,
    urgency: (sub.urgency || "Immediate Attention").replace(/🚨|🔔/g, "").trim(),
    assetType: (sub.assetType || "others").replace(/🪠|🔧/g, "").trim(),
    fundingSource: (sub.fundingSource || "MPLADS Fund").replace(/🏦/g, "").trim(),
    aiOverview: {
      brief: sub.aiSummary || "",
      priorityScore: sub.priorityScore || 50,
      priorityLabel: sub.priorityLabel || "Medium Priority",
      safetyRisk: sub.safetyRisk || "Low Risk",
      estimatedBudget: sub.estimatedBudget || "Medium Budget",
      urgency: sub.urgency || "🚨 Immediate Attention",
      fundingSource: sub.fundingSource || "🏦 Municipality Budget"
    }
  };

  try {
    const cleaned = cleanUndefined(docData);
    await setDoc(doc(db, "demands", ticketId), cleaned);
    
    const trackingUrl = `https://jansetu-ef57d.web.app/track.html?id=${ticketId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(trackingUrl)}`;
    const isSug = sub.type === "suggestion";
    const typeLabel = isSug ? "Suggestion" : "Grievance";
    const rawSuccess = `✅ *${typeLabel} Registered Successfully via JanSetuBot!*\n\nTicket Reference ID:\n\`${ticketId}\`\n\nYou can track this ticket live on the portal using the link below or by scanning the generated QR code.`;
    const successMsg = await translateBotText(rawSuccess, lang);

    await bot.sendMessage(chatId, successMsg, { parse_mode: "Markdown" });
    await bot.sendPhoto(chatId, qrUrl, { caption: `QR Code: Scan to track Reference ID ${ticketId}` });
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, "Failed to submit. Please try again.");
  }

  session.step = "MENU";
  session.tempSubmission = null;
  await saveUserSession(chatId, session);
  await sendMainMenu(chatId, lang);
}

// Callback queries handler
async function handleCallbackQuery(queryData) {
  const chatId = queryData.message.chat.id;
  const data = queryData.data;

  const session = await getUserSession(chatId);
  const lang = session.lang || "en";

  if (data.startsWith("lang_")) {
    const chosenLang = data.split("_")[1];
    session.lang = chosenLang;
    session.step = "LOCATION";
    await saveUserSession(chatId, session);

    const reqText = await translateBotText(T.locationRequest, chosenLang);
    const btnText = await translateBotText(T.locationBtn, chosenLang);

    await bot.sendMessage(chatId, reqText, {
      reply_markup: {
        keyboard: [[{ text: btnText, request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  if (data === "menu_1") {
    session.step = "COMPLAINT_MEDIA";
    await saveUserSession(chatId, session);
    const msgText = await translateBotText(T.promptMedia, lang);
    await bot.sendMessage(chatId, msgText);
  } else if (data === "menu_2") {
    session.step = "SUGGESTION_MEDIA";
    await saveUserSession(chatId, session);
    const msgText = await translateBotText(T.promptMedia, lang);
    await bot.sendMessage(chatId, msgText);
  } else if (data === "menu_3") {
    session.step = "TRACK";
    await saveUserSession(chatId, session);
    const msgText = await translateBotText(T.promptTrackId, lang);
    await bot.sendMessage(chatId, msgText);
  } else if (data === "menu_4") {
    if (!session.location || !session.location.lat || !session.location.lng) {
      const noLocMsg = await translateBotText("📍 Please share your location first to check local gaps.", lang);
      await bot.sendMessage(chatId, noLocMsg);
      await bot.answerCallbackQuery(queryData.id);
      return;
    }
    
    await syncKeysFromFirestore();
    const processingMsg = await translateBotText("⏳ Fetching and analyzing nearby issues...", lang);
    const sentMsg = await bot.sendMessage(chatId, processingMsg);

    try {
      const snap = await getDocs(collection(db, "demands"));
      const list = [];
      snap.forEach(docSnap => {
        const item = docSnap.data();
        if (docSnap.id === "config_gemini" || item.isConfig || item.isBotSession) return;
        if (item.status === "deleted") return;
        
        const itemTime = new Date(item.createdAt || item.updatedAt || 0).getTime();
        if (itemTime <= globalResetTimestamp) return;

        if (item.status === "pending" || item.status === "needs_info") {
          list.push({ id: docSnap.id, ...item });
        }
      });

      if (list.length === 0) {
        try {
          await bot.deleteMessage(chatId, sentMsg.message_id);
        } catch {}
        const noIssuesMsg = await translateBotText("No local issues found for now.", lang);
        await bot.sendMessage(chatId, noIssuesMsg);
        session.step = "MENU";
        session.localGaps = null;
        await saveUserSession(chatId, session);
        await bot.answerCallbackQuery(queryData.id);
        await sendMainMenu(chatId, lang);
        return;
      }

      list.sort((a, b) => {
        const distA = getHaversineDistance(session.location.lat, session.location.lng, a.location?.lat || 28.803, a.location?.lng || 79.025);
        const distB = getHaversineDistance(session.location.lat, session.location.lng, b.location?.lat || 28.803, b.location?.lng || 79.025);
        return distA - distB;
      });

      session.localGaps = { list, index: 0 };
      session.step = "LOCAL_GAPS_FLOW";
      await saveUserSession(chatId, session);

      try {
        await bot.deleteMessage(chatId, sentMsg.message_id);
      } catch {}
      await bot.answerCallbackQuery(queryData.id);
      await showCurrentLocalGap(chatId, session);
    } catch (err) {
      console.error(err);
      await bot.answerCallbackQuery(queryData.id);
      await bot.sendMessage(chatId, "Failed to load local gaps.");
    }
  }

  if (data === "gap_next") {
    if (session.localGaps) {
      session.localGaps.index++;
      await saveUserSession(chatId, session);
      await showCurrentLocalGap(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "gap_menu") {
    session.step = "MENU";
    session.localGaps = null;
    await saveUserSession(chatId, session);
    await bot.answerCallbackQuery(queryData.id);
    await sendMainMenu(chatId, lang);
  }
  // Handle nearby issue upvotes shown before submitting a new complaint
  if (data.startsWith("nearby_upvote_")) {
    const docId = data.replace("nearby_upvote_", "");
    try {
      await updateDoc(doc(db, "demands", docId), { upvotes: increment(1) });
      const upvotedText = await translateBotText(
        `👍 Done! Your upvote has been added to this existing issue. It now has higher priority for the manager.\n\nDo you want to also register your own new complaint, or is this existing issue the same as yours?`,
        lang
      );
      const registerNewText = await translateBotText("📝 Register my own new complaint too", lang);
      const doneText = await translateBotText("✅ This issue covers mine — done!", lang);
      await bot.answerCallbackQuery(queryData.id, { text: "👍 Upvoted!", show_alert: false });
      await bot.sendMessage(chatId, upvotedText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: registerNewText, callback_data: "nearby_proceed" }],
            [{ text: doneText, callback_data: "nearby_done" }]
          ]
        }
      });
    } catch (err) {
      console.error(err);
      await bot.answerCallbackQuery(queryData.id, { text: "Error upvoting.", show_alert: true });
    }
    return;
  }

  if (data === "nearby_proceed") {
    await bot.answerCallbackQuery(queryData.id);
    const proceedText = await translateBotText("⏳ Processing your new complaint...", lang);
    await bot.sendMessage(chatId, proceedText);
    session.step = "COMPLAINT_MEDIA";
    await saveUserSession(chatId, session);
    await runBotInputAnalysis(chatId, session);
    return;
  }

  if (data === "nearby_done") {
    await bot.answerCallbackQuery(queryData.id);
    session.step = "MENU";
    session.nearbyIssues = null;
    await saveUserSession(chatId, session);
    const doneMsg = await translateBotText("✅ Great! Your upvote has been recorded. The manager will see increased priority for that issue.", lang);
    await bot.sendMessage(chatId, doneMsg);
    await sendMainMenu(chatId, lang);
    return;
  }

  if (data.startsWith("gap_upvote_") || data.startsWith("upvote_")) {
    const docId = data.replace("gap_upvote_", "").replace("upvote_", "");
    try {
      const docRef = doc(db, "demands", docId);
      await updateDoc(docRef, {
        upvotes: increment(1)
      });
      if (session.localGaps?.list) {
        const gap = session.localGaps.list.find(g => g.id === docId);
        if (gap) gap.upvotes = (gap.upvotes || 1) + 1;
      }
      const upvoteDoneText = await translateBotText(T.upvoteDone, lang);
      await bot.answerCallbackQuery(queryData.id, { text: upvoteDoneText, show_alert: true });
      if (session.step === "LOCAL_GAPS_FLOW") {
        await showCurrentLocalGap(chatId, session);
      }
    } catch (err) {
      console.error(err);
      await bot.answerCallbackQuery(queryData.id, { text: "Error upvoting.", show_alert: true });
    }
  }

  if (data.startsWith("gap_details_")) {
    const docId = data.replace("gap_details_", "");
    session.step = "PROVIDE_DETAILS";
    session.activeGapDocId = docId;
    await saveUserSession(chatId, session);
    await bot.answerCallbackQuery(queryData.id);

    try {
      const docRef = doc(db, "demands", docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const gap = { id: docSnap.id, ...docSnap.data() };
        await syncKeysFromFirestore();
        const question = await askGeminiWhatDetailsAreNeeded(gap);
        const transPrompt = await translateBotText(`✍️ *Crowdsourcing details for Grievance #${gap.id}*\n\n_${question}_\n\n👉 Please reply to this message directly with your text description or upload a clear photo of the issue.`, lang);
        await bot.sendMessage(chatId, transPrompt, { parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "Failed to load details.");
    }
  }

  if (data === "submit_as_is") {
    if (session.tempSubmission) {
      session.tempSubmission.submittedAsIs = true;
      await saveUserSession(chatId, session);
      await sendPreSubmissionDashboard(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "tag_location_yes") {
    if (session.tempSubmission?.detectedLocationName) {
      session.tempSubmission.associatedPlace = {
        name: session.tempSubmission.detectedLocationName,
        type: session.tempSubmission.detectedLocationType || "other"
      };
      session.tempSubmission.locationTagged = true;
      await saveUserSession(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
    await sendPreSubmissionDashboard(chatId, session);
  }

  if (data === "tag_location_no") {
    if (session.tempSubmission) {
      session.tempSubmission.locationTagged = true;
      await saveUserSession(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
    await sendPreSubmissionDashboard(chatId, session);
  }

  if (data === "override_category") {
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
    await bot.sendMessage(chatId, overrideTitle, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data.startsWith("setcat_")) {
    const newCat = data.replace("setcat_", "");
    if (session.tempSubmission) {
      session.tempSubmission.category = newCat;
      await saveUserSession(chatId, session);
      await sendPreSubmissionDashboard(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "override_scope") {
    const inlineKeyboard = [
      [{ text: "🏠 Household (1-10)", callback_data: "setscope_household" }],
      [{ text: "🛣️ Street (~150)", callback_data: "setscope_street" }],
      [{ text: "🏢 Ward (~5k)", callback_data: "setscope_ward" }],
      [{ text: "🏛️ Constituency (10k+)", callback_data: "setscope_constituency" }],
      [{ text: "⬅️ Back", callback_data: "back_to_dashboard" }]
    ];
    const overrideTitle = await translateBotText("Select Scope Override:", lang);
    await bot.sendMessage(chatId, overrideTitle, {
      reply_markup: { inline_keyboard }
    });
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data.startsWith("setscope_")) {
    const newScope = data.replace("setscope_", "");
    if (session.tempSubmission) {
      session.tempSubmission.scope = newScope;
      if (SCOPE_MAP[newScope]) {
        session.tempSubmission.population = SCOPE_MAP[newScope].defaultPopulation;
      }
      await saveUserSession(chatId, session);
      await sendPreSubmissionDashboard(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "override_pop") {
    session.step = "OVERRIDE_POP_INPUT";
    await saveUserSession(chatId, session);
    const askMsg = await translateBotText("Please type the exact number of estimated citizens affected by this complaint: (e.g. 80)", lang);
    await bot.sendMessage(chatId, askMsg);
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "back_to_dashboard") {
    await sendPreSubmissionDashboard(chatId, session);
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "submit_final") {
    if (session.tempSubmission) {
      await submitFinalComplaint(chatId, session);
    }
    await bot.answerCallbackQuery(queryData.id);
  }

  if (data === "cancel_submission") {
    session.tempSubmission = null;
    session.step = "MENU";
    await saveUserSession(chatId, session);
    const cancelMsg = await translateBotText("Submission cancelled.", lang);
    await bot.sendMessage(chatId, cancelMsg);
    await sendMainMenu(chatId, lang);
    await bot.answerCallbackQuery(queryData.id);
  }
}

// Show current gap
async function showCurrentLocalGap(chatId, session) {
  const gaps = session.localGaps?.list || [];
  const idx = session.localGaps?.index || 0;
  const lang = session.lang || "en";

  if (gaps.length === 0 || idx >= gaps.length) {
    const noGapsMsg = await translateBotText("No local issues found for now.", lang);
    await bot.sendMessage(chatId, noGapsMsg);
    
    session.step = "MENU";
    session.localGaps = null;
    await saveUserSession(chatId, session);
    await sendMainMenu(chatId, lang);
    return;
  }

  const gap = gaps[idx];
  const distance = getHaversineDistance(
    session.location.lat, 
    session.location.lng, 
    gap.location?.lat || 28.803, 
    gap.location?.lng || 79.025
  ).toFixed(1);

  const isSuggestion = gap.ticketType === "suggestion";
  const typeLabel = isSuggestion ? "💡 Suggestion" : "⚠️ Complaint";
  
  let detailMsg = `📍 *Local Gap ${idx + 1} of ${gaps.length}* (${distance} km away)\n\n` +
                  `*Type:* ${typeLabel}\n` +
                  `*Category:* ${gap.category.toUpperCase()}\n` +
                  `*Status:* ${gap.status === "needs_info" ? "❓ Needs Details" : "📥 Pending Verification"}\n` +
                  `*Upvotes/Signatures:* 👍 ${gap.upvotes || 1}\n` +
                  `*Description:* "${gap.aiOverview?.brief || gap.items?.[0]?.content?.slice(0, 150) || "No description"}"\n`;

  let detailsNeededPrompt = "";
  if (gap.status === "needs_info" || gap.needsMoreInfo) {
    await syncKeysFromFirestore();
    const question = await askGeminiWhatDetailsAreNeeded(gap);
    detailsNeededPrompt = `\n❓ *MISSING DETAILS NEEDED:* \n_${question}_\n\n👉 *You can reply with text or upload a photo to provide these details!*`;
  }

  const translatedDetail = await translateBotText(detailMsg, lang) + (detailsNeededPrompt ? `\n` + await translateBotText(detailsNeededPrompt, lang) : "");
  
  const upvoteBtnText = await translateBotText("👍 Upvote This", lang);
  const addDetailsBtnText = await translateBotText("✍️ Provide Details", lang);
  const nextBtnText = await translateBotText("➡️ Next", lang);
  const backMenuBtnText = await translateBotText("🔙 Main Menu", lang);

  const inlineKeyboard = [];
  const actionRow = [];
  
  actionRow.push({ text: upvoteBtnText, callback_data: `gap_upvote_${gap.id}` });
  if (gap.status === "needs_info" || gap.needsMoreInfo) {
    actionRow.push({ text: addDetailsBtnText, callback_data: `gap_details_${gap.id}` });
  }
  inlineKeyboard.push(actionRow);

  const navRow = [];
  if (idx < gaps.length - 1) {
    navRow.push({ text: nextBtnText, callback_data: `gap_next` });
  }
  navRow.push({ text: backMenuBtnText, callback_data: `gap_menu` });
  inlineKeyboard.push(navRow);

  await bot.sendMessage(chatId, translatedDetail, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: inlineKeyboard }
  });
}

// Show menu
async function sendMainMenu(chatId, lang) {
  const menuTitle = await translateBotText(T.mainMenuTitle, lang);
  const opt1 = await translateBotText(T.option1, lang);
  const opt2 = await translateBotText(T.option2, lang);
  const opt3 = await translateBotText(T.option3, lang);
  const opt4 = await translateBotText(T.option4, lang);

  await bot.sendMessage(chatId, menuTitle, {
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

// Vercel Entrypoint
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("Jansetu Bot Webhook is active!");
  }

  try {
    const update = req.body;
    if (!update) return res.status(200).send("OK");

    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(200).send("OK");
  }
};
