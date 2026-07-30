// ════════════════════════════════════════════════════════════════════════════
// ATTRACTORS — a photographic plate on a long exposure.
//
// Shared by index.html (the post) and preview.html (the card).
//
// A strange attractor is one point iterated forever. Feed the output of a map
// back into its own input and the orbit never repeats and never escapes: it
// wanders a shape it can neither leave nor fill. Plotting that orbit is not
// drawing a curve — it is leaving a shutter open on something moving.
//
// So that is what this is. Every frame continues the SAME orbit from where it
// left off and exposes another few tens of thousands of hits onto an
// accumulation buffer: density in one plane, colour summed in three more.
// Nothing is ever redrawn from scratch. What you see is how many times the
// orbit has passed through each cell — filaments where it lingers burn in,
// and the places it merely crosses stay as haze.
//
// The plate also FORGETS. Every frame the accumulation decays a little, so an
// exposure reaches an equilibrium against its own fading and the parameters
// can drift underneath it without the old shape smearing forever. That is why
// it breathes instead of just filling up.
//
// Tone mapping is Reinhard (d / (d + K)) rather than a logarithm — no log per
// pixel per frame, and the highlight roll-off is gentler, which is what keeps
// dense cores from clipping to flat white. Colour comes from the orbit's
// SPEED at each hit, averaged over everything that landed in the cell, and is
// summed and encoded in LINEAR light.
// ════════════════════════════════════════════════════════════════════════════

const S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const c = i / 255;
    S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const LUT_N = 1024;
const L2S = new Uint8Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) {
    const c = i / LUT_N;
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    L2S[i] = Math.max(0, Math.min(255, Math.round(s * 255)));
}
function enc(v) {
    return L2S[v <= 0 ? 0 : v >= 1 ? LUT_N : (v * LUT_N) | 0];
}

export const PALETTES = [
    { name: 'NEBULA',   anchors: [[46, 22, 96], [30, 92, 184], [42, 190, 190], [242, 192, 92], [250, 124, 142]] },
    { name: 'EMBER',    anchors: [[70, 10, 22], [180, 40, 30], [240, 120, 40], [250, 200, 112], [255, 242, 206]] },
    { name: 'PHOSPHOR', anchors: [[10, 60, 42], [30, 150, 110], [120, 220, 140], [220, 250, 180], [255, 255, 232]] },
    { name: 'ARGENTUM', anchors: [[34, 44, 64], [92, 112, 142], [162, 182, 202], [222, 232, 242], [255, 255, 255]] },
    { name: 'AURORA',   anchors: [[22, 42, 92], [40, 142, 122], [124, 222, 160], [202, 240, 122], [250, 222, 162]] },
];

// ─── THE MAPS ──────────────────────────────────────────────────────────────
// Each one is two lines of arithmetic. `p` is four parameters; `range` is how
// wide those parameters are allowed to roam when a new plate is drawn.
export const FAMILIES = [
    {
        name: 'DE JONG', range: 3.0,
        step(x, y, p, o) {
            o[0] = Math.sin(p[0] * y) - Math.cos(p[1] * x);
            o[1] = Math.sin(p[2] * x) - Math.cos(p[3] * y);
        },
    },
    {
        name: 'CLIFFORD', range: 2.0,
        step(x, y, p, o) {
            o[0] = Math.sin(p[0] * y) + p[2] * Math.cos(p[0] * x);
            o[1] = Math.sin(p[1] * x) + p[3] * Math.cos(p[1] * y);
        },
    },
    {
        name: 'SVENSSON', range: 2.0,
        step(x, y, p, o) {
            o[0] = p[3] * Math.sin(p[0] * x) - Math.sin(p[1] * y);
            o[1] = p[2] * Math.cos(p[0] * x) + Math.cos(p[1] * y);
        },
    },
    {
        name: 'BEDHEAD', range: 1.0,
        step(x, y, p, o) {
            o[0] = Math.sin(x * y / p[1]) * y + Math.cos(p[0] * x - y);
            o[1] = x + Math.sin(y) / p[1];
        },
    },
    {
        name: 'HOPALONG', range: 4.0,
        step(x, y, p, o) {
            const s = x < 0 ? -1 : 1;
            o[0] = y - s * Math.sqrt(Math.abs(p[1] * x - p[2]));
            o[1] = p[0] - x;
        },
    },
];

