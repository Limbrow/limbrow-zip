// ════════════════════════════════════════════════════════════════════════════
// CHLADNI — sand on a vibrating plate.
//
// Shared by index.html (the post) and preview.html (the card).
//
// Bow the edge of a metal plate and it rings in a standing wave. Most of the
// surface is moving, but a set of curves — the NODAL LINES — stays perfectly
// still. Scatter sand on it and the sand is thrown off everywhere the plate is
// moving and lands where it isn't, so the invisible shape of the note draws
// itself in sand. Chladni was doing this in 1787.
//
// For a square plate the standing wave is
//
//     u(x,y) = cos(mπx)·cos(nπy) − cos(nπx)·cos(mπy)
//
// and the figure is the set where u = 0. Nothing here solves for those curves.
// Instead 25,000 grains each read |u| under themselves and take a random step
// scaled by it: grains over a violently moving patch get flung a long way,
// grains that stumble onto a still one stop being moved at all. The figure is
// not drawn, it is where the sand ends up — which is exactly how it works on
// a real plate.
//
// m and n are held as REAL numbers eased between integer targets, not switched.
// Between two modes the nodal set stays continuous and slides, so the sand
// reorganises by flowing rather than by teleporting.
//
// Colour is settledness: a grain still being thrown is cold and faint, a grain
// that has come to rest is warm and bright. So the figure ignites along the
// nodes while the dust between them stays dim.
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
function enc(v) { return L2S[v <= 0 ? 0 : v >= 1 ? LUT_N : (v * LUT_N) | 0]; }

// cold dust → settled sand
export const PALETTES = [
    { name: 'SAND',    anchors: [[26, 52, 104], [58, 116, 172], [176, 168, 132], [244, 214, 148], [255, 248, 232]] },
    { name: 'IRON',    anchors: [[36, 30, 44], [104, 52, 58], [196, 92, 54], [244, 172, 88], [255, 240, 210]] },
    { name: 'SALT',    anchors: [[18, 34, 44], [40, 94, 104], [120, 176, 176], [212, 236, 232], [255, 255, 255]] },
    { name: 'GRAPHITE',anchors: [[22, 22, 28], [66, 66, 78], [132, 132, 146], [206, 206, 214], [255, 255, 255]] },
];

