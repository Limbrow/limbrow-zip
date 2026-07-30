// ════════════════════════════════════════════════════════════════════════════
// VORONOI — stained glass that can't stop moving.
//
// Shared by index.html (the post) and preview.html (the card).
//
// Scatter some seeds on a plane and give every point on it to whichever seed
// is closest. That is the whole definition, and it produces the tiling that
// turns up in soap foam, giraffe hide, basalt columns and cracked glaze.
//
// The twist here is that "closest" is a CHOICE. Change the metric and the same
// seeds in the same places produce a completely different tiling:
//
//   EUCLID     √(dx² + dy²)        straight edges, the familiar foam
//   MANHATTAN  |dx| + |dy|         diamonds — distance if you can only turn 90°
//   CHEBYSHEV  max(|dx|, |dy|)     squares — a king's moves on a chessboard
//   CUBIC      ∛(|dx|³ + |dy|³)    boxes with the corners eased off
//
// Every pixel finds its nearest seed AND its second nearest. The first gives
// the cell its colour; the gap between them gives the edge — where two seeds
// are nearly tied, you are on a border, and it lights up. That is also why the
// borders are perfectly crisp at any zoom: nothing is drawn as a line, the
// edges are simply where the competition is close.
//
// The seeds drift on slow orbits, so the tiling is permanently rebuilding
// itself: cells swell, pinch, swallow their neighbours and split apart.
//
// Colour is interpolated in LINEAR light, with contour bands inside each cell
// following the distance field, so a cell reads as a domed piece of glass
// rather than a flat polygon.
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

// Cyclic, so neighbouring seeds can be anywhere on the wheel
export const PALETTES = [
    { name: 'GLASS',   anchors: [[214, 62, 74], [242, 150, 52], [244, 208, 92], [96, 194, 126], [48, 150, 210], [126, 88, 216]] },
    { name: 'LAGOON',  anchors: [[16, 78, 108], [24, 132, 148], [58, 186, 172], [140, 220, 196], [70, 162, 200], [34, 104, 158]] },
    { name: 'FOUNDRY', anchors: [[96, 22, 28], [166, 52, 34], [226, 104, 40], [244, 168, 66], [186, 74, 44], [124, 34, 30]] },
    { name: 'ORCHID',  anchors: [[74, 24, 92], [138, 44, 148], [206, 82, 178], [240, 146, 200], [166, 96, 214], [96, 52, 168]] },
    { name: 'BASALT',  anchors: [[38, 42, 50], [70, 78, 90], [112, 122, 136], [158, 168, 180], [96, 106, 120], [58, 64, 74]] },
];

export const METRICS = ['EUCLID', 'MANHATTAN', 'CHEBYSHEV', 'CUBIC'];

