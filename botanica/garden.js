// ════════════════════════════════════════════════════════════════════════════
// BOTANICA — a night garden that grows while you watch.
//
// Shared by index.html (the post) and preview.html (the card).
//
// Every plant is an L-system: one letter and a rewriting rule, applied to its
// own output over and over. `F → F[+F]F[-F]F` says "a stem is a stem, a stem
// with a branch left, a stem, a stem with a branch right, a stem", and four
// rounds of that is a shrub. Lindenmayer wrote these down in 1968 to describe
// how algae divide; they turn out to describe ferns, bushes and trees just as
// well, which is the whole unsettling point.
//
// Three things make this a garden instead of a diagram.
//
// GROWTH. The expanded string is compiled once into an opcode array, and each
// segment is tagged with its ORDER — how many stems lie between it and the
// root. Growth reveals segments in order, not in the order the string happens
// to list them (which is depth-first, and looks like a pen drawing one branch
// to the tip before starting the next). Ordering by distance from the root
// means the whole plant thickens outward at once, the way a real one does.
//
// WIND. The opcodes are re-interpreted every frame, so a sway can be added at
// every turn, scaled by order — the trunk barely moves, the tips whip. Nothing
// is baked, so the same plant bends differently every second.
//
// SEASONS. The palette turns slowly through spring, summer, autumn and winter,
// carrying the blossom with it: buds open, burn down to ochre, and drop. A
// plant that finishes its season is replaced by a seedling.
//
// Colour is interpolated in linear light, and the blossoms are drawn additively
// so a cluster of them glows instead of just overlapping.
// ════════════════════════════════════════════════════════════════════════════

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

// Each season: wood (root → tip) and a blossom colour.
export const SEASONS = [
    {
        name: 'SPRING',
        wood: [[38, 28, 24], [72, 60, 40], [96, 132, 58], [148, 196, 78], [196, 226, 128]],
        bloom: [252, 168, 200], bloomAmt: 1.0, sky: [10, 14, 20],
    },
    {
        name: 'SUMMER',
        wood: [[28, 26, 22], [56, 58, 34], [58, 118, 54], [96, 168, 70], [162, 210, 104]],
        bloom: [250, 240, 170], bloomAmt: 0.45, sky: [8, 14, 16],
    },
    {
        name: 'AUTUMN',
        wood: [[34, 24, 20], [78, 52, 28], [156, 92, 32], [214, 140, 46], [242, 196, 110]],
        bloom: [232, 96, 52], bloomAmt: 0.85, sky: [16, 12, 12],
    },
    {
        name: 'WINTER',
        wood: [[26, 28, 34], [54, 60, 70], [92, 104, 120], [140, 156, 176], [198, 214, 232]],
        bloom: [222, 240, 255], bloomAmt: 0.22, sky: [8, 10, 16],
    },
];

// ─── SPECIES ───────────────────────────────────────────────────────────────
// axiom + rules + turn angle + how much a stem shortens per generation
const SPECIES = [
    { name: 'BUSH',  axiom: 'F', rules: { F: 'FF-[-F+F+F]+[+F-F-F]' }, gen: 4, ang: 22, shrink: 0.50, up: 0.34 },
    { name: 'TREE',  axiom: 'F', rules: { F: 'F[+F]F[-F]F' },          gen: 4, ang: 26, shrink: 0.44, up: 0.40 },
    { name: 'FERN',  axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, gen: 5, ang: 22, shrink: 0.40, up: 0.30 },
    { name: 'WEED',  axiom: 'F', rules: { F: 'F[+F]F[-F][F]' },        gen: 4, ang: 20, shrink: 0.46, up: 0.36 },
    { name: 'WILLOW',axiom: 'F', rules: { F: 'FF[--F][++F][-F][+F]' }, gen: 3, ang: 16, shrink: 0.56, up: 0.42 },
];

// opcodes
const FWD = 0, LEFT = 1, RIGHT = 2, PUSH = 3, POP = 4;
const MAX_SYMBOLS = 26000;

function expand(sp) {
    let s = sp.axiom;
    for (let g = 0; g < sp.gen; g++) {
        let out = '';
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            out += sp.rules[ch] !== undefined ? sp.rules[ch] : ch;
        }
        if (out.length > MAX_SYMBOLS) { s = out.slice(0, MAX_SYMBOLS); break; }
        s = out;
    }
    const ops = new Uint8Array(s.length);
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        switch (s[i]) {
            case 'F': ops[n++] = FWD; break;
            case '+': ops[n++] = LEFT; break;
            case '-': ops[n++] = RIGHT; break;
            case '[': ops[n++] = PUSH; break;
            case ']': ops[n++] = POP; break;
            default: break;                 // X and friends draw nothing
        }
    }
    return ops.subarray(0, n);
}

