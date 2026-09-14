// La cremallera de arte.zip — motor web (Three.js, módulo ES).
//
// MISMA REGLA Y MISMOS NÚMEROS que design/cremallera/cremallera.py (Blender):
// lo que se cambie en `REGLA` aquí hay que cambiarlo allí. Blender saca el
// modelo (.blend, .glb), las fotos del logo y los vídeos; esto es la versión
// viva para la landing y el laboratorio (/branding/lab-cremallera.html).
//
// Ejes: la cremallera va a lo largo de Y (arriba), el ancho en X, el frente
// mira a +Z (la cámara está en +Z). Es la misma orientación en la que el
// exportador glTF de Blender deja el modelo.
//
// Uso mínimo:
//   import { montar } from '/branding/cremallera.js';
//   const c = montar(document.querySelector('canvas'), { fondo: '#000', metal: 'cromo' });
//   // c.set(0..1) fija la apertura a mano; con bucle:true se abre y cierra sola.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const REGLA = {
  L: 10.2, PASO: 0.66, N: 14, E: 0.40,
  CINTA_ANCHO: 1.25, CINTA_GROSOR: 0.05, CORDON_R: 0.09,
  ANGULO: 14, SIGMA: 0.35, ROLL: 12,
  S_ARRIBA: 3.95, S_ABAJO: -3.7, S_BOCA: 0.70,
  CLAMP: { x0: -0.27, x1: 0.03, sy: 0.44, sz: 0.38, r: 0.08 },
  HEAD: { x0: -0.05, x1: 0.62, sy: 0.23, sz: 0.42, r: 0.09 },
  BLOQUE: { x0: -0.20, x1: 0.56, sy: 0.26, sz: 0.42, r: 0.10 },   // un bloque por diente, como el icono .zip de macOS
  TOPE_SUP: { x0: -0.27, x1: 0.16, sy: 0.28, sz: 0.46, r: 0.06, pos: 4.95 },
  TOPE_INF: { sx: 1.40, sy: 0.38, sz: 0.46, r: 0.06, pos: -4.96 },
  CURSOR: { alto: 1.70, ancho_arriba: 1.45, ancho_abajo: 1.20, grosor: 0.72, r: 0.10 },
  PUENTE: { sx: 0.44, sy: 0.36, sz: 0.26, pos: 0.40 },
  PIN: { r: 0.06, largo: 0.40, alt: 0.26 },
  TIRADOR: { ancho: 0.62, largo: 1.35, cabeza: 0.31, grosor: 0.09, ranura: { ancho: 0.20, y0: -0.26, y1: -0.93 }, agujero: 0.11 },
  FPS: 30, FRAMES: 120,
  MUELLE: { K: 40, C: 6, G: 1.0, MAX: 70 },
};

export const METALES = {
  cromo: { color: 0xf2f2f4, rugosidad: 0.15 },
  oro:   { color: 0xffd08a, rugosidad: 0.20 },
  cobre: { color: 0xf8ccb8, rugosidad: 0.20 },
  negro: { color: 0x3a3a3c, rugosidad: 0.30 },
};
export const TELAS = { oscura: 0x242427, clara: 0xececec };

// ---------------------------------------------------------------------------
// El movimiento
// ---------------------------------------------------------------------------
export const ease = (u) => u * u * (3 - 2 * u);

/** t ∈ [0,1) del ciclo → 0 cerrada … 1 abierta. Abre, espera, cierra, espera. */
export function avance(t) {
  if (t < 0.375) return ease(t / 0.375);
  if (t < 0.5) return 1;
  if (t < 0.875) return 1 - ease((t - 0.5) / 0.375);
  return 0;
}

const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)));
const sigmoid = (x) => (x < -30 ? 0 : x > 30 ? 1 : 1 / (1 + Math.exp(-x)));

