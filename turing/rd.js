// ════════════════════════════════════════════════════════════════════════════
// TURING — the reaction–diffusion engine.
//
// Shared by index.html (the lab) and preview.html (the card).
//
// Gray-Scott, two chemicals on a torus:
//
//     ∂u/∂t = Du·∇²u − u·v²   + f·(1 − u)
//     ∂v/∂t = Dv·∇²v + u·v²   − (f + k)·v
//
// u is fed in at rate f and v is drained at rate f+k, while v eats u. That is
// the whole model. Everything — spots, worms, labyrinths, dividing cells,
// coral — is what those two numbers do to each other.
//
// Two things make this worth looking at instead of just watching one pattern:
//
// THE ZOO. f and k are not constants but FIELDS: f rises across x, k rises
// across y. So a single plate is a map of the whole parameter space, with
// spots in one corner, worms in another, and the unstable frontiers between
// regimes running through the middle as living boundaries. Even the named
// presets keep a slight gradient, because a perfectly uniform plate looks
// printed rather than grown.
//
// THE SURFACE. v is not painted flat. Its gradient is read as a normal, lit
// from the upper left with a diffuse and a specular term, so the pattern comes
// out as raised enamel on a dark ground — glazed, not coloured in. The palette
// is interpolated in LINEAR light, which is what keeps the glaze from going
// chalky in the mid-tones.
//
// The Laplacian is the 9-point stencil (orthogonals 0.2, diagonals 0.05). The
// cheap 5-point one biases growth along the axes and the patterns come out
// visibly square.
// ════════════════════════════════════════════════════════════════════════════

// ─── COLOUR ────────────────────────────────────────────────────────────────
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
    { name: 'MALACHITE', anchors: [[6, 18, 16], [10, 58, 48], [26, 120, 92], [120, 196, 140], [238, 250, 226]] },
    { name: 'CINNABAR',  anchors: [[16, 6, 10], [92, 14, 26], [196, 52, 40], [244, 140, 70], [252, 232, 190]] },
    { name: 'INDIGO',    anchors: [[6, 8, 26], [16, 36, 92], [44, 96, 176], [120, 176, 232], [232, 244, 255]] },
    { name: 'AMETHYST',  anchors: [[12, 6, 22], [54, 18, 80], [124, 44, 158], [206, 110, 206], [246, 214, 248]] },
    { name: 'ACID',      anchors: [[8, 14, 6], [42, 74, 10], [120, 166, 20], [204, 226, 70], [246, 252, 190]] },
    { name: 'BONE',      anchors: [[10, 10, 12], [52, 48, 46], [124, 116, 108], [198, 188, 174], [250, 246, 238]] },
];

// ─── REGIMES ───────────────────────────────────────────────────────────────
// span = how far f and k spread across the plate. ZOO spans the whole space;
// the named ones keep a sliver of gradient so the plate still breathes.
export const PRESETS = [
    { name: 'ZOO',       f: 0.0385, k: 0.0580, fSpan: 0.033, kSpan: 0.016 },
    { name: 'CORAL',     f: 0.0545, k: 0.0620, fSpan: 0.006, kSpan: 0.0030 },
    { name: 'WORMS',     f: 0.0580, k: 0.0650, fSpan: 0.005, kSpan: 0.0022 },
    { name: 'MITOSIS',   f: 0.0367, k: 0.0649, fSpan: 0.004, kSpan: 0.0018 },
    { name: 'LABYRINTH', f: 0.0290, k: 0.0570, fSpan: 0.006, kSpan: 0.0026 },
    { name: 'SOLITONS',  f: 0.0300, k: 0.0620, fSpan: 0.004, kSpan: 0.0016 },
];

const DU = 0.16, DV = 0.08, DT = 1.0;

