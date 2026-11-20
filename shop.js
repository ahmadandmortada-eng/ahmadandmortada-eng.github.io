/* Shared helpers for the shop pages */
(function () {
  const LABEL = { tiktok_username: 'TikTok username', instagram_username: 'Instagram username', gift_card: 'Gift card', digital_product: 'Digital product' };
  const fmt = n => Number(n).toLocaleString('en-US') + ' DA';
  function h(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    kids.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(c)); });
    return e;
  }
  const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = (el, t, k) => { el.textContent = t; el.className = 'msg' + (k ? ' ' + k : ''); };
  const dt = s => new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  /* automatic product image (used when no image link is set), drawn in the site's accent color */
  function productImage(p) {
    const custom = p.image_url && safeUrl(p.image_url); if (custom) return custom;
    const d = p.details || {}; let small = LABEL[p.category] || '', big = p.title || '';
    if (p.category === 'tiktok_username') { small = 'TikTok'; big = '@' + (d.handle || big.replace(/^@/, '')); }
    else if (p.category === 'instagram_username') { small = 'Instagram'; big = '@' + (d.handle || big.replace(/^@/, '')); }
    else if (p.category === 'gift_card') { small = (d.brand || 'Gift card') + ' gift card'; big = d.value || big; }
    else { small = 'Digital product'; }
    if (big.length > 22) big = big.slice(0, 21) + '…';
    const a = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#cfcfcf';
    const fs = big.length > 15 ? 40 : big.length > 10 ? 52 : 68;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 375"><defs><radialGradient id="g" cx="50%" cy="35%" r="85%"><stop offset="0" stop-color="#202020"/><stop offset="1" stop-color="#060606"/></radialGradient></defs>` +
      `<rect width="600" height="375" rx="26" fill="url(#g)"/><rect x="12" y="12" width="576" height="351" rx="18" fill="none" stroke="${esc(a)}" stroke-opacity=".5"/>` +
      `<text x="300" y="120" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="22" letter-spacing="6" fill="${esc(a)}" fill-opacity=".8">${esc(small.toUpperCase())}</text>` +
      `<text x="300" y="215" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${fs}" fill="#f1ecec">${esc(big)}</text>` +
      `<text x="300" y="325" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="18" letter-spacing="4" fill="${esc(a)}" fill-opacity=".55">resemblanced</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const needClient = el => { if (window.sbReady) return true; if (el) say(el, 'Not connected: ' + (window.sbError || 'config.js did not load'), 'err'); return false; };
  const session = async () => { if (!window.sbReady) return null; const { data } = await window.sb.auth.getSession(); return data.session; };
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch (e) { const t = h('textarea', {}, text); document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
    if (btn) { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = o, 1400); }
  }

  /* ---------- launch helpers ---------- */
  const SITE = 'https://rassim.shop';
  const money = (n, c) => c === 'USD'
    ? '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(n).toLocaleString('en-US') + ' DA';
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const slugify = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  const clip = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trim() + '…' : t; };

  /* page title, description, canonical and social tags (set per page, per product) */
  function setMeta({ title, desc, path, image }) {
    document.title = title;
    const meta = (sel, attrs) => { let e = document.head.querySelector(sel); if (!e) { e = document.createElement(sel.startsWith('link') ? 'link' : 'meta'); document.head.append(e); } for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); };
    const url = SITE + (path || location.pathname);
    meta('meta[name="description"]', { name: 'description', content: desc });
    meta('link[rel="canonical"]', { rel: 'canonical', href: url });
    meta('meta[property="og:title"]', { property: 'og:title', content: title });
    meta('meta[property="og:description"]', { property: 'og:description', content: desc });
    meta('meta[property="og:url"]', { property: 'og:url', content: url });
    meta('meta[property="og:image"]', { property: 'og:image', content: image || SITE + '/pfp.png' });
    meta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  }
  function jsonLd(obj) { const e = document.createElement('script'); e.type = 'application/ld+json'; e.textContent = JSON.stringify(obj); document.head.append(e); }


  /* usernames: 3-20 letters/numbers/_ (must match setup7.sql) */
  const RESERVED = ['admin','administrator','root','support','shop','browse','product','products','feedbacks','feedback','account','login','logout','signup','register','buy','profile','user','users','settings','api','help','about','contact','terms','privacy','rassim','resemblance','resemblanced','shopixx','index','null','undefined','www','mail','official','staff','moderator','orders','order','cart','checkout','home'];
  const cleanUsername = t => String(t || '').trim().toLowerCase().replace(/^@/, '');
  const validUsername = n => /^[a-z0-9_]{3,20}$/.test(n) && !RESERVED.includes(n);

  /* shared top bar: <nav id="nav"></nav> */
  function mountNav() {
    const n = document.getElementById('nav'); if (!n) return;
    n.className = 'top'; n.setAttribute('aria-label', 'Site');
    n.replaceChildren(h('a', { class: 'btn small', href: '/' }, 'Home'),
      h('span', { class: 'nav' }, h('a', { class: 'btn small', href: '/browse' }, 'Browse'), h('a', { class: 'btn small', href: '/feedbacks' }, 'Feedbacks'), h('a', { class: 'btn small', href: '/account' }, 'Account')));
  }
  const foot = () => h('footer', { class: 'foot', style: 'text-align:center;margin-top:40px' },
    h('p', {}, 'Contact: ', h('a', { href: 'mailto:xfosto9@gmail.com' }, 'xfosto9@gmail.com')), h('p', {}, '© 2026 Resemblance. All rights reserved.'));
  document.addEventListener('DOMContentLoaded', () => { mountNav(); const f = document.getElementById('foot'); if (f) f.replaceWith(foot()); });
  window.Shop = { LABEL, fmt, h, safeUrl, esc, say, dt, productImage, needClient, session, copy, SITE, money, stars, slugify, clip, setMeta, jsonLd, mountNav, RESERVED, cleanUsername, validUsername };
})();