// ---------------------------------------------------------------------------
export function montar(lienzo, opciones = {}) {
  const o = Object.assign({
    fondo: '#000000', transparente: false,
    metal: 'cromo', rugosidad: null,
    cinta: 'ninguna',       // ninguna (solo la estructura metálica, lo decidido) | tela | metal
    dientes: 'bloque',      // bloque (como el icono .zip de macOS) | real (pinza + cabeza)
    tiradorReposo: 'arriba',// arriba (como el icono) | abajo (colgando)
    topesSuperiores: false, // los dos topes de arriba: en el icono no están y asoman junto al tirador
    tela: 'auto',           // auto | oscura | clara | '#hex'
    cintaAncho: null,       // null = la de la regla
    detras: 'nada',         // nada | contraste | '#hex'  (un plano detrás, para "abrir y revelar")
    vista: 'tres_cuartos',  // tres_cuartos | frontal | plana
    orbita: true,
    bucle: true, duracion: 4, avance: 0,
    tirador: true, exposicion: 1.0, entorno: 1.0, entornoTipo: 'hdri', entornoGiro: -35,
    hdri: null,             // URL del .exr del estudio; null = ./vendor/estudio.exr junto a este módulo
    angulo: null, sigma: null, roll: null, n: null, balanceo: 1.0,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  }, opciones);

  const regla = JSON.parse(JSON.stringify(REGLA));
  const aplicarRegla = () => {
    if (o.angulo != null) regla.ANGULO = o.angulo;
    if (o.sigma != null) regla.SIGMA = o.sigma;
    if (o.roll != null) regla.ROLL = o.roll;
    if (o.n != null) regla.N = o.n;
    regla.CINTA_ANCHO = o.cintaAncho != null ? o.cintaAncho : REGLA.CINTA_ANCHO;
  };
  aplicarRegla();

  // --- separación: para un punto de la cinta a la altura y con el cursor en s
  function separacion(y, s) {
    const k = Math.tan(regla.ANGULO * Math.PI / 180), sg = regla.SIGMA;
    const t = y - (s + regla.S_BOCA);
    return {
      D: k * sg * softplus(t / sg),
      Dp: k * sigmoid(t / sg),
      roll: regla.ROLL * Math.PI / 180 * (1 - Math.exp(-Math.max(t, 0) / 2)),
    };
  }
  const _I = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3();
  /** Marco de la cinta en la altura y: I borde interior, t tangente (arriba), n hacia fuera (volcada), f normal delantera. */
  function marco(lado, y, s) {
    const { D, Dp, roll } = separacion(y, s);
    const th = Math.atan(Dp), st = Math.sin(th), ct = Math.cos(th);
    _I.set(lado * (regla.E + D), y, 0);
    _t.set(lado * st, ct, 0);
    _n.set(lado * ct, -st, 0);
    // la cinta se vuelve: el borde exterior se aleja de la cámara (−Z)
    _n.multiplyScalar(Math.cos(roll)).add(_f.set(0, 0, -Math.sin(roll)));
    _f.crossVectors(_t, _n);
    if (_f.z < 0) _f.negate();
    _f.normalize();
    return { I: _I, t: _t, n: _n, f: _f };
  }
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3();
  function matrizDiente(lado, y, s, out) {
    const { I, t, n, f } = marco(lado, y, s);
    _x.copy(n); if (lado < 0) _x.negate();
    // columnas: x → hacia el centro (izq) / hacia fuera (der); y → tangente (a lo largo
    // de la cinta, que es el alto del diente); z → normal delantera.
    out.set(
      _x.x, t.x, f.x, I.x,
      _x.y, t.y, f.y, I.y,
      _x.z, t.z, f.z, I.z,
      0, 0, 0, 1,
    );
    return out;
  }
  const posCursor = (av) => regla.S_ARRIBA + (regla.S_ABAJO - regla.S_ARRIBA) * av;

  // ---------------------------------------------------------------------------
  // Escena
  // ---------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setPixelRatio(o.pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposicion;
  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  /** Un estudio: cuarto oscuro con cajas de luz grandes. El cromo vive de los
   *  reflejos, y un entorno con contraste (luz muy blanca sobre fondo casi negro)
   *  es lo que lo hace brillar; la «sala» de three.js es más blanda. */
  function entornoEstudio() {
    const s = new THREE.Scene();
    // el cuarto: una esfera con degradado, más clara arriba que abajo
    const geo = new THREE.SphereGeometry(30, 32, 16), pos = geo.attributes.position, col = [];
    const abajo = new THREE.Color(0x0c0c0e), arriba = new THREE.Color(0x55555c), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { c.lerpColors(abajo, arriba, (pos.getY(i) / 30 + 1) / 2); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, ry, rx, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(i) }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
    };
    panel(30, 30, 0, 0, 22, Math.PI, 0, 1.7);           // pared blanca detrás de la cámara: lo que reflejan las caras planas
    panel(16, 8, -12, 10, 8, Math.PI / 4, -0.4, 10);    // caja de luz principal, arriba a la izquierda
    panel(5, 20, 14, 0, 4, -Math.PI / 2.5, 0, 6);       // tira vertical a la derecha
    panel(20, 3, 0, 14, -4, 0, Math.PI / 2, 5);         // tira alta, casi cenital
    panel(10, 3, -8, -9, 5, Math.PI / 3, 0.9, 2.5);     // rebote suave abajo
    return s;
  }
  /** hdri = el mismo estudio (CC0, Poly Haven) con el que renderiza Blender, así
   *  la web y las fotos brillan igual; estudio = cajas de luz procedurales; sala =
   *  la de three.js. El HDRI se carga aparte: mientras llega, el estudio. */
  let entornoActual = null;
  async function ponerEntorno(tipo) {
    if (entornoActual === tipo) return;
    entornoActual = tipo;
    let tex = null;
    if (tipo === 'hdri') {
      try {
        const { EXRLoader } = await import('three/addons/loaders/EXRLoader.js');
        const base = typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : null;
        const url = o.hdri || (base ? new URL('./vendor/estudio.exr', base).href : './vendor/estudio.exr');
        const exr = await new EXRLoader().loadAsync(url);
        exr.mapping = THREE.EquirectangularReflectionMapping;
        tex = pmrem.fromEquirectangular(exr).texture; exr.dispose();
      } catch (e) { console.warn('cremallera: sin HDRI, uso el estudio procedural', e); }
    }
    if (entornoActual !== tipo) return;   // cambió mientras cargaba
    if (!tex) tex = pmrem.fromScene(tipo === 'sala' ? new RoomEnvironment() : entornoEstudio(), 0.04).texture;
    if (escena.environment) escena.environment.dispose();
    escena.environment = tex;
  }
  escena.environment = pmrem.fromScene(entornoEstudio(), 0.04).texture;
  entornoActual = 'estudio';
  ponerEntorno(o.entornoTipo || 'hdri');
  if ('environmentIntensity' in escena) escena.environmentIntensity = o.entorno;

  const luzClave = new THREE.DirectionalLight(0xffffff, 2.2); luzClave.position.set(-6, 8, 10); escena.add(luzClave);
  const luzContra = new THREE.DirectionalLight(0xffffff, 1.4); luzContra.position.set(6, 4, -8); escena.add(luzContra);

  const grupo = new THREE.Group(); grupo.name = 'Cremallera'; escena.add(grupo);

  // --- materiales
  const matMetal = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.15, color: 0xffffff, envMapIntensity: 1.2 });
  const matTela = new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.85, color: 0x242427, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x777777) });
  const matDetras = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // --- geometrías
  const caja = (x0, x1, sy, sz, r) => {
    const g = new RoundedBoxGeometry(x1 - x0, sy, sz, 4, Math.min(r, (x1 - x0) / 2.2, sy / 2.2, sz / 2.2));
    g.translate((x0 + x1) / 2, 0, 0);
    return g;
  };
  function fusionar(geoms) {
    const pos = [], nor = [], uv = [], idx = []; let off = 0;
    for (const g of geoms) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count; g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  /** Diente: origen en el borde de la cinta; el diente cruza hacia el centro. */
  function geomDiente(lado) {
    const s = lado < 0 ? 1 : -1, c = regla.CLAMP, h = regla.HEAD;
    const b = (d) => { const [xa, xb] = [s * d.x0, s * d.x1].sort((p, q) => p - q); return caja(xa, xb, d.sy, d.sz, d.r); };
    if (o.dientes === 'bloque') return b(regla.BLOQUE);
    return fusionar([b(c), b(h)]);
  }
  function geomTopeSup(lado) {
    const s = lado < 0 ? 1 : -1, d = regla.TOPE_SUP;
    const [xa, xb] = [s * d.x0, s * d.x1].sort((p, q) => p - q);
    return caja(xa, xb, d.sy, d.sz, d.r);
  }
  function geomCursor() {
    const c = regla.CURSOR, bv = c.r, h = c.alto / 2;
    const wa = c.ancho_arriba / 2 - bv, wb = c.ancho_abajo / 2 - bv, ha = h - bv, r = 0.10;
    const sh = new THREE.Shape();
    // trapecio con esquinas redondeadas (ancho arriba, donde entran las cintas separadas)
    sh.moveTo(-wa + r, ha);
    sh.lineTo(wa - r, ha); sh.quadraticCurveTo(wa, ha, wa - r * 0.15, ha - r);
    sh.lineTo(wb + r * 0.15, -ha + r); sh.quadraticCurveTo(wb, -ha, wb - r, -ha);
    sh.lineTo(-wb + r, -ha); sh.quadraticCurveTo(-wb, -ha, -wb - r * 0.15, -ha + r);
    sh.lineTo(-wa + r * 0.15, ha - r); sh.quadraticCurveTo(-wa, ha, -wa + r, ha);
    const depth = c.grosor - 2 * bv;
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv - 0.002, bevelSegments: 5, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  function geomTirador() {
    const t = regla.TIRADOR, r0 = t.cabeza, w = t.ancho, L = t.largo, bv = 0.012;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r0 - bv, 0, Math.PI, false);
    sh.lineTo(-w / 2 + bv, -0.15);
    sh.lineTo(-w / 2 + bv, -L + w / 2);
    sh.absarc(0, -L + w / 2, w / 2 - bv, Math.PI, 2 * Math.PI, false);
    sh.lineTo(w / 2 - bv, -0.15);
    sh.closePath();
    const pin = new THREE.Path(); pin.absarc(0, 0, t.agujero + bv, 0, 2 * Math.PI, true); sh.holes.push(pin);
    const rw = t.ranura.ancho / 2 + bv, ya = t.ranura.y0 - t.ranura.ancho / 2, yb = t.ranura.y1 + t.ranura.ancho / 2;
    const ran = new THREE.Path();
    ran.absarc(0, ya, rw, 0, Math.PI, false); ran.lineTo(-rw, yb); ran.absarc(0, yb, rw, Math.PI, 2 * Math.PI, false); ran.lineTo(rw, ya); ran.closePath();
    sh.holes.push(ran);
    const depth = t.grosor - 2 * bv;
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv - 0.001, bevelSegments: 3, curveSegments: 16 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  // --- cinta: tira + cordón, con los vértices recalculados en cada avance
  const M = 100, ANILLO = 8, P = 4 + ANILLO;
  function geomCinta() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((M + 1) * P * 3), 3));
    const idx = [];
    for (let j = 0; j < M; j++) {
      const a = j * P, b = (j + 1) * P;
      const q = (p0, p1, p2, p3) => idx.push(p0, p1, p2, p0, p2, p3);
      q(a + 0, a + 1, b + 1, b + 0);  // delante
      q(a + 2, a + 3, b + 3, b + 2);  // detrás
      q(a + 1, a + 2, b + 2, b + 1);  // canto exterior
      for (let k = 0; k < ANILLO; k++) { const k2 = (k + 1) % ANILLO; q(a + 4 + k, a + 4 + k2, b + 4 + k2, b + 4 + k); }
    }
    g.setIndex(idx);
    return g;
  }
  const _v = new THREE.Vector3();
  function actualizarCinta(g, lado, s) {
    const arr = g.attributes.position.array;
    const L = regla.L, w = regla.CINTA_ANCHO, gr = regla.CINTA_GROSOR, rc = regla.CORDON_R;
    let i = 0;
    const put = (v) => { arr[i++] = v.x; arr[i++] = v.y; arr[i++] = v.z; };
    for (let j = 0; j <= M; j++) {
      const y = -L / 2 + L * j / M;
      const { I, n, f } = marco(lado, y, s);
      put(_v.copy(I).addScaledVector(f, gr / 2));
      put(_v.copy(I).addScaledVector(n, w).addScaledVector(f, gr / 2));
      put(_v.copy(I).addScaledVector(n, w).addScaledVector(f, -gr / 2));
      put(_v.copy(I).addScaledVector(f, -gr / 2));
      for (let k = 0; k < ANILLO; k++) {
        const a = 2 * Math.PI * k / ANILLO;
        put(_v.copy(I).addScaledVector(n, rc * Math.cos(a)).addScaledVector(f, rc * Math.sin(a)));
      }
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }

  // --- construcción (se rehace si cambia el número de dientes)
  let piezas = null;
  function construir() {
    if (piezas) { grupo.clear(); piezas.geoms.forEach((g) => g.dispose()); }
    const N = regla.N, paso = regla.PASO, y0 = -N * paso / 2 + paso / 4;
    const gI = geomDiente(-1), gD = geomDiente(+1);
    const dientesI = new THREE.InstancedMesh(gI, matMetal, N); dientesI.name = 'Dientes_I';
    const dientesD = new THREE.InstancedMesh(gD, matMetal, N); dientesD.name = 'Dientes_D';
    const alturasI = [], alturasD = [];
    for (let i = 0; i < N; i++) { alturasI.push(y0 + i * paso); alturasD.push(y0 + i * paso + paso / 2); }
    const topeI = new THREE.Mesh(geomTopeSup(-1), matMetal); topeI.name = 'TopeSup_I';
    const topeD = new THREE.Mesh(geomTopeSup(+1), matMetal); topeD.name = 'TopeSup_D';
    const ti = regla.TOPE_INF;
    const topeInf = new THREE.Mesh(new RoundedBoxGeometry(ti.sx, ti.sy, ti.sz, 4, ti.r), matMetal); topeInf.name = 'TopeInf'; topeInf.position.y = ti.pos;
    const cintaI = new THREE.Mesh(geomCinta(), matTela); cintaI.name = 'Cinta_I';
    const cintaD = new THREE.Mesh(geomCinta(), matTela); cintaD.name = 'Cinta_D';
    // cursor
    const c = regla.CURSOR, p = regla.PUENTE, pn = regla.PIN;
    const cursor = new THREE.Group(); cursor.name = 'Cursor';
    const cuerpo = new THREE.Mesh(geomCursor(), matMetal); cuerpo.name = 'Cuerpo'; cursor.add(cuerpo);
    const puente = new THREE.Mesh(new RoundedBoxGeometry(p.sx, p.sy, p.sz, 3, 0.04), matMetal); puente.name = 'Puente';
    puente.position.set(0, p.pos, c.grosor / 2 + p.sz / 2); cursor.add(puente);
    const pinG = new THREE.CylinderGeometry(pn.r, pn.r, pn.largo, 24); pinG.rotateZ(Math.PI / 2);
    const pin = new THREE.Mesh(pinG, matMetal); pin.name = 'Pin'; pin.position.set(0, p.pos, c.grosor / 2 + pn.alt); cursor.add(pin);
    // el tirador cuelga de una base en el pin: la base decide si apunta arriba
    // (como el icono) o abajo, y el tirador solo se balancea en X respecto a ella
    const tiradorBase = new THREE.Group(); tiradorBase.name = 'TiradorBase'; tiradorBase.position.copy(pin.position);
    const tirador = new THREE.Group(); tirador.name = 'Tirador';
    tirador.add(new THREE.Mesh(geomTirador(), matMetal)); tiradorBase.add(tirador); cursor.add(tiradorBase);
    // plano de detrás (revelado)
    const detras = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), matDetras); detras.name = 'Detras'; detras.position.z = -1.2; detras.visible = false;
    grupo.add(dientesI, dientesD, topeI, topeD, topeInf, cintaI, cintaD, cursor, detras);
    piezas = { dientesI, dientesD, alturasI, alturasD, topeI, topeD, topeInf, cintaI, cintaD, cursor, tirador, tiradorBase, detras, geoms: [gI, gD, cintaI.geometry, cintaD.geometry] };
    aplicarAspecto();
    set(estado.av, true);
  }

  // --- estado y pose
  const estado = { av: o.avance, s: posCursor(o.avance), v: 0, phi: 0, om: 0, tiempo: 0, pausa: !o.bucle };
  function set(av, forzar = false) {
    av = Math.max(0, Math.min(1, av));
    if (!forzar && av === estado.av) return;
    estado.av = av;
    const s = posCursor(av); estado.s = s;
    const { dientesI, dientesD, alturasI, alturasD, topeI, topeD, cintaI, cintaD, cursor } = piezas;
    for (let i = 0; i < alturasI.length; i++) { dientesI.setMatrixAt(i, matrizDiente(-1, alturasI[i], s, _m)); dientesD.setMatrixAt(i, matrizDiente(+1, alturasD[i], s, _m)); }
    dientesI.instanceMatrix.needsUpdate = true; dientesD.instanceMatrix.needsUpdate = true;
    dientesI.computeBoundingSphere(); dientesD.computeBoundingSphere();
    matrizDiente(-1, regla.TOPE_SUP.pos, s, _m); _m.decompose(topeI.position, topeI.quaternion, topeI.scale);
    matrizDiente(+1, regla.TOPE_SUP.pos, s, _m); _m.decompose(topeD.position, topeD.quaternion, topeD.scale);
    actualizarCinta(cintaI.geometry, -1, s); actualizarCinta(cintaD.geometry, +1, s);
    cursor.position.y = s;
  }

  // --- aspecto (colores, cinta, fondo, cámara)
  function luminancia(hex) { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
  function aplicarAspecto() {
    const m = METALES[o.metal] || METALES.cromo;
    matMetal.color.set(m.color); matMetal.roughness = o.rugosidad != null ? o.rugosidad : m.rugosidad;
    matMetal.envMapIntensity = 1.0;
    ponerEntorno(o.entornoTipo);
    if (escena.environmentRotation) escena.environmentRotation.set(0, (o.entornoGiro || 0) * Math.PI / 180, 0);
    renderer.toneMappingExposure = o.exposicion;
    if ('environmentIntensity' in escena) escena.environmentIntensity = o.entorno;
    // fondo
    if (o.transparente) { escena.background = null; renderer.setClearColor(0x000000, 0); }
    else { escena.background = new THREE.Color(o.fondo); renderer.setClearColor(o.fondo, 1); }
    // cinta
    const { cintaI, cintaD, detras, tirador, tiradorBase } = piezas;
    tiradorBase.rotation.z = o.tiradorReposo === 'arriba' ? Math.PI : 0;
    const oscuro = luminancia(o.fondo) < 0.18;
    let tela = o.tela === 'auto' ? (oscuro ? TELAS.oscura : TELAS.clara) : (TELAS[o.tela] != null ? TELAS[o.tela] : o.tela);
    matTela.color.set(tela);
    matTela.sheenColor.set(oscuro ? 0x777777 : 0xffffff);
    cintaI.visible = cintaD.visible = o.cinta !== 'ninguna';
    cintaI.material = cintaD.material = o.cinta === 'metal' ? matMetal : matTela;
    tirador.visible = !!o.tirador;
    piezas.topeI.visible = piezas.topeD.visible = !!o.topesSuperiores;
    // detrás
    detras.visible = o.detras !== 'nada';
    if (o.detras === 'contraste') matDetras.color.set(oscuro ? 0xffffff : 0x000000);
    else if (o.detras !== 'nada') matDetras.color.set(o.detras);
  }

  // --- cámaras
  let camara, controles = null;
  function esferica(d, az, el) {
    az *= Math.PI / 180; el *= Math.PI / 180;
    return new THREE.Vector3(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az));
  }
  async function ponerVista(vista) {
    o.vista = vista;
    if (controles) { controles.dispose(); controles = null; }
    if (vista === 'plana') { camara = new THREE.OrthographicCamera(-6.25, 6.25, 6.25, -6.25, 0.1, 200); camara.position.set(0, 0, 30); }
    else { camara = new THREE.PerspectiveCamera(24, 1, 0.1, 200); camara.position.copy(vista === 'frontal' ? esferica(30, 0, 0) : esferica(30, 24, 10)); }
    camara.lookAt(0, 0, 0);
    ajustar();
    if (o.orbita) {
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      controles = new OrbitControls(camara, lienzo); controles.enableDamping = true; controles.dampingFactor = 0.08; controles.enablePan = false;
      controles.minDistance = 8; controles.maxDistance = 80;
    }
  }
  function ajustar() {
    if (!camara) return;
    const w = lienzo.clientWidth || 800, h = lienzo.clientHeight || w;
    renderer.setSize(w, h, false);
    if (camara.isPerspectiveCamera) { camara.aspect = w / h; }
    else { const a = w / h; camara.left = -6.25 * a; camara.right = 6.25 * a; camara.top = 6.25; camara.bottom = -6.25; }
    camara.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(ajustar); ro.observe(lienzo);

  // --- el balanceo del tirador (muelle amortiguado que responde a la aceleración del cursor)
  function muelle(dt) {
    const m = regla.MUELLE, sub = 4, h = dt / sub, signo = o.tiradorReposo === 'arriba' ? 1 : -1;
    for (let k = 0; k < sub; k++) {
      const v = (estado.s - (estado.sPrev ?? estado.s)) / h; estado.sPrev = estado.s;
      const a = (v - estado.v) / h; estado.v = v;
      const acc = -m.K * estado.phi - m.C * estado.om + m.G * o.balanceo * (signo * a);
      estado.om += acc * h; estado.phi += estado.om * h;
      if (estado.phi < 0) { estado.phi = 0; estado.om = Math.max(estado.om, 0); }
      const lim = m.MAX * Math.PI / 180;
      if (estado.phi > lim) { estado.phi = lim; estado.om = Math.min(estado.om, 0); }
    }
    piezas.tirador.rotation.x = -estado.phi;
  }

  // --- bucle
  let rafId = 0, ultimo = performance.now(), vivo = true;
  function tick(dt) {
    if (!estado.pausa) { estado.tiempo += dt; set(avance((estado.tiempo / o.duracion) % 1)); }
    muelle(Math.min(dt, 0.05));
    if (controles) controles.update();
    renderer.render(escena, camara);
  }
  function bucle(ahora) {
    if (!vivo) return;
    const dt = Math.min((ahora - ultimo) / 1000, 0.1); ultimo = ahora;
    tick(dt);
    rafId = requestAnimationFrame(bucle);
  }

  // --- exportaciones
  async function fotograma(w = 2048, h = 2048, transparente = false) {
    const pr = renderer.getPixelRatio(); const cw = lienzo.clientWidth, ch = lienzo.clientHeight;
    const bg = escena.background, alfa = renderer.getClearAlpha();
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    if (camara.isPerspectiveCamera) camara.aspect = w / h; else { const a = w / h; camara.left = -6.25 * a; camara.right = 6.25 * a; }
    camara.updateProjectionMatrix();
    if (transparente) { escena.background = null; renderer.setClearColor(0x000000, 0); }
    renderer.render(escena, camara);
    const blob = await new Promise((res) => lienzo.toBlob(res, 'image/png'));
    escena.background = bg; renderer.setClearColor(o.transparente ? 0x000000 : o.fondo, o.transparente ? 0 : alfa);
    renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); ajustar();
    return blob;
  }
  async function exportarGLB() {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const g = new THREE.Group(); g.name = 'Cremallera';
    const { dientesI, dientesD, topeI, topeD, topeInf, cintaI, cintaD, cursor } = piezas;
    const m = new THREE.Matrix4();
    for (const [im, nombre] of [[dientesI, 'Diente_I'], [dientesD, 'Diente_D']]) {
      for (let i = 0; i < im.count; i++) {
        const d = new THREE.Mesh(im.geometry, matMetal); d.name = `${nombre}_${String(i).padStart(2, '0')}`;
        im.getMatrixAt(i, m); m.decompose(d.position, d.quaternion, d.scale); g.add(d);
      }
    }
    for (const src of [topeI, topeD, topeInf]) if (src.visible) { const c = src.clone(); g.add(c); }
    for (const src of [cintaI, cintaD]) if (src.visible) { const c = new THREE.Mesh(src.geometry.clone(), src.material); c.name = src.name; g.add(c); }
    g.add(cursor.clone(true));
    const bin = await new Promise((res, rej) => new GLTFExporter().parse(g, res, rej, { binary: true }));
    return new Blob([bin], { type: 'model/gltf-binary' });
  }
  /** Proyección frontal en SVG (el logo plano). `tinta` para el metal, `tela` para la cinta. */
  function svgPlano({ tinta = '#111111', tela = null, margen = 6.25 } = {}) {
    const s = estado.s, N = regla.N, out = [];
    const f2 = (x) => (Math.round(x * 1000) / 1000).toString();
    const rect = (x0, x1, sy, r) => `<rect x="${f2(x0)}" y="${f2(-sy / 2)}" width="${f2(x1 - x0)}" height="${f2(sy)}" rx="${f2(r)}"/>`;
    const polyCinta = (lado) => {
      const w = regla.CINTA_ANCHO, a = [], b = [];
      for (let j = 0; j <= 60; j++) {
        const y = -regla.L / 2 + regla.L * j / 60; const { I, n } = marco(lado, y, s);
        a.push(`${f2(I.x)},${f2(I.y)}`); b.push(`${f2(I.x + n.x * w)},${f2(I.y + n.y * w)}`);
      }
      return `<polygon points="${a.concat(b.reverse()).join(' ')}"/>`;
    };
    if (tela && o.cinta !== 'ninguna') out.push(`<g fill="${tela}">${polyCinta(-1)}${polyCinta(1)}</g>`);
    out.push(`<g fill="${tinta}">`);
    const diente = (lado, y, esTope) => {
      const { I, t } = marco(lado, y, s); const ang = Math.atan2(t.x, t.y) * -180 / Math.PI;
      const sg = lado < 0 ? 1 : -1, c = regla.CLAMP, h = regla.HEAD, tp = regla.TOPE_SUP;
      const b = (d) => { const [xa, xb] = [sg * d.x0, sg * d.x1].sort((p, q) => p - q); return rect(xa, xb, d.sy, d.r); };
      const cuerpo = esTope ? b(tp) : o.dientes === 'bloque' ? b(regla.BLOQUE) : b(c) + b(h);
      return `<g transform="translate(${f2(I.x)} ${f2(I.y)}) rotate(${f2(ang)})">${cuerpo}</g>`;
    };
    for (let i = 0; i < N; i++) { out.push(diente(-1, piezas.alturasI[i])); out.push(diente(1, piezas.alturasD[i])); }
    if (o.topesSuperiores) out.push(diente(-1, regla.TOPE_SUP.pos, true), diente(1, regla.TOPE_SUP.pos, true));
    const ti = regla.TOPE_INF; out.push(`<rect x="${f2(-ti.sx / 2)}" y="${f2(ti.pos - ti.sy / 2)}" width="${f2(ti.sx)}" height="${f2(ti.sy)}" rx="${f2(ti.r)}"/>`);
    // cursor
    const c = regla.CURSOR, wa = c.ancho_arriba / 2, wb = c.ancho_abajo / 2, ha = c.alto / 2, r = 0.10;
    out.push(`<g transform="translate(0 ${f2(s)})"><path d="M${f2(-wa + r)},${f2(ha)} L${f2(wa - r)},${f2(ha)} Q${f2(wa)},${f2(ha)} ${f2(wa)},${f2(ha - r)} L${f2(wb)},${f2(-ha + r)} Q${f2(wb)},${f2(-ha)} ${f2(wb - r)},${f2(-ha)} L${f2(-wb + r)},${f2(-ha)} Q${f2(-wb)},${f2(-ha)} ${f2(-wb)},${f2(-ha + r)} L${f2(-wa)},${f2(ha - r)} Q${f2(-wa)},${f2(ha)} ${f2(-wa + r)},${f2(ha)} Z"/>`);
    if (o.tirador) {
      const t = regla.TIRADOR, r0 = t.cabeza, w = t.ancho, L = t.largo, py = regla.PUENTE.pos, rw = t.ranura.ancho / 2;
      const ya = t.ranura.y0 - rw, yb = t.ranura.y1 + rw;
      const volteo = o.tiradorReposo === 'arriba' ? ' scale(1 -1)' : '';
      out.push(`<path fill-rule="evenodd" transform="translate(0 ${f2(py)})${volteo}" d="M${f2(r0)},0 A${f2(r0)},${f2(r0)} 0 0 1 ${f2(-r0)},0 L${f2(-w / 2)},-0.15 L${f2(-w / 2)},${f2(-L + w / 2)} A${f2(w / 2)},${f2(w / 2)} 0 0 1 ${f2(w / 2)},${f2(-L + w / 2)} L${f2(w / 2)},-0.15 Z ` +
        `M${f2(t.agujero)},0 A${f2(t.agujero)},${f2(t.agujero)} 0 1 0 ${f2(-t.agujero)},0 A${f2(t.agujero)},${f2(t.agujero)} 0 1 0 ${f2(t.agujero)},0 Z ` +
        `M${f2(rw)},${f2(ya)} A${f2(rw)},${f2(rw)} 0 0 1 ${f2(-rw)},${f2(ya)} L${f2(-rw)},${f2(yb)} A${f2(rw)},${f2(rw)} 0 0 1 ${f2(rw)},${f2(yb)} Z"/>`);
    }
    out.push('</g></g>');
    const m = margen;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${2 * m} ${2 * m}"><g transform="scale(1 -1)">${out.join('')}</g></svg>`;
  }

  // --- API (se llama `fijar` y no `opciones`: una función con el nombre del
  // parámetro lo pisaría por hoisting y `montar` ignoraría todas sus opciones)
  function fijar(parcial) {
    const estructural = ['n', 'angulo', 'sigma', 'roll', 'cintaAncho', 'dientes'].some((k) => k in parcial && parcial[k] !== o[k]);
    const rehacer = ['n', 'dientes'].some((k) => k in parcial && parcial[k] !== o[k]);
    Object.assign(o, parcial);
    aplicarRegla();
    if ('vista' in parcial || 'orbita' in parcial) ponerVista(o.vista);
    if (rehacer) construir();
    else if (estructural) set(estado.av, true);
    if ('bucle' in parcial) estado.pausa = !o.bucle;
    aplicarAspecto();
    return o;
  }
  function destruir() {
    vivo = false; cancelAnimationFrame(rafId); ro.disconnect();
    if (controles) controles.dispose();
    piezas.geoms.forEach((g) => g.dispose()); pmrem.dispose(); renderer.dispose();
  }

  construir();
  ponerVista(o.vista);
  rafId = requestAnimationFrame(bucle);

  return {
    THREE, escena, renderer, grupo, regla, estado, opciones: o,
    get camara() { return camara; },
    set, tick, ajustar,
    fijar,
    pausar(v = true) { estado.pausa = v; },
    reiniciar() { estado.tiempo = 0; set(avance(0), true); },
    fotograma, exportarGLB, svgPlano, destruir,
  };
}
