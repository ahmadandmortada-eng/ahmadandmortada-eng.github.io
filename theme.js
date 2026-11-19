/* Takes the accent color from pfp.png, same as the main page */
(function () {
  const root = document.documentElement.style;
  let hue = 0, sat = 0, lit = 82;
  function apply() {
    root.setProperty('--accent', `hsl(${hue} ${sat}% ${lit}%)`);
    root.setProperty('--glow', `hsl(${hue} ${sat}% ${lit}% / .5)`);
    root.setProperty('--bg-center', `hsl(${hue} ${Math.round(sat * .55)}% 11%)`);
    root.setProperty('--bg-edge', `hsl(${hue} ${Math.round(sat * .4)}% 3%)`);
    root.setProperty('--text', `hsl(${hue} 25% 92%)`);
    root.setProperty('--muted', `hsl(${hue} 12% 62%)`);
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = `hsl(${hue} ${Math.round(sat * .4)}% 3%)`;
  }
  function dominant(img) {
    const c = document.createElement('canvas'); c.width = c.height = 40;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 40, 40);
    const d = x.getImageData(0, 0, 40, 40).data;
    const bins = Array.from({ length: 12 }, () => ({ w: 0, h: 0 }));
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, df = max - min;
      if (df < .12 || l < .12 || l > .9) continue;
      const s = df / (1 - Math.abs(2 * l - 1));
      let h = max === r ? ((g - b) / df) % 6 : max === g ? (b - r) / df + 2 : (r - g) / df + 4;
      h = (h * 60 + 360) % 360;
      const bin = bins[Math.floor(h / 30)]; bin.w += s; bin.h += h * s;
    }
    const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
    return best.w === 0 ? null : Math.round(best.h / best.w);
  }
  apply();
  const img = new Image();
  img.onload = () => { try { const h = dominant(img); if (h !== null) { hue = h; sat = 70; lit = 52; } } catch (e) {} apply(); };
  img.src = '/pfp.png';
})();
