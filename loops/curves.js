// ════════════════════════════════════════════════════════════════════════════
// LOOPS — harmonic curves as 3D wire, not as dots.
//
// Shared by index.html (the post) and preview.html (the card).
//
// Each cell draws x = sin(a·t + δ), y = sin(b·t) — but with a third harmonic
// z = sin(c·t + ε) that nothing plots. z is depth: it drives the width and the
// brightness of the wire, so a flat Lissajous figure reads as a knot turning
// in space, thick and lit where it comes toward you, thin and dim where it
// goes behind itself.
//
// (a, b, c, δ, ε) are not fixed integers. They drift on per-cell sine
// oscillators with their own phases, so real-valued ratios open the curve into
// something that never closes, and integer ratios drift in and out of
// resonance. Each mode gives that evolution a different temperament.
//
// A comet runs the loop: brightness peaks at a head that marches along the
// arc and falls away behind it, over a faint ghost of the whole figure. The
// wire is stroked in chunks — one colour and one width per chunk, round joins
// — which keeps it continuous to the eye at a twentieth of the path count.
//
// Colour is a cyclic electric spectrum interpolated in LINEAR light and
// pre-encoded into a lookup table, so no strings are allocated per frame.
// ════════════════════════════════════════════════════════════════════════════

const TWO_PI = Math.PI * 2;

// Oscilloscope phosphor, pushed into neon
const PAL = [
    [40, 200, 190], [58, 140, 240], [124, 96, 246],
    [212, 74, 200], [246, 92, 128], [248, 176, 74], [150, 224, 130],
];

const S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const c = i / 255;
    S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function l2s(v) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(s * 255);
}

const RAMP_N = 384;
const BRI_N = 26;
const BRI_MAX = 1.5;
const BRI_GAMMA = 1.8;
const COLS = new Array(RAMP_N * BRI_N);

(function build() {
    const lin = new Float32Array(RAMP_N * 3);
    const n = PAL.length;
    for (let i = 0; i < RAMP_N; i++) {
        const f = (i / RAMP_N) * n;
        const k = Math.floor(f) % n;
        let fr = f - Math.floor(f);
        fr = fr * fr * (3 - 2 * fr);
        const a = PAL[k], b = PAL[(k + 1) % n];
        lin[i * 3]     = S2L[a[0]] + (S2L[b[0]] - S2L[a[0]]) * fr;
        lin[i * 3 + 1] = S2L[a[1]] + (S2L[b[1]] - S2L[a[1]]) * fr;
        lin[i * 3 + 2] = S2L[a[2]] + (S2L[b[2]] - S2L[a[2]]) * fr;
    }
    for (let b = 0; b < BRI_N; b++) {
        const k = BRI_MAX * Math.pow((b + 0.5) / BRI_N, BRI_GAMMA);
        for (let i = 0; i < RAMP_N; i++) {
            COLS[b * RAMP_N + i] = 'rgb(' +
                l2s(lin[i * 3] * k) + ',' +
                l2s(lin[i * 3 + 1] * k) + ',' +
                l2s(lin[i * 3 + 2] * k) + ')';
        }
    }
})();

function col(pos, bri) {
    let i = (pos - Math.floor(pos)) * RAMP_N | 0;
    if (i < 0) i = 0; else if (i >= RAMP_N) i = RAMP_N - 1;
    let b = (Math.pow(bri / BRI_MAX, 1 / BRI_GAMMA) * BRI_N) | 0;
    if (b < 0) b = 0; else if (b >= BRI_N) b = BRI_N - 1;
    return COLS[b * RAMP_N + i];
}

