/* Public profile card: used by profile.html and by 404.html (so rassim.shop/<username> works) */
(function () {
  const css = `.pcard{max-width:420px;margin:auto;text-align:center;position:relative;z-index:1}
  .pcard .av{width:112px;height:112px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;font-family:"UnifrakturCook","Times New Roman",serif;font-size:3.2rem;color:var(--text);
    background:rgba(0,0,0,.6);border:2px solid var(--accent);box-shadow:0 0 0 6px var(--bg-edge),0 0 0 7px var(--accent),0 0 40px var(--glow)}
  .pcard h1{font-family:"UnifrakturCook","Times New Roman",serif;font-size:clamp(2rem,8vw,2.6rem);text-shadow:0 0 22px var(--glow);overflow-wrap:anywhere}
  .pcard .bio{font-style:italic;color:var(--muted);margin:10px 0 22px;line-height:1.5;font-size:1.2rem;overflow-wrap:anywhere;white-space:pre-line}
  .pcard .stats{display:flex;justify-content:center;gap:34px;margin:6px 0 26px;color:var(--muted);font-style:italic}
  .pcard .stats b{display:block;font-style:normal;color:var(--text);font-size:1.5rem;text-shadow:0 0 14px var(--glow)}
  .pcard .pbtn{display:inline-block;margin:4px;padding:11px 24px;border-radius:999px;color:var(--text);text-decoration:none;font-style:italic;font-size:1.1rem;
    border:1px solid color-mix(in srgb,var(--accent) 35%,#222);background:rgba(0,0,0,.55);transition:color .2s,border-color .2s,box-shadow .2s,transform .2s}
  .pcard .pbtn:hover{color:#fff;border-color:var(--accent);box-shadow:0 0 22px var(--glow);transform:translateY(-3px)}`;

  async function render(container, username) {
    const name = String(username || '').toLowerCase();
    const { data } = await window.sb.from('profiles_public').select('*').eq('username', name).maybeSingle();
    if (!data) return false;
    if (!document.getElementById('pcard-css')) { const st = document.createElement('style'); st.id = 'pcard-css'; st.textContent = css; document.head.append(st); }
    const h = Shop.h;
    container.replaceChildren(h('div', { class: 'pcard' },
      h('div', { class: 'av', 'aria-hidden': 'true' }, data.username.charAt(0).toUpperCase()),
      h('h1', {}, '@' + data.username),
      data.bio ? h('p', { class: 'bio' }, data.bio) : null,
      h('div', { class: 'stats' },
        h('span', {}, h('b', {}, new Date(data.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })), 'Member since'),
        h('span', {}, h('b', {}, String(data.purchases)), data.purchases === 1 ? 'Purchase' : 'Purchases')),
      h('a', { class: 'pbtn', href: '/browse' }, 'Browse the shop'), h('a', { class: 'pbtn', href: '/' }, 'Home')));
    document.title = '@' + data.username + ' | Resemblance';
    const r = document.createElement('meta'); r.name = 'robots'; r.content = 'noindex'; document.head.append(r);
    return true;
  }
  window.ProfileView = { render };
})();
