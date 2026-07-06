/**
 * Shared service for communicating with Google Gemini API models.
 * Implements a multi-key backup fallback system.
 */

export async function fetchGemini(
  payload: any,
  model: string = 'gemini-2.5-flash'
): Promise<Response> {
  const keysString = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';
  
  // Parse keys by splitting by lines, commas, or semicolons
  const keys = keysString
    .split(/[\n\r,;]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);

  if (keys.length === 0) {
    keys.push('AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw');
  }

  let lastError: any = new Error("No Gemini keys available");

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // If key is bad, rate limited, or quota error, throw to fall back to the next key
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Status ${response.status}: ${errText}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch (je) {}
        throw new Error(`Gemini API Error - ${errMsg}`);
      }

      // Check if candidate exists and has text, indicating a successful response
      const json = await response.clone().json();
      if (!json.candidates || json.candidates.length === 0) {
        throw new Error("Gemini returned an empty candidates block. This could indicate content safety blockages.");
      }

      return response;
    } catch (e) {
      console.warn(`[Jansetu AI Backup System] Gemini key index ${i} failed. Trying backup key... Error:`, e);
      lastError = e;
    }
  }

  // All keys failed, bubble up the error
  throw lastError;
}
