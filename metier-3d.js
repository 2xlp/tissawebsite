/* TissaWeb — une vraie petite histoire en 3D pour chaque métier.
   Chargé seulement au clic sur « Voir mon site se construire en 3D » (essai-3d.js).
   play(host, metier, nom, { chapter(i), end() }) -> { chapters, dur, stop(), skip() } */
import * as THREE from './vendor/three/three.module.min.js';

/* ---------- outils ---------- */
const PI = Math.PI;
const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const k = (t, a, b) => cl((t - a) / (b - a));
const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x) => 1 - Math.pow(1 - x, 3);
const inq = (x) => x * x;
const back = (x) => { const c1 = 1.70158, c3 = c1 + 1; return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const bounce = (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
const lerp = (a, b, x) => a + (b - a) * x;
const rnd = (a, b) => a + Math.random() * (b - a);
const col = (h) => new THREE.Color(h);

function std(color, r = 0.6, m = 0, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: r, metalness: m }, o)); }
function phys(o) { return new THREE.MeshPhysicalMaterial(o); }
function mesh(g, m, cast = true) { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; }
function bumpify(g, amt, f = 1) {
  const p = g.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); n.copy(v).normalize();
    const o = amt * (Math.sin(v.x * 13 * f + 1.3) * Math.sin(v.y * 11 * f + 0.7) * Math.sin(v.z * 9 * f + 2.1) + 0.5 * Math.sin(v.x * 29 * f + v.z * 17 * f));
    v.addScaledVector(n, o); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const woodTex = (base, dark) => canvasTex(1024, 512, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    x.strokeStyle = dark; x.globalAlpha = rnd(0.05, 0.22); x.lineWidth = rnd(1, 4);
    const y0 = rnd(0, h); x.beginPath(); x.moveTo(0, y0);
    for (let s = 0; s <= w; s += 64) x.lineTo(s, y0 + Math.sin(s / rnd(80, 200) + i) * rnd(2, 10));
    x.stroke();
  }
  x.globalAlpha = 1;
});
const tileTex = (base, grout, n) => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = grout; x.fillRect(0, 0, w, h); const s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = base; x.globalAlpha = 1; x.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
    x.fillStyle = '#fff'; x.globalAlpha = rnd(0.02, 0.07); x.fillRect(i * s + 3, j * s + 3, s - 6, (s - 6) / 2);
  }
  x.globalAlpha = 1;
}, [2, 2]);
const marbleTex = () => canvasTex(1024, 512, (x, w, h) => {
  x.fillStyle = '#F3EEEA'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = i % 3 ? '#C9C0BA' : '#B8A9A2'; x.globalAlpha = rnd(0.15, 0.45); x.lineWidth = rnd(0.6, 2.4);
    let px = rnd(0, w), py = rnd(0, h); x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 14; s++) { px += rnd(10, 70); py += rnd(-40, 40); x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1;
});
function fit(x, txt, max, font) { let s = max; do { x.font = font.replace('#', s); s -= 2; } while (x.measureText(txt).width > x.canvas.width * 0.84 && s > 10); }
function radialTex() {
  return canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
}
function envMap(R) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x262626, side: THREE.BackSide })));
  const panel = (w, h, p, r, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide })); m.position.set(p[0], p[1], p[2]); m.rotation.set(r[0], r[1], 0); s.add(m); };
  panel(9, 5, [0, 4.9, 0], [PI / 2, 0], 6);
  panel(5, 6, [-9.9, 1.5, 0], [0, PI / 2], 3);
  panel(4, 6, [9.9, 1.5, 3], [0, -PI / 2], 2);
  panel(8, 3, [0, 1, -9.9], [0, 0], 1.4);
  const pm = new THREE.PMREMGenerator(R), t = pm.fromScene(s, 0.04).texture; pm.dispose(); return t;
}
/* petites pièces qui tombent (farine, cheveux, gouttes, poussière…) */
function bits(scene, geo, mat, n, o = {}) {
  const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = !!o.shadow; im.frustumCulled = false; scene.add(im);
  const P = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler(); let ix = 0;
  for (let i = 0; i < n; i++) { P.push({ life: 0, age: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 }); m.makeScale(0, 0, 0); im.setMatrixAt(i, m); }
  return {
    spawn(p, v, life, s) { const b = P[ix]; ix = (ix + 1) % n; b.p.copy(p); b.v.copy(v); b.life = life; b.age = 0; b.s = s || 1; b.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); b.w.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); },
    update(dt) {
      const g = o.g == null ? -9.8 : o.g, fl = o.floor || 0;
      for (let i = 0; i < n; i++) {
        const b = P[i];
        if (b.life <= 0) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); continue; }
        b.age += dt; b.life -= dt; b.v.y += g * dt; if (o.drag) b.v.multiplyScalar(1 - o.drag * dt);
        b.p.addScaledVector(b.v, dt);
        const f = typeof fl === 'function' ? fl(b.p) : fl;
        if (b.p.y < f) { b.p.y = f; b.v.y *= -0.2; b.v.x *= 0.5; b.v.z *= 0.5; b.w.multiplyScalar(0.3); }
        b.r.addScaledVector(b.w, dt); e.set(b.r.x, b.r.y, b.r.z); q.setFromEuler(e);
        const fade = o.fade ? Math.min(1, b.life / o.fade) : 1, grow = o.grow ? Math.min(1, b.age / o.grow) : 1;
        sc.setScalar(b.s * fade * grow); if (o.flat && b.p.y <= f + 0.001) sc.y *= 0.35;
        m.compose(b.p, q, sc); im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  };
}
function steam(scene, n, at) {
  const tex = radialTex(), S = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); S.push({ s, ph: i / n, x: rnd(-at.w, at.w), z: rnd(-at.d, at.d) }); }
  return {
    update(t, on) {
      S.forEach((o) => {
        const c = (t * 0.32 + o.ph) % 1;
        o.s.position.set(at.x + o.x * (0.6 + c) + Math.sin(t * 1.4 + o.ph * 9) * 0.14 * c, at.y + c * 1.7, at.z + o.z);
        const sc = 0.35 + c * 1.0; o.s.scale.set(sc, sc, 1); o.s.material.opacity = on * 0.2 * Math.sin(c * PI);
      });
    }
  };
}
function fallY(t, a, b, from, to, f = bounce) { return lerp(from, to, f(k(t, a, b))); }