// ─── BASE RATIOS, one set per mode ─────────────────────────────────────────
const SHAPES_BASES = [
    { a: 1, b: 1, d: 0 },              { a: 1, b: 1, d: Math.PI / 4 },
    { a: 1, b: 1, d: Math.PI / 2 },    { a: 1, b: 2, d: 0 },
    { a: 1, b: 2, d: Math.PI / 2 },    { a: 1, b: 3, d: Math.PI / 2 },
    { a: 2, b: 3, d: 0 },              { a: 2, b: 3, d: Math.PI / 4 },
    { a: 3, b: 4, d: 0 },              { a: 3, b: 5, d: 0 },
    { a: 4, b: 5, d: 0 },              { a: 5, b: 6, d: 0 },
    { a: 1, b: 4, d: Math.PI / 2 },    { a: 3, b: 2, d: Math.PI / 3 },
    { a: 5, b: 4, d: Math.PI / 4 },    { a: 7, b: 9, d: 0 },
];

const PHASES_BASES = Array.from({ length: 16 }, (_, i) => ({
    a: 3, b: 4, d: (i / 16) * TWO_PI,
}));

const WALL_BASES = [];
for (let a = 1; a <= 6; a++) {
    for (let b = a + 1; b <= 9; b++) {
        WALL_BASES.push({ a, b, d: (a * 0.7 + b * 0.4) % TWO_PI });
    }
}

// Deterministic per-cell phases so a grid of 48 never looks synchronised.
const CELL = Array.from({ length: 48 }, (_, i) => ({
    pA: ((i * 0.31379) % 1) * TWO_PI,
    pB: ((i * 0.47281) % 1) * TWO_PI,
    pD: ((i * 0.19427) % 1) * TWO_PI,
    pZ: ((i * 0.63317) % 1) * TWO_PI,
    hue: (i * 0.1373) % 1,
    zc: 2 + (i % 5),                      // depth harmonic per cell
}));

//   amp*    — how far a, b drift from their base
//   speed*  — how fast that drift cycles (rad/ms)
//   speedD  — how fast δ rotates, which drives the phase wave
export const MODES = ['SHAPES', 'PHASES', 'DRIFT', 'WALL'];

const PRESETS = {
    SHAPES: { bases: SHAPES_BASES, ampA: 0.35, ampB: 0.35, speedA: 0.00015, speedB: 0.00018, speedD: 0.00012 },
    PHASES: { bases: PHASES_BASES, ampA: 0.12, ampB: 0.12, speedA: 0.00010, speedB: 0.00010, speedD: 0.00030 },
    DRIFT:  { bases: SHAPES_BASES, ampA: 0.70, ampB: 0.70, speedA: 0.00030, speedB: 0.00033, speedD: 0.00020 },
    WALL:   { bases: WALL_BASES,   ampA: 0.50, ampB: 0.50, speedA: 0.00022, speedB: 0.00025, speedD: 0.00015 },
};