// A plate's modes, in the order they ring
const MODES = [
    [1, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [1, 5], [2, 5], [3, 5],
    [4, 5], [1, 6], [3, 6], [4, 6], [5, 6], [2, 7], [4, 7], [6, 7], [3, 8],
    [5, 8], [7, 8],
];

export function createSand(canvas, opts = {}) {
    const RES     = opts.res ?? 460;
    const GRAINS  = opts.grains ?? 25000;
    const DECAY   = opts.decay ?? 0.55;      // brief trails, not a long exposure
    const HOLD    = opts.hold ?? 9000;       // ms a mode is held before the next
    const MORPH   = opts.morph ?? 3200;      // ms to slide between modes

    const dctx = canvas.getContext('2d', { alpha: false });

    let W = 0, H = 0, N = 0;
    let side = 1, ox = 0, oy = 0;      // the square plate inside the buffer
    let DENS, CV, buffer, bctx, imgData, data32;

    let pal = PALETTES[0];
    const RR = new Float32Array(256), RG = new Float32Array(256), RB = new Float32Array(256);

    const px = new Float32Array(GRAINS);
    const py = new Float32Array(GRAINS);

    // mode state — real valued, eased
    let mA = 1, nA = 2;                  // where we are
    let mFrom = 1, nFrom = 2;
    let modeIdx = 0;
    let morphT = 1;                      // 0..1 through the current slide
    let clock = 0;

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

    // The plate is SQUARE, so the BUFFER is square and gets letterboxed into
    // the viewport at draw time. Sizing the buffer to the viewport aspect and
    // stretching it instead turns every figure into diagonal stripes — the
    // symmetry of the square is the whole reason these shapes look like this.
    function alloc() {
        W = H = RES;
        N = W * H;
        DENS = new Float32Array(N);
        CV = new Float32Array(N);          // summed settledness, for colour
        side = RES;
        ox = oy = 0;

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

    function scatter() {
        for (let i = 0; i < GRAINS; i++) {
            px[i] = Math.random();
            py[i] = Math.random();
        }
    }

    // Sprinkle fresh sand under the finger
    function sprinkle(nx, ny, radius) {
        const count = (GRAINS * 0.05) | 0;
        for (let k = 0; k < count; k++) {
            const i = (Math.random() * GRAINS) | 0;
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            px[i] = Math.min(1, Math.max(0, nx + Math.cos(a) * r));
            py[i] = Math.min(1, Math.max(0, ny + Math.sin(a) * r));
        }
    }

    const PI = Math.PI;

    function nextMode() {
        mFrom = mA; nFrom = nA;
        modeIdx = (modeIdx + 1) % MODES.length;
        morphT = 0;
    }

    function step(dt) {
        clock += dt;
        if (morphT < 1) {
            morphT = Math.min(1, morphT + dt / MORPH);
            const s = morphT * morphT * (3 - 2 * morphT);
            const t = MODES[modeIdx];
            mA = mFrom + (t[0] - mFrom) * s;
            nA = nFrom + (t[1] - nFrom) * s;
            if (morphT >= 1) clock = 0;
        } else if (clock > HOLD) {
            nextMode();
        }

        const mp = mA * PI, np = nA * PI;
        // How far a grain is thrown at full amplitude, in plate units
        const kick = 0.030;
        const jitter = 0.0016;              // never completely still

        for (let i = 0; i < GRAINS; i++) {
            const x = px[i], y = py[i];
            const cmx = Math.cos(mp * x), cnx = Math.cos(np * x);
            const cmy = Math.cos(mp * y), cny = Math.cos(np * y);
            let u = cmx * cny - cnx * cmy;
            if (u < 0) u = -u;
            u *= 0.5;                        // |u| in 0..1

            const s = jitter + u * kick;
            const a = Math.random() * PI * 2;
            let nx = x + Math.cos(a) * s;
            let ny = y + Math.sin(a) * s;
            // The plate has edges — a grain thrown off comes back on
            if (nx < 0) nx = -nx; else if (nx > 1) nx = 2 - nx;
            if (ny < 0) ny = -ny; else if (ny > 1) ny = 2 - ny;
            px[i] = nx; py[i] = ny;
        }
    }

    function render() {
        for (let i = 0; i < N; i++) { DENS[i] *= DECAY; CV[i] *= DECAY; }

        const mp = mA * PI, np = nA * PI;

        for (let i = 0; i < GRAINS; i++) {
            const x = px[i], y = py[i];
            const fx = ox + x * side, fy = oy + y * side;
            const ix = fx | 0, iy = fy | 0;
            if (ix < 0 || ix >= W - 1 || iy < 0 || iy >= H - 1) continue;

            // settledness: how still the plate is right here
            const cmx = Math.cos(mp * x), cnx = Math.cos(np * x);
            const cmy = Math.cos(mp * y), cny = Math.cos(np * y);
            let u = cmx * cny - cnx * cmy;
            if (u < 0) u = -u;
            let settled = 1 - Math.min(1, u * 0.5 * 4.2);     // sharpens the nodes
            settled *= settled;

            const u0 = fx - ix, v0 = fy - iy;
            const iu = 1 - u0, iv = 1 - v0;
            const i00 = iy * W + ix, i10 = i00 + 1, i01 = i00 + W, i11 = i01 + 1;
            const w00 = iu * iv, w10 = u0 * iv, w01 = iu * v0, w11 = u0 * v0;

            DENS[i00] += w00; CV[i00] += settled * w00;
            DENS[i10] += w10; CV[i10] += settled * w10;
            DENS[i01] += w01; CV[i01] += settled * w01;
            DENS[i11] += w11; CV[i11] += settled * w11;
        }

        // Auto-exposure against the mean of covered cells — a settled figure is
        // hundreds of times denser than the dust, and a fixed shoulder either
        // clips the nodes flat or loses the dust entirely.
        let sum = 0, lit = 0;
        for (let i = 0; i < N; i++) {
            const d = DENS[i];
            if (d > 0.004) { sum += d; lit++; }
        }
        if (lit > 0) ref += (sum / lit - ref) * 0.08;
        const K = ref * 2.6 < 0.05 ? 0.05 : ref * 2.6;

        for (let i = 0; i < N; i++) {
            const d = DENS[i];
            if (d <= 0.004) { data32[i] = BG; continue; }
            const v = d / (d + K);
            const st = CV[i] / d;                 // mean settledness in this cell
            let ci = (st * 255) | 0;
            if (ci < 0) ci = 0; else if (ci > 255) ci = 255;
            // Dust that is still being thrown around stays dim, so the figure
            // reads against it instead of drowning in blue speckle.
            const g = v * (0.30 + 2.1 * st);
            data32[i] = 0xff000000
                | (enc(RB[ci] * g) << 16)
                | (enc(RG[ci] * g) << 8)
                |  enc(RR[ci] * g);
        }

        bctx.putImageData(imgData, 0, 0);

        const cw = canvas.width, ch = canvas.height;
        const d = Math.min(cw, ch) * 0.94;
        dctx.fillStyle = '#04070a';
        dctx.fillRect(0, 0, cw, ch);
        dctx.imageSmoothingEnabled = true;
        dctx.drawImage(buffer, (cw - d) * 0.5, (ch - d) * 0.5, d, d);
    }

    let ref = 1;
    const BG = 0xff0a0704;          // #04070a packed as ABGR

    alloc();
    fitDisplay();
    buildRamp();
    scatter();

    // The buffer never needs reallocating — it is square regardless of viewport
    window.addEventListener('resize', fitDisplay);

    let raf = 0, last = 0;
    function frame(now) {
        const dt = last ? Math.min(64, now - last) : 16;
        last = now;
        step(dt);
        render();
        raf = requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) last = 0;
    });

    return {
        start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        sprinkle,
        nextMode,
        scatter,
        setPalette(name) {
            const p = PALETTES.find(p => p.name === name);
            if (p) { pal = p; buildRamp(); }
            return pal.name;
        },
        randomPalette() {
            pal = PALETTES[(Math.random() * PALETTES.length) | 0];
            buildRamp();
            return pal.name;
        },
        randomMode() {
            mFrom = mA; nFrom = nA;
            modeIdx = (Math.random() * MODES.length) | 0;
            morphT = 0;
        },
        get mode() {
            const t = MODES[modeIdx];
            return morphT < 1
                ? `${mA.toFixed(2)} × ${nA.toFixed(2)}`
                : `${t[0]} × ${t[1]}`;
        },
        get palette() { return pal.name; },
    };
}
