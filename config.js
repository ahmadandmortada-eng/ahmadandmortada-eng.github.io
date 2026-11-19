// Paste your Supabase values (Project Settings > API).
// The anon key is PUBLIC by design. NEVER paste the "service_role" key here.
window.SUPABASE_URL = 'PASTE_PROJECT_URL_HERE';
window.SUPABASE_ANON_KEY = 'PASTE_ANON_KEY_HERE';

window.sbReady = !/PASTE_/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY);
window.sb = window.sbReady ? supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