export function createPlate(canvas, opts = {}) {
    const RES    = opts.res ?? 520;
    const POINTS = opts.points ?? 62000;   // orbit hits exposed per frame
    const DECAY  = opts.decay ?? 0.997;    // how fast the plate forgets
    const DRIFT  = opts.drift ?? 1.0;      // parameter drift speed
    // Colour is summed in linear light, where mid-tones are numerically dark;
    // without a gain a fully exposed plate reads as a dim smudge.
    const GAIN   = opts.gain ?? 1.75;

    const dctx = canvas.getContext('2d', { alpha: false });

    let W = 0, H = 0, N = 0;
    let DENS, CR, CG, CB;
    let buffer, bctx, imgData, data32;

    let pal = PALETTES[0];
    const RR = new Float32Array(256), RG = new Float32Array(256), RB = new Float32Array(256);

    let fam = FAMILIES[0];
    const P = new Float64Array(4);      // live parameters
    const P0 = new Float64Array(4);     // their centres
    const PD = new Float64Array(4);     // drift amplitudes
    const PH = new Float64Array(4);     // drift phases
    const out = new Float64Array(2);

    // orbit state
    let ox = 0.1, oy = 0.1;
    // view transform, eased toward the probed bounds
    let sc = 100, tx = 0, ty = 0;
    let scT = 100, txT = 0, tyT = 0;
    let spanT = 1;
    let speedRef = 1;      // smoothed mean orbit speed, drives the colour scale
    let frames = 0;

    function buildRamp() {
        const A = pal.anchors, n = A.length;
        for (let i = 0; i < 256; i++) {
            const f = (i / 255) * (n - 1);
            const k = Math.min(n - 2, Math.floor(f));
            let fr = f - k;
            fr = fr * fr * (3 - 2 * fr);
            const a = A[k], b = A[k + 1];
            RR[i] = S2L[a[0]] + (S2L[b[0]] - S2L[a[0]]) * fr;
            RG[i] = S2L[a[1]] + (S2L[b[1]] - S2L[a[1]]) * fr;
            RB[i] = S2L[a[2]] + (S2L[b[2]] - S2L[a[2]]) * fr;
        }
    }

    function alloc() {
        const vw = canvas.clientWidth || window.innerWidth || 1;
        const vh = canvas.clientHeight || window.innerHeight || 1;
        W = RES;
        H = Math.max(60, Math.round(RES * (vh / vw)) || RES);
        N = W * H;

        DENS = new Float32Array(N);
        CR = new Float32Array(N); CG = new Float32Array(N); CB = new Float32Array(N);

        buffer = document.createElement('canvas');
        buffer.width = W; buffer.height = H;
        bctx = buffer.getContext('2d');
        imgData = bctx.createImageData(W, H);
        data32 = new Uint32Array(imgData.data.buffer);
    }

    function fitDisplay() {
        canvas.width = Math.max(1, window.innerWidth || canvas.clientWidth || 1);
        canvas.height = Math.max(1, window.innerHeight || canvas.clientHeight || 1);
    }

    // ─── PROBE ─────────────────────────────────────────────────────────────
    // Run the orbit without plotting: where does it live, and is it worth
    // looking at? Most random parameter sets are NOT — they spiral into a fixed
    // point or a short cycle, and auto-framing then zooms a single dot up to
    // fill the screen. So the probe also bins the orbit into a coarse grid and
    // reports COVERAGE, which is the cheap stand-in for "this one is strange".
    const PROBE_N = 4000;
    const probeX = new Float64Array(PROBE_N);
    const probeY = new Float64Array(PROBE_N);
    const GRID = 48;
    const cells = new Uint8Array(GRID * GRID);

    function probe(iters = PROBE_N) {
        if (iters > PROBE_N) iters = PROBE_N;
        let x = 0.1, y = 0.1, n = 0;
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (let i = 0; i < iters; i++) {
            fam.step(x, y, P, out);
            x = out[0]; y = out[1];
            if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) {
                x = 0.1; y = 0.1; continue;
            }
            if (i < 200) continue;                    // let the transient pass
            probeX[n] = x; probeY[n] = y; n++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        if (n < 2 || minX > maxX) { minX = -1; maxX = 1; minY = -1; maxY = 1; }
        const spanX = Math.max(1e-4, maxX - minX);
        const spanY = Math.max(1e-4, maxY - minY);

        cells.fill(0);
        let cov = 0;
        for (let i = 0; i < n; i++) {
            const gx = ((probeX[i] - minX) / spanX * (GRID - 1)) | 0;
            const gy = ((probeY[i] - minY) / spanY * (GRID - 1)) | 0;
            const c = gy * GRID + gx;
            if (!cells[c]) { cells[c] = 1; cov++; }
        }

        scT = Math.min(W / (spanX * 1.10), H / (spanY * 1.10));
        txT = W * 0.5 - (minX + maxX) * 0.5 * scT;
        tyT = H * 0.5 - (minY + maxY) * 0.5 * scT;
        spanT = Math.max(spanX, spanY);
        return { cov, span: Math.max(spanX, spanY) };
    }

    function randomParams() {
        for (let i = 0; i < 4; i++) {
            P0[i] = (Math.random() * 2 - 1) * fam.range;
            PD[i] = fam.range * (0.05 + Math.random() * 0.10);
            PH[i] = Math.random() * Math.PI * 2;
            P[i] = P0[i];
        }
        // Bedhead and Hopalong both divide by a parameter, so keep them clear
        // of zero
        if (fam.name === 'BEDHEAD' || fam.name === 'HOPALONG') {
            for (let i = 0; i < 4; i++) {
                if (Math.abs(P0[i]) < 0.4) P0[i] = P0[i] < 0 ? -0.4 : 0.4;
                P[i] = P0[i];
            }
        }
    }

    const MIN_COV = 170;      // of 48×48 — about 7% of the bounding box

    function newPlate(familyIdx) {
        fam = FAMILIES[familyIdx ?? ((Math.random() * FAMILIES.length) | 0)];

        let best = null, bestP = new Float64Array(4);
        for (let attempt = 0; attempt < 70; attempt++) {
            randomParams();
            const q = probe();
            if (!best || q.cov > best.cov) {
                best = q;
                bestP.set(P0);
            }
            if (q.cov >= MIN_COV && q.span > 0.05) { best = null; break; }
        }
        // Nothing strange found in 70 tries — take the widest-spreading one
        if (best) { P0.set(bestP); P.set(bestP); probe(); }

        sc = scT; tx = txT; ty = tyT;      // no easing on a brand-new plate
        DENS.fill(0); CR.fill(0); CG.fill(0); CB.fill(0);
        ox = 0.1; oy = 0.1;
        speedRef = spanT * 0.25;           // a starting guess; it self-corrects
        ref = 1;
        frames = 0;
        return fam.name;
    }

    // ── expose ──
    function expose(t) {
        // Parameters wander, so the shape is never quite the same twice
        for (let i = 0; i < 4; i++) {
            P[i] = P0[i] + Math.sin(t * (0.00004 + i * 0.000011) * DRIFT + PH[i]) * PD[i];
        }

        // Re-probe occasionally and ease the framing across, so a drifting
        // attractor that grows or shrinks stays in frame without jumping.
        if ((frames & 127) === 0) probe(2200);
        sc += (scT - sc) * 0.05;
        tx += (txT - tx) * 0.05;
        ty += (tyT - ty) * 0.05;
        frames++;

        // Forget a little
        for (let i = 0; i < N; i++) {
            DENS[i] *= DECAY; CR[i] *= DECAY; CG[i] *= DECAY; CB[i] *= DECAY;
        }

        // Colour is keyed to orbit speed, so the scale has to come from the
        // orbit itself. Deriving it from the bounding box instead pins whole
        // families (Hopalong especially) to one end of the palette.
        const kSpeed = 255 / (speedRef * 2.2);
        let speedSum = 0, speedN = 0;
        let x = ox, y = oy;

        for (let n = 0; n < POINTS; n++) {
            fam.step(x, y, P, out);
            const nx2 = out[0], ny2 = out[1];
            if (!isFinite(nx2) || !isFinite(ny2) || Math.abs(nx2) > 1e6 || Math.abs(ny2) > 1e6) {
                x = Math.random() * 0.2 - 0.1;
                y = Math.random() * 0.2 - 0.1;
                continue;
            }
            const dx = nx2 - x, dy = ny2 - y;
            x = nx2; y = ny2;

            const fx = x * sc + tx;
            const fy = y * sc + ty;
            const px = fx | 0, py = fy | 0;
            if (px < 0 || px >= W - 1 || py < 0 || py >= H - 1) continue;

            // colour by how fast the orbit is moving through here
            const speed = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
            speedSum += speed; speedN++;
            let ci = (speed * kSpeed) | 0;
            if (ci > 255) ci = 255;
            const cr = RR[ci], cg = RG[ci], cb = RB[ci];

            // Bilinear splat. Dropping each hit into a single cell leaves the
            // plate visibly dithered — lit cell, dead cell — instead of smoke.
            const u = fx - px, v = fy - py;
            const iu = 1 - u, iv = 1 - v;
            const i00 = py * W + px, i10 = i00 + 1;
            const i01 = i00 + W,     i11 = i01 + 1;
            const w00 = iu * iv, w10 = u * iv, w01 = iu * v, w11 = u * v;

            DENS[i00] += w00; CR[i00] += cr * w00; CG[i00] += cg * w00; CB[i00] += cb * w00;
            DENS[i10] += w10; CR[i10] += cr * w10; CG[i10] += cg * w10; CB[i10] += cb * w10;
            DENS[i01] += w01; CR[i01] += cr * w01; CG[i01] += cg * w01; CB[i01] += cb * w01;
            DENS[i11] += w11; CR[i11] += cr * w11; CG[i11] += cg * w11; CB[i11] += cb * w11;
        }

        ox = x; oy = y;
        if (speedN > 0) speedRef += (speedSum / speedN - speedRef) * 0.10;
    }

    // AUTO-EXPOSURE. The right Reinhard shoulder depends on resolution, points
    // per frame, decay AND how thinly the particular attractor spreads itself —
    // four things that all change, so it is measured rather than guessed.
    //
    // It tracks the MEAN density of exposed cells, not the peak: the peak is one
    // hot pixel and keying off it drives the shoulder so low that most of the
    // plate clips to a flat colour with the sparse cells punched through it as
    // black speckle. Against the mean, haze lands at the bottom of the curve
    // and only the real filaments approach burn-out.
    let ref = 1;
    const BG = 0xff0a0605;      // #05060a packed as ABGR

    function render() {
        const K = ref * 3.2 < 0.25 ? 0.25 : ref * 3.2;
        const g0 = GAIN;
        let sum = 0, lit = 0;
        for (let i = 0; i < N; i++) {
            const d = DENS[i];
            if (d <= 0.0025) { data32[i] = BG; continue; }
            sum += d; lit++;
            const v = d / (d + K);
            const inv = (v / d) * g0;
            data32[i] = 0xff000000
                | (enc(CB[i] * inv) << 16)
                | (enc(CG[i] * inv) << 8)
                |  enc(CR[i] * inv);
        }
        if (lit > 0) ref += (sum / lit - ref) * 0.06;
        bctx.putImageData(imgData, 0, 0);
        dctx.imageSmoothingEnabled = true;
        dctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }

    // ── lifecycle ──
    alloc();
    fitDisplay();
    buildRamp();
    newPlate();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        fitDisplay();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const vw = canvas.clientWidth || window.innerWidth || 1;
            const vh = canvas.clientHeight || window.innerHeight || 1;
            const want = Math.max(60, Math.round(RES * (vh / vw)) || RES);
            if (Math.abs(want - H) > H * 0.08) { alloc(); probe(); sc = scT; tx = txT; ty = tyT; }
        }, 250);
    });

    let raf = 0;
    const t0 = performance.now();
    function frame(now) {
        expose(now - t0);
        render();
        raf = requestAnimationFrame(frame);
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        newPlate,
        nextFamily() {
            return newPlate((FAMILIES.indexOf(fam) + 1) % FAMILIES.length);
        },
        // Steer the first two parameters by hand — the plate re-forms under
        // your finger because it is always forgetting. A step that collapses
        // the orbit is refused, so dragging can't dead-end on a single dot.
        nudge(dx, dy) {
            const a = P0[0], b = P0[1];
            P0[0] += dx * fam.range * 0.9;
            P0[1] += dy * fam.range * 0.9;
            if (probe(2400).cov < MIN_COV * 0.5) {
                P0[0] = a; P0[1] = b;
                probe(2400);
            }
        },
        setPalette(name) {
            const p = PALETTES.find(p => p.name === name);
            if (!p) return pal.name;
            pal = p;
            buildRamp();
            // Colour already in the buffer belongs to the old palette
            CR.fill(0); CG.fill(0); CB.fill(0); DENS.fill(0);
            return pal.name;
        },
        randomPalette() {
            return this.setPalette(PALETTES[(Math.random() * PALETTES.length) | 0].name);
        },
        get family() { return fam.name; },
        get palette() { return pal.name; },
        params() { return [P[0], P[1], P[2], P[3]]; },
    };
}
