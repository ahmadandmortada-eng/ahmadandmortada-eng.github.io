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
  window.Shop = { LABEL, fmt, h, safeUrl, esc, say, dt, productImage, needClient, session, copy };
})();
