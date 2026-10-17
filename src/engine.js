/* Motor: imagen -> piezas de color sin superposición (SVG). Sin dependencias. */
const Engine = (() => {
  'use strict';

  // ---------------- Color ----------------
  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const LW = 0.8; // peso de la luminosidad: las sombras pesan menos que el tono
  const labF = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  function rgbToLab(r, g, b, out, o) {
    const R = LIN[r], G = LIN[g], B = LIN[b];
    const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
    const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
    const fx = labF(x), fy = labF(y), fz = labF(z);
    out[o] = (116 * fy - 16) * LW; out[o + 1] = 500 * (fx - fy); out[o + 2] = 200 * (fy - fz);
  }
  function mulberry32(a) {
    return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const toHex = ([r, g, b]) => ('#' + hex2(r) + hex2(g) + hex2(b)).toUpperCase();
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  function colorName([r, g, b]) {
    const R = r / 255, G = g / 255, B = b / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d < 0.07 || s < 0.1) {
      if (l < 0.13) return 'Negro'; if (l > 0.9) return 'Blanco';
      if (l < 0.38) return 'Gris oscuro'; if (l > 0.7) return 'Gris claro'; return 'Gris';
    }
    let h = 0;
    if (mx === R) h = ((G - B) / d) % 6; else if (mx === G) h = (B - R) / d + 2; else h = (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
    if (l < 0.1) return 'Negro';
    if (h < 12 || h >= 345) return l < 0.3 ? 'Bordó' : l > 0.75 ? 'Rosa' : 'Rojo';
    if (h < 40) return l < 0.3 ? 'Marrón' : l > 0.78 ? 'Durazno' : 'Naranja';
    if (h < 66) return l < 0.33 ? 'Ocre' : 'Amarillo';
    if (h < 160) return l < 0.28 ? 'Verde oscuro' : l > 0.72 ? 'Verde claro' : 'Verde';
    if (h < 200) return l > 0.65 ? 'Celeste' : 'Turquesa';
    if (h < 250) return l > 0.68 ? 'Celeste' : l < 0.28 ? 'Azul marino' : 'Azul';
    if (h < 290) return l > 0.72 ? 'Lila' : 'Violeta';
    return l > 0.72 ? 'Rosa' : 'Fucsia';
  }

  // ---------------- K-means ----------------
  function kmeans(data, n, k, rng, iters) {
    const C = new Float64Array(k * 3), D = new Float64Array(n).fill(Infinity);
    const f = Math.floor(rng() * n);
    C[0] = data[f * 3]; C[1] = data[f * 3 + 1]; C[2] = data[f * 3 + 2];
    let kk = 1;
    for (; kk < k; kk++) {
      const cx = C[(kk - 1) * 3], cy = C[(kk - 1) * 3 + 1], cz = C[(kk - 1) * 3 + 2];
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const dx = data[i * 3] - cx, dy = data[i * 3 + 1] - cy, dz = data[i * 3 + 2] - cz;
        const d = dx * dx + dy * dy + dz * dz; if (d < D[i]) D[i] = d; sum += D[i];
      }
      if (sum <= 1e-6) break;
      let t = rng() * sum, idx = 0;
      for (; idx < n - 1; idx++) { t -= D[idx]; if (t <= 0) break; }
      C[kk * 3] = data[idx * 3]; C[kk * 3 + 1] = data[idx * 3 + 1]; C[kk * 3 + 2] = data[idx * 3 + 2];
    }
    k = kk;
    const assign = new Int32Array(n).fill(-1), S = new Float64Array(k * 3), cnt = new Int32Array(k);
    for (let it = 0; it < iters; it++) {
      S.fill(0); cnt.fill(0); let changed = 0;
      for (let i = 0; i < n; i++) {
        const x = data[i * 3], y = data[i * 3 + 1], z = data[i * 3 + 2];
        let best = 0, bd = Infinity;
        for (let c = 0; c < k; c++) {
          const dx = x - C[c * 3], dy = y - C[c * 3 + 1], dz = z - C[c * 3 + 2];
          const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = c; }
        }
        if (assign[i] !== best) { assign[i] = best; changed++; }
        S[best * 3] += x; S[best * 3 + 1] += y; S[best * 3 + 2] += z; cnt[best]++;
      }
      for (let c = 0; c < k; c++) if (cnt[c] > 0) { C[c * 3] = S[c * 3] / cnt[c]; C[c * 3 + 1] = S[c * 3 + 1] / cnt[c]; C[c * 3 + 2] = S[c * 3 + 2] / cnt[c]; }
      if (changed === 0) break;
    }
    return { C: C.slice(0, k * 3), k, cnt: Array.from(cnt) };
  }

  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const hueOf = l => (Math.atan2(l[2], l[1]) * 180) / Math.PI;
  const chromaOf = l => Math.hypot(l[1], l[2]);

  /**
   * Separa la imagen en grupos de color.
   * mode: 'auto' o un número fijo de colores.
   * Devuelve raw (índice de grupo por píxel, 255 = transparente) y groups [{rgb,count}].
   */
  function quantize(rgba, w, h, mode) {
    const N = w * h, lab = new Float32Array(N * 3), opaque = new Uint8Array(N);
    let nOp = 0, hasAlpha = false;
    for (let i = 0; i < N; i++) {
      const a = rgba[i * 4 + 3];
      if (a < 255) hasAlpha = true;
      if (a < 128) continue;
      opaque[i] = 1; nOp++;
      rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], lab, i * 3);
    }
    if (nOp === 0) throw new Error('La imagen está completamente transparente.');
    const rng = mulberry32(12345);
    const M = Math.min(60000, nOp), samp = new Float32Array(M * 3);
    if (M === nOp) { let j = 0; for (let i = 0; i < N; i++) if (opaque[i]) { samp.set(lab.subarray(i * 3, i * 3 + 3), j * 3); j++; } }
    else { let j = 0; while (j < M) { const i = Math.floor(rng() * N); if (!opaque[i]) continue; samp.set(lab.subarray(i * 3, i * 3 + 3), j * 3); j++; } }

    const auto = mode === 'auto';
    const K = auto ? 16 : Math.max(2, Math.min(24, mode | 0));
    const km = kmeans(samp, M, K, rng, 30);
    const k = km.k;
    // grupos
    let groups = [];
    for (let c = 0; c < k; c++) groups.push({ members: [c], count: km.cnt[c], lab: [km.C[c * 3], km.C[c * 3 + 1], km.C[c * 3 + 2]] });
    groups = groups.filter(g => g.count > 0);
    const mergeInto = (a, b) => { // a dentro de b
      const t = a.count + b.count;
      b.lab = b.lab.map((v, i) => (v * b.count + a.lab[i] * a.count) / t);
      b.count = t; b.members = b.members.concat(a.members); a.dead = true;
    };
    if (auto) {
      // 1) unir colores casi iguales
      for (;;) {
        let best = null, bd = 14;
        for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
          const d = dist3(groups[i].lab, groups[j].lab); if (d < bd) { bd = d; best = [i, j]; }
        }
        if (!best) break;
        const [i, j] = best; const a = groups[i], b = groups[j];
        if (a.count > b.count) mergeInto(b, a); else mergeInto(a, b);
        groups = groups.filter(g => !g.dead);
      }
      // 2) sombras y brillos del mismo tono (mismo matiz, distinta luz)
      const sorted = groups.slice().sort((a, b) => a.count - b.count);
      for (const g of sorted) {
        if (g.dead || g.count / M >= 0.1 || chromaOf(g.lab) < 15) continue;
        let tgt = null, bd = Infinity;
        for (const o of groups) {
          if (o === g || o.dead || o.count <= g.count || chromaOf(o.lab) < 15) continue;
          let dh = Math.abs(hueOf(g.lab) - hueOf(o.lab)); if (dh > 180) dh = 360 - dh;
          if (dh > 8) continue;
          const d = dist3(g.lab, o.lab); if (d < 45 && d < bd) { bd = d; tgt = o; }
        }
        if (tgt) mergeInto(g, tgt);
      }
      groups = groups.filter(g => !g.dead);
      // 3) restos mínimos (bordes suavizados) al color más cercano
      for (const g of groups.slice().sort((a, b) => a.count - b.count)) {
        if (g.dead || g.count / M >= 0.004 || groups.filter(x => !x.dead).length <= 2) continue;
        let tgt = null, bd = Infinity;
        for (const o of groups) { if (o === g || o.dead) continue; const d = dist3(g.lab, o.lab); if (d < bd) { bd = d; tgt = o; } }
        if (tgt) mergeInto(g, tgt);
      }
      groups = groups.filter(g => !g.dead);
    }
    const centerGroup = new Int32Array(k).fill(-1);
    groups.forEach((g, gi) => g.members.forEach(c => (centerGroup[c] = gi)));
    // centros sin grupo (vacíos) -> grupo más cercano
    for (let c = 0; c < k; c++) if (centerGroup[c] < 0) {
      let bd = Infinity; const cl = [km.C[c * 3], km.C[c * 3 + 1], km.C[c * 3 + 2]];
      groups.forEach((g, gi) => { const d = dist3(cl, g.lab); if (d < bd) { bd = d; centerGroup[c] = gi; } });
    }
    // asignación final de todos los píxeles al centro más cercano
    const C = km.C, raw = new Uint8Array(N).fill(255);
    const cs = new Float64Array(k * 3), cc = new Float64Array(k);
    for (let i = 0; i < N; i++) {
      if (!opaque[i]) continue;
      const x = lab[i * 3], y = lab[i * 3 + 1], z = lab[i * 3 + 2];
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = x - C[c * 3], dy = y - C[c * 3 + 1], dz = z - C[c * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = c; }
      }
      raw[i] = centerGroup[best];
      cs[best * 3] += rgba[i * 4]; cs[best * 3 + 1] += rgba[i * 4 + 1]; cs[best * 3 + 2] += rgba[i * 4 + 2]; cc[best]++;
    }
    // color de cada grupo = el de su centro dominante (no una mezcla)
    const out = groups.map((g, gi) => {
      let dom = -1, dc = -1, total = 0;
      for (let c = 0; c < k; c++) if (centerGroup[c] === gi) { total += cc[c]; if (cc[c] > dc) { dc = cc[c]; dom = c; } }
      const rgb = dc > 0 ? [cs[dom * 3] / dc, cs[dom * 3 + 1] / dc, cs[dom * 3 + 2] / dc].map(Math.round) : [128, 128, 128];
      return { rgb, count: total, old: gi };
    }).filter(g => g.count > 0);
    // Colores de transición: tonos de mezcla que solo viven en los bordes
    // (antialiasing, desenfoque). Se detectan por estar casi sin "interior" y
    // por caer entre otros dos colores; sus píxeles se reparten entre los vecinos.
    const G = groups.length, inner = new Float64Array(G), tot = new Float64Array(G);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      const i = y * w + x, g = raw[i]; if (g === 255) continue; tot[g]++;
      if (raw[i - 1] === g && raw[i + 1] === g && raw[i - 2] === g && raw[i + 2] === g && raw[i - w] === g && raw[i + w] === g && raw[i - 2 * w] === g && raw[i + 2 * w] === g) inner[g]++;
    }
    const glab = groups.map(g => g.lab);
    out.forEach(o => {
      const g = o.old; o.edge = false;
      if (o.count / nOp >= 0.04 || tot[g] === 0 || inner[g] / tot[g] >= 0.2) return;
      for (let a = 0; a < G && !o.edge; a++) for (let b = a + 1; b < G; b++) {
        if (a === g || b === g || tot[a] < tot[g] || tot[b] < tot[g]) continue;
        const A = glab[a], B = glab[b], P = glab[g];
        const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ap = [P[0] - A[0], P[1] - A[1], P[2] - A[2]];
        const L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]; if (L2 < 1) continue;
        const t = (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / L2; if (t < 0.05 || t > 0.95) continue;
        const d = Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
        if (d < 18) { o.edge = true; break; }
      }
    });
    out.sort((a, b) => b.count - a.count);
    const remap = new Uint8Array(256).fill(255);
    out.forEach((g, i) => (remap[g.old] = i));
    for (let i = 0; i < N; i++) if (raw[i] !== 255) raw[i] = remap[raw[i]];
    return { raw, groups: out.map(g => ({ rgb: g.rgb, hex: toHex(g.rgb), count: g.count, edge: g.edge })), hasAlpha };
  }

  // ---------------- Mapa de etiquetas ----------------
  /** map[g] = grupo destino (>=0) o -1 para quitar. Etiqueta 0 = fondo; g+1 = color. */
  function buildLabels(raw, w, h, map, removeBg, edge) {
    const N = w * h, L = new Uint8Array(N);
    let pending = false;
    for (let i = 0; i < N; i++) {
      const g = raw[i];
      if (g === 255) L[i] = 0;
      else if (edge && edge[g]) { L[i] = 255; pending = true; }
      else L[i] = map[g] < 0 ? 0 : map[g] + 1;
    }
    if (removeBg) {
      const cnt = new Int32Array(256);
      for (let x = 0; x < w; x++) { cnt[L[x]]++; cnt[L[(h - 1) * w + x]]++; }
      for (let y = 0; y < h; y++) { cnt[L[y * w]]++; cnt[L[y * w + w - 1]]++; }
      let d = 0; for (let v = 1; v < 256; v++) if (cnt[v] > cnt[d]) d = v;
      if (d !== 0) {
        const st = new Int32Array(N); let sp = 0;
        const push = i => { if (L[i] === d) { L[i] = 0; st[sp++] = i; } };
        for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
        for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
        while (sp) {
          const i = st[--sp], x = i % w;
          if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < N - w) push(i + w);
        }
      }
    }
    if (pending) fillUnassigned(L, w, h);
    return L;
  }

  function contentBox(L, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) { const r = y * w; for (let x = 0; x < w; x++) if (L[r + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; } }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  // Componentes conexos (4 vecinos)
  function components(L, w, h) {
    const N = w * h, comp = new Int32Array(N).fill(-1), st = new Int32Array(N);
    const sizes = [], labelOf = [], border = [];
    let n = 0;
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0) continue;
      const lab = L[s]; let sp = 0, size = 0, b = false;
      comp[s] = n; st[sp++] = s;
      while (sp) {
        const i = st[--sp]; size++;
        const x = i % w;
        if (x === 0 || x === w - 1 || i < w || i >= N - w) b = true;
        if (x > 0 && comp[i - 1] < 0 && L[i - 1] === lab) { comp[i - 1] = n; st[sp++] = i - 1; }
        if (x < w - 1 && comp[i + 1] < 0 && L[i + 1] === lab) { comp[i + 1] = n; st[sp++] = i + 1; }
        if (i >= w && comp[i - w] < 0 && L[i - w] === lab) { comp[i - w] = n; st[sp++] = i - w; }
        if (i < N - w && comp[i + w] < 0 && L[i + w] === lab) { comp[i + w] = n; st[sp++] = i + w; }
      }
      sizes.push(size); labelOf.push(lab); border.push(b); n++;
    }
    return { comp, sizes, labelOf, border, n };
  }

  // ---------------- Limpieza ----------------
  function modeFilter(L, w, h) {
    const out = new Uint8Array(L), cnt = new Int32Array(256);
    const off = [-w - 1, -w, -w + 1, -1, 0, 1, w - 1, w, w + 1];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, c = L[i];
      if (L[i - 1] === c && L[i + 1] === c && L[i - w] === c && L[i + w] === c) continue;
      for (let k = 0; k < 9; k++) cnt[L[i + off[k]]]++;
      let best = c, bc = cnt[c];
      for (let k = 0; k < 9; k++) { const v = L[i + off[k]]; if (cnt[v] > bc) { bc = cnt[v]; best = v; } }
      out[i] = best;
      for (let k = 0; k < 9; k++) cnt[L[i + off[k]]] = 0;
    }
    return out;
  }

  // Suavizado por mayoría ponderada: cada píxel toma el color que más pesa a su alrededor
  function smoothLabels(L, w, h, r) {
    if (r < 1) return L;
    const N = w * h, best = new Float32Array(N).fill(-1), out = new Uint8Array(L);
    const bb = [];
    for (let v = 0; v < 256; v++) bb.push([w, h, -1, -1]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const b = bb[L[y * w + x]]; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y;
    }
    const pad = 2 * r + 1;
    for (let v = 0; v < 256; v++) {
      const b = bb[v]; if (b[2] < 0) continue;
      const x0 = Math.max(0, b[0] - pad), y0 = Math.max(0, b[1] - pad), x1 = Math.min(w - 1, b[2] + pad), y1 = Math.min(h - 1, b[3] + pad);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      let A = new Float32Array(bw * bh), B = new Float32Array(bw * bh);
      for (let y = 0; y < bh; y++) { const s = (y0 + y) * w + x0; for (let x = 0; x < bw; x++) A[y * bw + x] = L[s + x] === v ? 1 : 0; }
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < bh; y++) { // horizontal
          const o = y * bw; let acc = 0;
          for (let x = -r; x <= r; x++) if (x >= 0 && x < bw) acc += A[o + x];
          for (let x = 0; x < bw; x++) {
            B[o + x] = acc;
            const xa = x - r, xb = x + r + 1;
            if (xa >= 0) acc -= A[o + xa]; if (xb < bw) acc += A[o + xb];
          }
        }
        for (let x = 0; x < bw; x++) { // vertical
          let acc = 0;
          for (let y = -r; y <= r; y++) if (y >= 0 && y < bh) acc += B[y * bw + x];
          for (let y = 0; y < bh; y++) {
            A[y * bw + x] = acc;
            const ya = y - r, yb = y + r + 1;
            if (ya >= 0) acc -= B[ya * bw + x]; if (yb < bh) acc += B[yb * bw + x];
          }
        }
      }
      for (let y = 0; y < bh; y++) {
        const s = (y0 + y) * w + x0;
        for (let x = 0; x < bw; x++) { const val = A[y * bw + x]; if (val > best[s + x] + 1e-4) { best[s + x] = val; out[s + x] = v; } }
      }
    }
    return out;
  }

  // Quita partes más finas que 2r+1 px (apertura morfológica por color)
  function removeThin(L, w, h, r) {
    if (r < 1) return;
    const bb = [];
    for (let v = 0; v < 256; v++) bb.push([w, h, -1, -1]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const b = bb[L[y * w + x]]; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y;
    }
    for (let v = 0; v < 256; v++) {
      const b = bb[v]; if (b[2] < 0) continue;
      const bx0 = Math.max(0, b[0] - r), by0 = Math.max(0, b[1] - r), bx1 = Math.min(w - 1, b[2] + r), by1 = Math.min(h - 1, b[3] + r);
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, W1 = bw + 1;
      const I = new Int32Array(W1 * (bh + 1));
      for (let y = 0; y < bh; y++) { let row = 0; const src = (by0 + y) * w + bx0; for (let x = 0; x < bw; x++) { row += L[src + x] === v ? 1 : 0; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
      const E = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) {
        const ya = Math.max(0, y - r), yb = Math.min(bh - 1, y + r);
        for (let x = 0; x < bw; x++) {
          if (L[(by0 + y) * w + bx0 + x] !== v) continue;
          const xa = Math.max(0, x - r), xb = Math.min(bw - 1, x + r);
          const s = I[(yb + 1) * W1 + xb + 1] - I[ya * W1 + xb + 1] - I[(yb + 1) * W1 + xa] + I[ya * W1 + xa];
          if (s === (xb - xa + 1) * (yb - ya + 1)) E[y * bw + x] = 1;
        }
      }
      const J = I; J.fill(0);
      for (let y = 0; y < bh; y++) { let row = 0; for (let x = 0; x < bw; x++) { row += E[y * bw + x]; J[(y + 1) * W1 + x + 1] = J[y * W1 + x + 1] + row; } }
      for (let y = 0; y < bh; y++) {
        const ya = Math.max(0, y - r), yb = Math.min(bh - 1, y + r);
        for (let x = 0; x < bw; x++) {
          const i = (by0 + y) * w + bx0 + x; if (L[i] !== v) continue;
          const xa = Math.max(0, x - r), xb = Math.min(bw - 1, x + r);
          const s = J[(yb + 1) * W1 + xb + 1] - J[ya * W1 + xb + 1] - J[(yb + 1) * W1 + xa] + J[ya * W1 + xa];
          if (s === 0) L[i] = 255; // parte demasiado fina: se reasigna al vecino
        }
      }
    }
    fillUnassigned(L, w, h);
  }

  function fillUnassigned(L, w, h) {
    let list = []; const N = w * h;
    for (let i = 0; i < N; i++) if (L[i] === 255) list.push(i);
    const cnt = new Int32Array(256);
    while (list.length) {
      const next = [], set = [];
      for (const i of list) {
        const x = i % w, y = (i / w) | 0; let best = -1, bc = 0; const touched = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const v = L[yy * w + xx]; if (v === 255) continue; cnt[v]++; touched.push(v); if (cnt[v] > bc) { bc = cnt[v]; best = v; }
        }
        for (const v of touched) cnt[v] = 0;
        if (best < 0) next.push(i); else set.push(i, best);
      }
      if (!set.length) { for (const i of next) L[i] = 0; break; }
      for (let k = 0; k < set.length; k += 2) L[set[k]] = set[k + 1];
      list = next;
    }
  }

  // Une manchas chicas al color vecino con el que comparten más borde
  function removeSpecks(L, w, h, minArea) {
    if (minArea < 2) return;
    for (let pass = 0; pass < 4; pass++) {
      const { comp, sizes, n } = components(L, w, h);
      const sIdx = new Int32Array(n).fill(-1); let ns = 0;
      for (let c = 0; c < n; c++) if (sizes[c] < minArea) sIdx[c] = ns++;
      if (!ns) return;
      const counts = new Int32Array(ns * 256), N = w * h;
      for (let i = 0; i < N; i++) {
        const s = sIdx[comp[i]]; if (s < 0) continue; const x = i % w, c = comp[i];
        if (x > 0 && comp[i - 1] !== c) counts[s * 256 + L[i - 1]]++;
        if (x < w - 1 && comp[i + 1] !== c) counts[s * 256 + L[i + 1]]++;
        if (i >= w && comp[i - w] !== c) counts[s * 256 + L[i - w]]++;
        if (i < N - w && comp[i + w] !== c) counts[s * 256 + L[i + w]]++;
      }
      const target = new Int32Array(ns).fill(-1);
      for (let s = 0; s < ns; s++) { let bc = 0; for (let v = 0; v < 256; v++) if (counts[s * 256 + v] > bc) { bc = counts[s * 256 + v]; target[s] = v; } }
      let changed = 0;
      for (let i = 0; i < N; i++) { const s = sIdx[comp[i]]; if (s >= 0 && target[s] >= 0 && L[i] !== target[s]) { L[i] = target[s]; changed++; } }
      if (!changed) return;
    }
  }

  function cleanup(L, w, h, { smoothR, minWidthPx, minAreaPx }) {
    L = smoothR > 0 ? smoothLabels(L, w, h, smoothR) : modeFilter(L, w, h);
    removeThin(L, w, h, Math.floor(minWidthPx / 2));
    removeSpecks(L, w, h, Math.round(minAreaPx));
    return L;
  }

  /** Toques del usuario: {x,y,mode:'fill'|'hole'} en px de trabajo */
  function applyEdits(L, w, h, edits) {
    const N = w * h;
    for (const e of edits) {
      const x = Math.floor(e.x), y = Math.floor(e.y);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const s = y * w + x, lab = L[s];
      const seen = new Uint8Array(N), st = [s], region = []; seen[s] = 1;
      const cnt = new Int32Array(256); let border = false;
      while (st.length) {
        const i = st.pop(); region.push(i); const xx = i % w;
        if (xx === 0 || xx === w - 1 || i < w || i >= N - w) border = true;
        const nb = [xx > 0 ? i - 1 : -1, xx < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < N - w ? i + w : -1];
        for (const j of nb) { if (j < 0) continue; if (L[j] === lab) { if (!seen[j]) { seen[j] = 1; st.push(j); } } else cnt[L[j]]++; }
      }
      let target = -1;
      if (e.mode === 'hole') { if (lab !== 0) target = 0; }
      else if (!(lab === 0 && border)) { let bc = 0; for (let v = 0; v < 256; v++) if (cnt[v] > bc) { bc = cnt[v]; target = v; } }
      if (target >= 0) for (const i of region) L[i] = target;
    }
    return L;
  }

  // ---------------- Trazado con bordes compartidos ----------------
  function rdp(xs, ys, a, b, eps, keep) {
    const st = [[a, b]];
    while (st.length) {
      const [i, j] = st.pop(); if (j <= i + 1) continue;
      const ax = xs[i], ay = ys[i], dx = xs[j] - ax, dy = ys[j] - ay, L2 = dx * dx + dy * dy;
      let md = -1, mk = -1;
      for (let k = i + 1; k < j; k++) {
        let d;
        if (L2 < 1e-12) d = Math.hypot(xs[k] - ax, ys[k] - ay);
        else d = Math.abs(dy * (xs[k] - ax) - dx * (ys[k] - ay)) / Math.sqrt(L2);
        if (d > md) { md = d; mk = k; }
      }
      if (md > eps) { keep[mk] = 1; st.push([i, mk], [mk, j]); }
    }
  }

  // puntos -> cúbicas (Catmull-Rom escalado por cuerda); devuelve [x0,y0, c1x,c1y,c2x,c2y,x,y, ...]
  function toCubics(px, py, closed) {
    const m = px.length; const out = [px[0], py[0]];
    const segs = closed ? m : m - 1;
    const P = i => (closed ? ((i % m) + m) % m : Math.max(0, Math.min(m - 1, i)));
    const dl = i => Math.hypot(px[P(i + 1)] - px[P(i)], py[P(i + 1)] - py[P(i)]);
    for (let i = 0; i < segs; i++) {
      const a = P(i), b = P(i + 1), d = dl(i);
      let c1x, c1y, c2x, c2y;
      if (!closed && i === 0) { c1x = px[a] + (px[b] - px[a]) / 3; c1y = py[a] + (py[b] - py[a]) / 3; }
      else { const p0 = P(i - 1), dp = dl(i - 1), f = d / (3 * (dp + d) || 1); c1x = px[a] + (px[b] - px[p0]) * f; c1y = py[a] + (py[b] - py[p0]) * f; }
      if (!closed && i === segs - 1) { c2x = px[b] - (px[b] - px[a]) / 3; c2y = py[b] - (py[b] - py[a]) / 3; }
      else { const p3 = P(i + 2), dn = dl(i + 1), f = d / (3 * (d + dn) || 1); c2x = px[b] - (px[p3] - px[a]) * f; c2y = py[b] - (py[p3] - py[a]) * f; }
      out.push(c1x, c1y, c2x, c2y, px[b], py[b]);
    }
    return out;
  }

  function gaussKernel(sigma) {
    if (sigma <= 0.05) return [1];
    const R = Math.ceil(2.5 * sigma), k = [];
    for (let i = -R; i <= R; i++) k.push(Math.exp((-i * i) / (2 * sigma * sigma)));
    return k;
  }

  function smoothOpen(vx, vy, ker, eps) {
    const n = vx.length - 1;
    if (n <= 1) return toCubics([vx[0], vx[n]], [vy[0], vy[n]], false);
    const qx = [vx[0]], qy = [vy[0]];
    for (let i = 1; i <= n; i++) { qx.push((vx[i - 1] + vx[i]) / 2); qy.push((vy[i - 1] + vy[i]) / 2); }
    qx.push(vx[n]); qy.push(vy[n]);
    const m = qx.length, last = m - 1, R = (ker.length - 1) / 2;
    const get = (arr, j) => {
      if (j < 0) { const jj = Math.min(last, -j); return 2 * arr[0] - arr[jj]; }
      if (j > last) { const jj = Math.max(0, 2 * last - j); return 2 * arr[last] - arr[jj]; }
      return arr[j];
    };
    const sx = new Float64Array(m), sy = new Float64Array(m);
    sx[0] = qx[0]; sy[0] = qy[0]; sx[last] = qx[last]; sy[last] = qy[last];
    for (let i = 1; i < last; i++) {
      let ax = 0, ay = 0, ws = 0;
      for (let k = -R; k <= R; k++) { const wgt = ker[k + R]; ax += wgt * get(qx, i + k); ay += wgt * get(qy, i + k); ws += wgt; }
      sx[i] = ax / ws; sy[i] = ay / ws;
    }
    const keep = new Uint8Array(m); keep[0] = keep[last] = 1;
    rdp(sx, sy, 0, last, eps, keep);
    const px = [], py = []; for (let i = 0; i < m; i++) if (keep[i]) { px.push(sx[i]); py.push(sy[i]); }
    return toCubics(px, py, false);
  }

  function smoothClosed(vx, vy, ker, eps) {
    const n = vx.length; // ciclo
    const qx = new Float64Array(n), qy = new Float64Array(n);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; qx[i] = (vx[i] + vx[j]) / 2; qy[i] = (vy[i] + vy[j]) / 2; }
    const R = (ker.length - 1) / 2, sx = new Float64Array(n + 1), sy = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      let ax = 0, ay = 0, ws = 0;
      for (let k = -R; k <= R; k++) { const j = (((i + k) % n) + n) % n, wgt = ker[k + R]; ax += wgt * qx[j]; ay += wgt * qy[j]; ws += wgt; }
      sx[i] = ax / ws; sy[i] = ay / ws;
    }
    sx[n] = sx[0]; sy[n] = sy[0];
    let far = 0, fd = -1;
    for (let i = 1; i < n; i++) { const d = Math.hypot(sx[i] - sx[0], sy[i] - sy[0]); if (d > fd) { fd = d; far = i; } }
    const keep = new Uint8Array(n + 1); keep[0] = keep[n] = 1; keep[far] = 1;
    rdp(sx, sy, 0, far, eps, keep); rdp(sx, sy, far, n, eps, keep);
    const px = [], py = []; for (let i = 0; i < n; i++) if (keep[i]) { px.push(sx[i]); py.push(sy[i]); }
    if (px.length < 3) { // forma diminuta: polígono simple
      const ox = Array.from(vx), oy = Array.from(vy); return toCubics(ox, oy, true);
    }
    return toCubics(px, py, true);
  }

  function reverseCubics(g) {
    const n = (g.length - 2) / 6, out = [g[g.length - 2], g[g.length - 1]];
    for (let s = n - 1; s >= 0; s--) {
      const b = 2 + s * 6, x0 = s === 0 ? g[0] : g[b - 2], y0 = s === 0 ? g[1] : g[b - 1];
      out.push(g[b + 2], g[b + 3], g[b], g[b + 1], x0, y0);
    }
    return out;
  }

  const fmt = v => String(Math.round(v * 100) / 100);

  /**
   * Traza cada pieza (componente conexo) de cada color. Los bordes entre dos
   * piezas se calculan una sola vez y se comparten: no hay huecos ni encimados.
   */
  function vectorize(L, w, h, { sigma, eps }) {
    const pw = w + 2, ph = h + 2, P = new Uint8Array(pw * ph);
    for (let y = 0; y < h; y++) P.set(L.subarray(y * w, y * w + w), (y + 1) * pw + 1);
    const { comp, sizes, labelOf, n } = components(P, pw, ph);
    const VW = pw + 1, ker = gaussKernel(sigma);
    const jc = new Uint8Array(VW * (ph + 1)); // 0 sin calcular, 1 no, 2 sí
    const isJ = v => {
      let s = jc[v]; if (s) return s === 2;
      const vx = v % VW, vy = (v / VW) | 0;
      const TL = comp[(vy - 1) * pw + vx - 1], TR = comp[(vy - 1) * pw + vx], BL = comp[vy * pw + vx - 1], BR = comp[vy * pw + vx];
      const deg = (TL !== TR) + (BL !== BR) + (TL !== BL) + (TR !== BR);
      jc[v] = deg >= 3 ? 2 : 1; return deg >= 3;
    };
    const NB = [pw, -1, -pw, 1];
    const FL = [[0, -1], [0, 0], [-1, 0], [-1, -1]], FR = [[0, 0], [-1, 0], [-1, -1], [0, -1]];
    const visited = new Uint8Array(pw * ph);
    const cache = new Map();
    const rings = new Map();
    const vxOf = v => (v % VW) - 1, vyOf = v => ((v / VW) | 0) - 1;

    function trace(p0, d0) {
      const ring = []; let p = p0, d = d0; const c = comp[p0];
      do {
        visited[p] |= 1 << d;
        const x = p % pw, y = (p / pw) | 0;
        let ex, ey;
        if (d === 0) { ex = x + 1; ey = y + 1; } else if (d === 1) { ex = x; ey = y + 1; } else if (d === 2) { ex = x; ey = y; } else { ex = x + 1; ey = y; }
        ring.push(ey * VW + ex);
        const fl = (ey + FL[d][1]) * pw + ex + FL[d][0], fr = (ey + FR[d][1]) * pw + ex + FR[d][0];
        if (comp[fl] !== c) d = (d + 3) & 3;
        else if (comp[fr] === c) { p = fr; d = (d + 1) & 3; }
        else p = fl;
      } while (!(p === p0 && d === d0));
      return ring;
    }

    function segGeom(S) { // S: ids de vértices (abierto, de junta a junta)
      const a = S[0], b = S[S.length - 1], s1 = S[1], s2 = S[S.length - 2];
      const fwd = a < b || (a === b && s1 < s2);
      const key = fwd ? a + ',' + s1 : b + ',' + s2;
      let g = cache.get(key);
      if (!g) {
        const T = fwd ? S : S.slice().reverse();
        g = smoothOpen(T.map(vxOf), T.map(vyOf), ker, eps);
        cache.set(key, g);
      }
      return fwd ? g : reverseCubics(g);
    }
    function loopGeom(ring) {
      const n = ring.length; let mi = 0;
      for (let i = 1; i < n; i++) if (ring[i] < ring[mi]) mi = i;
      const nx = ring[(mi + 1) % n], pv = ring[(mi - 1 + n) % n];
      const fwd = nx < pv; const key = 'L' + ring[mi];
      let g = cache.get(key);
      if (!g) {
        const T = []; for (let k = 0; k < n; k++) T.push(fwd ? ring[(mi + k) % n] : ring[(mi - k + n) % n]);
        g = smoothClosed(T.map(vxOf), T.map(vyOf), ker, eps);
        cache.set(key, g);
      }
      return fwd ? g : reverseCubics(g);
    }

    for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
      const p = y * pw + x, c = comp[p]; if (!labelOf[c]) continue;
      for (let d = 0; d < 4; d++) {
        if (comp[p + NB[d]] === c || (visited[p] >> d) & 1) continue;
        const ring = trace(p, d);
        let arr = rings.get(c); if (!arr) rings.set(c, (arr = [])); arr.push(ring);
      }
    }

    const pieces = [];
    for (const [c, rs] of rings) {
      let dstr = '';
      for (const ring of rs) {
        const n = ring.length, js = [];
        for (let k = 0; k < n; k++) if (isJ(ring[k])) js.push(k);
        const parts = [];
        if (!js.length) parts.push(loopGeom(ring));
        else for (let t = 0; t < js.length; t++) {
          const a = js[t], b = t + 1 < js.length ? js[t + 1] : js[0] + n, S = [];
          for (let k = a; k <= b; k++) S.push(ring[k % n]);
          parts.push(segGeom(S));
        }
        dstr += 'M' + fmt(parts[0][0]) + ' ' + fmt(parts[0][1]);
        for (const g of parts) {
          dstr += 'C';
          for (let k = 2; k < g.length; k += 6) dstr += (k > 2 ? ' ' : '') + fmt(g[k]) + ' ' + fmt(g[k + 1]) + ' ' + fmt(g[k + 2]) + ' ' + fmt(g[k + 3]) + ' ' + fmt(g[k + 4]) + ' ' + fmt(g[k + 5]);
        }
        dstr += 'Z';
      }
      pieces.push({ label: labelOf[c], area: sizes[c], d: dstr });
    }
    return pieces;
  }

  return { quantize, buildLabels, contentBox, cleanup, applyEdits, vectorize, colorName, toHex, hexToRgb };
})();
