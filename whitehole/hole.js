// ════════════════════════════════════════════════════════════════════════════
// WHITEHOLE — the same Schwarzschild spacetime as /singularity, run backwards.
//
// Shared by index.html (the post) and preview.html (the card).
//
// General relativity is time-symmetric: take a black hole, reverse every
// worldline, and the result still solves the field equations exactly. That
// object is the white hole. Outside the horizon nothing changes — Birkhoff's
// theorem says the exterior curvature is identical — so every pixel here is
// still traced backwards along a null geodesic with the same one line of
// physics, a = −3/2·h²·x/|x|⁵ (rs = 1), and the photon sphere at r = 1.5,
// the Einstein ring and the critical curve at b = 3√3/2·rs all survive. A
// frozen photograph of the lensing could not tell the two apart.
//
// The difference is causal, and it lives at r = 1. A black hole's horizon can
// only be crossed inward; a white hole's only outward. So a camera ray traced
// backwards past r = 1 — the ray that painted the shadow next door — must
// here have ORIGINATED inside: the shadow develops into a source. Rays that
// stare straight down the throat (b → 0) carry the youngest light and burn
// blue-white; rays that graze the critical curve wound around the photon
// sphere first, carry the oldest, and arrive exponentially dimmed and
// redshifted — the anti-shadow dies ember-red at exactly the edge where the
// black hole keeps its photon ring. b² = |x × v|² is conserved, so each
// pixel's age is free.
//
// Run the disk backwards too and accretion becomes ejection: the same
// Keplerian annulus (orbits are time-symmetric), opposite spin, arms
// unwinding outward, a radial escape that decays as the ejecta climb —
// blue-hot where matter has just surfaced, indigo ash where it has cooled.
// Every half minute the hole sheds a faint spherical shell that the lensing
// bends like everything else.
//
// And nothing falls in. Scroll pushes the camera toward the horizon, and you
// may approach — but the crossing the black hole offers is not on the menu,
// and the piece slowly expels you back to a safe orbit. The field equations
// permit all of this; only thermodynamics objects. Entropy would have to run
// downhill, so the universe appears to have declined the option — a white
// hole is forbidden not by geometry but by probability.
// ════════════════════════════════════════════════════════════════════════════

const VS = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