/* ---------- les histoires ---------- */
const STORIES = {

  /* BOULANGERIE : la pâte tombe, on l'étale, elle s'enroule en croissant, passe au four et sort dorée */
  boulangerie: {
    rim: 0xffc47a, dur: 11.4,
    chapters: [
      { s: 0, cap: 'La pâte', p: 'Tout part d’une bonne base : votre nom, votre adresse.' },
      { s: 2.2, cap: 'Le façonnage', p: 'On le façonne à votre image : vos produits, vos horaires.' },
      { s: 4.9, cap: 'Au four', p: 'On le teste et on le peaufine : rapide, clair, parfait sur téléphone.' },
      { s: 8.3, cap: 'Doré, prêt à vendre', p: 'En ligne en 7 jours. Il n’y a plus qu’à le montrer.' }
    ],
    cam: [[0, 0.5, 0.62, 6.6, 0.4], [2.2, 0.22, 0.78, 6.1, 0.3], [4.6, -0.25, 0.62, 5.5, 0.35], [6.0, 0, 0.2, 5.6, 0.75], [8.3, 0.05, 0.24, 5.6, 0.6], [11.4, 0.6, 0.42, 5.0, 0.55]],
    build(x) {
      const { scene } = x, top = 0.16;
      const board = mesh(new THREE.BoxGeometry(5, 0.16, 3.6), std('#FFFFFF', 0.7, 0, { map: woodTex('#8A5A33', '#4A2A14') })); board.position.y = 0.08; scene.add(board);
      // farine sur la planche
      const flour = mesh(new THREE.CircleGeometry(1.4, 48), std('#F7F1E6', 1, 0, { transparent: true, opacity: 0 }), false); flour.rotation.x = -PI / 2; flour.position.y = top + 0.003; flour.scale.set(1, 0.75, 1); scene.add(flour);
      const puff = bits(scene, new THREE.SphereGeometry(0.025, 6, 4), std('#FFFFFF', 1), 120, { g: -1.2, drag: 2.5, fade: 0.8, floor: top });
      // la pâte
      const doughM = phys({ color: '#EBD6AC', roughness: 0.9, sheen: 1, sheenRoughness: 0.7, sheenColor: col('#FFFFFF') });
      const dough = mesh(bumpify(new THREE.SphereGeometry(0.62, 64, 48), 0.03), doughM); scene.add(dough);
      // rouleau à pâtisserie
      const pin = new THREE.Group(); scene.add(pin);
      const rod = mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.7, 48), std('#D7AE78', 0.55, 0, { map: woodTex('#D8B07C', '#A77A48') })); rod.rotation.z = PI / 2; pin.add(rod);
      [-1, 1].forEach((sd) => { const h = mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.55, 24), std('#8E5E33', 0.45)); h.rotation.z = PI / 2; h.position.x = sd * 1.62; pin.add(h); });
      // le croissant : 7 boudins le long d'un arc
      const cro = new THREE.Group(); cro.position.set(0, top, -0.15); scene.add(cro);
      const lobes = [], N = 7, R0 = 0.8;
      for (let i = 0; i < N; i++) {
        const u = (i / (N - 1)) * 2 - 1, d = Math.abs(u), a = u * 1.3, r = 0.1 + 0.34 * (1 - Math.pow(d, 1.25));
        const m = phys({ color: '#F0E2C4', roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0.35, sheen: 0.5, sheenColor: col('#FFF0D0') });
        const l = mesh(bumpify(new THREE.SphereGeometry(1, 48, 32), 0.03, 0.6), m);
        l.position.set(Math.sin(a) * R0, r * 0.8 - (d > 0.7 ? (d - 0.7) * 0.25 : 0), Math.cos(a) * R0 - 0.45);
        l.rotation.set(0, a, d > 0.6 ? -u * 0.25 : 0);
        l.userData = { d, s: new THREE.Vector3(0.21 + 0.06 * (1 - d), r * 0.8, r) };
        l.scale.setScalar(0.0001); cro.add(l); lobes.push(l);
      }
      // four à pain (dôme ouvert vers la caméra)
      const oven = new THREE.Group(); scene.add(oven);
      const brick = canvasTex(1024, 512, (c, w, h) => {
        c.fillStyle = '#5A2A1A'; c.fillRect(0, 0, w, h);
        const bw = 96, bh = 40;
        for (let yy = 0; yy < h; yy += bh) for (let xx = -bw; xx < w; xx += bw) {
          const o = (yy / bh) % 2 ? bw / 2 : 0;
          c.fillStyle = ['#A9543A', '#9A4A31', '#B5603F', '#8F4029'][Math.floor(Math.random() * 4)]; c.fillRect(xx + o + 3, yy + 3, bw - 6, bh - 6);
        }
      }, [3, 1]);
      const domeG = new THREE.SphereGeometry(1.55, 72, 32, PI / 2 + 0.62, 2 * PI - 1.24, 0, PI / 2);
      const dome = mesh(domeG, std('#FFFFFF', 0.85, 0, { map: brick, side: THREE.DoubleSide })); oven.add(dome);
      const arch = mesh(new THREE.TorusGeometry(1.55, 0.09, 16, 64, PI), std('#7E3A26', 0.8)); arch.rotation.y = PI / 2; arch.scale.set(1, 1, 1); oven.add(arch);
      arch.visible = false;
      const fire = new THREE.PointLight('#FF7A2A', 0, 6, 1.6); fire.position.set(0, 0.7, -0.4); oven.add(fire);
      const embers = mesh(new THREE.CircleGeometry(1.45, 48), std('#2A120A', 1, 0, { emissive: col('#FF5A14'), emissiveIntensity: 0 }), false); embers.rotation.x = -PI / 2; embers.position.y = 0.004; oven.add(embers);
      const st = steam(scene, 14, { x: 0, y: top + 0.55, z: -0.15, w: 0.5, d: 0.3 });
      const pale = col('#EBD6AC'), gold = col('#B4621C'), deep = col('#73360D'), tmp = new THREE.Color();
      let puffed = false;
      return {
        update(t, dt) {
          // 1. la pâte tombe
          const land = 0.95, y0 = 0.62 * 0.92;
          let dy = t < land ? lerp(4, top + y0, inq(k(t, 0.15, land))) : top + y0;
          const sq = t > land ? Math.exp(-(t - land) * 5) * Math.sin((t - land) * 22) * 0.22 : 0;
          if (!puffed && t >= land) { puffed = true; for (let i = 0; i < 90; i++) { const a = rnd(0, 2 * PI), v = rnd(0.6, 1.8); puff.spawn(new THREE.Vector3(Math.cos(a) * 0.55, top + 0.05, Math.sin(a) * 0.55), new THREE.Vector3(Math.cos(a) * v, rnd(0.4, 1.4), Math.sin(a) * v), rnd(0.8, 1.6), rnd(0.6, 1.3)); } }
          flour.material.opacity = 0.85 * k(t, land, land + 0.4);
          // 2. le rouleau étale
          const f = io(k(t, 2.5, 3.6));
          dough.scale.set(1 + 1.25 * f - sq * 0.6, (1 - 0.8 * f) * 0.92 + sq, 1 + 0.85 * f - sq * 0.6);
          dough.position.y = top + 0.62 * dough.scale.y;
          const pz = lerp(-2.3, 2.1, io(k(t, 2.35, 3.6)));
          const py = top + 0.16 + 1.24 * dough.scale.y * (pz > 0.9 ? 0.5 : 1) * 0.9;
          pin.position.set(0, t < 2.25 ? 6 : lerp(py, 4, inq(k(t, 3.6, 4.1))), t < 3.6 ? pz : lerp(2.1, 3.5, k(t, 3.6, 4.1)));
          pin.rotation.x = -pin.position.z / 0.16;
          // 3. on enroule : la feuille disparaît, le croissant pousse depuis le centre
          const g = k(t, 3.75, 4.7); dough.visible = g < 1;
          if (g > 0) dough.scale.multiplyScalar(1 - io(g));
          lobes.forEach((l) => {
            const s = back(k(t, 3.85 + l.userData.d * 0.7, 4.35 + l.userData.d * 0.7)) * lerp(1, 1.12, io(k(t, 5.7, 7.6)));
            l.scale.copy(l.userData.s).multiplyScalar(Math.max(0.0001, s));
            // cuisson : du pâle au doré, plus foncé sur les pointes
            const c = io(k(t, 5.7, 7.7)); tmp.copy(gold).lerp(deep, l.userData.d * 0.75); l.material.color.copy(pale).lerp(tmp, c);
            l.material.emissive.set('#FF6A1A'); l.material.emissiveIntensity = 0.18 * Math.sin(PI * k(t, 5.4, 8.3));
            l.material.clearcoat = 0.7 * k(t, 8.5, 9.6); l.material.roughness = lerp(0.85, 0.55, k(t, 8.5, 9.6));
          });
          // 4. le four descend, chauffe, puis remonte
          oven.position.y = t < 8.3 ? lerp(5.5, top, out(k(t, 4.9, 5.6))) : lerp(top, 6.5, inq(k(t, 8.3, 9.1)));
          oven.visible = t > 4.85 && t < 9.2;
          const heat = k(t, 5.4, 6.3) * (1 - k(t, 7.9, 8.4));
          fire.intensity = 26 * heat * (0.9 + 0.1 * Math.sin(t * 17));
          embers.material.emissiveIntensity = 1.6 * heat;
          // 5. il sort doré
          cro.position.y = top + 0.22 * out(k(t, 8.6, 9.6));
          cro.rotation.y = lerp(0, 0.9, io(k(t, 8.6, 11.4)));
          puff.update(dt); st.update(t, k(t, 8.7, 9.4));
        }
      };
    }
  },

  /* RESTAURANT : l'assiette arrive, les ingrédients tombent et se dressent, la cloche couvre puis révèle */
  restaurant: {
    rim: 0xffb45e, dur: 11.6,
    chapters: [
      { s: 0, cap: 'L’assiette', p: 'Une base propre et soignée : votre nom, votre adresse.' },
      { s: 2.2, cap: 'Les ingrédients', p: 'Votre carte, vos plats du jour, vos prix.' },
      { s: 5.3, cap: 'Le dressage', p: 'Chaque élément à sa place, pensé pour qu’on réserve.' },
      { s: 7.5, cap: 'C’est servi !', p: 'Votre site, en ligne en 7 jours.' }
    ],
    cam: [[0, 0.6, 0.72, 6.6, 0.25], [2.2, 0.3, 0.86, 5.6, 0.25], [5.3, -0.3, 0.72, 5.0, 0.25], [7.5, 0, 0.42, 5.8, 0.45], [9.3, 0.2, 0.55, 5.0, 0.35], [11.6, 0.75, 0.6, 4.7, 0.3]],
    build(x) {
      const { scene } = x, top = 0.12;
      const table = mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.12, 96), std('#4A2C1A', 0.55, 0, { map: woodTex('#4B2D1B', '#24140B') })); table.position.y = 0.06; scene.add(table);
      const ceramic = phys({ color: '#F6F4EF', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
      const prof = [[0, 0.004], [0.85, 0.004], [0.92, 0.03], [1.0, 0.055], [1.42, 0.16], [1.48, 0.175], [1.45, 0.195], [1.0, 0.08], [0, 0.065]].map((p) => new THREE.Vector2(p[0], p[1]));
      const plate = new THREE.Group(); scene.add(plate);
      plate.add(mesh(new THREE.LatheGeometry(prof, 96), ceramic));
      const sy = 0.065; // surface de l'assiette
      const items = [];
      const add = (m, p, s, rot, at) => { m.position.set(p[0], p[1], p[2]); if (s) m.scale.set(s[0], s[1], s[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); m.userData = { y: p[1], at }; m.visible = false; plate.add(m); items.push(m); return m; };
      add(mesh(bumpify(new THREE.SphereGeometry(1, 48, 24), 0.04), std('#EED7A1', 0.75)), [-0.32, sy + 0.1, 0.12], [0.55, 0.15, 0.45], null, 2.3);
      const meat = std('#5A2C18', 0.5, 0, { emissive: col('#2A0D05'), emissiveIntensity: 0.2 });
      add(mesh(new THREE.CapsuleGeometry(0.26, 0.55, 8, 32), meat), [0.18, sy + 0.17, -0.05], [1, 0.62, 1], [0, 0.35, PI / 2], 2.8);
      const bean = std('#3F8F3A', 0.45);
      for (let i = 0; i < 5; i++) add(mesh(new THREE.CapsuleGeometry(0.045, 0.5, 6, 12), bean), [0.55 + i * 0.07, sy + 0.05 + i * 0.012, 0.45 - i * 0.05], null, [0, -0.6 + i * 0.12, PI / 2], 3.4 + i * 0.09);
      const tom = phys({ color: '#D63A2C', roughness: 0.22, clearcoat: 1 });
      [[-0.75, 0.55], [-0.5, 0.75], [-0.85, 0.2]].forEach((p, i) => add(mesh(new THREE.SphereGeometry(0.11, 32, 16), tom), [p[0], sy + 0.1, p[1]], null, null, 4.0 + i * 0.12));
      // dressage
      const sauce = mesh(new THREE.TorusGeometry(0.95, 0.035, 12, 96, 1.9), phys({ color: '#5E1419', roughness: 0.15, clearcoat: 1 }), false);
      sauce.rotation.set(-PI / 2, 0, 2.2); sauce.position.y = sy + 0.03; sauce.scale.set(1, 1, 0.4); plate.add(sauce);
      const herb = new THREE.Group(); herb.position.set(0.2, sy + 0.36, -0.05); plate.add(herb);
      const leaf = std('#5BAA3C', 0.5);
      for (let i = 0; i < 4; i++) { const l = mesh(new THREE.SphereGeometry(0.08, 16, 8), leaf); l.scale.set(1, 0.25, 0.55); l.position.set(Math.cos(i * 1.6) * 0.07, 0.02 * i, Math.sin(i * 1.6) * 0.07); l.rotation.y = i * 1.6; herb.add(l); }
      // couverts
      const steel = phys({ color: '#D8DCE0', metalness: 1, roughness: 0.18 });
      const fork = new THREE.Group(); fork.add(mesh(new THREE.BoxGeometry(0.09, 0.025, 1.0), steel)); fork.children[0].position.z = 0.3;
      for (let i = 0; i < 4; i++) { const ti = mesh(new THREE.BoxGeometry(0.018, 0.02, 0.32), steel); ti.position.set(-0.045 + i * 0.03, 0, -0.35); fork.add(ti); }
      const knife = new THREE.Group(); knife.add(mesh(new THREE.BoxGeometry(0.09, 0.025, 0.7), steel)); knife.children[0].position.z = 0.45;
      const blade = mesh(new THREE.BoxGeometry(0.11, 0.012, 0.65), steel); blade.position.z = -0.22; knife.add(blade);
      [fork, knife].forEach((c) => { c.position.y = top + 0.02; scene.add(c); });
      // cloche
      const cloche = new THREE.Group(); scene.add(cloche);
      const silver = phys({ color: '#E9ECEF', metalness: 1, roughness: 0.12 });
      cloche.add(mesh(new THREE.SphereGeometry(1.32, 72, 32, 0, 2 * PI, 0, PI / 2), new THREE.MeshPhysicalMaterial({ color: '#E9ECEF', metalness: 1, roughness: 0.12, side: THREE.DoubleSide })));
      const rim = mesh(new THREE.TorusGeometry(1.32, 0.04, 12, 96), silver); rim.rotation.x = PI / 2; cloche.add(rim);
      const knob = mesh(new THREE.SphereGeometry(0.13, 24, 16), phys({ color: '#E2A23B', metalness: 1, roughness: 0.25 })); knob.position.y = 1.4; cloche.add(knob);
      const st = steam(scene, 16, { x: 0, y: top + 0.4, z: 0, w: 0.5, d: 0.4 });
      return {
        update(t) {
          // assiette qui arrive en tournant
          plate.position.y = fallY(t, 0.1, 1.2, 3, top);
          plate.rotation.y = lerp(-2.4, 0, out(k(t, 0.1, 1.6))) + 0.25 * io(k(t, 5.3, 7.4)) + 0.4 * io(k(t, 9.4, 11.6));
          fork.position.x = lerp(-5, -1.95, out(k(t, 0.8, 1.6))); knife.position.x = lerp(5, 1.95, out(k(t, 0.95, 1.75)));
          items.forEach((m) => { const a = m.userData.at; m.visible = t > a; m.position.y = fallY(t, a, a + 0.55, m.userData.y + 2.6, m.userData.y); });
          const s = out(k(t, 5.4, 6.3)); sauce.scale.set(Math.max(0.0001, s), Math.max(0.0001, s), 0.4); sauce.visible = s > 0;
          herb.scale.setScalar(Math.max(0.0001, back(k(t, 6.3, 6.9)))); herb.rotation.y = t * 0.3;
          // cloche : descend, attend, se lève
          cloche.position.y = t < 9 ? lerp(5, top + 0.005, out(k(t, 7.5, 8.2))) : lerp(top + 0.005, 4.2, io(k(t, 9.0, 9.8)));
          cloche.position.z = t < 9 ? 0 : lerp(0, -1.2, io(k(t, 9.0, 9.8)));
          cloche.rotation.x = t < 9 ? 0 : lerp(0, -0.45, io(k(t, 9.0, 9.8)));
          cloche.visible = t > 7.45 && t < 10.2;
          st.update(t, k(t, 9.1, 9.8));
        }
      };
    }
  },

  /* BARBIER : une tête de mannequin hirsute, les ciseaux tournent autour, les mèches tombent, coupe nette */
  barbier: {
    rim: 0xd9b26a, dur: 11.4,
    chapters: [
      { s: 0, cap: 'Avant', p: 'Sans site, les clients ne vous trouvent pas.' },
      { s: 2.2, cap: 'La coupe', p: 'On garde l’essentiel : vos prestations, vos prix.' },
      { s: 6.3, cap: 'Les finitions', p: 'La prise de rendez-vous en 30 secondes.' },
      { s: 8.5, cap: 'Coupe nette', p: 'Votre salon, en ligne en 7 jours.' }
    ],
    cam: [[0, 0.9, 0.22, 6.4, 1.75], [2.2, 0.55, 0.2, 5.3, 1.95], [4.3, -0.65, 0.22, 5.3, 1.95], [6.3, 0.05, 0.02, 4.6, 1.65], [8.5, -0.55, 0.12, 5.2, 1.8], [11.4, 0.45, 0.18, 5.3, 1.8]],
    build(x) {
      const { scene } = x, HC = new THREE.Vector3(0, 1.95, 0), HS = new THREE.Vector3(0.66, 0.74, 0.7);
      const clay = std('#CDBBA4', 0.62);
      const cape = mesh(new THREE.CylinderGeometry(0.42, 1.55, 1.15, 72, 1, true), std('#141414', 0.75, 0, { side: THREE.DoubleSide })); cape.position.y = 0.575; scene.add(cape);
      const trim = mesh(new THREE.TorusGeometry(1.55, 0.03, 8, 96), phys({ color: '#C9A45C', metalness: 1, roughness: 0.3 })); trim.rotation.x = PI / 2; trim.position.y = 0.015; scene.add(trim);
      const neck = mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.6, 32), clay); neck.position.y = 1.35; scene.add(neck);
      const hairC = col('#1E130D'), skinC = col('#CDBBA4');
      const hairZ = (d) => (d.y > 0.36) || (d.y > 0.02 && d.z < 0.55) || (d.y > -0.5 && d.z < -0.2);
      const beardZ = (d) => d.z > 0.18 && d.y < -0.22 && d.y > -0.95 && Math.abs(d.x) < 0.92 && !(Math.abs(d.x) < 0.22 && d.y > -0.52 && d.y < -0.38 && d.z > 0.8);
      const hg = new THREE.SphereGeometry(1, 96, 64), hp = hg.attributes.position, hc = new Float32Array(hp.count * 3), dv = new THREE.Vector3(), tc = new THREE.Color();
      for (let i = 0; i < hp.count; i++) { dv.fromBufferAttribute(hp, i).normalize(); tc.copy(hairZ(dv) || beardZ(dv) ? hairC : skinC); tc.toArray(hc, i * 3); }
      hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
      const head = mesh(hg, std('#FFFFFF', 0.6, 0, { vertexColors: true })); head.position.copy(HC); head.scale.copy(HS); scene.add(head);
      const nose = mesh(new THREE.SphereGeometry(0.09, 16, 12), clay); nose.scale.set(0.8, 1.3, 1.1); nose.position.set(0, 1.9, 0.7); scene.add(nose);
      [-1, 1].forEach((s) => {
        const e = mesh(new THREE.SphereGeometry(0.13, 16, 12), clay); e.scale.set(0.4, 1, 0.75); e.position.set(s * 0.66, 1.92, 0.02); scene.add(e);
        const brow = mesh(new THREE.CapsuleGeometry(0.022, 0.16, 4, 8), std('#1E130D', 0.7)); brow.rotation.z = PI / 2 + s * 0.12; brow.position.set(s * 0.22, 2.13, 0.63); scene.add(brow);
        const lid = mesh(new THREE.CapsuleGeometry(0.012, 0.11, 4, 8), std('#5A4A3C', 0.8)); lid.rotation.z = PI / 2; lid.position.set(s * 0.22, 2.03, 0.665); scene.add(lid);
      });
      const hairM = std('#22160F', 0.48);
      // mèches fines et denses
      const S = [], Nf = 7000, up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < Nf; i++) {
        const y = 1 - (2 * (i + 0.5)) / Nf, r = Math.sqrt(1 - y * y), ph = i * 2.399963, d = new THREE.Vector3(Math.cos(ph) * r, y, Math.sin(ph) * r);
        const isH = hairZ(d), isB = !isH && beardZ(d);
        if (!isH && !isB) continue;
        if (isB && i % 2) continue;
        const base = new THREE.Vector3(d.x * HS.x, d.y * HS.y, d.z * HS.z).multiplyScalar(0.985).add(HC);
        const messy = d.clone().add(new THREE.Vector3(rnd(-0.55, 0.55), rnd(-0.1, 0.5), rnd(-0.55, 0.55))).normalize();
        const neat = d.clone().add(new THREE.Vector3(0, isB ? -0.25 : (d.y > 0.5 ? 0.1 : -0.6), isB ? 0 : -0.45)).normalize();
        const Lt = isB ? 0.045 : d.y > 0.55 ? 0.16 + 0.05 * d.z : lerp(0.012, 0.13, cl((d.y - 0.05) / 0.5));
        S.push({ d, base, messy, neat, L0: isB ? rnd(0.18, 0.3) : rnd(0.32, 0.62), Lt, cut: -1, beard: isB, az: Math.atan2(d.x, d.z), ph: rnd(0, 6) });
      }
      const hair = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.014, 1, 2, 5), hairM, S.length); hair.castShadow = true; hair.receiveShadow = true; scene.add(hair);
      const cc = new THREE.Color(); S.forEach((s, i) => { cc.set('#2A1B12').multiplyScalar(rnd(0.7, 1.5)); hair.setColorAt(i, cc); });
      const clips = bits(scene, new THREE.CapsuleGeometry(0.014, 0.16, 2, 4), hairM, 520, { g: -6, drag: 1.2, floor: (p) => { const rr = Math.hypot(p.x, p.z); return rr < 1.55 ? Math.max(0, 1.15 - (rr - 0.42) * (1.15 / 1.13)) : 0; } });
      // ciseaux
      const sc = new THREE.Group(); scene.add(sc);
      const bladeM = phys({ color: '#E8ECEF', metalness: 1, roughness: 0.15 }), goldM = phys({ color: '#C9A45C', metalness: 1, roughness: 0.3 });
      const half = (sgn) => {
        const g = new THREE.Group(), sh = new THREE.Shape();
        sh.moveTo(0, -0.04); sh.lineTo(0.62, -0.008); sh.lineTo(0.66, 0.0); sh.lineTo(0, 0.045); sh.lineTo(-0.05, 0);
        const b = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }), bladeM); b.position.z = sgn * 0.01; g.add(b);
        const arm = mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), goldM); arm.position.set(-0.17, -sgn * 0.035, 0); arm.rotation.z = sgn * 0.3; g.add(arm);
        const ring = mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 24), goldM); ring.position.set(-0.36, -sgn * 0.1, 0); g.add(ring);
        sc.add(g); return g;
      };
      const A = half(1), B = half(-1);
      const pivot = mesh(new THREE.SphereGeometry(0.03, 12, 8), goldM); sc.add(pivot); sc.scale.setScalar(1.7);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), dir = new THREE.Vector3(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), tip = new THREE.Vector3();
      return {
        update(t, dt) {
          // passage des ciseaux : tour de tête puis barbe
          const sweep = lerp(-PI, PI, io(k(t, 2.4, 5.9)));
          const bx = lerp(-1, 1, io(k(t, 6.5, 8.2)));
          S.forEach((s, i) => {
            if (s.cut < 0) {
              if (!s.beard && t > 2.4 && s.az < sweep) s.cut = t;
              if (s.beard && t > 6.5 && s.d.x < bx) s.cut = t;
              if (s.cut > 0 && i % 5 === 0) { tip.copy(s.messy).multiplyScalar(s.L0 * 0.8).add(s.base); clips.spawn(tip, new THREE.Vector3(rnd(-0.4, 0.4), rnd(0, 0.6), rnd(-0.2, 0.6)), 6, rnd(0.8, 1.3)); }
            }
            const c = s.cut > 0 ? io(k(t, s.cut, s.cut + 0.35)) : 0;
            const wob = (1 - c) * 0.12 * Math.sin(t * 2.6 + s.ph);
            dir.copy(s.messy).lerp(s.neat, c); dir.x += wob; dir.normalize();
            const L = lerp(s.L0, s.Lt, c);
            q.setFromUnitVectors(up, dir); pos.copy(s.base).addScaledVector(dir, L / 2); scl.set(1, L, 1);
            m.compose(pos, q, scl); hair.setMatrixAt(i, m);
          });
          hair.instanceMatrix.needsUpdate = true;
          // ciseaux : arrivent, tournent autour, passent à la barbe, repartent
          const snip = 0.06 + 0.32 * Math.abs(Math.sin(t * 13));
          A.rotation.z = snip; B.rotation.z = -snip;
          let p, lookAt;
          if (t < 2.4) { const a = lerp(-PI - 1.2, -PI, out(k(t, 1.2, 2.4))); p = new THREE.Vector3(Math.sin(a) * 1.6, 2.35, Math.cos(a) * 1.6).lerp(new THREE.Vector3(3, 3.5, 2), 1 - k(t, 1.2, 2.4)); }
          else if (t < 6.1) p = new THREE.Vector3(Math.sin(sweep) * 1.05, 2.22 + 0.1 * Math.sin(t * 3), Math.cos(sweep) * 1.05);
          else if (t < 8.4) p = new THREE.Vector3(lerp(Math.sin(PI) * 1.05, bx * 0.6, k(t, 6.1, 6.5)), lerp(2.22, 1.5, k(t, 6.1, 6.5)), lerp(-1.05, 0.95, k(t, 6.1, 6.5)));
          else p = new THREE.Vector3(lerp(0.6, 3.5, inq(k(t, 8.4, 9.1))), lerp(1.5, 3.4, inq(k(t, 8.4, 9.1))), lerp(0.95, 1.5, k(t, 8.4, 9.1)));
          sc.position.copy(p); sc.visible = t > 1.2 && t < 9.1;
          lookAt = new THREE.Vector3(HC.x, p.y, HC.z); sc.lookAt(lookAt); sc.rotateY(-PI / 2); sc.rotateX(PI / 2);
          clips.update(dt);
          x.rim.intensity = lerp(1.6, 3.2, k(t, 8.5, 9.5));
        }
      };
    }
  },

  /* BEAUTÉ : le flacon sort du socle, se remplit, le bouchon se visse, l'étiquette apparaît, pétales */
  beaute: {
    rim: 0xffb7c9, dur: 11.4,
    chapters: [
      { s: 0, cap: 'Le flacon', p: 'Une base élégante, à votre nom.' },
      { s: 2.2, cap: 'Le soin', p: 'Votre carte des soins, avec les prix.' },
      { s: 5.4, cap: 'La touche finale', p: 'La réservation en ligne, à toute heure.' },
      { s: 7.7, cap: 'Prête à briller', p: 'Votre institut, en ligne en 7 jours.' }
    ],
    cam: [[0, 0.4, 0.32, 6.1, 1.2], [2.2, 0.15, 0.36, 6.0, 1.85], [5.4, -0.25, 0.28, 5.0, 1.35], [7.7, 0.3, 0.2, 5.4, 1.25], [11.4, -0.45, 0.24, 5.3, 1.2]],
    build(x) {
      const { scene, nom } = x, top = 0.5;
      const plinth = mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.5, 96), phys({ color: '#FFFFFF', roughness: 0.25, clearcoat: 0.6, map: marbleTex() })); plinth.position.y = 0.25; scene.add(plinth);
      const bottle = new THREE.Group(); scene.add(bottle);
      const prof = [[0.001, 0], [0.55, 0], [0.63, 0.05], [0.66, 0.15], [0.66, 1.05], [0.6, 1.22], [0.42, 1.34], [0.2, 1.4], [0.18, 1.47], [0.18, 1.56]].map((p) => new THREE.Vector2(p[0], p[1]));
      const glass = phys({ color: '#FFFFFF', roughness: 0.03, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.16, emissive: col('#FFFFFF'), emissiveIntensity: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.4 });
      const gl = mesh(new THREE.LatheGeometry(prof, 96), glass, false); gl.renderOrder = 2; bottle.add(gl);
      const base = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.07, 64), phys({ color: '#F7E7EA', roughness: 0.1, transparent: true, opacity: 0.6 })); base.position.y = 0.035; bottle.add(base);
      const liqG = new THREE.CylinderGeometry(0.61, 0.61, 1, 72); liqG.translate(0, 0.5, 0);
      const liquid = mesh(liqG, phys({ color: '#E57C9C', roughness: 0.15, clearcoat: 1, emissive: col('#7A1E38'), emissiveIntensity: 0.15 }), false); liquid.position.y = 0.07; bottle.add(liquid);
      // pipette
      const drop = new THREE.Group(); scene.add(drop);
      const tube = mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.0, 24), phys({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.5 })); tube.position.y = 0.5; drop.add(tube);
      const bulb = mesh(new THREE.SphereGeometry(0.15, 24, 16), std('#2A2427', 0.5)); bulb.scale.set(1, 1.3, 1); bulb.position.y = 1.1; drop.add(bulb);
      const stream = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 12), liquid.material, false); scene.add(stream);
      // bouchon
      const cap = new THREE.Group(); scene.add(cap);
      const gold = phys({ color: '#D2AA55', metalness: 1, roughness: 0.22 });
      cap.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.42, 48), gold));
      const capTop = mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.06, 48), gold); capTop.position.y = 0.24; cap.add(capTop);
      for (let i = 0; i < 24; i++) { const g = mesh(new THREE.BoxGeometry(0.02, 0.38, 0.02), gold); const a = (i / 24) * 2 * PI; g.position.set(Math.cos(a) * 0.255, 0, Math.sin(a) * 0.255); cap.add(g); }
      // étiquette avec le nom
      const tex = canvasTex(1024, 512, (c, w, h) => {
        c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#C2788A'; c.lineWidth = 6; c.strokeRect(28, 28, w - 56, h - 56);
        c.fillStyle = '#3A2A2E'; c.textAlign = 'center'; c.textBaseline = 'middle';
        fit(c, nom, 110, 'italic 500 #px Georgia, serif'); c.fillText(nom, w / 2, h * 0.42);
        c.fillStyle = '#C2788A'; c.font = '600 46px "Onest", Arial, sans-serif'; c.fillText('SOIN ÉCLAT · 50 ml', w / 2, h * 0.7);
      });
      const label = mesh(new THREE.CylinderGeometry(0.665, 0.665, 0.62, 72, 1, true, -1.2, 2.4), std('#FFFFFF', 0.5, 0, { map: tex, side: THREE.FrontSide }), false);
      label.position.y = 0.58; bottle.add(label);
      // pétales
      const petalM = phys({ color: '#E98BA5', roughness: 0.55, side: THREE.DoubleSide });
      const petals = []; for (let i = 0; i < 11; i++) { const p = mesh(new THREE.SphereGeometry(0.11, 16, 8), petalM); p.scale.set(1, 0.18, 0.62); p.userData = { a: (i / 11) * 2 * PI, r: rnd(1.0, 1.6), h: rnd(0.4, 2.4), sp: rnd(0.5, 0.9), ph: rnd(0, 6) }; scene.add(p); petals.push(p); }
      return {
        update(t) {
          bottle.position.y = lerp(-1.7, top, out(k(t, 0.2, 1.8))); bottle.rotation.y = lerp(-PI, 0, out(k(t, 0.2, 2.0))) + 0.35 * io(k(t, 7.7, 11.4));
          const neckY = top + 1.56;
          drop.position.set(0, t < 4.9 ? lerp(4.5, neckY + 0.35, out(k(t, 2.2, 2.8))) : lerp(neckY + 0.35, 5, inq(k(t, 4.9, 5.4))), 0);
          drop.visible = t > 2.15 && t < 5.4;
          const fill = io(k(t, 2.95, 4.9)) * 0.86;
          liquid.scale.set(1, Math.max(0.0001, fill), 1); liquid.visible = fill > 0.002;
          const on = t > 2.85 && t < 4.95;
          stream.visible = on; const s0 = neckY + 0.33, s1 = top + 0.07 + fill;
          stream.scale.y = Math.max(0.01, s0 - s1); stream.position.y = (s0 + s1) / 2;
          bulb.scale.set(1, 1.3 - (on ? 0.25 * Math.abs(Math.sin(t * 6)) : 0), 1);
          // bouchon vissé
          const c = k(t, 5.4, 6.5);
          cap.position.y = lerp(4.2, neckY + 0.12, out(c)); cap.rotation.y = lerp(10, 0, out(c));
          cap.visible = t > 5.35;
          const lb = back(k(t, 6.5, 7.3)); label.scale.set(1, Math.max(0.0001, lb), 1); label.visible = lb > 0.001;
          // pétales en spirale
          const pv = k(t, 7.7, 8.5) * (1 - k(t, 11.0, 11.4) * 0);
          petals.forEach((p) => { const u = p.userData, a = u.a + t * u.sp; p.visible = pv > 0; p.position.set(Math.cos(a) * u.r * (1.6 - 0.6 * pv), u.h + 0.2 * Math.sin(t + u.ph) + (1 - pv) * 2.5, Math.sin(a) * u.r * (1.6 - 0.6 * pv)); p.rotation.set(t * 0.8 + u.ph, a, Math.sin(t + u.ph)); p.scale.set(pv, 0.18 * pv, 0.62 * pv); });
          x.rim.intensity = lerp(1.4, 3, k(t, 7.7, 8.6));
        }
      };
    }
  },

  /* ARTISAN : une fuite sur un tuyau, la clé arrive, serre le raccord, la fuite s'arrête */
  artisan: {
    rim: 0xff5a3a, dur: 11.4,
    chapters: [
      { s: 0, cap: 'La fuite', p: 'Un client a un problème. Il cherche sur Google.' },
      { s: 2.6, cap: 'Il vous trouve', p: 'Votre site sort, avec le bouton « Appeler » en premier.' },
      { s: 5.0, cap: 'Le serrage', p: 'Services, devis gratuit, avis : il vous fait confiance.' },
      { s: 8.3, cap: 'Réparé !', p: 'Un client de plus. En ligne en 7 jours.' }
    ],
    cam: [[0, 0.45, 0.22, 7.3, 1.7], [2.6, 0.25, 0.18, 6.2, 2.0], [5.0, -0.12, 0.08, 4.4, 2.35], [8.3, 0.32, 0.16, 6.3, 1.85], [11.4, 0.5, 0.22, 6.6, 1.75]],
    build(x) {
      const { scene, rim } = x, Y = 2.5;
      const wall = mesh(new THREE.BoxGeometry(14, 6, 0.2), std('#FFFFFF', 0.4, 0, { map: tileTex('#1B3A57', '#0E2234', 4) })); wall.position.set(0, 3, -0.75); wall.material.map.repeat.set(3.7, 1.6); scene.add(wall);
      const floor = mesh(new THREE.PlaneGeometry(14, 5), std('#FFFFFF', 0.55, 0, { map: tileTex('#14293D', '#0A1826', 4) }), false); floor.rotation.x = -PI / 2; floor.position.set(0, 0.002, 1.75); floor.material.map.repeat.set(3.7, 1.3); scene.add(floor);
      const copper = phys({ color: '#C8794A', metalness: 1, roughness: 0.32, clearcoat: 0.3 });
      const brass = phys({ color: '#C9A24E', metalness: 1, roughness: 0.28 });
      const pipes = new THREE.Group(); scene.add(pipes);
      const seg = (len, axis, p) => { const g = new THREE.CylinderGeometry(0.14, 0.14, len, 40); if (axis === 'x') g.rotateZ(PI / 2); const m = mesh(g, copper); m.position.set(p[0], p[1], p[2]); m.userData.axis = axis; pipes.add(m); return m; };
      const P1 = seg(6, 'x', [-3.2, Y, 0]), P2 = seg(0.85, 'x', [0.6, Y, 0]);
      const elbow = mesh(new THREE.TorusGeometry(0.45, 0.14, 24, 48, PI / 2), copper); elbow.position.set(1.02, Y - 0.45, 0); pipes.add(elbow);
      const P3 = seg(Y - 0.45 - 0.35, 'y', [1.47, (Y - 0.45 + 0.35) / 2, 0]);
      const flange = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 40), brass); flange.position.set(1.47, 0.36, 0); pipes.add(flange);
      [[-3.2, Y], [-1.2, Y]].forEach((c) => { const cl2 = mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 24), brass); cl2.rotation.y = PI / 2; cl2.position.set(c[0] + 0.2, c[1], 0); pipes.add(cl2); });
      const nut = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.34, 6), brass); nut.geometry.rotateZ(PI / 2); nut.position.set(0, Y, 0); scene.add(nut);
      // fuite
      const water = phys({ color: '#6FB7F0', roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.8, emissive: col('#1C5E9A'), emissiveIntensity: 0.25 });
      const drops = bits(scene, new THREE.SphereGeometry(0.026, 10, 8), water, 480, { g: -9.8, fade: 0.3, flat: true });
      const puddle = mesh(new THREE.CircleGeometry(1, 64), phys({ color: '#79B4DE', roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.5 }), false); puddle.rotation.x = -PI / 2; puddle.position.set(0.1, 0.006, 0.7); scene.add(puddle);
      const alarm = new THREE.PointLight('#FF3B2E', 0, 5, 1.5); alarm.position.set(0, Y + 0.3, 0.8); scene.add(alarm);
      // clé à molette
      const wr = new THREE.Group();
      const steel = phys({ color: '#D5DDE4', metalness: 1, roughness: 0.22 });
      const headR = mesh(new THREE.TorusGeometry(0.33, 0.085, 16, 48, PI * 1.45), steel); headR.rotation.z = -1.225 * PI; wr.add(headR);
      const handle = mesh(new THREE.BoxGeometry(0.16, 1.5, 0.08), steel); handle.position.y = -1.05; wr.add(handle);
      const grip = mesh(new THREE.CapsuleGeometry(0.1, 0.62, 6, 16), std('#E07B24', 0.5)); grip.position.y = -1.35; grip.scale.z = 0.6; wr.add(grip);
      const pivotWr = new THREE.Group(); scene.add(pivotWr); pivotWr.position.set(0, Y, 0); pivotWr.rotation.y = PI / 2; pivotWr.add(wr);
      // coche de validation
      const ok = new THREE.Group(); ok.position.set(-0.9, Y + 0.62, 0.55); scene.add(ok);
      const okM = std('#3DDC97', 0.35, 0, { emissive: col('#1F9E66'), emissiveIntensity: 0.6 });
      const a1 = mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), okM); a1.position.set(-0.13, -0.05, 0); a1.rotation.z = 0.75; ok.add(a1);
      const a2 = mesh(new THREE.BoxGeometry(0.12, 0.72, 0.12), okM); a2.position.set(0.14, 0.08, 0); a2.rotation.z = -0.62; ok.add(a2);
      let rate = 0, acc = 0, nutRot = 0;
      return {
        update(t, dt) {
          // les tuyaux poussent
          P1.scale.y = Math.max(0.0001, out(k(t, 0.0, 0.7))); P2.scale.y = Math.max(0.0001, out(k(t, 0.4, 0.8)));
          elbow.scale.setScalar(Math.max(0.0001, out(k(t, 0.6, 1.0)))); P3.scale.y = Math.max(0.0001, out(k(t, 0.8, 1.3))); flange.scale.setScalar(Math.max(0.0001, out(k(t, 1.1, 1.4))));
          nut.scale.setScalar(Math.max(0.0001, back(k(t, 0.5, 1.0))));
          // la fuite démarre, puis diminue pendant le serrage
          rate = 110 * k(t, 1.2, 1.7) * (1 - k(t, 5.4, 7.6));
          acc += rate * dt;
          while (acc >= 1) { acc -= 1; const a = rnd(-0.9, 0.9); drops.spawn(new THREE.Vector3(rnd(-0.1, 0.1), Y + rnd(-0.12, 0.12), 0.2), new THREE.Vector3(Math.sin(a) * rnd(0.3, 1.2), rnd(0.2, 1.8), rnd(0.8, 2.2) * Math.cos(a * 0.5)), rnd(0.9, 1.5), rnd(0.7, 1.3)); }
          drops.update(dt);
          const pd = out(k(t, 1.5, 5.2)) * (1 - io(k(t, 8.0, 10.5)));
          puddle.scale.set(Math.max(0.0001, pd * 1.3), Math.max(0.0001, pd), 1); puddle.material.opacity = 0.5 * pd;
          alarm.intensity = 5 * k(t, 1.3, 1.8) * (1 - k(t, 6.5, 7.6)) * (0.6 + 0.4 * Math.sin(t * 8));
          rim.color.set('#FF5A3A').lerp(col('#FFC07A'), k(t, 6.5, 8.6));
          // la clé arrive et se place sur l'écrou (plan perpendiculaire au tuyau)
          let turn = 0;
          if (t >= 5.0 && t < 8.0) {
            const u = (t - 5.0) / 1.0, f = u % 1, n = Math.floor(u);
            turn = f < 0.55 ? -1.0 * io(f / 0.55) : -1.0 * (1 - io((f - 0.55) / 0.45));
            if (f < 0.55) nutRot = n * -1.0 + turn; else nutRot = (n + 1) * -1.0;
          } else if (t >= 8.0) nutRot = -3.0;
          nut.rotation.x = nutRot;
          const arrive = out(k(t, 2.7, 3.7)), leave = inq(k(t, 8.2, 8.9));
          wr.position.set(0, 0, 0).lerp(new THREE.Vector3(0.0, -1.5, 3.2), 1 - arrive).lerp(new THREE.Vector3(0, 2.5, 3.5), leave);
          wr.rotation.set(0, 0, (1 - arrive) * 1.6 + turn - leave * 2);
          pivotWr.visible = t > 2.65 && t < 8.9;
          copper.roughness = lerp(0.32, 0.16, k(t, 8.3, 9.3));
          const okS = back(k(t, 8.7, 9.4)); ok.scale.setScalar(Math.max(0.0001, okS)); ok.rotation.y = 0.4 * Math.sin(t * 1.5); ok.visible = okS > 0.001;
        }
      };
    }
  },

  /* COACH : la barre arrive sur le rack, on charge les disques, on soulève, on lâche */
  coach: {
    rim: 0xff5a2a, dur: 11.2, wide: 1.3,
    chapters: [
      { s: 0, cap: 'La barre', p: 'On part de zéro, à votre nom.' },
      { s: 2.2, cap: 'On charge', p: 'Vos formules et vos objectifs, bien visibles.' },
      { s: 5.3, cap: 'On soulève', p: 'La 1re séance offerte, en gros, là où on la voit.' },
      { s: 8.3, cap: 'Objectif atteint', p: 'Votre activité, en ligne en 7 jours.' }
    ],
    cam: [[0, 0.7, 0.32, 7.4, 1.25], [2.2, 0.45, 0.28, 7.0, 1.35], [5.3, 0.15, 0.12, 7.4, 1.7], [7.9, 0.08, 0.06, 6.8, 1.15], [8.3, 0.08, 0.08, 6.6, 0.9], [11.2, -0.5, 0.14, 6.2, 0.75]],
    build(x) {
      const { scene, rim, cam } = x;
      const mat = mesh(new THREE.BoxGeometry(6.4, 0.04, 3.4), std('#1A1A1A', 0.92)); mat.position.y = 0.02; scene.add(mat);
      const line = mesh(new THREE.BoxGeometry(6.4, 0.002, 0.05), std('#FF4F1F', 0.6, 0, { emissive: col('#FF4F1F'), emissiveIntensity: 0.4 }), false); line.position.set(0, 0.042, 1.3); scene.add(line);
      const black = std('#111111', 0.5, 0.5);
      const rack = new THREE.Group(); scene.add(rack);
      [-1.25, 1.25].forEach((xx) => { const u = mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), black); u.position.set(xx, 0.75, 0); rack.add(u); const hk = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.24), black); hk.position.set(xx, 1.36, 0.12); rack.add(hk); const ft = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.6), black); ft.position.set(xx, 0.065, 0); rack.add(ft); });
      const bar = new THREE.Group(); scene.add(bar);
      const chrome = phys({ color: '#E4E7EA', metalness: 1, roughness: 0.15 });
      const shaft = mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.3, 24), chrome); shaft.rotation.z = PI / 2; bar.add(shaft);
      [-1, 1].forEach((s) => { const sl = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 24), chrome); sl.rotation.z = PI / 2; sl.position.x = s * 2.07; bar.add(sl); const st = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 24), chrome); st.rotation.z = PI / 2; st.position.x = s * 1.66; bar.add(st); });
      const plates = [], spec = [[0.56, 0.11, '#FF4F1F'], [0.47, 0.085, '#1D1D1D'], [0.36, 0.07, '#FF4F1F']];
      [-1, 1].forEach((s) => {
        let xx = 1.7;
        spec.forEach((p, i) => {
          const g = new THREE.Group();
          const disc = mesh(new THREE.CylinderGeometry(p[0], p[0], p[1], 64), std(p[2], 0.62)); disc.rotation.z = PI / 2; g.add(disc);
          const hub = mesh(new THREE.CylinderGeometry(0.13, 0.13, p[1] + 0.012, 32), chrome); hub.rotation.z = PI / 2; g.add(hub);
          const lip = mesh(new THREE.TorusGeometry(p[0] - 0.03, 0.018, 8, 64), std('#2A2A2A', 0.5)); lip.rotation.y = PI / 2; lip.position.x = s * p[1] / 2; g.add(lip);
          xx += p[1] / 2; g.userData = { x: s * xx, s, at: 2.4 + i * 0.75 }; xx += p[1] / 2 + 0.01;
          bar.add(g); plates.push(g);
        });
        const collar = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 24), std('#FF4F1F', 0.4)); collar.rotation.z = PI / 2; collar.userData = { x: s * (xx + 0.05), s, at: 4.6 }; bar.add(collar); plates.push(collar);
      });
      const ring = mesh(new THREE.TorusGeometry(1, 0.03, 8, 96), std('#FF4F1F', 0.4, 0, { emissive: col('#FF4F1F'), emissiveIntensity: 1.5, transparent: true }), false); ring.rotation.x = PI / 2; ring.position.y = 0.05; scene.add(ring);
      const dust = bits(scene, new THREE.SphereGeometry(0.03, 6, 4), std('#EDEDED', 1), 160, { g: -2, drag: 2, fade: 0.8, floor: 0.04 });
      let hit = false; const camBase = new THREE.Vector3();
      return {
        update(t, dt) {
          // barre posée sur le rack
          const rackY = 1.45, floorY = 0.6;
          let y;
          if (t < 5.4) y = fallY(t, 0.2, 1.3, 3.6, rackY);
          else if (t < 7.6) y = rackY + (t < 6.5 ? out(k(t, 5.4, 5.9)) * 0.8 - io(k(t, 5.9, 6.5)) * 0.65 : 0.15 + out(k(t, 6.5, 7.1)) * 0.8);
          else y = lerp(rackY + 0.95, floorY, inq(k(t, 7.6, 8.0)));
          if (t >= 8.0) y = floorY + (t < 8.6 ? Math.abs(Math.sin((t - 8) * 9)) * 0.12 * Math.exp(-(t - 8) * 6) : 0);
          bar.position.y = y; bar.position.z = lerp(-3, 0, out(k(t, 0.2, 1.0)));
          bar.rotation.x = lerp(-6, 0, out(k(t, 0.2, 1.2)));
          const rk = 1 - io(k(t, 5.5, 6.2)); rack.scale.set(1, Math.max(0.0001, rk), 1); rack.visible = rk > 0.002;
          plates.forEach((p) => { const u = p.userData, f = back(k(t, u.at, u.at + 0.55)); p.position.x = lerp(u.s * 4.6, u.x, f); p.visible = t > u.at - 0.02; });
          // impact au sol
          if (!hit && t >= 8.0) { hit = true; for (let i = 0; i < 140; i++) { const a = rnd(0, 2 * PI), v = rnd(0.8, 2.6); dust.spawn(new THREE.Vector3(rnd(-2.3, 2.3), 0.08, rnd(-0.3, 0.3)), new THREE.Vector3(Math.cos(a) * v, rnd(0.3, 1.4), Math.sin(a) * v), rnd(0.8, 1.6), rnd(0.6, 1.4)); } }
          const r = k(t, 8.0, 8.9); ring.visible = r > 0 && r < 1; ring.scale.set(0.5 + r * 4, 0.5 + r * 4, 1); ring.material.opacity = 1 - r;
          dust.update(dt);
          rim.intensity = 1.8 + (t > 8.3 ? 1.2 * (0.6 + 0.4 * Math.sin(t * 3)) : 0);
          // petite secousse à l'impact
          const sh = t > 8 && t < 8.4 ? (8.4 - t) * 0.08 : 0; cam.position.x += rnd(-sh, sh); cam.position.y += rnd(-sh, sh);
        }
      };
    }
  },

  /* BOUTIQUE : une feuille à plat, elle se plie en sac, les articles tombent dedans, poignées et étiquette */
  boutique: {
    rim: 0x9fe0c8, dur: 11.2, wide: 1.2,
    chapters: [
      { s: 0, cap: 'Le papier', p: 'Une feuille blanche, à votre nom.' },
      { s: 2.2, cap: 'Le pliage', p: 'On construit votre vitrine, pièce par pièce.' },
      { s: 5.0, cap: 'Les articles', p: 'Vos nouveautés et vos marques, mises en avant.' },
      { s: 7.8, cap: 'Emballé !', p: 'Votre boutique, en ligne en 7 jours.' }
    ],
    cam: [[0, 0.3, 0.95, 7.2, 0.3], [2.2, 0.5, 0.62, 6.2, 0.8], [5.0, 0.2, 0.6, 5.6, 1.1], [7.8, -0.3, 0.3, 5.8, 1.1], [11.2, 0.5, 0.3, 5.6, 1.0]],
    build(x) {
      const { scene, nom } = x, top = 0.12, W = 1.5, D = 0.62, H = 1.8, th = 0.02;
      const counter = mesh(new THREE.BoxGeometry(7, 0.12, 4.4), phys({ color: '#FFFFFF', roughness: 0.3, clearcoat: 0.5, map: marbleTex() })); counter.position.y = 0.06; scene.add(counter);
      const paper = std('#2F5D50', 0.8), inside = std('#C9A27A', 0.9);
      const mats = [paper, paper, paper, paper, paper, inside];
      const bag = new THREE.Group(); bag.position.y = top; scene.add(bag);
      const bottom = mesh(new THREE.BoxGeometry(W, th, D), paper); bottom.position.y = th / 2; bag.add(bottom);
      const hinge = (pos, geo, ax, flat) => { const p = new THREE.Group(); p.position.set(pos[0], th, pos[2]); const m = mesh(geo, mats); p.add(m); p.userData = { ax, flat }; bag.add(p); return p; };
      const gFront = new THREE.BoxGeometry(W, H, th); gFront.translate(0, H / 2, 0);
      const gSide = new THREE.BoxGeometry(th, H, D); gSide.translate(0, H / 2, 0);
      const front = hinge([0, 0, D / 2], gFront, 'x', PI / 2), backP = hinge([0, 0, -D / 2], gFront.clone(), 'x', -PI / 2);
      const right = hinge([W / 2, 0, 0], gSide, 'z', -PI / 2), left = hinge([-W / 2, 0, 0], gSide.clone(), 'z', PI / 2);
      backP.children[0].rotation.y = PI;
      // bande claire en haut (le rabat)
      [front, backP].forEach((p) => { const b = mesh(new THREE.BoxGeometry(W, 0.16, th * 1.4), std('#3E7566', 0.7)); b.position.y = H - 0.08; p.add(b); });
      const panels = [[front, 2.4], [backP, 2.75], [right, 3.15], [left, 3.45]];
      // poignées
      const rope = std('#1C3A32', 0.6);
      const handles = [D / 2 + 0.02, -D / 2 - 0.02].map((z) => { const h = mesh(new THREE.TorusGeometry(0.32, 0.028, 12, 48, PI), rope); h.position.set(0, top + H + th, z); scene.add(h); return h; });
      // articles
      const gift = new THREE.Group(); scene.add(gift);
      gift.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.42), std('#F4F1EA', 0.6)));
      const gold = phys({ color: '#D2AA55', metalness: 1, roughness: 0.3 });
      const r1 = mesh(new THREE.BoxGeometry(0.1, 0.52, 0.44), gold); gift.add(r1); const r2 = mesh(new THREE.BoxGeometry(0.82, 0.52, 0.1), gold); gift.add(r2);
      const bow = mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 24), gold); bow.position.y = 0.3; gift.add(bow);
      const tissueM = std('#FBFAF6', 0.95, 0, { side: THREE.DoubleSide });
      const tissues = [[-0.4, 0.3, -0.3], [0.1, -0.25, 0.25], [0.45, 0.2, -0.15], [-0.1, 0.05, 0.35]].map((p, i) => { const g = new THREE.PlaneGeometry(0.75, 0.9); g.translate(0, 0.45, 0); const m = mesh(g, tissueM); m.position.set(p[0], top + H - 0.55, p[1] * 0.5); m.rotation.set(p[2], i * 0.8, p[1]); m.userData.at = 6.0 + i * 0.15; scene.add(m); return m; });
      const box2 = mesh(new THREE.BoxGeometry(0.45, 0.62, 0.32), std('#161616', 0.5)); scene.add(box2);
      // étiquette avec le nom
      const tag = new THREE.Group(); scene.add(tag);
      const ttex = canvasTex(512, 320, (c, w, h) => {
        c.fillStyle = '#F4F4F1'; c.fillRect(0, 0, w, h); c.fillStyle = '#161616'; c.textAlign = 'center'; c.textBaseline = 'middle';
        fit(c, nom, 76, '800 #px "Schibsted Grotesk", Arial, sans-serif'); c.fillText(nom, w / 2, h * 0.5);
        c.fillStyle = '#2F5D50'; c.font = '600 30px "Onest", Arial, sans-serif'; c.fillText('NOUVELLE COLLECTION', w / 2, h * 0.78);
        c.beginPath(); c.arc(w / 2, 40, 14, 0, 2 * PI); c.fillStyle = '#C9C9C3'; c.fill();
      });
      const card = mesh(new THREE.BoxGeometry(0.62, 0.39, 0.012), [std('#F4F4F1'), std('#F4F4F1'), std('#F4F4F1'), std('#F4F4F1'), std('#FFFFFF', 0.6, 0, { map: ttex }), std('#F4F4F1')]); card.position.y = -0.42; tag.add(card);
      const string = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), rope); string.position.y = -0.11; tag.add(string);
      return {
        update(t) {
          // la feuille arrive et se déplie
          const a = out(k(t, 0.1, 1.6)); bag.scale.set(Math.max(0.0001, a), 1, Math.max(0.0001, a)); bag.rotation.y = lerp(-1.2, 0, a) + 0.5 * io(k(t, 7.8, 11.2));
          panels.forEach(([p, at]) => { const f = back(k(t, at, at + 0.7)); p.rotation[p.userData.ax] = lerp(p.userData.flat, 0, f); });
          handles.forEach((h, i) => { const s = back(k(t, 4.3 + i * 0.15, 4.9 + i * 0.15)); h.scale.setScalar(Math.max(0.0001, s)); h.visible = s > 0.001; h.rotation.y = bag.rotation.y; h.position.x = Math.sin(bag.rotation.y) * h.position.z * 0; const z = (i ? -1 : 1) * (D / 2 + 0.02); h.position.set(Math.sin(bag.rotation.y) * z, top + H + th, Math.cos(bag.rotation.y) * z); });
          // articles qui tombent dedans
          gift.position.set(-0.25, fallY(t, 5.1, 5.8, 4.5, top + th + 0.25), 0); gift.visible = t > 5.05; gift.rotation.y = 0.2;
          box2.position.set(0.42, fallY(t, 5.5, 6.2, 4.5, top + th + 0.31), 0.02); box2.visible = t > 5.45; box2.rotation.y = -0.15;
              [gift, box2].forEach((o) => { const px = o.position.x, pz = o.position.z; o.position.x = px * Math.cos(bag.rotation.y) + pz * Math.sin(bag.rotation.y); o.position.z = -px * Math.sin(bag.rotation.y) + pz * Math.cos(bag.rotation.y); o.rotation.y += bag.rotation.y; });
          tissues.forEach((m, i) => { const s = back(k(t, m.userData.at, m.userData.at + 0.5)); m.scale.set(1, Math.max(0.0001, s), 1); m.visible = s > 0.001; const px = [-0.4, 0.1, 0.45, -0.1][i], pz = [0.3, -0.25, 0.2, 0.05][i] * 0.5, r = bag.rotation.y; m.position.x = px * Math.cos(r) + pz * Math.sin(r); m.position.z = -px * Math.sin(r) + pz * Math.cos(r); m.rotation.y = i * 0.8 + r; });
          // étiquette accrochée à la poignée avant, qui se balance
          const tg = back(k(t, 8.0, 8.6)); tag.visible = tg > 0.001; tag.scale.setScalar(Math.max(0.0001, tg));
          const hz = D / 2 + 0.05, hx = 0.28, r = bag.rotation.y;
          tag.position.set(hx * Math.cos(r) + hz * Math.sin(r), top + H + th + 0.12, -hx * Math.sin(r) + hz * Math.cos(r));
          tag.rotation.order = 'YXZ'; tag.rotation.set(-0.12, r, 0.35 * Math.sin((t - 8) * 4) * Math.exp(-Math.max(0, t - 8) * 0.9));
        }
      };
    }
  }
};

