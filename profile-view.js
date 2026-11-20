/* Public profile card: used by profile.html and by 404.html (so rassim.shop/<username> works) */
(function () {
  const css = `.pcard{max-width:440px;width:100%;margin:auto;text-align:center;position:relative;z-index:1;overflow:hidden;border-radius:22px;
    border:1px solid color-mix(in srgb,var(--accent) 28%,#222);background:rgba(0,0,0,.55);font-family:"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;color:var(--text)}
  .pcard .pbanner{height:96px}
  .pcard .pbody{padding:0 22px 26px;margin-top:-54px}
  .pcard .av{display:inline-grid;place-items:center;border-radius:50%;border:3px solid var(--accent);color:var(--text);line-height:1;margin:0 auto;background:#0b0b0b}
  .pcard h1{font-family:"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;font-style:normal;font-weight:600;letter-spacing:.01em;font-size:clamp(1.7rem,7vw,2.1rem);margin:14px 0 0;overflow-wrap:anywhere;text-shadow:none}
  .pcard .handle{color:var(--muted);font-size:1.2rem;font-style:normal;margin-top:2px;overflow-wrap:anywhere}
  .pcard .badges{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
  .pcard .badge{font-size:.9rem;padding:3px 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--accent) 45%,#222);background:rgba(0,0,0,.45);font-style:normal}
  .pcard .bio{color:var(--muted);margin:14px 0 4px;line-height:1.55;font-size:1.15rem;overflow-wrap:anywhere;white-space:pre-line}
  .pcard .info{color:var(--muted);font-style:normal;font-size:1rem;margin-top:8px}
  .pcard .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0 6px;padding:14px 0;border-top:1px solid color-mix(in srgb,var(--accent) 15%,#222);border-bottom:1px solid color-mix(in srgb,var(--accent) 15%,#222)}
  .pcard .stats b{display:block;font-weight:600;font-size:1.45rem;color:var(--text)}
  .pcard .stats span{color:var(--muted);font-style:normal;font-size:.95rem}
  .pcard h3{font-weight:600;font-size:1.25rem;margin:20px 0 6px;text-align:left}
  .pcard .rv{text-align:left;padding:12px 0;border-bottom:1px solid color-mix(in srgb,var(--accent) 12%,#222)}
  .pcard .rv:last-child{border-bottom:0}
  .pcard .rv .st{color:var(--accent);letter-spacing:.1em}
  .pcard .rv p{margin-top:4px;line-height:1.45;overflow-wrap:anywhere}
  .pcard .rv small{color:var(--muted);font-style:normal}
  .pcard .acts{margin-top:22px}
  .pcard .pbtn{display:inline-block;margin:4px;padding:10px 22px;border-radius:999px;color:var(--text);text-decoration:none;font:inherit;font-style:normal;font-size:1.05rem;cursor:pointer;
    border:1px solid color-mix(in srgb,var(--accent) 35%,#222);background:rgba(0,0,0,.55);transition:color .2s,border-color .2s,box-shadow .2s,transform .2s}
  .pcard .pbtn:hover{color:#fff;border-color:var(--accent);box-shadow:0 0 22px var(--glow);transform:translateY(-2px)}`;

  const IG = /^[A-Za-z0-9._]{1,30}$/;
  const tier = n => n >= 15 ? 'VIP buyer' : n >= 5 ? 'Loyal customer' : n >= 1 ? 'Verified buyer' : 'New member';

  async function render(container, username) {
    const name = String(username || '').toLowerCase();
    const { data: d } = await window.sb.from('profiles_public').select('*').eq('username', name).maybeSingle();
    if (!d) return false;
    if (!document.getElementById('pcard-css')) { const st = document.createElement('style'); st.id = 'pcard-css'; st.textContent = css; document.head.append(st); }
    const h = Shop.h;
    const [revs, mine] = await Promise.all([
      window.sb.from('feedbacks_public').select('*').eq('author', d.username).eq('verified', true).order('created_at', { ascending: false }).limit(5).then(r => r.data || []),
      (async () => { try { const s = await Shop.session(); if (!s) return false; const { data } = await window.sb.from('profiles').select('username').eq('id', s.user.id).maybeSingle(); return !!data && data.username === d.username; } catch (e) { return false; } })()]);
    const hue = d.avatar_hue === null || d.avatar_hue === undefined ? null : Number(d.avatar_hue);
    const banner = hue === null ? 'linear-gradient(135deg,color-mix(in srgb,var(--accent) 40%,#000),#050505)' : `linear-gradient(135deg,hsl(${hue} 60% 30%),hsl(${hue} 45% 9%))`;
    const link = 'https://rassim.shop/' + d.username;
    const shareBtn = h('button', { class: 'pbtn', onclick: e => Shop.copy(link, e.target) }, 'Copy link');
    container.replaceChildren(h('div', { class: 'pcard' },
      h('div', { class: 'pbanner', style: 'background:' + banner }),
      h('div', { class: 'pbody' },
        Shop.avatar(d, 104),
        d.display_name ? h('h1', {}, d.display_name) : null,
        d.display_name ? h('div', { class: 'handle' }, '@' + d.username) : h('h1', {}, '@' + d.username),
        h('div', { class: 'badges' }, h('span', { class: 'badge' }, tier(d.purchases)), d.reviews > 0 ? h('span', { class: 'badge' }, 'Reviewer') : null),
        d.bio ? h('p', { class: 'bio' }, d.bio) : null,
        h('div', { class: 'info' }, [d.country, 'Member since ' + new Date(d.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })].filter(Boolean).join('  |  ')),
        h('div', { class: 'stats' },
          h('div', {}, h('b', {}, String(d.purchases)), h('span', {}, d.purchases === 1 ? 'Purchase' : 'Purchases')),
          h('div', {}, h('b', {}, String(d.reviews)), h('span', {}, d.reviews === 1 ? 'Review' : 'Reviews')),
          h('div', {}, h('b', {}, d.avg_rating ? Number(d.avg_rating).toFixed(1) : '-'), h('span', {}, 'Avg rating'))),
        revs.length ? h('h3', {}, 'Reviews') : null,
        ...revs.map(r => h('div', { class: 'rv' }, h('div', {}, h('span', { class: 'st' }, Shop.stars(r.rating)), ' ', h('small', {}, r.product_title || '')), h('p', {}, r.comment))),
        h('div', { class: 'acts' },
          d.instagram && IG.test(d.instagram) ? h('a', { class: 'pbtn', href: 'https://www.instagram.com/' + encodeURIComponent(d.instagram), target: '_blank', rel: 'noopener' }, 'Instagram') : null,
          d.tiktok && IG.test(d.tiktok) ? h('a', { class: 'pbtn', href: 'https://www.tiktok.com/@' + encodeURIComponent(d.tiktok), target: '_blank', rel: 'noopener' }, 'TikTok') : null,
          shareBtn, mine ? h('a', { class: 'pbtn', href: '/profile' }, 'Edit profile') : null),
        h('div', { class: 'acts', style: 'margin-top:0' }, h('a', { class: 'pbtn', href: '/browse' }, 'Browse the shop'), h('a', { class: 'pbtn', href: '/' }, 'Home')))));
    document.title = (d.display_name || '@' + d.username) + ' | Resemblance';
    const r = document.createElement('meta'); r.name = 'robots'; r.content = 'noindex'; document.head.append(r);
    return true;
  }
  window.ProfileView = { render };
})();
