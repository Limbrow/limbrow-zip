// ════════════════════════════════════════════════════════════════════════════
// LEPARC — the modulation plate.
//
// Shared by index.html (the post) and preview.html (the card).
//
// MODULATIONS — a regular grid of identical elements, each set at a subtly
// different angle so the collective forms a continuous wave. The angle field
// is multi-octave (three sines plus a cross term) and its octave weights drift
// under a long-period modulation, so the field never closes onto the same
// configuration twice.
//
// CONTINUEL-LUMIÈRE — the elements are not lines but polished blades, and
// there is a light in the room. A blade aligned with the light flares: longer,
// wider, brighter, with a specular core. The light turns slowly and the wave
// keeps moving, so bands of reflection sweep the plate on their own. Every
// blade also casts its own shadow, offset away from the light — that is what
// gives the surface thickness. A second *population* of elements would just
// read as wrong blades.
//
// Colour is a cyclic spectrum interpolated in LINEAR light and pre-encoded
// into a lookup table (hue position × brightness bucket), so a thousand blades
// a frame cost no string allocation at all.
// ════════════════════════════════════════════════════════════════════════════

const PI = Math.PI;
const SHADOW = '#000205';

// Le Parc's Surface-Couleur work is high-chroma on dark. Darkness here comes
// from the lighting term, never from muddying the palette.
const PAL = [
    [232, 54, 62], [250, 132, 46], [244, 196, 78], [138, 204, 84],
    [44, 182, 168], [58, 126, 216], [128, 92, 224], [222, 78, 172],
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

const RAMP_N = 512;      // hue positions around the cycle
const BRI_N = 24;        // brightness buckets
const BRI_MAX = 1.45;
const BRI_GAMMA = 1.7;   // more buckets down in the shadows
const COLS = new Array(RAMP_N * BRI_N);

(function buildColours() {
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

// Angle in π units — 1.0 is a half turn, and Le Parc's line elements are
// symmetric under exactly that.
function angleField(nx, ny, t, w) {
    return Math.sin(nx * 4.5 + t * 1.00) * w[0]
         + Math.cos(ny * 3.5 + t * 0.85) * w[1]
         + Math.sin((nx + ny) * 5.5 + t * 1.30) * w[2]
         + Math.cos((nx - ny) * 7.0 - t * 0.70) * w[3];
}

export function createPlate(canvas, opts = {}) {

    // A grid card is a couple of hundred pixels wide and there are two dozen of
    // them on screen. Capping the draw rate is the cheapest lever there is:
    // the simulation still advances on real elapsed time, we just stop
    // repainting it sixty times a second. 0 means "every animation frame".
    const FRAME_MS = opts.fps ? 1000 / opts.fps : 0;
    const DENSITY     = opts.density ?? 21;    // elements across the short side
    const INTERACTIVE = opts.interactive ?? false;
    const SEED        = opts.seed ?? 0;

    const ctx = canvas.getContext('2d', { alpha: false });

    function fit() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', fit);
    fit();

    // ─── POINTER — the light goes tangential around your finger and the
    // blades bend into rings with it, so the rings are exactly the ones the
    // light is aligned with. They ignite. ───
    const pointer = { x: 0, y: 0, active: false };
    let pStrength = 0;

    if (INTERACTIVE) {
        window.addEventListener('pointermove', e => {
            pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
        }, { passive: true });
        window.addEventListener('pointerleave', () => { pointer.active = false; });
        window.addEventListener('blur', () => { pointer.active = false; });
        window.addEventListener('pointerdown', e => {
            if (e.target.closest('.back')) return;
            pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
        }, { passive: true });
    }

    // A blade is a lozenge: tip, shoulder, tip, shoulder. Solid fill (fast),
    // with an optional brighter core stroke down the middle for the polish.
    function blade(cx, cy, a, len, wid, fill, core) {
        const dx = Math.cos(a), dy = Math.sin(a);
        const hx = dx * len * 0.5, hy = dy * len * 0.5;
        const nx = -dy * wid * 0.5, ny = dx * wid * 0.5;

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(cx + hx, cy + hy);
        ctx.lineTo(cx + nx, cy + ny);
        ctx.lineTo(cx - hx, cy - hy);
        ctx.lineTo(cx - nx, cy - ny);
        ctx.closePath();
        ctx.fill();

        if (core) {
            ctx.strokeStyle = core;
            ctx.lineWidth = wid * 0.34;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx + hx * 0.55, cy + hy * 0.55);
            ctx.lineTo(cx - hx * 0.55, cy - hy * 0.55);
            ctx.stroke();
        }
    }

    const w = new Float32Array(4);
    let raf = 0;
    let lastDraw = 0;

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (FRAME_MS && now - lastDraw < FRAME_MS) return;
        lastDraw = now;
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;

        ctx.fillStyle = '#05060a';
        ctx.fillRect(0, 0, W, H);

        const t = now * 0.00038 + SEED * 0.01;
        const slow = now * 0.000018 + SEED * 0.001;

        // Long-period re-weighting of the octaves
        w[0] = 0.65 + Math.sin(slow * 0.7) * 0.25;
        w[1] = 0.55 + Math.sin(slow * 0.5 + 1.4) * 0.25;
        w[2] = 0.40 + Math.cos(slow * 0.6 + 2.8) * 0.20;
        w[3] = 0.30 + Math.sin(slow * 0.4 + 0.9) * 0.20;

        // Global light direction — one slow turn every ~50s
        const lightG = now * 0.000125 + SEED;

        // Pointer influence fades in and out so leaving the plate doesn't snap
        pStrength += ((pointer.active ? 1 : 0) - pStrength) * 0.06;
        const pRad = Math.min(W, H) * 0.44;
        const pOn = pStrength > 0.01;
        const pX = pointer.x, pY = pointer.y;

        const rampDrift = t * 0.05 + slow * 0.08;

        const target = Math.min(W, H) / DENSITY;
        const cols = Math.max(6, Math.ceil(W / target));
        const rows = Math.max(6, Math.ceil(H / target));
        const cw = W / cols, ch = H / rows;
        const cell = Math.min(cw, ch);
        const sh = cell * 0.11;

        for (let r = 0; r < rows; r++) {
            const ny = r / (rows - 1) - 0.5;
            const cy = (r + 0.5) * ch;
            for (let c = 0; c < cols; c++) {
                const nx = c / (cols - 1) - 0.5;
                const cx = (c + 0.5) * cw;

                let ang = angleField(nx, ny, t, w);
                let light = lightG;

                if (pOn) {
                    const dx = cx - pX, dy = cy - pY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const d = 1 - dist / pRad;
                    if (d > 0) {
                        const inf = d * pStrength;
                        const k = inf * inf * (3 - 2 * inf);
                        const tangent = Math.atan2(dy, dx) + PI * 0.5;
                        ang = ang * (1 - k) + (tangent / PI) * k;
                        light = light * (1 - k) + tangent * k;
                    }
                }

                const a = ang * PI;

                // Specular alignment — |cos| so a half turn is the same blade
                let al = Math.cos(a - light);
                al = al < 0 ? -al : al;
                const al2 = al * al;
                const spec = al2 * al2;              // ^4, tight highlight

                // Every blade has to read: the wave IS the piece. The light
                // adds sheen on top of a legible field, it doesn't decide who
                // gets to exist.
                const wob = Math.sin(nx * 5 - ny * 3 + t * 1.5);
                const bri = 0.40 + spec * 0.78 + wob * 0.06;
                const pos = (nx + ny) * 0.30 + rampDrift + Math.sin(nx * 4 + t) * 0.09;

                const len = cell * (0.90 + spec * 0.16);
                const wid = Math.max(1.6, cell * (0.145 + spec * 0.070));

                blade(cx - Math.cos(light) * sh, cy - Math.sin(light) * sh,
                      a, len, wid, SHADOW, null);

                // Specular core only where it reads — keeps the path count sane
                const core = spec > 0.38 ? col(pos + 0.02, 0.75 + spec * 0.70) : null;
                blade(cx, cy, a, len, wid, col(pos, bri), core);
            }
        }

    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
    };
}