/* ---------- moteur commun ---------- */
export function supported() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}
export function info(metier) { const S = STORIES[metier] || STORIES.boutique; return { chapters: S.chapters, dur: S.dur }; }

export function play(host, metier, nom, hooks = {}) {
  const S = STORIES[metier] || STORIES.boutique;
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.setClearColor(0x000000, 0);
  host.appendChild(R.domElement); R.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  const scene = new THREE.Scene(); scene.environment = envMap(R);
  const cam = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3e4, 2.6); key.position.set(4, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(S.rim || 0xffffff, 1.8); rim.position.set(-5, 4, -6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-6, 2, 6); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.35 })); ground.rotation.x = -PI / 2; ground.receiveShadow = true; scene.add(ground);
  const story = S.build({ THREE, scene, cam, key, rim, hemi, nom: (nom || '').trim() || 'Votre commerce' });

  let W = 0, H = 0;
  function size() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    R.setSize(W, H, false); cam.aspect = W / H; cam.setViewOffset(W, H, 0, H * 0.1, W, H); cam.updateProjectionMatrix();
  }
  size(); window.addEventListener('resize', size);
  const tgt = new THREE.Vector3();
  function camAt(t) {
    const K = S.cam; let i = 0; while (i < K.length - 1 && t > K[i + 1][0]) i++;
    const a = K[i], b = K[Math.min(i + 1, K.length - 1)], f = a === b ? 1 : io(k(t, a[0], b[0]));
    const az = lerp(a[1], b[1], f), el = lerp(a[2], b[2], f), ty = lerp(a[4], b[4], f);
    const portrait = cam.aspect < 1.05 ? Math.pow(1.05 / cam.aspect, 0.92) * (S.wide || 1) : 1;
    const d = lerp(a[3], b[3], f) * portrait;
    tgt.set(0, ty, 0); cam.position.set(Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d); cam.lookAt(tgt);
  }
  let t0 = performance.now(), last = t0, raf = 0, chap = -1, ended = false, alive = true;
  function frame(now) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    let ci = 0; S.chapters.forEach((c, i) => { if (t >= c.s) ci = i; });
    if (ci !== chap) { chap = ci; hooks.chapter && hooks.chapter(ci); }
    camAt(Math.min(t, S.dur));
    story.update(Math.min(t, S.dur + 4), dt);
    R.render(scene, cam);
    if (!ended && t >= S.dur) { ended = true; hooks.end && hooks.end(); }
  }
  let mt = 0;
  if (!hooks.manual) raf = requestAnimationFrame(frame);
  return {
    advance(dt) { mt += dt; let ci = 0; S.chapters.forEach((c, i) => { if (mt >= c.s) ci = i; }); hooks.chapter && hooks.chapter(ci); camAt(Math.min(mt, S.dur)); story.update(Math.min(mt, S.dur + 4), dt); },
    draw() { R.render(scene, cam); },
    chapters: S.chapters, dur: S.dur,
    seek(sec) { t0 = performance.now() - sec * 1000; },
    stop() {
      alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', size);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
      R.dispose(); try { R.forceContextLoss(); } catch (e) {} R.domElement.remove();
    }
  };
}
