/**
 * Shared service for communicating with Google Gemini API models.
 * Implements a multi-key backup fallback system with model cascade for vision tasks.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getKeys(): string[] {
  const keysString = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';
  const keys = keysString
    .split(/[\n\r,;]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
  if (keys.length === 0) keys.push('AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw');
  return keys;
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
  const keys = getKeys();
  let lastError: any = new Error('No Gemini keys available');

  for (let i = 0; i < keys.length; i++) {
    try {
      const json = await callGemini(model, keys[i], payload);
      // Wrap back into a Response so call-sites can do `.json()`
      return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.warn(`[Jansetu AI] Key index ${i} on model ${model} failed:`, e);
      lastError = e;
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
  const VISION_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
  ];

  const keys = getKeys();

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
