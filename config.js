// Paste your Supabase values (Project Settings > API).
// The anon key is PUBLIC by design. NEVER paste the "service_role" key here.
window.SUPABASE_URL = 'sb_publishable_T6kzMgk-lKurMDHY2ojy4Q_Kvpoo7Sm';
window.SUPABASE_ANON_KEY = 'sb_publishable_T6kzMgk-lKurMDHY2ojy4Q_Kvpoo7Sm';

window.sbReady = !/PASTE_/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY);
window.sb = window.sbReady ? supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