function fragSrc(STEPS) {
    return `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_camPos;
uniform mat3  u_camBasis;
uniform float u_focal;

const float HORIZON = 1.0;
const float R_IN    = 2.6;
const float R_OUT   = 9.0;
const float R_ESC   = 60.0;
const float BCRIT2  = 6.75;   // (3√3/2)² — critical impact parameter squared, rs = 1
const int   MAX_STEPS = ${STEPS};

float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash31(vec3 p){
    p = fract(p*0.1031);
    p += dot(p, p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
}
float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float n000=hash31(i+vec3(0,0,0)), n100=hash31(i+vec3(1,0,0));
    float n010=hash31(i+vec3(0,1,0)), n110=hash31(i+vec3(1,1,0));
    float n001=hash31(i+vec3(0,0,1)), n101=hash31(i+vec3(1,0,1));
    float n011=hash31(i+vec3(0,1,1)), n111=hash31(i+vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
               mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }

vec3 stars(vec3 dir){
    float neb = smoothstep(0.55, 1.0, fbm(dir*3.0 + 11.0));
    // Same sky as next door, tilted cold — faint blue nebula instead of warm
    vec3 col = mix(vec3(0.011,0.012,0.016), vec3(0.026,0.040,0.066), neb) * 0.6;
    for(float s=0.0; s<3.0; s+=1.0){
        float scale = 60.0 + s*120.0;
        vec3 g = dir*scale, id = floor(g);
        float h = hash31(id + s*17.0);
        if(h > 0.86){
            vec3 fp = fract(g) - 0.5;
            float d = length(fp);
            float bright = (h-0.86)/0.14;
            float star = smoothstep(0.16, 0.0, d) * bright;
            float tw = 0.6 + 0.4*sin(u_time*1.5 + h*60.0);
            vec3 sc = mix(vec3(0.64,0.72,0.86), vec3(1.0,0.93,0.74), hash11(h*7.0));
            col += sc * star * tw * 1.4;
        }
    }
    return col;
}

vec3 diskEmission(vec3 p, vec3 photonDir, out float alpha){
    float r = length(p.xz);
    if(r < R_IN || r > R_OUT){ alpha = 0.0; return vec3(0.0); }
    float tNorm = (r - R_IN) / (R_OUT - R_IN);
    // The accretion ramp run backwards: ejecta surface blue-white at the
    // inner edge and cool to indigo ash as they climb. Mixed in linear-ish
    // light (squared space) so the blue midtones don't go chalky.
    vec3 hot  = vec3(0.92, 0.99, 1.06);
    vec3 mid  = vec3(0.22, 0.44, 0.96);
    vec3 cool = vec3(0.04, 0.07, 0.26);
    vec3 base = (tNorm < 0.5)
        ? sqrt(mix(hot*hot, mid*mid, tNorm*2.0))
        : sqrt(mix(mid*mid, cool*cool, tNorm*2.0 - 1.0));
    float bright = 1.30 * pow(1.0 - tNorm, 1.35) + 0.16;
    float ang = atan(p.z, p.x);
    // Arms unwind OUTWARD: flipped chirality, reversed spin, and the texture
    // itself drifts to larger r over time
    float swirl = ang*2.0 + 6.0/sqrt(r) - u_time*0.6;
    float tex = fbm(vec3(cos(swirl)*r*0.5, sin(swirl)*r*0.5, r*0.7 - u_time*0.45));
    tex = 0.55 + 0.85*tex;
    bright *= tex;
    // Time-reversed orbits: same Keplerian speed, opposite sense, plus a
    // slow radial escape that decays as the ejecta climb
    float M = 0.5;
    float vt = min(sqrt(M / r), 0.7);
    float vr = 0.20 * sqrt(R_IN / r);
    vec3 vmot = normalize(vec3(p.z, 0.0, -p.x)) * vt + normalize(vec3(p.x, 0.0, p.z)) * vr;
    float speed = min(length(vmot), 0.75);
    vec3 vdir = normalize(vmot);
    float cosA = dot(vdir, -normalize(photonDir));
    float gamma = 1.0 / sqrt(1.0 - speed*speed);
    float doppler = 1.0 / (gamma * (1.0 - speed*cosA));
    float beam = pow(doppler, 3.0);
    // Doppler stays cold: receding deep indigo, approaching blue-white
    vec3 shift = mix(vec3(0.10,0.13,0.40), vec3(0.94,1.02,1.08), clamp((doppler-0.6)/1.2, 0.0, 1.0));
    float edge = smoothstep(0.0, 0.10, tNorm) * smoothstep(0.0, 0.10, 1.0 - tNorm);
    // Doppler-dim gas also veils less — keeps the receding side from
    // reading as stains where it crosses in front of the core
    alpha = clamp(0.80 * edge * tex * clamp(doppler, 0.55, 1.0), 0.0, 1.0);
    return base * shift * bright * beam * edge;
}

// A thin spherical shell of matter the hole has already shed, expanding
// through the scene. Sampled along the bent ray, so it is lensed too.
void shellHit(float S, vec3 cp, inout vec3 col, inout float trans){
    float fade = smoothstep(1.2, 5.0, S) * (1.0 - smoothstep(18.0, 40.0, S));
    if(fade < 0.002) return;
    float wsp = fbm(normalize(cp)*3.0 + vec3(0.0, S*0.26, -S*0.14));
    float a = 0.10 * fade * smoothstep(0.20, 0.85, wsp);
    vec3 e = vec3(0.55, 0.74, 1.05) * (0.6 + 0.7*wsp);
    col += trans * e * a;   // pure emission — thin gas glows, it does not occlude
}

vec3 coreEmission(vec3 p, float w){
    // w = b²/b_crit² — how close this backward ray came to the critical
    // curve. w→0 stares straight down the throat: the youngest light,
    // blue-white. w→1 grazed the photon sphere: image brightness decays
    // exponentially with winding number, so age rises steeply toward the
    // rim — the edge of the anti-shadow is the deep past, dim and red.
    float age = pow(w, 2.8);
    vec3 young = vec3(1.72, 1.76, 1.90);
    vec3 gold  = vec3(1.50, 1.08, 0.52);
    vec3 old   = vec3(0.62, 0.09, 0.04);
    vec3 c = (age < 0.6) ? mix(young, gold, age/0.6) : mix(gold, old, (age - 0.6)/0.4);
    vec3 n = normalize(p);
    float boil = fbm(n*5.0 + vec3(0.0, -u_time*0.40, u_time*0.16));
    float b = mix(3.4, 0.22, age)
            * (0.70 + 0.55*boil)
            * (0.92 + 0.12*sin(u_time*0.55 + 6.28*boil));
    return c * b;
}

vec3 tonemap(vec3 x){
    x *= 0.9;
    return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0);
}

void main(){
    // Normalise by the SMALLER screen dimension so the hole stays centred and
    // correctly sized on any aspect ratio — crucial for tall phone screens.
    float m = min(u_res.x, u_res.y);
    vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / m;

    vec3 pos = u_camPos;
    vec3 vel = normalize(u_camBasis * vec3(uv, u_focal));
    vec3 h = cross(pos, vel);
    float h2 = dot(h, h);          // = b², conserved along the geodesic

    float shellA = 1.0 + mod(u_time*1.35, 44.0);
    float shellB = 1.0 + mod(u_time*1.35 + 22.0, 44.0);

    vec3 col = vec3(0.0);
    float trans = 1.0;
    vec3 prevPos = pos;

    for(int i=0; i<MAX_STEPS; i++){
        float r = length(pos);
        // Step grows fast far from the hole (so a far camera still reaches it
        // within the step budget) and stays fine near it for an accurate ring.
        float dt = clamp(0.03 * (r - HORIZON) + 0.010, 0.012, 1.2);

        prevPos = pos;
        vec3 acc = -1.5 * h2 * pos / pow(dot(pos,pos), 2.5);
        vec3 newPos = pos + vel*dt + 0.5*acc*dt*dt;
        vel += acc*dt;
        pos = newPos;

        if(prevPos.y * pos.y < 0.0){
            float t = prevPos.y / (prevPos.y - pos.y);
            vec3 cp = mix(prevPos, pos, t);
            float a;
            vec3 e = diskEmission(cp, vel, a);
            if(a > 0.0){ col += trans * e; trans *= (1.0 - a); }
        }

        float rr = length(pos);

        if((r - shellA)*(rr - shellA) < 0.0)
            shellHit(shellA, mix(prevPos, pos, (r - shellA)/(r - rr)), col, trans);
        if((r - shellB)*(rr - shellB) < 0.0)
            shellHit(shellB, mix(prevPos, pos, (r - shellB)/(r - rr)), col, trans);

        if(rr < HORIZON){
            // Backwards past the anti-horizon: this ray began inside. The
            // pixel that was the shadow next door is the source here.
            col += trans * coreEmission(pos, clamp(h2 / BCRIT2, 0.0, 1.0));
            trans = 0.0;
            break;
        }
        if(trans < 0.02){ break; }
        // Only escape once the photon is heading OUTWARD — otherwise a camera
        // that starts beyond R_ESC (zoomed far out) would escape instantly.
        if(rr > R_ESC && dot(pos, vel) > 0.0){ break; }
    }

    // A ray still wound up near the photon sphere when the step budget ran
    // out must have originated inside — resolve it as core, not sky. Without
    // this the card, whose budget is smaller, punches a starfield moat into
    // the anti-shadow.
    if(trans > 0.02 && length(pos) < 4.0){
        col += trans * coreEmission(pos, clamp(h2 / BCRIT2, 0.0, 1.0));
        trans = 0.0;
    }

    // Any remaining transmittance shows the background sky — covers escaped
    // rays and rays that ran out of steps far from the hole.
    col += trans * stars(normalize(vel));

    col = tonemap(col);
    float v = 1.0 - 0.25*dot(uv, uv);
    col *= v;
    gl_FragColor = vec4(col, 1.0);
}
`;
}

