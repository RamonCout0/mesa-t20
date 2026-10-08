// Formas dos dados (d4, d6, d8, d10, d12, d20) com uma face por grupo e UV centrado em cada face,
// para cada face ter sua propria textura com o numero.
import * as THREE from 'three';

export interface Face {
  normal: THREE.Vector3;
  centro: THREE.Vector3;
  /** Direcao "para cima" do numero desenhado na face (no plano da face). */
  cima: THREE.Vector3;
  valor: number;
}

export interface FormaDado {
  geometria: THREE.BufferGeometry;
  faces: Face[];
  /** Raio aproximado, para espacar os dados. */
  raio: number;
}

/** Trapezoedro pentagonal: o d10 de verdade (10 pipas). */
function geometriaD10() {
  const h = 1.05; // altura dos vertices dos polos
  // Altura do anel em zigue-zague que deixa cada pipa plana: e = h(1 - cos36)/(1 + cos36).
  const cos36 = Math.cos(Math.PI / 5);
  const e = (h * (1 - cos36)) / (1 + cos36);
  const r = 1;
  const v: number[][] = [[0, h, 0], [0, -h, 0]];
  for (let i = 0; i < 10; i += 1) {
    const ang = (i * Math.PI * 2) / 10;
    v.push([Math.cos(ang) * r, i % 2 ? -e : e, Math.sin(ang) * r]);
  }
  const anel = (i: number) => 2 + ((i % 10) + 10) % 10;
  const tris: number[] = [];
  // 5 pipas de cima (polo de cima + 3 do anel) e 5 de baixo.
  for (let k = 0; k < 5; k += 1) {
    const a = anel(2 * k);
    const b = anel(2 * k + 1);
    const c = anel(2 * k + 2);
    tris.push(0, b, a, 0, c, b);
    const d = anel(2 * k + 1);
    const ee = anel(2 * k + 2);
    const f = anel(2 * k + 3);
    tris.push(1, d, ee, 1, ee, f);
  }
  const pos: number[] = [];
  for (const i of tris) pos.push(...v[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function geometriaBase(lados: number): THREE.BufferGeometry {
  if (lados === 4) return new THREE.TetrahedronGeometry(1.15);
  if (lados === 6) return new THREE.BoxGeometry(1.35, 1.35, 1.35).toNonIndexed();
  if (lados === 8) return new THREE.OctahedronGeometry(1.1);
  if (lados === 10) return geometriaD10();
  if (lados === 12) return new THREE.DodecahedronGeometry(1.08);
  return new THREE.IcosahedronGeometry(1.1);
}

/** Agrupa triangulos com a mesma normal: cada grupo e uma face do dado. Normais sempre para fora. */
function separarFaces(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const n = pos.count / 3;
  const grupos: { normal: THREE.Vector3; tris: number[]; inverter: boolean[] }[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < n; t += 1) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const centroide = a.clone().add(b).add(c).divideScalar(3);
    const inverter = normal.dot(centroide) < 0;
    if (inverter) normal.negate();
    const grupo = grupos.find((x) => x.normal.dot(normal) > 0.995);
    if (grupo) { grupo.tris.push(t); grupo.inverter.push(inverter); } else grupos.push({ normal, tris: [t], inverter: [inverter] });
  }
  return grupos;
}

const CACHE = new Map<number, FormaDado>();

export function formaDado(lados: number): FormaDado {
  const pronta = CACHE.get(lados);
  if (pronta) return pronta;
  const base = geometriaBase(lados);
  const grupos = separarFaces(base);
  const pos = base.getAttribute('position');
  const novaPos: number[] = [];
  const uvs: number[] = [];
  const normais: number[] = [];
  const geometria = new THREE.BufferGeometry();
  const faces: Face[] = [];
  const v = new THREE.Vector3();
  let raio = 0;

  grupos.forEach((grupo, gi) => {
    // Centro e base local da face (u para a direita, w para "cima" do numero).
    const verts: THREE.Vector3[] = [];
    for (const t of grupo.tris) for (let k = 0; k < 3; k += 1) verts.push(v.fromBufferAttribute(pos, t * 3 + k).clone());
    const centro = verts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(verts.length);
    // "Cima" aponta para o vertice mais distante do centro (o bico da pipa no d10, a ponta no d4/d8/d20).
    const longe = verts.reduce((m, p) => (p.distanceTo(centro) > m.distanceTo(centro) ? p : m), verts[0]);
    let cima = new THREE.Vector3().subVectors(longe, centro);
    cima.sub(grupo.normal.clone().multiplyScalar(cima.dot(grupo.normal))).normalize();
    if (lados === 6) cima = Math.abs(grupo.normal.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const direita = new THREE.Vector3().crossVectors(cima, grupo.normal).normalize();
    const meio = Math.max(...verts.map((p) => {
      const d = new THREE.Vector3().subVectors(p, centro);
      return Math.max(Math.abs(d.dot(direita)), Math.abs(d.dot(cima)));
    }));
    raio = Math.max(raio, ...verts.map((p) => p.length()));

    const inicio = novaPos.length / 3;
    grupo.tris.forEach((t, ti) => {
      // Triangulo com a ordem trocada vira (0, 2, 1) para a face apontar para fora.
      for (const k of grupo.inverter[ti] ? [0, 2, 1] : [0, 1, 2]) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, t * 3 + k);
        const d = new THREE.Vector3().subVectors(p, centro);
        novaPos.push(p.x, p.y, p.z);
        normais.push(grupo.normal.x, grupo.normal.y, grupo.normal.z);
        uvs.push(0.5 + d.dot(direita) / (2 * meio) * 0.92, 0.5 + d.dot(cima) / (2 * meio) * 0.92);
      }
    });
    geometria.addGroup(inicio, grupo.tris.length * 3, gi);
    faces.push({ normal: grupo.normal.clone(), centro, cima, valor: 0 });
  });

  geometria.setAttribute('position', new THREE.Float32BufferAttribute(novaPos, 3));
  geometria.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3));
  geometria.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // Numeracao: faces opostas somam lados+1 (como nos dados de verdade), exceto o d4.
  const livres = faces.map((_, i) => i);
  let proximo = 1;
  while (livres.length) {
    const i = livres.shift()!;
    faces[i].valor = proximo;
    const oposta = livres.find((j) => faces[j].normal.dot(faces[i].normal) < -0.99);
    if (oposta !== undefined && lados !== 4) {
      faces[oposta].valor = lados + 1 - proximo;
      livres.splice(livres.indexOf(oposta), 1);
    }
    proximo += 1;
    while (faces.some((f) => f.valor === proximo)) proximo += 1;
  }

  const forma = { geometria, faces, raio };
  CACHE.set(lados, forma);
  return forma;
}

/** Rotacao que deixa a face com `valor` virada para `paraCima`, com o numero de pe na tela. */
export function orientacaoPara(forma: FormaDado, valor: number, paraCima: THREE.Vector3, telaCima: THREE.Vector3, giro = 0) {
  const face = forma.faces.find((f) => f.valor === valor) ?? forma.faces[0];
  const q1 = new THREE.Quaternion().setFromUnitVectors(face.normal, paraCima);
  const cimaGirado = face.cima.clone().applyQuaternion(q1);
  // Gira em torno do eixo "para cima" ate o numero ficar alinhado com o topo da tela.
  const alvo = telaCima.clone().sub(paraCima.clone().multiplyScalar(telaCima.dot(paraCima))).normalize();
  let angulo = Math.atan2(new THREE.Vector3().crossVectors(cimaGirado, alvo).dot(paraCima), cimaGirado.dot(alvo));
  angulo += giro;
  const q2 = new THREE.Quaternion().setFromAxisAngle(paraCima, angulo);
  return q2.multiply(q1);
}