export function createLoops(canvas, opts = {}) {
    // More, shorter runs means smaller width steps between them — long runs
    // leave visible pearls where a fat round cap overhangs a thin neighbour.
    const CHUNKS = opts.chunks ?? 34;     // stroked runs per curve
    const SUB    = opts.sub ?? 5;         // points per run
    const GLOW   = opts.glow ?? true;
    const SEED   = opts.seed ?? 0;

    const ctx = canvas.getContext('2d', { alpha: false });

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();

    let mode = MODES[0];
    let t = SEED;

    function grid() {
        if (mode === 'WALL') {
            return window.innerWidth >= window.innerHeight
                ? { cols: 8, rows: 6 } : { cols: 6, rows: 8 };
        }
        return { cols: 4, rows: 4 };
    }

    // Scratch buffers — reused, never reallocated
    const px = new Float64Array(CHUNKS * SUB + 1);
    const py = new Float64Array(CHUNKS * SUB + 1);
    const pz = new Float64Array(CHUNKS * SUB + 1);

    function drawCell(cx, cy, r0, idx) {
        const p = PRESETS[mode];
        const base = p.bases[idx % p.bases.length];
        const ph = CELL[idx % CELL.length];
        // WALL packs three times the cells — spend fewer runs on each
        const chunks = mode === 'WALL' ? (CHUNKS * 0.55) | 0 : CHUNKS;

        const a = base.a + Math.sin(t * p.speedA + ph.pA) * p.ampA;
        const b = base.b + Math.sin(t * p.speedB + ph.pB) * p.ampB;
        const d = base.d + t * p.speedD + Math.sin(t * p.speedD * 0.4 + ph.pD) * 0.5;
        const zc = ph.zc + Math.sin(t * 0.00013 + ph.pZ) * 0.6;
        const ze = ph.pZ + t * 0.00009;

        // The cell turns slowly on its own — a knot on a turntable. A rotated
        // unit square reaches |cos|+|sin| at the corners, so the radius is
        // divided by exactly that or the figure spills out of its cell.
        const spin = t * 0.00004 + ph.hue * TWO_PI;
        const cs = Math.cos(spin), sn = Math.sin(spin);
        const r = r0 / (Math.abs(cs) + Math.abs(sn));

        const N = chunks * SUB;
        for (let i = 0; i <= N; i++) {
            const u = (i / N) * TWO_PI;
            const x = Math.sin(a * u + d);
            const y = Math.sin(b * u);
            px[i] = cx + (x * cs - y * sn) * r;
            py[i] = cy + (x * sn + y * cs) * r;
            pz[i] = Math.sin(zc * u + ze);           // −1 behind, +1 toward you
        }

        // Comet head marches around the loop
        const head = (t * 0.00011) % 1;

        for (let c = 0; c < chunks; c++) {
            const i0 = c * SUB;
            const s = (i0 + SUB * 0.5) / N;

            // distance behind the head, wrapped
            let back = head - s;
            if (back < 0) back += 1;
            const near = 1 - back;
            const comet = near * near * near;

            const z = pz[i0 + (SUB >> 1)];
            const depth = z * 0.5 + 0.5;                     // 0 far, 1 near

            const bri = 0.055 + comet * 1.25 * (0.45 + depth * 0.75);
            // Depth only swells the wire where the comet lights it. Letting
            // depth drive width along the whole ghost leaves a string of
            // beads down the faint part of the loop.
            const thick = 0.22 + comet * 0.78;
            const wid = Math.max(0.55, r0 * (0.010 + (0.020 + depth * 0.048) * thick));
            const hue = ph.hue + s * 0.55 + t * 0.00002;

            ctx.beginPath();
            ctx.moveTo(px[i0], py[i0]);
            for (let k = 1; k <= SUB; k++) ctx.lineTo(px[i0 + k], py[i0 + k]);

            if (GLOW && comet > 0.30) {
                ctx.strokeStyle = col(hue, bri * 0.26);
                ctx.lineWidth = wid * 3.2;
                ctx.stroke();
            }
            ctx.strokeStyle = col(hue, bri);
            ctx.lineWidth = wid;
            ctx.stroke();
        }
    }

    let raf = 0, last = performance.now();

    function frame(now) {
        t += now - last;
        last = now;

        const W = canvas.clientWidth, H = canvas.clientHeight;
        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const { cols, rows } = grid();
        const gap = mode === 'WALL' ? 3 : 6;
        const cw = (W - gap * (cols + 1)) / cols;
        const chh = (H - gap * (rows + 1)) / rows;
        const r = Math.min(cw, chh) * 0.44;

        for (let row = 0; row < rows; row++) {
            for (let c = 0; c < cols; c++) {
                drawCell(gap + c * (cw + gap) + cw / 2,
                         gap + row * (chh + gap) + chh / 2,
                         r, row * cols + c);
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        raf = requestAnimationFrame(frame);
    }

    // A long dt while hidden would compound into the evolution
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) last = performance.now();
    });

    return {
        start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        setMode(m) { if (PRESETS[m]) mode = m; },
        get mode() { return mode; },
    };
}
