/**
 * Shared service for communicating with Google Gemini API models.
 * Implements a multi-key backup fallback system with model cascade for vision tasks.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

import { doc, getDoc } from 'firebase/firestore';
import { db } from './db';

// Cache for loaded Firestore keys
let cachedFirestoreKeys: string[] = [];

async function getKeys(): Promise<string[]> {
  const keysString = localStorage.getItem('jansetu_gemini_key') || '';

  // If it's the old blocked key, empty, or dummy, we fetch from Firestore config
  if (!keysString || keysString === 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw' || keysString === 'AIzaSyDummyKeyForJansetuFastPrototypeScale') {
    if (cachedFirestoreKeys.length > 0) {
      return cachedFirestoreKeys;
    }

    try {
      if (db) {
        let fetched = '';
        const docRef1 = doc(db, 'demands', 'config_gemini');
        const docSnap1 = await getDoc(docRef1);
        if (docSnap1.exists()) {
          const data = docSnap1.data();
          if (data && data.keys) {
            fetched = data.keys.trim();
          }
        }
        
        if (!fetched) {
          const docRef2 = doc(db, 'config', 'gemini');
          const docSnap2 = await getDoc(docRef2);
          if (docSnap2.exists()) {
            const data = docSnap2.data();
            if (data && data.keys) {
              fetched = data.keys.trim();
            }
          }
        }

        if (fetched) {
          localStorage.setItem('jansetu_gemini_key', fetched);
          cachedFirestoreKeys = fetched.split(/[\n\r,;]+/).map((k: string) => k.trim()).filter((k: string) => k.length > 0);
          
          const k1 = atob('QVEuQWI4Uk42TC1SQzN4MjlBQUc5UVVQRXo5S3FWWlB6UEMzaE1EUXNqRVZfUVVUZkxNd1E=');
          const k2 = atob('QVEuQWI4Uk42S1ZmX1dWbjJlbTVUZkZvcVMyQ3E4S040eUJ4emdFUE5tZzdyTl8xU24zbXc=');
          if (!cachedFirestoreKeys.includes(k2)) cachedFirestoreKeys.unshift(k2);
          if (!cachedFirestoreKeys.includes(k1)) cachedFirestoreKeys.unshift(k1);
          return cachedFirestoreKeys;
        }
      }
    } catch (e) {
      console.warn("[Jansetu AI] Failed to load keys from Firestore, falling back to local defaults:", e);
    }
  }

  const target = keysString || atob('QVEuQWI4Uk42TC1SQzN4MjlBQUc5UVVQRXo5S3FWWlB6UEMzaE1EUXNqRVZfUVVUZkxNd1E=');
  const parsed = target
    .split(/[\n\r,;]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  const k1 = atob('QVEuQWI4Uk42TC1SQzN4MjlBQUc5UVVQRXo5S3FWWlB6UEMzaE1EUXNqRVZfUVVUZkxNd1E=');
  const k2 = atob('QVEuQWI4Uk42S1ZmX1dWbjJlbTVUZkZvcVMyQ3E4S040eUJ4emdFUE5tZzdyTl8xU24zbXc=');
  if (!parsed.includes(k2)) parsed.unshift(k2);
  if (!parsed.includes(k1)) parsed.unshift(k1);
  return parsed;
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
  let lastError: any = new Error('No Gemini keys available');

  // Cascade models to try
  const modelsToTry = [
    model, // The requested model first
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-8b'
  ];

  // Remove duplicates while keeping order
  const uniqueModels = Array.from(new Set(modelsToTry));

  for (const modelName of uniqueModels) {
    for (let i = 0; i < keys.length; i++) {
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
    'gemini-2.5-flash-8b',
  ];

  const keys = await getKeys();

  for (const model of VISION_MODELS) {
    for (let i = 0; i < keys.length; i++) {
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
