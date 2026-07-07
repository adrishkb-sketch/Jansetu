/**
 * Shared service for communicating with Google Gemini API models.
 * Implements a multi-key backup fallback system with model cascade for vision tasks.
 *
 * KEY PRIORITY ORDER (highest → lowest):
 *   1. Keys entered by user in "Configure Gemini API Keys" panel (stored in localStorage)
 *   2. Keys synced from Firestore demands/config_gemini
 *   No hardcoded keys — all exhausted. Use the configure panel to add fresh keys.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

import { doc, getDoc } from 'firebase/firestore';
import { db } from './db';

// In-memory cache of Firestore keys (so we don't re-fetch on every call)
let cachedFirestoreKeys: string[] = [];
let lastFirestoreFetch = 0;
const FIRESTORE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Set of keys known to be quota-exhausted right now (429). Cleared after 1 minute.
const exhaustedKeys = new Map<string, number>(); // key -> timestamp when it was marked exhausted

function isKeyExhausted(key: string): boolean {
  const ts = exhaustedKeys.get(key);
  if (!ts) return false;
  if (Date.now() - ts > 60_000) {
    exhaustedKeys.delete(key); // expired, try again
    return false;
  }
  return true;
}

function markKeyExhausted(key: string) {
  exhaustedKeys.set(key, Date.now());
  console.warn(`[Jansetu AI] Key marked quota-exhausted for 60s: ${key.slice(0, 12)}...`);
}

async function getFirestoreKeys(): Promise<string[]> {
  const now = Date.now();
  if (cachedFirestoreKeys.length > 0 && now - lastFirestoreFetch < FIRESTORE_CACHE_TTL) {
    return cachedFirestoreKeys;
  }
  try {
    if (db) {
      let fetched = '';
      const docRef1 = doc(db, 'demands', 'config_gemini');
      const docSnap1 = await getDoc(docRef1);
      if (docSnap1.exists()) {
        const data = docSnap1.data();
        if (data && data.keys) fetched = data.keys.trim();
      }
      if (!fetched) {
        const docRef2 = doc(db, 'config', 'gemini');
        const docSnap2 = await getDoc(docRef2);
        if (docSnap2.exists()) {
          const data = docSnap2.data();
          if (data && data.keys) fetched = data.keys.trim();
        }
      }
      if (fetched) {
        cachedFirestoreKeys = fetched.split(/[\n\r,;]+/).map((k: string) => k.trim()).filter((k: string) => k.length > 0);
        lastFirestoreFetch = now;
        return cachedFirestoreKeys;
      }
    }
  } catch (e) {
    console.warn('[Jansetu AI] Failed to load keys from Firestore:', e);
  }
  return cachedFirestoreKeys;
}

async function getKeys(): Promise<string[]> {
  // 1. User-configured keys from the "Configure Gemini API Keys" footer panel
  const localRaw = localStorage.getItem('jansetu_gemini_key') || '';
  const localKeys = localRaw
    .split(/[\n\r,;]+/)
    .map(k => k.trim())
    .filter(k => k.length > 10 && k !== 'AIzaSyDummyKeyForJansetuFastPrototypeScale' && k !== 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw');

  // 2. Keys from Firestore (configured via the web panel and synced)
  const firestoreKeys = await getFirestoreKeys();

  // Merge: local first, then Firestore, deduplicated
  const all = [...new Set([...localKeys, ...firestoreKeys])].filter(k => k.length > 10);

  if (all.length === 0) {
    console.warn('[Jansetu AI] No API keys configured. Open "Configure Gemini API Keys" at the bottom of any page and add your Google Gemini API key from https://aistudio.google.com/apikey');
  }

  return all;
}


async function callGemini(model: string, key: string, payload: any): Promise<any> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `HTTP ${response.status}: ${errText}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) errMsg = parsed.error.message;
    } catch (_) {}
    // Mark this key as quota-exhausted so the cascade skips it for 60s
    if (response.status === 429) {
      markKeyExhausted(key);
    }
    throw new Error(`Gemini API Error [${model}] — ${errMsg}`);
  }

  const json = await response.json();

  // Detect safety blocks or empty responses (returns 200 but empty candidates)
  if (!json.candidates || json.candidates.length === 0) {
    const blockReason = json.promptFeedback?.blockReason;
    throw new Error(
      `Gemini [${model}] returned no candidates. Reason: ${blockReason || 'unknown (possibly safety filter or empty response)'}`
    );
  }

  // Detect STOP finish or other issues at the candidate level
  const candidate = json.candidates[0];
  if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
    throw new Error(`Gemini [${model}] candidate finishReason: ${candidate.finishReason}`);
  }

  return json;
}

/**
 * Core fetchGemini — tries all keys, returns a Response-like object wrapping the JSON.
 * Falls back through model cascade for vision/multimodal payloads when primary fails.
 */
