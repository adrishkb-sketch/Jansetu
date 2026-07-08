/**
 * Jansetu — Gemini API Service
 *
 * Features:
 *  - Global request queue: max 1 request per 7 seconds (stays under free-tier RPM limits)
 *  - Exponential backoff retry: up to 4 attempts per key before moving to next key/model
 *  - Respects Retry-After header from 429 responses
 *  - Multi-key rotation: exhausted keys are skipped for 90s then retried
 *  - Model cascade: gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite
 *  - Robust key loading: localStorage first, then Firestore, never empty on transient errors
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Firestore sync removed as per user request — website ONLY uses user-pasted keys.

// ─── RATE LIMIT QUEUE ────────────────────────────────────────────────────────
// Ensures max 1 Gemini request every MIN_REQUEST_GAP_MS.
// Free tier: ~10-15 RPM → 1 req / 6s safely avoids rate limits entirely.
const MIN_REQUEST_GAP_MS = 8000; // 8 seconds between requests
let lastRequestTime = 0;
let requestQueue: Array<() => void> = [];
let queueRunning = false;

function scheduleRequest<T>(fn: () => Promise<T>, retriesLeft = 3): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (e: any) {
        if (e.status === 429 && retriesLeft > 0) {
          const waitTime = e.retryAfterMs || 6000;
          console.warn(`[Jansetu Queue] Rate limited (429). Retrying in ${waitTime}ms...`);
          await sleep(waitTime);
          try {
            const retryRes = await scheduleRequest(fn, retriesLeft - 1);
            resolve(retryRes);
          } catch (retryErr) {
            reject(retryErr);
          }
        } else {
          reject(e);
        }
      }
    });
    if (!queueRunning) drainQueue();
  });
}

async function drainQueue() {
  queueRunning = true;
  while (requestQueue.length > 0) {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_GAP_MS) {
      await sleep(MIN_REQUEST_GAP_MS - elapsed);
    }
    const next = requestQueue.shift();
    if (next) {
      lastRequestTime = Date.now();
      await next();
    }
  }
  queueRunning = false;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── KEY MANAGEMENT ──────────────────────────────────────────────────────────

// Keys marked 429-exhausted. Cleared after 90s so they're retried.
const exhaustedKeys = new Map<string, number>();

function isKeyExhausted(_key: string): boolean {
  return false; // Disabled key lockout to allow immediate recovery
}

function markKeyExhausted(key: string, retryAfterMs = 90_000) {
  exhaustedKeys.set(key, Date.now() - (90_000 - retryAfterMs));
  console.warn(`[Jansetu AI] Key exhausted, retry in ${Math.round(retryAfterMs / 1000)}s: ${key.slice(0, 14)}...`);
}

// Firestore sync removed as per user request — website ONLY uses user-pasted keys.

function parseLocalKeys(): string[] {
  try {
    const raw = localStorage.getItem('jansetu_gemini_key') || '';
    return raw
      .split(/[\n\r,;]+/)
      .map(k => k.trim())
      .filter(k => k.length >= 20); // accept any key format (AIza..., AQ.xxx, etc.)
  } catch {
    return [];
  }
}

/**
 * Returns ordered list of API keys to try.
 * Uses ONLY localStorage (user-pasted keys). Deduped.
 */
async function getKeys(): Promise<string[]> {
  const local = parseLocalKeys();

  const all = [...new Set(local)];

  if (all.length === 0) {
    console.warn(
      '[Jansetu AI] No API keys found in localStorage.\n' +
      'Open "Configure Gemini API Keys" at the bottom of the page and paste your key from https://aistudio.google.com/apikey'
    );
  }

  return all;
}

// ─── CORE REQUEST ────────────────────────────────────────────────────────────

/**
 * Makes a single raw POST to the Gemini API.
 * Throws on HTTP errors with a parsed message.
 * Returns retry-after milliseconds via a special error property on 429.
 */
async function rawCall(model: string, key: string, payload: any): Promise<any> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) errMsg = parsed.error.message;
    } catch (_) {}

    if (response.status === 429) {
      // Parse Retry-After header (seconds) if present
      const retryAfterSec = parseFloat(response.headers.get('retry-after') || '0');
      const retryAfterMs = retryAfterSec > 0 ? retryAfterSec * 1000 : 90_000;
      markKeyExhausted(key, retryAfterMs);
      const err: any = new Error(`Gemini [${model}] quota exceeded — ${errMsg}`);
      err.status = 429;
      err.retryAfterMs = retryAfterMs;
      throw err;
    }

    throw new Error(`Gemini [${model}] error — ${errMsg}`);
  }

  const json = await response.json();

  if (!json.candidates || json.candidates.length === 0) {
    throw new Error(`Gemini [${model}] returned no candidates (safety block or empty response)`);
  }

  const candidate = json.candidates[0];
  if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
    if (candidate.finishReason === 'SAFETY') throw new Error(`Gemini [${model}] safety block`);
    // RECITATION and others can still have valid text
  }

  return json;
}

