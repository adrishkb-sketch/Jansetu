/**
 * Jansetu Live Telegram Chatbot Gateway - UPGRADED MULTILINGUAL VERSION
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
let geminiKeys = ['AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw'];
try {
  // Try loading from localStorage equivalent or environment/settings
  const keyEnv = process.env.JANSETU_GEMINI_KEY || '';
  if (keyEnv) {
    geminiKeys = keyEnv.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
  }
} catch (e) {}

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
    
    let parts = [];
    if (customSystemPrompt) {
      // Flash 2.5 can ingest prompt instruction
      parts.push({ text: customSystemPrompt });
    }
    
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

// Helper translations dictionary (Base templates in English)
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
    console.warn("Google Translate failed on chatbot, falling back to Gemini:", err);
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
console.log("Jansetu Telegram Bot is long-polling (23 languages support enabled)...");

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

  // Awaiting Media (Complaint or Suggestion)
  if (session.step === 'COMPLAINT_MEDIA' || session.step === 'SUGGESTION_MEDIA') {
    const type = session.step === 'COMPLAINT_MEDIA' ? 'complaint' : 'suggestion';
    
    let content = userText;
    let voiceFileId = msg.voice ? msg.voice.file_id : null;
    let photoFileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : null;
    
    let mediaType = 'text';
    let fileBase64 = '';

    const processText = await translateBotText(T.processing, lang);
    await bot.sendMessage(chatId, processText);

    // Handle Voice notes
    if (voiceFileId) {
      mediaType = 'audio';
      try {
        const directLink = await bot.getFileLink(voiceFileId);
        // Using allorigins CORS bypass to read file buffer safely
        const fileRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(directLink)}`);
        const buffer = await fileRes.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString('base64');
        
        // Transcribe voice
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
      mediaType = 'photo';
      try {
        const directLink = await bot.getFileLink(photoFileId);
        const fileRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(directLink)}`);
        const buffer = await fileRes.arrayBuffer();
        fileBase64 = Buffer.from(buffer).toString('base64');

        // Describe photo
        const geminiRes = await fetchGeminiWithFallback([
          { inlineData: { mimeType: 'image/jpeg', data: fileBase64 } },
          { text: "You are the visual analyzer for Jansetu. Describe the civic/infrastructure problem shown in this image in detail (e.g. pothole, garbage piles). Output ONLY the description." }
        ]);
        const data = await geminiRes.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Photo input received.";
      } catch (err) {
        console.error(err);
        content = "Photo attachment received (Analysis failed).";
      }
    }

    // Translate input to English before sending to classification loop
    let englishContent = content;
    try {
      const translationPrompt = `You are a professional translator for Jansetu. Translate the following citizen suggestion/complaint to English. Keep the tone exact and professional. Output ONLY the English translation:\n"${content}"`;
      const transRes = await fetchGeminiWithFallback([{ parts: [{ text: translationPrompt }] }]);
      const transData = await transRes.json();
      const transText = transData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (transText) {
        englishContent = transText;
      }
    } catch (err) {
      console.warn("Incoming translation failed, using original transcript:", err);
    }

    // Classify category, scope, and priority using Gemini (with English text)
    let category = 'others';
    let scope = 'ward';
    let aiOverview = null;

    try {
      const classificationPrompt = `
        Analyze this citizen feedback text: "${englishContent}".
        Classify it into one of these categories: "water", "roads", "health", "education", "power", "others".
        Also classify its scope: "household", "street", "ward", "constituency".
        Finally, suggest a priority score from 0 to 100, and a 1-sentence response.
        Output ONLY a JSON object:
        {
          "category": "category_name",
          "scope": "scope_name",
          "priorityScore": number,
          "urgency": "Normal" | "High" | "Critical",
          "fundingSource": "MPLADS Fund",
          "brief": "One sentence summary brief in standard English"
        }
      `;
      const classRes = await fetchGeminiWithFallback([{ parts: [{ text: classificationPrompt }] }]);
      const data = await classRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
      aiOverview = JSON.parse(rawText.replace(/```json|```/g, ''));
      if (aiOverview) {
        category = aiOverview.category || 'others';
        scope = aiOverview.scope || 'ward';
      }
    } catch {}

    // Save to Firestore 'demands' collection
    const docData = {
      ticketType: type,
      category,
      scope,
      location: session.location || { lat: 28.803, lng: 79.025 },
      address: 'Submitted via JanSetuBot',
      constituency: session.constituency || 'Rampur',
      items: [{
        type: mediaType,
        content: content, // Keep raw spoken transcript in original language
        createdAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      upvotes: 1,
      aiOverview: aiOverview || {
        brief: englishContent,
        priorityScore: 55,
        safetyRisk: 'Moderate',
        urgency: 'Normal',
        fundingSource: 'MPLADS Fund',
        citizenResponse: `Thank you for sharing your feedback. We have queued it for review.`
      }
    };

    try {
      const docRef = await addDoc(collection(db, 'demands'), docData);
      
      const briefToShow = docData.aiOverview.brief || englishContent;
      const rawSuccessText = `✅ *Grievance Registered Successfully!*\n\nTicket Reference ID:\n\`${docRef.id}\`\n\nCategory: ${category.toUpperCase()}\nScope: ${scope.toUpperCase()}\n\nAI Analysis: "${briefToShow}"`;
      const successMsg = await translateBotText(rawSuccessText, lang);

      await bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
    } catch (dbErr) {
      console.error(dbErr);
      await bot.sendMessage(chatId, "Failed to write database. Please try again.");
    }

    session.step = 'MENU';
    userState.set(chatId, session);
    sendMainMenu(chatId, lang);
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

// Inline Buttons Handler
bot.on('callback_query', async (queryData) => {
  const chatId = queryData.message.chat.id;
  const data = queryData.data;

  const session = userState.get(chatId) || {};

  // Handle Language selection
  if (data.startsWith('lang_')) {
    const lang = data.split('_')[1];
    session.lang = lang;
    session.step = 'LOCATION';
    userState.set(chatId, session);

    const reqText = await translateBotText(T.locationRequest, lang);
    const btnText = await translateBotText(T.locationBtn, lang);

    bot.sendMessage(chatId, reqText, {
      reply_markup: {
        keyboard: [[{ text: btnText, request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return;
  }

  const lang = session.lang || 'en';

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
    // Show regional verified issues & list them for upvote
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