export function createGarden(canvas, opts = {}) {

    // A grid card is a couple of hundred pixels wide and there are two dozen of
    // them on screen. Capping the draw rate is the cheapest lever there is:
    // the simulation still advances on real elapsed time, we just stop
    // repainting it sixty times a second. 0 means "every animation frame".
    const FRAME_MS = opts.fps ? 1000 / opts.fps : 0;
    const PLANTS      = opts.plants ?? 7;
    const SEASON_MS   = opts.seasonMs ?? 22000;
    const GROW_MS     = opts.growMs ?? 14000;
    const WIND        = opts.wind ?? 1.0;

    // A plant is only worth looking at once it is grown, so growth has to be a
    // fraction of the life and not the whole of it. At 32% growing / 54% full /
    // 14% fading the garden is mostly a garden; when growth WAS the lifetime,
    // every plant spent nearly all its time as a seedling or a ghost.
    const LIFE_MS = GROW_MS * 3;
    const GROW_FRAC = 0.32;
    const FADE_FROM = 0.86;

    const ctx = canvas.getContext('2d', { alpha: false });

    // colour tables per season, built once
    const RAMPS = SEASONS.map(s => {
        const R = new Float32Array(256), G = new Float32Array(256), B = new Float32Array(256);
        const A = s.wood, n = A.length;
        for (let i = 0; i < 256; i++) {
            const f = (i / 255) * (n - 1);
            const k = Math.min(n - 2, Math.floor(f));
            let fr = f - k;
            fr = fr * fr * (3 - 2 * fr);
            const a = A[k], b = A[k + 1];
            R[i] = S2L[a[0]] + (S2L[b[0]] - S2L[a[0]]) * fr;
            G[i] = S2L[a[1]] + (S2L[b[1]] - S2L[a[1]]) * fr;
            B[i] = S2L[a[2]] + (S2L[b[2]] - S2L[a[2]]) * fr;
        }
        return { R, G, B };
    });

    // Pre-encoded strokes: 64 order steps × 12 brightness steps, so a few
    // thousand segments a frame allocate no strings at all.
    const OSTEPS = 64, BSTEPS = 12;
    const STROKES = SEASONS.map((s, si) => {
        const r = RAMPS[si], out = new Array(OSTEPS * BSTEPS);
        for (let b = 0; b < BSTEPS; b++) {
            const k = 0.45 + (b / (BSTEPS - 1)) * 0.95;
            for (let o = 0; o < OSTEPS; o++) {
                const ci = (o / (OSTEPS - 1) * 255) | 0;
                out[b * OSTEPS + o] =
                    'rgb(' + l2s(r.R[ci] * k) + ',' + l2s(r.G[ci] * k) + ',' + l2s(r.B[ci] * k) + ')';
            }
        }
        return out;
    });

    function fit() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth || canvas.clientWidth || 1;
        const h = window.innerHeight || canvas.clientHeight || 1;
        canvas.width = Math.max(1, Math.floor(w * dpr));
        canvas.height = Math.max(1, Math.floor(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', fit);
    fit();

    // ─── PLANTS ────────────────────────────────────────────────────────────
    const plants = [];

    // A stem tapers with its order, so the plant closes off instead of
    // shooting on forever.
    function taper(order) {
        const t = 1 - order * 0.015;
        return t < 0.45 ? 0.45 : t;
    }

    // MEASURE. Run the turtle once with a unit stem to find the plant's own
    // proportions, then scale it to the height we want. Guessing a stem length
    // instead cannot work: how tall a plant comes out depends on its rule, its
    // generation count and its branching angle all at once, so any fixed guess
    // sends some species clean off the top of the screen.
    const mst = new Float64Array(4 * 64);

    function measure(p) {
        const ops = p.ops, turn = p.sp.ang * Math.PI / 180;
        let x = 0, y = 0, ang = -Math.PI / 2, order = 0, sp = 0;
        let minX = 0, maxX = 0, minY = 0, maxY = 0, seenMax = 0;
        for (let i = 0; i < ops.length; i++) {
            switch (ops[i]) {
                case PUSH:
                    if (sp < 63) {
                        const b = sp * 4;
                        mst[b] = x; mst[b + 1] = y; mst[b + 2] = ang; mst[b + 3] = order;
                        sp++;
                    }
                    break;
                case POP:
                    if (sp > 0) {
                        sp--;
                        const b = sp * 4;
                        x = mst[b]; y = mst[b + 1]; ang = mst[b + 2]; order = mst[b + 3];
                    }
                    break;
                case LEFT:  ang -= turn; break;
                case RIGHT: ang += turn; break;
                default: {
                    const L = taper(order);
                    x += Math.cos(ang) * L;
                    y += Math.sin(ang) * L;
                    order++;
                    if (order > seenMax) seenMax = order;
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    break;
                }
            }
        }
        p.bh = Math.max(1e-6, maxY - minY);
        p.bxMid = (minX + maxX) * 0.5;
        p.maxOrder = Math.max(1, seenMax);
    }

    function makePlant(baseX) {
        const sp = SPECIES[(Math.random() * SPECIES.length) | 0];
        const p = {
            sp,
            ops: expand(sp),
            x: baseX !== undefined ? baseX : Math.random(),
            scale: 0.72 + Math.random() * 0.55,
            lean: (Math.random() - 0.5) * 0.22,
            phase: Math.random() * Math.PI * 2,
            born: performance.now(),
            life: LIFE_MS * (0.85 + Math.random() * 0.5),
            bh: 1, bxMid: 0, maxOrder: 1,
        };
        measure(p);
        return p;
    }

    for (let i = 0; i < PLANTS; i++) {
        const p = makePlant((i + 0.5) / PLANTS + (Math.random() - 0.5) * 0.06);
        // stagger the generation so they don't all sprout together
        p.born = performance.now() - Math.random() * p.life;
        plants.push(p);
    }

    function plant(nx) {
        const p = makePlant(nx);
        plants.push(p);
        if (plants.length > PLANTS + 6) plants.shift();
    }

    // ─── WIND ──────────────────────────────────────────────────────────────
    let gust = 0, gustTarget = 0;
    function blow(strength) { gustTarget = Math.min(2.6, strength); }

    // ─── TURTLE ────────────────────────────────────────────────────────────
    // Re-interpreted every frame so the wind is live. The stack holds
    // x, y, angle, order — length comes from the order, not the stack.
    const stack = new Float64Array(4 * 64);

    function draw(p, now, seasonIdx, blend, W, H) {
        const age = (now - p.born) / p.life;
        if (age >= 1) return false;                                // make way
        const g = age < GROW_FRAC ? age / GROW_FRAC : 1;
        const grow = g * g * (3 - 2 * g);                          // smoothstep
        const fade = age > FADE_FROM
            ? Math.max(0, 1 - (age - FADE_FROM) / (1 - FADE_FROM))
            : 1;

        const groundY = H * 0.965;
        const turn = p.sp.ang * Math.PI / 180;
        // scale the measured plant to the height it should occupy
        const unit = (H * p.sp.up * p.scale) / p.bh;
        const xoff = -p.bxMid * unit;

        // Wind: the trunk barely moves, the tips whip. The sway is added at
        // EVERY turn, so it accumulates along a path — with 80 stems between
        // root and tip, a per-stem sway has to stay tiny or the plant curls
        // into a corkscrew.
        const windPhase = now * 0.00075 + p.phase;
        const amp = (0.0045 + gust * 0.016) * WIND;

        let x = p.x * W + xoff, y = groundY;
        let ang = -Math.PI / 2 + p.lean;
        let order = 0;
        let sp = 0;

        const season = STROKES[seasonIdx];
        const seasonNext = STROKES[(seasonIdx + 1) % SEASONS.length];
        const s = SEASONS[seasonIdx];
        const sNext = SEASONS[(seasonIdx + 1) % SEASONS.length];

        // How far growth has reached, in orders
        const reach = grow * p.maxOrder;

        const ops = p.ops;
        ctx.lineCap = 'round';

        for (let i = 0; i < ops.length; i++) {
            switch (ops[i]) {
                case PUSH:
                    if (sp < 63) {
                        const b = sp * 4;
                        stack[b] = x; stack[b + 1] = y;
                        stack[b + 2] = ang; stack[b + 3] = order;
                        sp++;
                    }
                    break;
                case POP:
                    if (sp > 0) {
                        sp--;
                        const b = sp * 4;
                        x = stack[b]; y = stack[b + 1];
                        ang = stack[b + 2]; order = stack[b + 3];
                    }
                    break;
                case LEFT:  ang -= turn; break;
                case RIGHT: ang += turn; break;
                default: {
                    if (order > reach) { order++; break; }

                    // sway grows with order
                    const w = Math.sin(windPhase + order * 0.55) * amp * (order < 8 ? order : 8);
                    const a = ang + w;
                    const L = unit * taper(order);
                    const nx2 = x + Math.cos(a) * L;
                    const ny2 = y + Math.sin(a) * L;

                    const o = order / p.maxOrder;
                    const oi = Math.min(OSTEPS - 1, (o * (OSTEPS - 1)) | 0);
                    // just-grown tips are brighter — that is where the sap is
                    const edge = 1 - Math.min(1, (reach - order) * 0.8);
                    const bi = Math.min(BSTEPS - 1,
                        (((0.35 + edge * 0.65) * fade) * (BSTEPS - 1)) | 0);

                    ctx.strokeStyle = blend < 0.5 ? season[bi * OSTEPS + oi]
                                                  : seasonNext[bi * OSTEPS + oi];
                    ctx.lineWidth = Math.max(0.6,
                        (H * 0.006) * p.scale * (1 - o * 0.85) * fade + 0.35);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(nx2, ny2);
                    ctx.stroke();

                    x = nx2; y = ny2;
                    order++;
                    break;
                }
            }
        }

        // ── BLOSSOM at the tips, additive so clusters glow ──
        const bloomAmt = s.bloomAmt + (sNext.bloomAmt - s.bloomAmt) * blend;
        if (bloomAmt > 0.03 && grow > 0.45) {
            const bc = s.bloom, bn = sNext.bloom;
            const r = (bc[0] + (bn[0] - bc[0]) * blend) | 0;
            const g = (bc[1] + (bn[1] - bc[1]) * blend) | 0;
            const b = (bc[2] + (bn[2] - bc[2]) * blend) | 0;
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(${r},${g},${b},${(0.30 * bloomAmt * fade).toFixed(3)})`;

            // re-run the turtle, drawing only the outermost tips
            x = p.x * W + xoff; y = groundY;
            ang = -Math.PI / 2 + p.lean;
            order = 0; sp = 0;
            const tipR = Math.max(1.1, H * 0.007 * p.scale);

            for (let i = 0; i < ops.length; i++) {
                switch (ops[i]) {
                    case PUSH:
                        if (sp < 63) {
                            const b2 = sp * 4;
                            stack[b2] = x; stack[b2 + 1] = y;
                            stack[b2 + 2] = ang; stack[b2 + 3] = order;
                            sp++;
                        }
                        break;
                    case POP:
                        if (sp > 0) {
                            sp--;
                            const b2 = sp * 4;
                            x = stack[b2]; y = stack[b2 + 1];
                            ang = stack[b2 + 2]; order = stack[b2 + 3];
                        }
                        break;
                    case LEFT:  ang -= turn; break;
                    case RIGHT: ang += turn; break;
                    default: {
                        if (order > reach) { order++; break; }
                        const w = Math.sin(windPhase + order * 0.55) * amp * (order < 8 ? order : 8);
                        const a = ang + w;
                        const L = unit * taper(order);
                        x += Math.cos(a) * L;
                        y += Math.sin(a) * L;
                        order++;
                        // only the last couple of orders carry flowers
                        if (order > p.maxOrder - 2) {
                            ctx.beginPath();
                            ctx.arc(x, y, tipR, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;
                    }
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        return true;
    }

    // ─── FRAME ─────────────────────────────────────────────────────────────
    let raf = 0;
    let lastDraw = 0;
    const t0 = performance.now();

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (FRAME_MS && now - lastDraw < FRAME_MS) return;
        lastDraw = now;
        const W = canvas.clientWidth || window.innerWidth || 1;
        const H = canvas.clientHeight || window.innerHeight || 1;

        gust += (gustTarget - gust) * 0.05;
        gustTarget *= 0.985;

        const sPos = ((now - t0) / SEASON_MS) % SEASONS.length;
        const si = sPos | 0;
        const blend = sPos - si;
        const sk = SEASONS[si].sky, skN = SEASONS[(si + 1) % SEASONS.length].sky;
        const r = (sk[0] + (skN[0] - sk[0]) * blend) | 0;
        const g = (sk[1] + (skN[1] - sk[1]) * blend) | 0;
        const b = (sk[2] + (skN[2] - sk[2]) * blend) | 0;

        // night sky, a touch lighter at the horizon
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `rgb(${(r * 0.55) | 0},${(g * 0.55) | 0},${(b * 0.6) | 0})`);
        grad.addColorStop(0.72, `rgb(${r},${g},${b})`);
        grad.addColorStop(1, `rgb(${(r * 1.9) | 0},${(g * 1.8) | 0},${(b * 1.7) | 0})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        for (let i = plants.length - 1; i >= 0; i--) {
            if (!draw(plants[i], now, si, blend, W, H)) {
                // a plant that has finished its season is replaced by a seedling
                plants[i] = makePlant(plants[i].x + (Math.random() - 0.5) * 0.05);
            }
        }

        // soil
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, H * 0.962, W, H * 0.04);

    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        plant, blow,
        get season() {
            const sPos = ((performance.now() - t0) / SEASON_MS) % SEASONS.length;
            return SEASONS[sPos | 0].name;
        },
        get count() { return plants.length; },
    };
}
