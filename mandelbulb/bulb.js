// ════════════════════════════════════════════════════════════════════════════
// MANDELBULB — the Mandelbrot set, in three dimensions.
//
// Shared by index.html (the post) and preview.html (the card).
//
// The Mandelbrot set needs squaring a number to make sense, so for decades
// there was no 3D version: nobody knew how to multiply points in space. In 2009
// Daniel White and Paul Nylander tried it anyway, by defining the "square" of a
// 3D point as doubling its two spherical angles and squaring its radius — and
// with the exponent pushed to 8, out came this.
//
// It cannot be plotted, only walked up to. There is no equation for its surface,
// so instead a ray is fired at it and asked, over and over, "how far can I move
// without hitting anything?" That answer is the DISTANCE ESTIMATOR, derived
// from how fast the iteration's derivative is blowing up, and marching along it
// is what draws the picture. Every pixel is a separate walk, which is why this
// wants a GPU and renders at reduced resolution upscaled.
//
// The exponent is not fixed. It drifts between 4 and 12, and the whole solid
// reorganises as it goes: lobes split, the surface turns to lace, and it packs
// back into a bulb. Nothing about the shape is authored.
//
// Colour comes from the ORBIT TRAP — how close the iteration passed to the
// origin before escaping — which is what puts those bands and whorls on the
// surface instead of a flat plastic shell. Anchors are converted to linear
// light in JS, mixed in linear light in the shader, and encoded on the way out.
// ════════════════════════════════════════════════════════════════════════════

export const PALETTES = [
    { name: 'BRASS',   anchors: [[14, 8, 6], [92, 40, 16], [190, 110, 34], [242, 186, 92], [255, 240, 206]] },
    { name: 'ABALONE', anchors: [[8, 14, 26], [24, 70, 110], [46, 152, 156], [156, 214, 190], [244, 250, 238]] },
    { name: 'VIOLET',  anchors: [[12, 6, 22], [58, 20, 84], [126, 46, 158], [206, 112, 200], [246, 214, 246]] },
    { name: 'BONE',    anchors: [[12, 12, 14], [56, 54, 52], [124, 120, 114], [198, 192, 182], [252, 250, 246]] },
    { name: 'VERDANT', anchors: [[6, 16, 10], [22, 68, 34], [70, 138, 52], [156, 200, 96], [238, 250, 210]] },
];

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uPower;
uniform vec3  uRo;          // camera position
uniform mat3  uCam;         // camera basis
uniform vec3  uPal[5];      // palette anchors, LINEAR light
uniform float uFov;

#define ITERS 10
#define MAX_STEPS 92
#define FAR 7.0

// Distance estimator for the Mandelbulb, plus the orbit trap.
float de(vec3 pos, float power, out float trap) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    trap = 1e9;
    for (int i = 0; i < ITERS; i++) {
        r = length(z);
        if (r > 2.0) break;
        trap = min(trap, r);
        float theta = acos(clamp(z.z / r, -1.0, 1.0));
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        float zr = pow(r, power);
        theta *= power;
        phi *= power;
        z = zr * vec3(sin(theta) * cos(phi),
                      sin(theta) * sin(phi),
                      cos(theta)) + pos;
    }
    return 0.5 * log(max(r, 1e-6)) * r / dr;
}

vec3 normalAt(vec3 p, float power) {
    float e = 0.0012;
    float t;
    vec2 k = vec2(1.0, -1.0) * e;
    float dx = de(p + vec3(k.x, 0.0, 0.0), power, t) - de(p + vec3(k.y, 0.0, 0.0), power, t);
    float dy = de(p + vec3(0.0, k.x, 0.0), power, t) - de(p + vec3(0.0, k.y, 0.0), power, t);
    float dz = de(p + vec3(0.0, 0.0, k.x), power, t) - de(p + vec3(0.0, 0.0, k.y), power, t);
    return normalize(vec3(dx, dy, dz));
}

vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 4.0;
    float i = floor(t);
    float f = t - i;
    f = f * f * (3.0 - 2.0 * f);
    if (i < 1.0) return mix(uPal[0], uPal[1], f);
    if (i < 2.0) return mix(uPal[1], uPal[2], f);
    if (i < 3.0) return mix(uPal[2], uPal[3], f);
    return mix(uPal[3], uPal[4], f);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 rd = normalize(uCam * vec3(uv * uFov, 1.0));
    vec3 ro = uRo;

    float t = 0.0;
    float trap = 1.0, tr = 1.0;
    bool hit = false;
    float steps = 0.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = de(p, uPower, tr);
        if (d < 0.0007 * t + 0.00025) { hit = true; trap = tr; break; }
        t += d * 0.86;                       // understep: the DE is a bound
        steps += 1.0;
        if (t > FAR) break;
    }

    vec3 col;
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = normalAt(p, uPower);

        // cheap ambient occlusion: a ray that needed many small steps to
        // arrive was crawling through a crevice
        float ao = clamp(1.0 - steps / float(MAX_STEPS) * 1.6, 0.06, 1.0);

        vec3 key = normalize(vec3(0.62, 0.74, -0.34));
        vec3 fill = normalize(vec3(-0.5, 0.2, -0.8));
        float d1 = max(dot(n, key), 0.0);
        float d2 = max(dot(n, fill), 0.0) * 0.34;

        vec3 h = normalize(key - rd);
        float spec = pow(max(dot(n, h), 0.0), 34.0) * 0.65;

        // Spread the trap across more of the ramp — the raw range is narrow and
        // squeezes the whole surface onto the two lightest anchors.
        vec3 base = ramp(pow(clamp(trap * 2.1, 0.0, 1.0), 0.5));
        col = base * (0.10 + d1 * 1.05 + d2) * ao + vec3(spec) * ao;

        // haze with depth so the far side reads as further away
        float fog = 1.0 - exp(-max(t - 1.2, 0.0) * 0.42);
        col = mix(col, uPal[0] * 1.4, fog * 0.7);
    } else {
        // a soft studio background, brighter behind the subject
        float v = 1.0 - length(uv) * 0.62;
        col = uPal[0] * (0.35 + max(v, 0.0) * 1.25);
    }

    gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}
