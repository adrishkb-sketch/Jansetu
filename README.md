<div align="center">
  <img src="https://raw.githubusercontent.com/adrishkb-sketch/Jansetu/main/public/vite.svg" width="100" />
  <h1>Jansetu (जनसेतु) - Bridging the Gap</h1>
  <p><strong>Google Cloud "Build with AI: Code for Communities" Hackathon</strong></p>
  <p>An AI-powered unified civic engagement and constituency planning platform designed directly for Members of Parliament (MPs) and their constituents.</p>
</div>

---

## 📖 Overview

**Jansetu** is a multimodal, multilingual civic platform that decentralizes how real, on-the-ground governance problems are reported, verified, and actioned. Citizens can report issues—like broken infrastructure, sanitation gaps, or agricultural needs—in their native language via our Web App or Telegram Bot using text, voice, or photos. 

Jansetu's AI instantly verifies the problem using Google Gemini Multimodal Vision, tags its severity, maps it to the exact constituency using geospatial boundaries, and auto-generates AI action plans and budgetary audits for the MP's office.


---

## 🛠️ Technology Stack

* **Frontend:** React.js (Vite), Vanilla CSS (Responsive & Accessible), Lucide Icons
* **AI Engine:** Google Gemini (1.5 Flash, 2.0 Flash, Vision) — For multimodal translation, bounding-box anomaly detection, voice transcription, and semantic clustering.
* **Backend & Cloud:** Firebase Firestore (Dynamic BigQuery mock for Census/NFHS data), Firebase Hosting
* **Serverless Bots:** Node.js (Vercel Serverless Functions), Telegram Bot API
* **Image Processing:** Sharp (Native Node.js pipeline for scalable bounding box generation)
* **APIs:** Google Translate API

---

## 🏆 Hackathon Judging Criteria Alignment

### 1. Impact & Relevance (Solving the MP's Core Problem)
We reduce the bureaucratic friction between a citizen facing a problem and an MP releasing MPLADS funds to fix it.
* **Hyper-Localized:** Uses Haversine geospatial calculations over a dataset of 543 constituency polygons to automatically route a grievance directly to the correct MP's dashboard.
* **Inclusive Accessibility:** Built for everyone. A farmer in rural Karnataka can upload a voice note in Kannada via Telegram, and the AI will transcribe, translate, verify the agricultural issue, and present it to the MP in English on a categorized dashboard.
* **Democratic Prioritization:** Features an intelligent upvoting system. Issues are clustered semantically by Gemini so duplicate complaints are merged, allowing the community to prioritize what needs fixing first.

### 2. Technical Execution (Google Cloud Excellence)
We built a robust, cloud-native architecture utilizing Google Cloud and Firebase.
* **Firestore as a Scalable Data Lake:** All interactions, session data, MP budget statuses, and public demographic sets (Census/NFHS) are dynamically fetched via Firebase Firestore, mirroring a BigQuery enterprise architecture.
* **Advanced Error Handling:** Implemented a sophisticated Gemini Key rotation and fallback cascade mechanism. If rate limits are hit on one model or key, the backend automatically fails over to backup keys and models without dropping the citizen's session.
* **Real-time Synchronization:** The Manager dashboard, MP dashboard, and Citizen view all reflect changes (like status updates from "Pending" to "Funds Released") instantly across the Firestore network.

### 3. Innovation (Deep AI Integration)
We leverage autonomous AI workflows rather than basic conversational bots.
* **AI Visual Evidence Verification:** When a citizen uploads a photo of a pothole, Gemini Vision detects the anomaly, calculates bounding boxes, and our backend dynamically generates an SVG overlay highlighting the damage in red before returning it to the user.
* **Smart Context Gathering (Crowdsourcing):** If an issue is reported with missing data, the AI acts as an investigator, automatically asking targeted follow-up questions to gather exact dimensions, landmarks, or details from the community.
* **AI Action Plans:** The MP's dashboard features a one-click Gemini-powered "Generate Speech/Audit" tool that synthesizes thousands of local data points into a concise 2-minute actionable brief for parliamentary sessions.

### 4. Deployability & Scalability
Jansetu is engineered to handle variable scale securely.
* **Serverless Architecture:** The Telegram bot runs as a stateless webhook on Vercel (`api/telegram-webhook.cjs`), meaning it can scale infinitely to handle thousands of concurrent photo uploads during a civic crisis without server crashes.
* **Zero Python Bottlenecks:** We completely eliminated heavy Python subprocesses for image processing, migrating to the blazing-fast Node.js `sharp` library for native SVG manipulation, reducing image processing latency by over 90%.
* **Security & Auth:** Built-in modular authentication states ensure that MP dashboards and funds are strictly isolated from citizen views. 

---

## 🚀 Getting Started Locally

1. **Clone the repo**
   ```bash
   git clone https://github.com/adrishkb-sketch/Jansetu.git
   cd Jansetu
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Run the local dev server**
   ```bash
   npm run dev
   ```
4. **Deploy to Firebase**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

*Proudly built for the Google Cloud Hackathon. Let's build a better, AI-powered democracy together.*