/**
 * Calls one model+key combo with up to MAX_RETRIES attempts,
 * using exponential backoff.
 */
const MAX_RETRIES = 3;

async function callWithRetry(model: string, key: string, payload: any): Promise<any> {
  let delay = 2000;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await rawCall(model, key, payload);
    } catch (e: any) {
      if (e.status === 429) {
        // Key is exhausted, no point retrying with it
        throw e;
      }
      if (attempt === MAX_RETRIES) throw e;
      console.warn(`[Jansetu AI] ${model} attempt ${attempt + 1} failed, retrying in ${delay}ms...`, e.message);
      await sleep(delay);
      delay = Math.min(delay * 2, 16_000);
    }
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

/**
 * Sends a text/multimodal payload to Gemini.
 * Tries all keys × all models in cascade, with retries and rate limiting.
 * Returns a Response-compatible object so callers can do `.json()`.
 */
export async function fetchGemini(
  payload: any,
  model: string = 'gemini-2.5-flash'
): Promise<Response> {
  return scheduleRequest(async () => {
    const keys = await getKeys();
    if (keys.length === 0) {
      throw new Error(
        'No Gemini API keys configured. Please open "Configure Gemini API Keys" at the bottom of the page.'
      );
    }

    const models = Array.from(new Set([model, ...TEXT_MODELS]));
    let lastError: any = new Error('All Gemini models and keys exhausted');

    for (const m of models) {
      for (const key of keys) {
        if (isKeyExhausted(key)) {
          console.log(`[Jansetu AI] Skipping exhausted key for ${m}`);
          continue;
        }
        try {
          const json = await callWithRetry(m, key, payload);
          console.log(`[Jansetu AI] ✓ model=${m}`);
          return new Response(JSON.stringify(json), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          console.warn(`[Jansetu AI] ${m} failed:`, e.message);
          lastError = e;
        }
      }
    }

    throw lastError;
  });
}

/**
 * Vision-specific call (image + text parts).
 * Returns { text, model } or null on total failure.
 */
export async function fetchGeminiVision(
  parts: any[],
  fallbackDescription = ''
): Promise<{ text: string; model: string } | null> {
  return scheduleRequest(async () => {
    const keys = await getKeys();
    if (keys.length === 0) {
      console.error('[Jansetu Vision] No API keys available');
      return fallbackDescription ? { text: fallbackDescription, model: 'fallback' } : null;
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: { 
        temperature: 0.2, 
        maxOutputTokens: 2048
        // NOTE: Do NOT set responseMimeType here — vision calls on free-tier models reject JSON mode
        // The vision prompt instructs Gemini to output raw JSON text, which extractJSON() handles client-side
      },
    };

    for (const model of VISION_MODELS) {
      for (const key of keys) {
        if (isKeyExhausted(key)) {
          console.log(`[Jansetu Vision] Skipping exhausted key for ${model}`);
          continue;
        }
        try {
          const json = await callWithRetry(model, key, payload);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`[Jansetu Vision] ✓ model=${model}`);
            return { text, model };
          }
          throw new Error('Empty text in response');
        } catch (e: any) {
          console.warn(`[Jansetu Vision] ${model} failed:`, e.message);
        }
      }
    }

    console.error('[Jansetu Vision] All models and keys failed');
    return fallbackDescription ? { text: fallbackDescription, model: 'fallback' } : null;
  });
}

/**
 * Detects MIME type from base64 image header bytes.
 */
export function detectMimeType(base64: string): string {
  const sig = base64.substring(0, 8);
  if (sig.startsWith('/9j/')) return 'image/jpeg';
  if (sig.startsWith('iVBORw')) return 'image/png';
  if (sig.startsWith('R0lGOD')) return 'image/gif';
  if (sig.startsWith('UklGRi') || sig.startsWith('AAABAA')) return 'image/webp';
  if (sig.startsWith('AAAAFG') || sig.startsWith('AAAAHG')) return 'image/heic';
  return 'image/jpeg';
}