export function createHole(canvas, opts = {}) {

    // Card budget: cap the paint rate, not the physics — everything in the
    // shader runs off u_time, so a 15fps card shows the same moment a 60fps
    // post would. 0 means "every animation frame".
    const FRAME_MS = opts.fps ? 1000 / opts.fps : 0;
    const SCALE = opts.scale ?? 0.85;
    const FOCAL = opts.focal ?? 1.5;
    const SPIN  = opts.spin  ?? 0.0004;
    const STEPS = opts.steps ?? 340;

    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false })
            || canvas.getContext('webgl',  { antialias: false })
            || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s));
        }
        return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc(STEPS)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {
        res:   gl.getUniformLocation(prog, 'u_res'),
        time:  gl.getUniformLocation(prog, 'u_time'),
        cam:   gl.getUniformLocation(prog, 'u_camPos'),
        basis: gl.getUniformLocation(prog, 'u_camBasis'),
        focal: gl.getUniformLocation(prog, 'u_focal'),
    };

    // An iframe can report width 0 at parse time — never trust one signal,
    // never bake the 0 in. Fall back and re-measure on resize.
    function fit() {
        const w = window.innerWidth || canvas.clientWidth || 1;
        const h = window.innerHeight || canvas.clientHeight || 1;
        canvas.width  = Math.max(1, Math.round(w * SCALE));
        canvas.height = Math.max(1, Math.round(h * SCALE));
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', fit);
    fit();

    // ─── CAMERA ────────────────────────────────────────────────────────────
    let az   = opts.az   ?? 0.6;
    let el   = opts.el   ?? 0.16;
    let dist = opts.dist ?? 15.0;
    let vAz = SPIN, vEl = 0;
    let dragging = false, lastX = 0, lastY = 0, pinchD = 0;

    const MIN_D = 5.0, MAX_D = 52.0;
    // The one place the piece disagrees with your hand: below PUSH_D the
    // camera is slowly expelled back out. Nothing gets to fall in here.
    const PUSH_D = 10.0;

    if (opts.interactive !== false) {
        canvas.addEventListener('pointerdown', e => {
            if (e.target.closest('.back')) return;
            dragging = true; lastX = e.clientX; lastY = e.clientY;
            vAz = 0; vEl = 0;
            canvas.setPointerCapture?.(e.pointerId);
        });
        canvas.addEventListener('pointermove', e => {
            if (!dragging || pinchD) return;
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            az -= dx * 0.005;
            el = Math.max(-1.45, Math.min(1.45, el + dy * 0.005));
            vAz = -dx * 0.0004; vEl = dy * 0.0004;
        });
        canvas.addEventListener('pointerup',     () => { dragging = false; });
        canvas.addEventListener('pointercancel', () => { dragging = false; });

        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            dist = Math.max(MIN_D, Math.min(MAX_D, dist * Math.exp(e.deltaY * 0.0011)));
        }, { passive: false });

        canvas.addEventListener('touchmove', e => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const d = Math.hypot(dx, dy);
                if (pinchD) dist = Math.max(MIN_D, Math.min(MAX_D, dist * pinchD / d));
                pinchD = d; e.preventDefault();
            }
        }, { passive: false });
        canvas.addEventListener('touchend', () => { pinchD = 0; });
    }

    // ─── RENDER LOOP ───────────────────────────────────────────────────────
    const t0 = performance.now();
    let raf = 0, lastDraw = 0;

    function cross(a, b){ return [ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ]; }
    function norm(a){ const l = Math.hypot(a[0], a[1], a[2]) || 1; return [ a[0]/l, a[1]/l, a[2]/l ]; }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (FRAME_MS && now - lastDraw < FRAME_MS) return;
        lastDraw = now;

        if (!dragging) {
            az += vAz;
            el = Math.max(-1.45, Math.min(1.45, el + vEl));
            vAz += (SPIN - vAz) * 0.01;
            vEl *= 0.96;
            if (!pinchD && dist < PUSH_D) dist += (PUSH_D - dist) * 0.005;
        }

        const ce = Math.cos(el), se = Math.sin(el);
        const ca = Math.cos(az), sa = Math.sin(az);
        const camPos = [ dist*ce*ca, dist*se, dist*ce*sa ];

        const fwd = norm([ -camPos[0], -camPos[1], -camPos[2] ]);
        let right = norm(cross(fwd, [0,1,0]));
        if (!isFinite(right[0])) right = [1,0,0];
        const up = cross(right, fwd);

        gl.uniform2f(U.res, canvas.width, canvas.height);
        gl.uniform1f(U.time, (now - t0) * 0.001);
        gl.uniform3f(U.cam, camPos[0], camPos[1], camPos[2]);
        gl.uniformMatrix3fv(U.basis, false, [
            right[0], right[1], right[2],
            up[0],    up[1],    up[2],
            fwd[0],   fwd[1],   fwd[2],
        ]);
        gl.uniform1f(U.focal, FOCAL);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
    };
}