export function createRD(canvas, opts = {}) {
    const RES    = opts.res ?? 320;
    const ITERS  = opts.iters ?? 2;     // simulation steps per displayed frame
    const RELIEF = opts.relief ?? 1.0;  // strength of the glaze lighting
    const WARMUP = opts.warmup ?? 0;    // steps run before the first paint

    const dctx = canvas.getContext('2d', { alpha: false });

    let W = 0, H = 0, N = 0;
    let U, V, U2, V2, F, K;
    let buffer, bctx, imgData, data32;

    let pal = PALETTES[0];
    const RR = new Float32Array(256), RG = new Float32Array(256), RB = new Float32Array(256);
    let preset = PRESETS[0];

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

        U = new Float32Array(N); V = new Float32Array(N);
        U2 = new Float32Array(N); V2 = new Float32Array(N);
        F = new Float32Array(N); K = new Float32Array(N);

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

    // f and k as fields — this is the zoo
    function buildParams() {
        for (let y = 0; y < H; y++) {
            const ny = H > 1 ? y / (H - 1) - 0.5 : 0;
            for (let x = 0; x < W; x++) {
                const nx = W > 1 ? x / (W - 1) - 0.5 : 0;
                const i = y * W + x;
                F[i] = preset.f + nx * preset.fSpan;
                K[i] = preset.k + ny * preset.kSpan;
            }
        }
    }

    // u saturated, v absent, then a scatter of drops of v to break symmetry.
    // Density matters: too few nuclei and the plate is still mostly empty
    // ground a minute in, so the zoo never shows.
    function seed() {
        U.fill(1); V.fill(0);
        const drops = Math.max(40, Math.round(N / 900));
        for (let d = 0; d < drops; d++) {
            splat(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 1);
        }
    }

    function splat(cx, cy, r, strength) {
        const r2 = r * r;
        for (let y = Math.floor(cy - r); y <= cy + r; y++) {
            for (let x = Math.floor(cx - r); x <= cx + r; x++) {
                const dx = x - cx, dy = y - cy;
                if (dx * dx + dy * dy > r2) continue;
                // torus, same as the simulation
                const xi = ((x % W) + W) % W, yi = ((y % H) + H) % H;
                const i = yi * W + xi;
                V[i] = Math.min(1, V[i] + 0.9 * strength);
                U[i] = Math.max(0, U[i] - 0.45 * strength);
            }
        }
    }

    // Paint in normalised (0..1) viewport coordinates
    function paint(nx, ny, radius) {
        splat(nx * W, ny * H, Math.max(1.5, radius * W), 1);
    }

    function step() {
        for (let y = 0; y < H; y++) {
            const yUp = (y === 0 ? H - 1 : y - 1) * W;
            const yDn = (y === H - 1 ? 0 : y + 1) * W;
            const yMid = y * W;
            for (let x = 0; x < W; x++) {
                const xl = x === 0 ? W - 1 : x - 1;
                const xr = x === W - 1 ? 0 : x + 1;
                const i = yMid + x;

                const u = U[i], v = V[i];

                const lu = 0.2 * (U[yMid + xl] + U[yMid + xr] + U[yUp + x] + U[yDn + x])
                         + 0.05 * (U[yUp + xl] + U[yUp + xr] + U[yDn + xl] + U[yDn + xr])
                         - u;
                const lv = 0.2 * (V[yMid + xl] + V[yMid + xr] + V[yUp + x] + V[yDn + x])
                         + 0.05 * (V[yUp + xl] + V[yUp + xr] + V[yDn + xl] + V[yDn + xr])
                         - v;

                const uvv = u * v * v;
                const f = F[i], k = K[i];

                let nu = u + (DU * lu - uvv + f * (1 - u)) * DT;
                let nv = v + (DV * lv + uvv - (f + k) * v) * DT;

                U2[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
                V2[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
            }
        }
        let t = U; U = U2; U2 = t;
        t = V; V = V2; V2 = t;
    }

    // ── render: v through the palette, lit as a raised glaze ──
    // v is bimodal — near 0 in the ground, peaking around 0.35 inside a
    // pattern — so HI has to sit well above that peak or every pattern
    // saturates on the lightest anchor and the palette never gets used.
    const LO = 0.035, HI = 0.50;
    const INV = 1 / (HI - LO);
    // light from the upper left, halfway vector against a head-on view
    const LX = -0.52, LY = -0.68, LZ = 0.52;
    const HX = LX, HY = LY, HZ = LZ + 1;
    const HL = Math.sqrt(HX * HX + HY * HY + HZ * HZ);
    const hx = HX / HL, hy = HY / HL, hz = HZ / HL;

    function render() {
        for (let y = 0; y < H; y++) {
            const yUp = (y === 0 ? H - 1 : y - 1) * W;
            const yDn = (y === H - 1 ? 0 : y + 1) * W;
            const yMid = y * W;
            for (let x = 0; x < W; x++) {
                const xl = x === 0 ? W - 1 : x - 1;
                const xr = x === W - 1 ? 0 : x + 1;
                const i = yMid + x;

                const v = V[i];
                let t = (v - LO) * INV;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const ci = (t * 255) | 0;

                // gradient of v → surface normal
                const gx = (V[yMid + xr] - V[yMid + xl]) * 14 * RELIEF;
                const gy = (V[yDn + x] - V[yUp + x]) * 14 * RELIEF;
                const slope = Math.sqrt(gx * gx + gy * gy);
                const len = Math.sqrt(slope * slope + 1);
                const nxn = -gx / len, nyn = -gy / len, nzn = 1 / len;

                let diff = nxn * LX + nyn * LY + nzn * LZ;
                if (diff < 0) diff = 0;

                // Gated by slope. A flat facet points straight at the viewer,
                // which is close enough to the half vector that an ungated
                // specular lifts the whole empty ground to mid grey.
                let sp = nxn * hx + nyn * hy + nzn * hz;
                sp = sp < 0 ? 0 : sp;
                const sp4 = sp * sp * sp * sp;
                const gate = slope < 1.25 ? slope * 0.8 : 1;
                const spec = sp4 * sp4 * sp4 * 0.60 * gate;      // ^12

                const lit = 0.34 + diff * 0.78;

                const r = RR[ci] * lit + spec;
                const g = RG[ci] * lit + spec;
                const b = RB[ci] * lit + spec;

                data32[i] = 0xff000000 | (enc(b) << 16) | (enc(g) << 8) | enc(r);
            }
        }
        bctx.putImageData(imgData, 0, 0);
        dctx.imageSmoothingEnabled = true;      // organic, not pixelated
        dctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }

    // ── lifecycle ──
    alloc();
    fitDisplay();
    buildRamp();
    buildParams();

    // Reaction–diffusion needs hundreds of steps before there is anything to
    // look at. Those steps are spread over the next handful of frames instead
    // of run in one blocking burst — at this resolution a 500-step burst is a
    // second and a half of frozen page every time you change regime.
    let pending = 0;
    function reset() {
        seed();
        pending = WARMUP;
    }
    reset();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        fitDisplay();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const vw = canvas.clientWidth || window.innerWidth || 1;
            const vh = canvas.clientHeight || window.innerHeight || 1;
            const want = Math.max(60, Math.round(RES * (vh / vw)) || RES);
            if (Math.abs(want - H) > H * 0.08) {
                alloc(); buildParams(); reset();
            }
        }, 250);
    });

    let raf = 0;
    const CATCHUP = 26;      // extra steps per frame while warming up
    function frame() {
        let n = ITERS;
        if (pending > 0) {
            const extra = pending < CATCHUP ? pending : CATCHUP;
            pending -= extra;
            n += extra;
        }
        while (n--) step();
        render();
        raf = requestAnimationFrame(frame);
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        paint,
        reseed() { reset(); },
        clear()  { U.fill(1); V.fill(0); },
        setPreset(name) {
            const p = PRESETS.find(p => p.name === name);
            if (!p) return;
            preset = p;
            buildParams();
            return preset.name;
        },
        setPalette(name) {
            const p = PALETTES.find(p => p.name === name);
            if (!p) return;
            pal = p;
            buildRamp();
        },
        randomPalette() {
            pal = PALETTES[(Math.random() * PALETTES.length) | 0];
            buildRamp();
            return pal.name;
        },
        get preset() { return preset.name; },
        get palette() { return pal.name; },
    };
}
