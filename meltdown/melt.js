// ════════════════════════════════════════════════════════════════════════════
// MELTDOWN — the wax engine.
//
// Shared by index.html (interactive) and preview.html (card, auto-pours).
//
// How it works
// ────────────
// A low-resolution buffer holds colour in LINEAR light (three Float32 planes)
// plus a HEAT plane. Fresh colour is poured into the top rows every frame from
// a domain-warped fbm field, mapped through a mirrored palette ramp.
//
// Then it melts. Scanned bottom-up, every cell has a probability of pulling
// the cell above it down by one pixel. That probability is the product of
//   · a per-column speed field   → some columns run, some barely move
//   · the luminance of the wax   → hot bright colour melts faster than crust
//   · a static per-cell viscosity field → drips thicken and thin, so the
//     shapes are blobby and organic instead of straight column streaks
// A small share of pulls comes from the diagonal instead, which grows lateral
// tendrils and stops everything reading as vertical stripes.
//
// Colour that travels loses HEAT on every copy, so it cools downward into a
// dark crust of its own hue. Where a hot cell sits directly above a cold one
// — the leading edge of a drip — the front glows. A half-res bright pass is
// composited back with 'lighter' for bloom, so the molten veins bleed light.
//
// Everything is interpolated and lit in linear light, then encoded to sRGB
// through a LUT. That is the single biggest reason the gradients read as wax
// and not as a 90s plasma.
// ════════════════════════════════════════════════════════════════════════════

// ─── COLOUR SPACE ──────────────────────────────────────────────────────────
const S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const c = i / 255;
    S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const LUT_N = 2048;
const L2S = new Uint8Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) {
    const c = i / LUT_N;
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    L2S[i] = Math.max(0, Math.min(255, Math.round(s * 255)));
}
function enc(v) {
    return L2S[v <= 0 ? 0 : v >= 1 ? LUT_N : (v * LUT_N) | 0];
}

// ─── PALETTES ──────────────────────────────────────────────────────────────
// Ordered dark → light. The ramp is mirrored, so each one reads as a glowing
// vein running through its own shadow — no seam where the ramp wraps.
export const PALETTES = [
    { name: 'OXIDE',       anchors: [[18, 8, 14], [96, 22, 30], [188, 62, 38], [238, 146, 56], [252, 226, 176]] },
    { name: 'MAGMA',       anchors: [[8, 4, 10], [74, 8, 48], [186, 32, 46], [246, 128, 36], [253, 234, 150]] },
    { name: 'ULTRAVIOLET', anchors: [[8, 6, 24], [46, 18, 88], [118, 42, 168], [212, 84, 190], [248, 206, 240]] },
    { name: 'CHLOROPHYLL', anchors: [[5, 18, 15], [14, 68, 54], [48, 136, 88], [146, 198, 86], [236, 248, 190]] },
    { name: 'CYANOTYPE',   anchors: [[4, 9, 24], [12, 42, 90], [32, 102, 166], [102, 178, 222], [226, 244, 252]] },
    { name: 'VERDIGRIS',   anchors: [[6, 16, 20], [10, 62, 74], [26, 132, 130], [120, 202, 178], [238, 250, 236]] },
    { name: 'LIMBROW',     anchors: [[16, 12, 14], [227, 52, 46], [242, 194, 77], [76, 184, 107], [58, 123, 213]] },
];

