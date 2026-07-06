/**
 * Jansetu Live Telegram Chatbot Gateway
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
const GEMINI_KEY = "AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw"; // Default fallback key

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

// Helper translations dictionary
const T = {
  welcome: {
    en: "Welcome to Jansetu Bot! Please choose your preferred language:",
    hi: "जनसेतु बॉट में आपका स्वागत है! कृपया अपनी पसंदीदा भाषा चुनें:"
  },
  locationRequest: {
    en: "Please share your current location (GPS) by tapping the button below so we can find your parliamentary constituency.",
    hi: "संसदीय निर्वाचन क्षेत्र का पता लगाने के लिए कृपया नीचे दिए गए बटन पर टैप करके अपना वर्तमान स्थान (GPS) साझा करें।"
  },
  locationBtn: {
    en: "📍 Share Current Location",
    hi: "📍 अपना स्थान साझा करें"
  },
  constituencySelected: {
    en: (constituency) => `Location matched! Your Parliamentary Constituency is: *${constituency}*`,
    hi: (constituency) => `स्थान मिल गया! आपका संसदीय निर्वाचन क्षेत्र है: *${constituency}*`
  },
  mainMenuTitle: {
    en: "Main Menu - What would you like to do?",
    hi: "मुख्य मेनू - आप क्या करना चाहेंगे?"
  },
  option1: { en: "📝 Register Complaint", hi: "📝 शिकायत दर्ज करें" },
  option2: { en: "💡 Send Suggestion", hi: "💡 सुझाव भेजें" },
  option3: { en: "🔍 Track Status", hi: "🔍 स्थिति जांचें" },
  option4: { en: "🗳️ Upvote Local Gaps", hi: "🗳️ क्षेत्रीय मुद्दों पर वोट करें" },
  promptMedia: {
    en: "Please submit your detail: You can type text, send a photo of the issue, or record a voice note.",
    hi: "कृपया विवरण भेजें: आप संदेश लिख सकते हैं, फोटो भेज सकते हैं, या वॉयस नोट रिकॉर्ड कर सकते हैं।"
  },
  processing: {
    en: "⏳ Jansetu AI is processing your input...",
    hi: "⏳ जनसेतु एआई आपके इनपुट को प्रोसेस कर रहा है..."
  },
  promptTrackId: {
    en: "Please enter your Ticket Reference ID:",
    hi: "कृपया अपना टिकट संदर्भ आईडी दर्ज करें:"
  },
  noTicket: {
    en: "❌ No ticket found with that reference ID.",
    hi: "❌ उस संदर्भ आईडी के साथ कोई टिकट नहीं मिला।"
  },
  ticketStatusMsg: {
    en: (id, category, status) => `📌 *Ticket details:* \nID: ${id}\nCategory: ${category}\nStatus: *${status}*`,
    hi: (id, category, status) => `📌 *टिकट विवरण:* \nआईडी: ${id}\nश्रेणी: ${category}\nस्थिति: *${status}*`
  },
  upvoteListTitle: {
    en: "Select a local grievance to support/upvote:",
    hi: "वोट/समर्थन देने के लिए स्थानीय शिकायत चुनें:"
  },
  noIssues: {
    en: "No active verified grievances found in your constituency.",
    hi: "आपके निर्वाचन क्षेत्र में कोई सक्रिय सत्यापित शिकायतें नहीं मिलीं।"
  },
  upvoteDone: {
    en: "👍 Upvoted successfully! Thank you for your support.",
    hi: "👍 सफलतापूर्वक वोट कर दिया गया! आपके समर्थन के लिए धन्यवाद।"
  }
};

// Initialize Bot API
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("Jansetu Telegram Bot is long-polling...");

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text || '';
  
  // Clean states on start
  if (userText === '/start') {
    userState.set(chatId, { step: 'LANG' });
    
    bot.sendMessage(chatId, T.welcome.en, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🇬🇧 English", callback_data: "lang_en" }],
          [{ text: "🇮🇳 हिंदी", callback_data: "lang_hi" }]
        ]
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

    await bot.sendMessage(chatId, T.constituencySelected[lang](constituency), { parse_mode: 'Markdown' });
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

    await bot.sendMessage(chatId, T.processing[lang]);

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
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: 'audio/ogg', data: fileBase64 } },
                { text: "You are the voice transcriber for Jansetu. Please transcribe this Hindi or English voice note of a citizen complaint verbatim. Output ONLY the plain transcription. Do not add any greeting or meta-text." }
              ]
            }]
          })
        });
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
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: fileBase64 } },
                { text: "You are the visual analyzer for Jansetu. Describe the civic/infrastructure problem shown in this image in detail (e.g. pothole, garbage piles). Output ONLY the description." }
              ]
            }]
          })
        });
        const data = await geminiRes.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Photo input received.";
      } catch (err) {
        console.error(err);
        content = "Photo attachment received (Analysis failed).";
      }
    }

    // Classify category, scope, and priority using Gemini
    let category = 'others';
    let scope = 'ward';
    let aiOverview = null;

    try {
      const classificationPrompt = `
        Analyze this citizen feedback text: "${content}".
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
          "citizenResponse": "We have received your issue..."
        }
      `;
      const classRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: classificationPrompt }] }] })
      });
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
        content: content,
        createdAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      upvotes: 1,
      aiOverview: aiOverview || {
        brief: content,
        priorityScore: 55,
        safetyRisk: 'Moderate',
        urgency: 'Normal',
        fundingSource: 'MPLADS Fund',
        citizenResponse: `Thank you for sharing your feedback. We have queued it for review.`
      }
    };

    try {
      const docRef = await addDoc(collection(db, 'demands'), docData);
      
      const successMsg = lang === 'en' 
        ? `✅ *Grievance Registered Successfully!*\n\nTicket Reference ID:\n\`${docRef.id}\`\n\nCategory: ${category.toUpperCase()}\nScope: ${scope.toUpperCase()}\n\nAI Analysis: "${docData.aiOverview.brief}"`
        : `✅ *शिकायत सफलतापूर्वक दर्ज की गई!*\n\nटिकट संदर्भ आईडी:\n\`${docRef.id}\`\n\nश्रेणी: ${category.toUpperCase()}\nक्षेत्र: ${scope.toUpperCase()}\n\nएआई सारांश: "${docData.aiOverview.brief}"`;

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
        await bot.sendMessage(chatId, T.ticketStatusMsg[lang](docSnap.id, d.category, d.status), { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, T.noTicket[lang]);
      }
    } catch {
      await bot.sendMessage(chatId, T.noTicket[lang]);
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

    bot.sendMessage(chatId, T.locationRequest[lang], {
      reply_markup: {
        keyboard: [[{ text: T.locationBtn[lang], request_location: true }]],
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
    bot.sendMessage(chatId, T.promptMedia[lang]);
  } else if (data === 'menu_2') {
    session.step = 'SUGGESTION_MEDIA';
    userState.set(chatId, session);
    bot.sendMessage(chatId, T.promptMedia[lang]);
  } else if (data === 'menu_3') {
    session.step = 'TRACK';
    userState.set(chatId, session);
    bot.sendMessage(chatId, T.promptTrackId[lang]);
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
        bot.sendMessage(chatId, T.noIssues[lang]);
      } else {
        await bot.sendMessage(chatId, T.upvoteListTitle[lang]);
        snap.forEach(docSnap => {
          const item = docSnap.data();
          const detailMsg = `📍 *Grievance:* ${item.category.toUpperCase()} issue\nStatus: ${item.status}\n👍 Upvotes: ${item.upvotes || 1}\nDetail: "${item.aiOverview?.brief || item.items?.[0]?.content?.slice(0, 100)}"`;
          
          bot.sendMessage(chatId, detailMsg, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `👍 Upvote Issue`, callback_data: `upvote_${docSnap.id}` }]
              ]
            }
          });
        });
      }
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, T.noIssues[lang]);
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
      bot.answerCallbackQuery(queryData.id, { text: T.upvoteDone[lang], show_alert: true });
    } catch {
      bot.answerCallbackQuery(queryData.id, { text: "Error upvoting.", show_alert: true });
    }
  }
});

// Helper: Show Main Menu Inline Buttons
function sendMainMenu(chatId, lang) {
  bot.sendMessage(chatId, T.mainMenuTitle[lang], {
    reply_markup: {
      inline_keyboard: [
        [{ text: T.option1[lang], callback_data: "menu_1" }],
        [{ text: T.option2[lang], callback_data: "menu_2" }],
        [{ text: T.option3[lang], callback_data: "menu_3" }],
        [{ text: T.option4[lang], callback_data: "menu_4" }]
      ]
    }
  });
}
