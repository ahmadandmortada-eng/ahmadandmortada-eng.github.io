// Paste your Supabase values (Project Settings > API).
// The anon key is PUBLIC by design. NEVER paste the "service_role" key here.
window.SUPABASE_URL = 'sb_publishable_T6kzMgk-lKurMDHY2ojy4Q_Kvpoo7Sm';
window.SUPABASE_ANON_KEY = 'sb_publishable_T6kzMgk-lKurMDHY2ojy4Q_Kvpoo7Sm';

window.sbReady = false; window.sbError = ''; window.sb = null;
try {
  if (/PASTE_/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY)) throw new Error('config.js still contains the PASTE_ placeholders.');
  if (typeof supabase === 'undefined') throw new Error('The Supabase library did not load (an ad blocker, Brave Shields or the network may be blocking cdn.jsdelivr.net).');
  window.sb = supabase.createClient(window.SUPABASE_URL.trim(), window.SUPABASE_ANON_KEY.trim());
  window.sbReady = true;
} catch (e) { window.sbError = e.message; }