export async function fetchGemini(
  payload: any,
  model: string = 'gemini-2.5-flash'
): Promise<Response> {
  const keys = await getKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API keys configured. Please open \u201cConfigure Gemini API Keys\u201d at the bottom of the page and add your key from https://aistudio.google.com/apikey');
  }
  let lastError: any = new Error('No Gemini keys available');

  // Cascade models to try
  const modelsToTry = [
    model, // The requested model first
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];

  // Remove duplicates while keeping order
  const uniqueModels = Array.from(new Set(modelsToTry));

  for (const modelName of uniqueModels) {
    for (let i = 0; i < keys.length; i++) {
      if (isKeyExhausted(keys[i])) {
        console.log(`[Jansetu AI] Skipping quota-exhausted key[${i}] for ${modelName}`);
        continue;
      }
      try {
        const json = await callGemini(modelName, keys[i], payload);
        console.log(`[Jansetu AI] Succeeded on model=${modelName} keyIndex=${i}`);
        // Wrap back into a Response so call-sites can do `.json()`
        return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        console.warn(`[Jansetu AI] model=${modelName} keyIndex=${i} failed:`, e);
        lastError = e;
      }
    }
  }

  throw lastError;
}

/**
 * Vision-specific Gemini call with model cascade and smart retry.
 * Tries: gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-pro
 * Each model is tried with all keys before cascading.
 *
 * Returns parsed JSON (the candidates object) directly, never throws to caller.
 */
export async function fetchGeminiVision(
  parts: any[],
  fallbackDescription = ''
): Promise<any | null> {
  // Models in preference order for vision tasks
  // gemini-1.5-pro and gemini-1.5-flash are deprecated as of July 2026
  const VISION_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  const keys = await getKeys();
  if (keys.length === 0) {
    console.error('[Jansetu Vision] No API keys configured.');
    return fallbackDescription ? { text: fallbackDescription, model: 'fallback', keyIndex: -1 } : null;
  }

  for (const model of VISION_MODELS) {
    for (let i = 0; i < keys.length; i++) {
      if (isKeyExhausted(keys[i])) {
        console.log(`[Jansetu Vision] Skipping quota-exhausted key[${i}] for ${model}`);
        continue;
      }
      try {
        const payload = {
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,       // Low temperature for deterministic structured output
            maxOutputTokens: 2048,
          }
        };
        const json = await callGemini(model, keys[i], payload);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Jansetu Vision] Succeeded on model=${model} keyIndex=${i}`);
          return { text, model, keyIndex: i };
        }
        throw new Error('Empty text in candidate part');
      } catch (e) {
        console.warn(`[Jansetu Vision] model=${model} key=${i} failed:`, e);
      }
    }
  }

  console.error('[Jansetu Vision] All models and keys failed for vision task.');
  return fallbackDescription ? { text: fallbackDescription, model: 'fallback', keyIndex: -1 } : null;
}

/**
 * Detects the actual MIME type from a base64-encoded image header.
 * Prevents sending wrong MIME types (e.g. PNG uploaded as image/jpeg).
 */
export function detectMimeType(base64: string): string {
  const sig = base64.substring(0, 8);
  if (sig.startsWith('/9j/')) return 'image/jpeg';
  if (sig.startsWith('iVBORw')) return 'image/png';
  if (sig.startsWith('R0lGOD')) return 'image/gif';
  if (sig.startsWith('UklGRi') || sig.startsWith('AAABAA')) return 'image/webp';
  if (sig.startsWith('AAAAFG') || sig.startsWith('AAAAHG')) return 'image/heic';
  // Default to jpeg for unknown
  return 'image/jpeg';
}