export function createCells(canvas, opts = {}) {

    // A grid card is a couple of hundred pixels wide and there are two dozen of
    // them on screen. Capping the draw rate is the cheapest lever there is:
    // the simulation still advances on real elapsed time, we just stop
    // repainting it sixty times a second. 0 means "every animation frame".
    const FRAME_MS = opts.fps ? 1000 / opts.fps : 0;
    const RES   = opts.res ?? 300;
    const SEEDS = opts.seeds ?? 34;
    const BAND  = opts.band ?? 1.0;      // strength of the contour banding

    const dctx = canvas.getContext('2d', { alpha: false });

    let W = 0, H = 0, N = 0;
    let buffer, bctx, imgData, data32;

    let pal = PALETTES[0];
    let metric = 0;
    const RR = new Float32Array(256), RG = new Float32Array(256), RB = new Float32Array(256);

    // seeds live slightly outside the frame too, so edge cells aren't all clipped
    const sx = new Float32Array(SEEDS), sy = new Float32Array(SEEDS);
    const ax = new Float32Array(SEEDS), ay = new Float32Array(SEEDS);   // orbit radii
    const ph = new Float32Array(SEEDS), pw = new Float32Array(SEEDS);   // phase, rate
    const cx0 = new Float32Array(SEEDS), cy0 = new Float32Array(SEEDS); // orbit centres
    const hue = new Float32Array(SEEDS);

    function buildRamp() {
        const A = pal.anchors, n = A.length;
        for (let i = 0; i < 256; i++) {
            const f = (i / 256) * n;
            const k = Math.floor(f) % n;
            let fr = f - Math.floor(f);
            fr = fr * fr * (3 - 2 * fr);
            const a = A[k], b = A[(k + 1) % n];
            RR[i] = S2L[a[0]] + (S2L[b[0]] - S2L[a[0]]) * fr;
            RG[i] = S2L[a[1]] + (S2L[b[1]] - S2L[a[1]]) * fr;
            RB[i] = S2L[a[2]] + (S2L[b[2]] - S2L[a[2]]) * fr;
        }
    }

    function seed() {
        for (let i = 0; i < SEEDS; i++) {
            cx0[i] = -0.08 + Math.random() * 1.16;
            cy0[i] = -0.08 + Math.random() * 1.16;
            ax[i] = 0.04 + Math.random() * 0.13;
            ay[i] = 0.04 + Math.random() * 0.13;
            ph[i] = Math.random() * Math.PI * 2;
            pw[i] = (0.5 + Math.random() * 1.4) * (Math.random() < 0.5 ? -1 : 1);
            hue[i] = Math.random();
            sx[i] = cx0[i]; sy[i] = cy0[i];
        }
    }

    function alloc() {
        const vw = canvas.clientWidth || window.innerWidth || 1;
        const vh = canvas.clientHeight || window.innerHeight || 1;
        W = RES;
        H = Math.max(60, Math.round(RES * (vh / vw)) || RES);
        N = W * H;
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

    // pointer pushes seeds away from itself
    const push = { x: 0, y: 0, on: false, str: 0 };
    function shove(nx, ny) { push.x = nx; push.y = ny; push.on = true; }
    function release() { push.on = false; }

    function move(t) {
        push.str += ((push.on ? 1 : 0) - push.str) * 0.08;
        for (let i = 0; i < SEEDS; i++) {
            let x = cx0[i] + Math.cos(t * 0.00011 * pw[i] + ph[i]) * ax[i];
            let y = cy0[i] + Math.sin(t * 0.00013 * pw[i] + ph[i] * 1.7) * ay[i];
            if (push.str > 0.01) {
                const dx = x - push.x, dy = y - push.y;
                const d = Math.sqrt(dx * dx + dy * dy) + 1e-4;
                const k = Math.max(0, 1 - d / 0.42) * push.str * 0.28;
                x += (dx / d) * k;
                y += (dy / d) * k;
            }
            sx[i] = x; sy[i] = y;
        }
    }

    // Aspect-corrected so cells aren't stretched on a wide screen
    let asp = 1;

    function dist(dx, dy) {
        dx = dx < 0 ? -dx : dx;
        dy = dy < 0 ? -dy : dy;
        switch (metric) {
            case 1: return dx + dy;
            case 2: return dx > dy ? dx : dy;
            case 3: return Math.cbrt(dx * dx * dx + dy * dy * dy);
            default: return Math.sqrt(dx * dx + dy * dy);
        }
    }

    function render() {
        asp = W / H;
        const invW = 1 / W, invH = 1 / H;

        for (let y = 0; y < H; y++) {
            const py = y * invH;
            const row = y * W;
            for (let x = 0; x < W; x++) {
                const pxn = x * invW;

                let d1 = 1e9, d2 = 1e9, id1 = 0;
                for (let s = 0; s < SEEDS; s++) {
                    const d = dist((pxn - sx[s]) * asp, py - sy[s]);
                    if (d < d1) { d2 = d1; d1 = d; id1 = s; }
                    else if (d < d2) { d2 = d; }
                }

                // Edge: not a drawn line but where the two nearest seeds are
                // nearly tied. Crisp at any resolution, for free.
                const gap = d2 - d1;
                const eW = 0.020;
                let edge = gap < eW ? gap / eW : 1;
                edge = edge * edge * (3 - 2 * edge);

                // Dome the cell with its own distance field, plus contour bands.
                // A cell is only ~0.1 wide, so the falloff has to be steep or
                // every cell comes out flat and milky.
                let shade = 1 - d1 * 4.6;
                if (shade < 0.10) shade = 0.10;
                shade *= 0.92 + 0.08 * BAND * Math.sin(d1 * 130);

                const ci = (hue[id1] * 256) & 255;
                // Dark lead exactly on the border, with a thin bright bevel
                // just inside it — that pairing is what reads as leaded glass.
                const lead = 0.10 + 0.90 * edge;
                let rim = 1 - Math.abs(edge - 0.34) * 3.4;
                if (rim < 0) rim = 0;
                const lit = shade * lead + rim * 0.40;

                data32[row + x] = 0xff000000
                    | (enc(RB[ci] * lit) << 16)
                    | (enc(RG[ci] * lit) << 8)
                    |  enc(RR[ci] * lit);
            }
        }

        bctx.putImageData(imgData, 0, 0);
        dctx.imageSmoothingEnabled = true;
        dctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }

    alloc();
    fitDisplay();
    buildRamp();
    seed();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        fitDisplay();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const vw = canvas.clientWidth || window.innerWidth || 1;
            const vh = canvas.clientHeight || window.innerHeight || 1;
            const want = Math.max(60, Math.round(RES * (vh / vw)) || RES);
            if (Math.abs(want - H) > H * 0.08) alloc();
        }, 250);
    });

    let raf = 0;
    let lastDraw = 0;
    const t0 = performance.now();
    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (FRAME_MS && now - lastDraw < FRAME_MS) return;
        lastDraw = now;
        move(now - t0);
        render();
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        shove, release,
        reseed() { seed(); },
        setMetric(name) {
            const i = METRICS.indexOf(name);
            if (i >= 0) metric = i;
            return METRICS[metric];
        },
        nextMetric() {
            metric = (metric + 1) % METRICS.length;
            return METRICS[metric];
        },
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
        get metric() { return METRICS[metric]; },
        get palette() { return pal.name; },
        get seeds() { return SEEDS; },
    };
}