`;

function s2l(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function createBulb(canvas, opts = {}) {
    // Ray marching a fractal is expensive per pixel, so the backing store is
    // deliberately smaller than the element and upscaled by the compositor.
    const SCALE = opts.scale ?? 0.55;
    const SPIN  = opts.spin ?? 1.0;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
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
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes   = gl.getUniformLocation(prog, 'uRes');
    const uPower = gl.getUniformLocation(prog, 'uPower');
    const uRo    = gl.getUniformLocation(prog, 'uRo');
    const uCam   = gl.getUniformLocation(prog, 'uCam');
    const uFov   = gl.getUniformLocation(prog, 'uFov');
    const uPal   = gl.getUniformLocation(prog, 'uPal');

    let pal = PALETTES[0];
    function pushPalette() {
        const a = pal.anchors;
        const flat = new Float32Array(15);
        for (let i = 0; i < 5; i++) {
            flat[i * 3]     = s2l(a[i][0]);
            flat[i * 3 + 1] = s2l(a[i][1]);
            flat[i * 3 + 2] = s2l(a[i][2]);
        }
        gl.uniform3fv(uPal, flat);
    }
    pushPalette();

    function fit() {
        const w = window.innerWidth || canvas.clientWidth || 1;
        const h = window.innerHeight || canvas.clientHeight || 1;
        canvas.width = Math.max(1, Math.round(w * SCALE));
        canvas.height = Math.max(1, Math.round(h * SCALE));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    window.addEventListener('resize', fit);
    fit();

    // ─── CAMERA ────────────────────────────────────────────────────────────
    let yaw = 0.6, pitch = 0.22, dist = 2.55;
    let yawV = 0, pitchV = 0;
    let dragging = false, lastX = 0, lastY = 0;

    function down(e) {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        canvas.setPointerCapture?.(e.pointerId);
    }
    function move(e) {
        if (!dragging) return;
        yawV -= (e.clientX - lastX) * 0.00055;
        pitchV += (e.clientY - lastY) * 0.00045;
        lastX = e.clientX; lastY = e.clientY;
    }
    function up() { dragging = false; }

    if (opts.interactive !== false) {
        canvas.addEventListener('pointerdown', down, { passive: true });
        canvas.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerup', up, { passive: true });
    }

    const cam = new Float32Array(9);
    let raf = 0;
    const t0 = performance.now();

    function frame(now) {
        const t = (now - t0) * 0.001;

        // hand momentum, then back to a slow drift
        yaw += yawV; pitch += pitchV;
        yawV *= 0.94; pitchV *= 0.94;
        if (!dragging) yaw += 0.0013 * SPIN;
        pitch = Math.max(-1.2, Math.min(1.2, pitch));

        // the exponent drifts, and the whole solid reorganises with it
        const power = 8.0 + Math.sin(t * 0.055) * 4.0;
        gl.uniform1f(uPower, power);

        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const ro = [dist * cp * sy, dist * sp, dist * cp * cy];

        // look at the origin: build an orthonormal basis
        const fx = -ro[0], fy = -ro[1], fz = -ro[2];
        const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
        const f = [fx / fl, fy / fl, fz / fl];
        // right = normalize(cross([0,1,0], f)) = normalize(f.z, 0, -f.x)
        let rx = f[2], ry = 0, rz = -f[0];
        const rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
        rx /= rl; ry /= rl; rz /= rl;
        // up = cross(f, right)
        const ux = f[1] * rz - f[2] * ry;
        const uy = f[2] * rx - f[0] * rz;
        const uz = f[0] * ry - f[1] * rx;

        // column-major mat3: [right, up, forward]
        cam[0] = rx; cam[1] = ry; cam[2] = rz;
        cam[3] = ux; cam[4] = uy; cam[5] = uz;
        cam[6] = f[0]; cam[7] = f[1]; cam[8] = f[2];

        gl.uniform3f(uRo, ro[0], ro[1], ro[2]);
        gl.uniformMatrix3fv(uCam, false, cam);
        gl.uniform1f(uFov, 1.15);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(frame);
    }

    return {
        start() { if (!raf) raf = requestAnimationFrame(frame); },
        stop()  { cancelAnimationFrame(raf); raf = 0; },
        setPalette(name) {
            const p = PALETTES.find(p => p.name === name);
            if (p) { pal = p; pushPalette(); }
            return pal.name;
        },
        randomPalette() {
            pal = PALETTES[(Math.random() * PALETTES.length) | 0];
            pushPalette();
            return pal.name;
        },
        get palette() { return pal.name; },
        get power() { return 8.0 + Math.sin((performance.now() - t0) * 0.001 * 0.055) * 4.0; },
    };
}
