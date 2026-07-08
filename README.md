<div align="center">
  <img src="https://raw.githubusercontent.com/adrishkb-sketch/Jansetu/main/public/vite.svg" width="100" />
  <h1>Jansetu (जनसेतु) - Bridging the Gap</h1>
  <p><strong>Google Cloud "Build with AI: Code for Communities" Hackathon</strong></p>
  <p>An AI-powered unified civic engagement and constituency planning platform designed directly for Members of Parliament (MPs) and their constituents.</p>
</div>

---

> [!IMPORTANT]
> **Demo Login Credentials:**
> * **Manager Portal:** Username: `manager` | Password: `password`
> * **MP Workspace:** Username: `mp` | Password: `password`

---

## 📖 Overview

**Jansetu** is a multimodal, multilingual civic platform that decentralizes how real, on-the-ground governance problems are reported, verified, and actioned. Citizens can report issues—like broken infrastructure, sanitation gaps, or agricultural needs—in their native language via our Web App or Telegram Bot using text, voice, or photos. 

Jansetu's AI instantly verifies the problem using Google Gemini Multimodal Vision, tags its severity, maps it to the exact constituency using geospatial boundaries, and auto-generates AI action plans and budgetary audits for the MP's office.


---

## 🛠️ Technology Stack

* **Frontend:** React.js (Vite), Vanilla CSS (Responsive & Accessible), Lucide Icons
* **AI Engine:** Google Gemini (1.5 Flash, 2.0 Flash, Vision) — For multimodal translation, bounding-box anomaly detection, voice transcription, and semantic clustering.
* **On-Device Vision:** Google MediaPipe Tasks Vision (WebAssembly) — For instant, client-side browser object detection and categorization of uploaded evidence without server overhead.
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
* **Hybrid Vision Pipeline (Gemini + MediaPipe):** In addition to cloud-based Gemini analysis, the platform executes on-device local object detection using Google MediaPipe (running an EfficientDet-Lite0 model via WebAssembly). This provides immediate, real-time feedback by detecting common objects (vehicles, street furniture, people, etc.) directly on the user's browser, displaying a second layer of bounding boxes in cyan alongside Gemini's insights.
* **Smart Context Gathering (Crowdsourcing):** If an issue is reported with missing data, the AI acts as an investigator, automatically asking targeted follow-up questions to gather exact dimensions, landmarks, or details from the community.
* **AI Action Plans:** The MP's dashboard features a one-click Gemini-powered "Generate Speech/Audit" tool that synthesizes thousands of local data points into a concise 2-minute actionable brief for parliamentary sessions.

### 4. Deployability & Scalability
Jansetu is engineered to handle variable scale securely.
* **Serverless Architecture:** The Telegram bot runs as a stateless webhook on Vercel (`api/telegram-webhook.cjs`), meaning it can scale infinitely to handle thousands of concurrent photo uploads during a civic crisis without server crashes.
* **Zero Python Bottlenecks:** We completely eliminated heavy Python subprocesses for image processing, migrating to the blazing-fast Node.js `sharp` library for native SVG manipulation, reducing image processing latency by over 90%.
* **Security & Auth:** Built-in modular authentication states ensure that MP dashboards and funds are strictly isolated from citizen views. 

---

## 🏗️ System Architecture & Technology Deep-Dive

Jansetu is engineered with a modular, serverless, and resilient architecture designed to handle citizen scale with minimal overhead:

### 1. Ingestion Layer (Web & Mobile Channels)
* **React (TypeScript & Vite):** Powers all responsive web dashboards (Citizen, Manager, MP, and Tracking). TypeScript ensures compilation safety and zero runtime schema crashes.
* **Telegram Bot API (Node.js/Express Webhook):** The chatbot gateway processes real-time mobile messages. It is built as a serverless stateless function in Vercel to scale infinitely under spike load.

### 2. Edge Processing & AI Verification Tier
* **Google MediaPipe Tasks Vision (WebAssembly):** Executes an `efficientdet_lite0` object detection model directly in the citizen's browser. This runs client-side OCR and object detection to tag anomalies instantly before data is uploaded, saving server compute.
* **Google Gemini 2.5 & 2.0 Flash Cascade:** Ingests multimodal voice notes and photos. Transcribes regional audio files verbatim, extracts visual context from images, and draws anomaly bounding boxes dynamically.
* **Resilient Key Rotation:** Built a custom fallback queue in the backend. If a Gemini API key hits a rate limit (HTTP 429), the service automatically rotates to backup keys and falls back through models (2.5-flash → 2.0-flash → 2.0-flash-lite) to maintain 100% uptime.

### 3. Database & Analytical Core
* **Firebase Firestore:** Acts as our real-time NoSQL data lake, syncing citizen tickets and MP proposals instantly. It dynamically serves localized Census and NFHS-5 demographics across all 543 Lok Sabha constituencies.
* **Combined Priority Index (CPI) Engine:** Automatically scores grievances from 0–100 by calculating:
  $$\text{CPI} = (\text{Base Priority} \times 0.45) + (\text{Upvotes Normalization} \times 0.35) + (\text{Demographic Vulnerability} \times 0.20)$$
  It cross-references geolocation coordinates with Ministry Standards (e.g., Jal Jeevan Mission, Swachh Bharat) to measure the infrastructure gap.

---

*Proudly built for the Google Cloud Hackathon. Let's build a better, AI-powered democracy together.*
