// Paste your Supabase values (Project Settings > API).
// The anon key is PUBLIC by design. NEVER paste the "service_role" key here.
window.SUPABASE_URL = 'https://adubprhqlurqtlopgyek.supabase.co/rest/v1/';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdWJwcmhxbHVycXRsb3BneWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNDE0MjIsImV4cCI6MjExMDYxNzQyMn0.pJbQ1_lQq9ocvFBbvIdJt6HiwfcwOf94vPdIBtJbrm8';

window.sbReady = false; window.sbError = ''; window.sb = null;
try {
  if (/PASTE_/.test(window.SUPABASE_URL + window.SUPABASE_ANON_KEY)) throw new Error('config.js still contains the PASTE_ placeholders.');
  if (typeof supabase === 'undefined') throw new Error('The Supabase library did not load (an ad blocker, Brave Shields or the network may be blocking cdn.jsdelivr.net).');
  window.sb = supabase.createClient(window.SUPABASE_URL.trim(), window.SUPABASE_ANON_KEY.trim());
  window.sbReady = true;
} catch (e) { window.sbError = e.message; }