// ─── NOISE ─────────────────────────────────────────────────────────────────
function h2(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = h2(xi, yi, seed),     b = h2(xi + 1, yi, seed);
    const c = h2(xi, yi + 1, seed), d = h2(xi + 1, yi + 1, seed);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

// ─── ENGINE ────────────────────────────────────────────────────────────────
export function createMelt(canvas, opts = {}) {
    const RES        = opts.res        ?? 300;   // buffer width in cells
    const INJECT     = opts.inject     ?? 3;     // rows of fresh pour per frame
    const COOL       = opts.cool       ?? 0.9972;
    const BLOOM      = opts.bloom      ?? 0.40;
    const CRUST      = opts.crust      ?? 0.28;  // floor brightness of cold wax

    const dctx = canvas.getContext('2d', { alpha: false });

    let W = 0, H = 0, N = 0;
    let R, G, B, HEAT, VISC, colSpeed;
    let buffer, bctx, imgData, data32;
    let bloomBuf, bloomCtx, bloomImg, bloom32, bW, bH;

    // pour state
    let pal = PALETTES[0];
    const RR = new Float32Array(256), RG = new Float32Array(256), RB = new Float32Array(256);
    let seedA = 0, seedB = 0, warp = 1, fscale = 3, drift = 0;
    let frameN = 0;

    // ── palette ramp, mirrored, in linear light ──
    // Mirrored (0→1→0) so the cycle has no seam, and biased hard toward the
    // dark anchors: the bright end has to stay a thin vein, otherwise the
    // whole slab reads as a pastel weather map instead of wax.
    function buildRamp(offset, bias) {
        const A = pal.anchors, n = A.length;
        for (let i = 0; i < 256; i++) {
            let t = (i / 255 + offset) % 1;
            t = t < 0.5 ? t * 2 : (1 - t) * 2;
            t = Math.pow(t, bias);
            const f = t * (n - 1);
            const k = Math.min(n - 2, Math.floor(f));
            let fr = f - k;
            fr = fr * fr * (3 - 2 * fr);
            const a = A[k], b = A[k + 1];
            RR[i] = S2L[a[0]] + (S2L[b[0]] - S2L[a[0]]) * fr;
            RG[i] = S2L[a[1]] + (S2L[b[1]] - S2L[a[1]]) * fr;
            RB[i] = S2L[a[2]] + (S2L[b[2]] - S2L[a[2]]) * fr;
        }
    }

    // ── the inflow field: domain-warped fbm ──
    function field(nx, ny, t) {
        const wx = vnoise(nx * 2.3 + t * 0.10, ny * 2.3, seedA) * 2 - 1;
        const wy = vnoise(nx * 2.3 + 5.2, ny * 2.3 - t * 0.08, seedA + 17) * 2 - 1;
        let x = nx * fscale + wx * warp;
        let y = ny * fscale + wy * warp;
        let v = 0, amp = 0.5, f = 1;
        for (let o = 0; o < 4; o++) {
            v += amp * vnoise(x * f + t * 0.06 * f, y * f + drift, seedB + o * 31);
            amp *= 0.5; f *= 2.07;
        }
        return v / 0.9375;
    }

    function srcIdx(x, y, t) {
        const v = field(x / W, y / H, t);
        return (v * 255) & 255;
    }

    // ── allocation ──
    function alloc() {
        const vw = canvas.clientWidth  || window.innerWidth;
        const vh = canvas.clientHeight || window.innerHeight;
        W = RES;
        H = Math.max(60, Math.round(RES * (vh / vw)) || RES);
        N = W * H;

        R = new Float32Array(N); G = new Float32Array(N); B = new Float32Array(N);
        HEAT = new Float32Array(N); VISC = new Float32Array(N);
        colSpeed = new Float32Array(W);

        buffer = document.createElement('canvas');
        buffer.width = W; buffer.height = H;
        bctx = buffer.getContext('2d');
        imgData = bctx.createImageData(W, H);
        data32 = new Uint32Array(imgData.data.buffer);

        bW = W >> 1; bH = H >> 1;
        bloomBuf = document.createElement('canvas');
        bloomBuf.width = bW; bloomBuf.height = bH;
        bloomCtx = bloomBuf.getContext('2d');
        bloomImg = bloomCtx.createImageData(bW, bH);
        bloom32 = new Uint32Array(bloomImg.data.buffer);
    }

    function fitDisplay() {
        canvas.width  = Math.max(1, window.innerWidth);
        canvas.height = Math.max(1, window.innerHeight);
    }

    // ── a new pour: palette, field, speeds, viscosity ──
    function reseed(t = 0, refill = true) {
        pal = PALETTES[(Math.random() * PALETTES.length) | 0];
        seedA = (Math.random() * 9999) | 0;
        seedB = (Math.random() * 9999) | 0;
        warp = 0.4 + Math.random() * 1.6;
        fscale = 3.5 + Math.random() * 6.0;
        drift = Math.random() * 100;
        buildRamp(Math.random(), 1.05 + Math.random() * 0.85);

        const vs = (Math.random() * 9999) | 0;
        for (let x = 0; x < W; x++) {
            const n = vnoise(x * 0.055, 3.1, vs) * 0.7 + vnoise(x * 0.19, 9.4, vs + 5) * 0.3;
            colSpeed[x] = 0.10 + n * 0.68;
        }
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const n = vnoise(x * 0.045, y * 0.030, vs + 71) * 0.75
                        + vnoise(x * 0.16,  y * 0.11,  vs + 91) * 0.25;
                VISC[y * W + x] = 0.35 + n * 1.15;
            }
        }
        if (refill) fill(t);
        return pal.name;
    }

    // Prime the slab as cold crust: the colour structure is already there but
    // almost unlit, so the bright wax pouring from the top reads as molten
    // running down over something that has already set.
    function fill(t) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x, k = srcIdx(x, y, t);
                R[i] = RR[k]; G[i] = RG[k]; B[i] = RB[k];
                HEAT[i] = 0.10 + vnoise(x * 0.08, y * 0.05, seedB + 3) * 0.22;
            }
        }
    }

    // ── molten splash under the finger ──
    function pour(nx, ny, radius, t) {
        const cx = nx * W, cy = ny * H, rad = Math.max(2, radius * W);
        const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(H - 1, (cy + rad) | 0);
        const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(W - 1, (cx + rad) | 0);
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const dx = x - cx, dy = (y - cy) * 1.25;
                const d = Math.sqrt(dx * dx + dy * dy) / rad;
                if (d > 1) continue;
                if (h2(x, y, frameN) > (1 - d) * 1.1) continue;   // ragged edge
                const i = y * W + x;
                const k = (srcIdx(x, y, t) + 128) & 255;          // opposite side of the ramp
                R[i] = RR[k]; G[i] = RG[k]; B[i] = RB[k];
                HEAT[i] = 1.35;
            }
        }
    }

    // ── one melt step ──
    function step(t) {
        frameN++;
        for (let x = 0; x < W; x++) {
            const sp = colSpeed[x];
            for (let y = H - 1; y >= 1; y--) {
                const i = y * W + x;
                const up = i - W;
                // Keep p mostly well under 1 — if everything pulls every frame
                // the image translates as a block and nothing smears.
                const lum = R[up] * 0.21 + G[up] * 0.72 + B[up] * 0.07;
                const p = sp * (0.14 + lum * 0.62) * VISC[up];
                const r = h2(x, y, frameN);
                if (r >= p) continue;
                // ~18% of pulls come in diagonally → lateral tendrils
                let src = up;
                if (r < p * 0.09 && x > 0)         src = up - 1;
                else if (r > p * 0.91 && x < W - 1) src = up + 1;
                // blend a touch so drip edges are soft, not stair-stepped
                R[i] = R[src] * 0.86 + R[i] * 0.14;
                G[i] = G[src] * 0.86 + G[i] * 0.14;
                B[i] = B[src] * 0.86 + B[i] * 0.14;
                HEAT[i] = HEAT[src] * COOL;
            }
        }
        // pour fresh wax into the top rows
        for (let y = 0; y < INJECT; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x, k = srcIdx(x, y, t);
                R[i] = RR[k]; G[i] = RG[k]; B[i] = RB[k];
                HEAT[i] = 1;
            }
        }
    }

    // ── render: cool → sheen → drip-front glow → sRGB, plus bright pass ──
    function render(t) {
        const sheenPhase = t * 0.13;
        bloom32.fill(0);
        for (let y = 0; y < H; y++) {
            const rowBelow = y < H - 1 ? W : 0;
            const brow = (y >> 1) * bW;
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const h = HEAT[i];
                // cold wax sinks toward a dark crust of its own hue
                let k = CRUST + (1 - CRUST) * (h < 0 ? 0 : h > 1.35 ? 1.35 : h);
                // slow gloss band travelling across the slab
                k *= 1 + 0.10 * Math.sin(x / W * 3.1 - sheenPhase);
                // Leading edge of a drip: hot cell above a cold one. This
                // brightens the cell's own hue rather than adding white —
                // additive glow speckles the top of the slab with white dashes.
                const front = h - HEAT[i + rowBelow];
                if (front > 0.03) k *= 1 + Math.min(0.85, (front - 0.03) * 1.9);

                const r = R[i] * k;
                const g = G[i] * k;
                const b = B[i] * k;

                data32[i] = 0xff000000 | (enc(b) << 16) | (enc(g) << 8) | enc(r);

                // half-res bright pass — keep the hottest sample of each 2×2
                const lum = r * 0.21 + g * 0.72 + b * 0.07;
                if (lum > 0.30) {
                    const bi = brow + (x >> 1);
                    const e = (lum - 0.30) * 1.5;
                    const pr = enc(r * e), pg = enc(g * e), pb = enc(b * e);
                    const prev = bloom32[bi];
                    if (((prev & 255) + ((prev >> 8) & 255) + ((prev >> 16) & 255)) < pr + pg + pb) {
                        bloom32[bi] = 0xff000000 | (pb << 16) | (pg << 8) | pr;
                    }
                }
            }
        }

        // The inject band is a hard edge by definition — crop it off the top
        // rather than trying to disguise it.
        const dw = canvas.width, dh = canvas.height;
        const sy = INJECT + 3, sh = H - INJECT - 3;
        bctx.putImageData(imgData, 0, 0);
        dctx.globalCompositeOperation = 'source-over';
        dctx.globalAlpha = 1;
        dctx.imageSmoothingEnabled = false;
        dctx.drawImage(buffer, 0, sy, W, sh, 0, 0, dw, dh);

        if (BLOOM > 0) {
            const by = (INJECT + 3) >> 1, bh = bH - by;
            bloomCtx.putImageData(bloomImg, 0, 0);
            dctx.globalCompositeOperation = 'lighter';
            dctx.imageSmoothingEnabled = true;
            dctx.globalAlpha = BLOOM;
            dctx.drawImage(bloomBuf, 0, by, bW, bh, -dw * 0.012, -dh * 0.012, dw * 1.024, dh * 1.024);
            dctx.globalAlpha = BLOOM * 0.5;
            dctx.drawImage(bloomBuf, 0, by, bW, bh, -dw * 0.05, -dh * 0.05, dw * 1.10, dh * 1.10);
            dctx.globalAlpha = 1;
            dctx.globalCompositeOperation = 'source-over';
        }
    }

    // ── lifecycle ──
    alloc();
    fitDisplay();
    reseed(0);

    let resizeTimer = null;
    function onResize() {
        fitDisplay();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const vw = canvas.clientWidth || window.innerWidth;
            const vh = canvas.clientHeight || window.innerHeight;
            const wantH = Math.max(60, Math.round(RES * (vh / vw)) || RES);
            if (Math.abs(wantH - H) > H * 0.08) {
                alloc(); reseed(0);
            }
        }, 250);
    }
    window.addEventListener('resize', onResize);

    const t0 = performance.now();
    let raf = 0;
    function frame(now) {
        const t = (now - t0) * 0.001;
        step(t);
        render(t);
        raf = requestAnimationFrame(frame);
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        reseed,
        pour,
        get palette() { return pal.name; },
        time() { return (performance.now() - t0) * 0.001; },
    };
}
