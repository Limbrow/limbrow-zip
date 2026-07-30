// ════════════════════════════════════════════════════════════════════════════
// RIPPLES — a ripple tank.
//
// Shared by index.html (the post) and preview.html (the card).
//
// The wave equation, integrated straight:
//
//     ∂²u/∂t² = c²·∇²u
//
// which discretises to almost nothing —
//
//     u_next = 2u − u_prev + C·(∑neighbours − 4u)
//
// two frames of memory and a five-point Laplacian. No particles, no noise, no
// fudged sine sum: this is the actual equation, and everything it is famous for
// falls out of it for free. Waves reflect off the walls. Two crests meeting
// make a taller one and a crest meeting a trough cancels. Push them through a
// gap narrower than their wavelength and they bend around the corner.
//
// So the barriers are the piece. Send a straight wavefront at TWO slits and the
// pattern past them is the double-slit experiment, in water, at 60fps: the two
// gaps each re-radiate a circular wave, and where those two agree you get a
// bright fan of fringes and where they disagree, dead calm.
//
// The surface is lit rather than colour-coded — the gradient of u becomes a
// normal, so crests catch a specular glint, and the Laplacian is added as a
// CAUSTIC term, which is the actual reason the bottom of a swimming pool is
// covered in that bright shifting web. Colour is interpolated in linear light.
//
// C must stay below 0.5 or the integration explodes.
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

// trough → still → crest
export const PALETTES = [
    { name: 'TANK',    anchors: [[4, 18, 30], [10, 58, 82], [26, 122, 148], [120, 208, 214], [238, 252, 252]] },
    { name: 'INK',     anchors: [[8, 6, 22], [34, 26, 84], [86, 62, 168], [168, 146, 232], [242, 238, 255]] },
    { name: 'MERCURY', anchors: [[16, 18, 22], [58, 64, 74], [124, 134, 148], [196, 206, 218], [255, 255, 255]] },
    { name: 'COPPER',  anchors: [[22, 10, 8], [86, 34, 20], [176, 84, 38], [232, 158, 88], [255, 236, 208]] },
    { name: 'ALGAE',   anchors: [[6, 20, 14], [14, 66, 46], [40, 138, 92], [136, 212, 150], [242, 254, 232]] },
];

export const BARRIERS = ['OPEN', 'SLIT', 'DOUBLE', 'LENS'];

const C = 0.34;          // must stay under 0.5
const DAMP = 0.9975;

export function createTank(canvas, opts = {}) {
    const RES    = opts.res ?? 340;
    const STEPS  = opts.steps ?? 2;        // integration steps per frame
    const RELIEF = opts.relief ?? 1.0;

    const dctx = canvas.getContext('2d', { alpha: false });

    let W = 0, H = 0, N = 0;
    let u0, u1, u2, SOLID;
    let buffer, bctx, imgData, data32;

    let pal = PALETTES[0];
    const RR = new Float32Array(256), RG = new Float32Array(256), RB = new Float32Array(256);

    let barrier = 0;
    let clock = 0;
    // The driver: a line of emitters down the left edge makes a straight
    // wavefront, which is what you need to see diffraction at a slit.
    let driveOn = true;
    // The wave travels √C ≈ 0.58 cells per step, so wavelength = 0.58 · period.
    // This puts it around 25 cells: short enough to see as ripples, long enough
    // that a slit a few cells wide really does diffract it.
    const DRIVE_FREQ = 0.146;
    const DRIVE_AMP = 0.55;

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
        u0 = new Float32Array(N);
        u1 = new Float32Array(N);
        u2 = new Float32Array(N);
        SOLID = new Uint8Array(N);

        buffer = document.createElement('canvas');
        buffer.width = W; buffer.height = H;
        bctx = buffer.getContext('2d');
        imgData = bctx.createImageData(W, H);
        data32 = new Uint32Array(imgData.data.buffer);
        buildBarrier();
    }

    function fitDisplay() {
        canvas.width = Math.max(1, window.innerWidth || canvas.clientWidth || 1);
        canvas.height = Math.max(1, window.innerHeight || canvas.clientHeight || 1);
    }

    function buildBarrier() {
        SOLID.fill(0);
        const wallX = (W * 0.42) | 0;
        const thick = Math.max(2, (W * 0.010) | 0);
        const gap = Math.max(3, (H * 0.055) | 0);      // ~ one wavelength

        if (barrier === 1 || barrier === 2) {
            for (let y = 0; y < H; y++) {
                let open = false;
                if (barrier === 1) {
                    open = Math.abs(y - H * 0.5) < gap * 0.5;
                } else {
                    open = Math.abs(y - H * 0.36) < gap * 0.5
                        || Math.abs(y - H * 0.64) < gap * 0.5;
                }
                if (open) continue;
                for (let x = wallX; x < wallX + thick; x++) SOLID[y * W + x] = 1;
            }
        } else if (barrier === 3) {
            // A concave wall: the reflection converges on a focus
            const cx = W * 0.86, cy = H * 0.5, r = W * 0.52;
            for (let y = 0; y < H; y++) {
                for (let x = (W * 0.30) | 0; x < W; x++) {
                    const dx = x - cx, dy = y - cy;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d > r && d < r + thick + 1) SOLID[y * W + x] = 1;
                }
            }
        }
        // A solid cell holds no water
        for (let i = 0; i < N; i++) if (SOLID[i]) { u0[i] = 0; u1[i] = 0; u2[i] = 0; }
    }

    function drop(nx, ny, radius, amp) {
        const cx = nx * W, cy = ny * H;
        const r = Math.max(1.5, radius * W);
        const r2 = r * r;
        for (let y = Math.max(1, (cy - r) | 0); y <= Math.min(H - 2, cy + r); y++) {
            for (let x = Math.max(1, (cx - r) | 0); x <= Math.min(W - 2, cx + r); x++) {
                const dx = x - cx, dy = y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 > r2) continue;
                const i = y * W + x;
                if (SOLID[i]) continue;
                // a smooth dimple, not a spike — a spike is mostly high
                // frequencies the grid can't carry and it just looks like noise
                const k = 0.5 + 0.5 * Math.cos(Math.sqrt(d2 / r2) * Math.PI);
                u1[i] -= amp * k;
                u0[i] -= amp * k;
            }
        }
    }

    function step() {
        clock++;
        for (let y = 1; y < H - 1; y++) {
            const row = y * W;
            for (let x = 1; x < W - 1; x++) {
                const i = row + x;
                if (SOLID[i]) { u2[i] = 0; continue; }
                const c = u1[i];
                // A solid neighbour is a hard wall: it contributes 0, which is
                // what makes the wave bounce off it.
                const l = SOLID[i - 1] ? 0 : u1[i - 1];
                const r = SOLID[i + 1] ? 0 : u1[i + 1];
                const u = SOLID[i - W] ? 0 : u1[i - W];
                const d = SOLID[i + W] ? 0 : u1[i + W];
                u2[i] = (2 * c - u0[i] + C * (l + r + u + d - 4 * c)) * DAMP;
            }
        }

        // rotate the two frames of memory
        const t = u0; u0 = u1; u1 = u2; u2 = t;

        if (driveOn) {
            const a = Math.sin(clock * DRIVE_FREQ) * DRIVE_AMP;
            const x = 2;
            for (let y = 1; y < H - 1; y++) u1[y * W + x] = a;
        }
    }

    // ── render: the surface lit, plus caustics ──
    const LX = -0.48, LY = -0.62, LZ = 0.62;
    const HX = LX, HY = LY, HZ = LZ + 1;
    const HL = Math.sqrt(HX * HX + HY * HY + HZ * HZ);
    const hx = HX / HL, hy = HY / HL, hz = HZ / HL;
    const SOLIDC = 0xff2a2622;

    function render() {
        for (let y = 0; y < H; y++) {
            const row = y * W;
            const up = y > 0 ? row - W : row;
            const dn = y < H - 1 ? row + W : row;
            for (let x = 0; x < W; x++) {
                const i = row + x;
                if (SOLID[i]) { data32[i] = SOLIDC; continue; }
                const xl = x > 0 ? i - 1 : i;
                const xr = x < W - 1 ? i + 1 : i;

                const h = u1[i];
                const gx = (u1[xr] - u1[xl]) * 5.0 * RELIEF;
                const gy = (u1[dn + x] - u1[up + x]) * 5.0 * RELIEF;
                const slope = Math.sqrt(gx * gx + gy * gy);
                const len = Math.sqrt(slope * slope + 1);
                const nx = -gx / len, ny = -gy / len, nz = 1 / len;

                let diff = nx * LX + ny * LY + nz * LZ;
                if (diff < 0) diff = 0;

                // Gated by slope: still water faces straight at the viewer,
                // close enough to the half vector that an ungated specular
                // washes the whole tank out to pale grey.
                let sp = nx * hx + ny * hy + nz * hz;
                sp = sp < 0 ? 0 : sp;
                const s4 = sp * sp * sp * sp;
                const gate = slope < 1.1 ? slope * 0.9 : 1;
                const spec = s4 * s4 * s4 * 0.60 * gate;

                // Caustic: where the surface focuses light. This is the real
                // reason a pool floor is covered in a bright shifting web.
                const lap = u1[xl] + u1[xr] + u1[up + x] + u1[dn + x] - 4 * h;
                let caust = -lap * 3.4;
                if (caust < 0) caust = 0;

                let t = h * 0.9 + 0.5;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const ci = (t * 255) | 0;

                const lit = 0.42 + diff * 0.72 + caust;
                data32[i] = 0xff000000
                    | (enc(RB[ci] * lit + spec) << 16)
                    | (enc(RG[ci] * lit + spec) << 8)
                    |  enc(RR[ci] * lit + spec);
            }
        }
        bctx.putImageData(imgData, 0, 0);
        dctx.imageSmoothingEnabled = true;
        dctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    }

    alloc();
    fitDisplay();
    buildRamp();

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
    function frame() {
        for (let s = 0; s < STEPS; s++) step();
        render();
        raf = requestAnimationFrame(frame);
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        drop,
        calm() { u0.fill(0); u1.fill(0); u2.fill(0); },
        setBarrier(name) {
            const i = BARRIERS.indexOf(name);
            if (i >= 0) { barrier = i; buildBarrier(); this.calm(); }
            return BARRIERS[barrier];
        },
        nextBarrier() {
            barrier = (barrier + 1) % BARRIERS.length;
            buildBarrier(); this.calm();
            return BARRIERS[barrier];
        },
        setDrive(on) { driveOn = !!on; },
        get driving() { return driveOn; },
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
        get barrier() { return BARRIERS[barrier]; },
        get palette() { return pal.name; },
    };
}
