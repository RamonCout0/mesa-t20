// Texturas e materiais dos 14 modelos de dado (desenhados em canvas, sem arquivos externos).
import * as THREE from 'three';
import { MODELO_POR_ID, type ModeloDado } from '../../shared/dados-3d.ts';

const TAM = 256;

// Pseudoaleatorio com semente: o padrao de cada face nao muda entre rolagens.
function semente(n: number) {
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function desenharPadrao(ctx: CanvasRenderingContext2D, m: ModeloDado, chave: number) {
  const r = semente(chave);
  const grad = ctx.createLinearGradient(0, 0, TAM, TAM);
  grad.addColorStop(0, m.base);
  grad.addColorStop(1, m.base);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TAM, TAM);

  if (m.padrao === 'arcoiris') {
    const g = ctx.createLinearGradient(0, 0, TAM, TAM * r());
    ['#ff5b5b', '#ffb84a', '#ffe94a', '#5bff8a', '#4ad3ff', '#8a5bff', '#ff5bd8'].forEach((c, i, l) => g.addColorStop(i / (l.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TAM, TAM);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.arc(r() * TAM, r() * TAM, 10 + r() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (m.padrao === 'estrelas') {
    const g = ctx.createRadialGradient(TAM * r(), TAM * r(), 10, TAM / 2, TAM / 2, TAM);
    g.addColorStop(0, '#3b2a8a');
    g.addColorStop(1, m.base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TAM, TAM);
    for (let i = 0; i < 70; i += 1) {
      ctx.fillStyle = i % 9 === 0 ? m.detalhe : '#ffffff';
      ctx.globalAlpha = 0.4 + r() * 0.6;
      const t = r() < 0.9 ? 1 + r() * 1.5 : 2.5 + r() * 2;
      ctx.beginPath();
      ctx.arc(r() * TAM, r() * TAM, t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (m.padrao === 'veios') {
    ctx.strokeStyle = m.detalhe;
    for (let i = 0; i < 5; i += 1) {
      ctx.globalAlpha = 0.25 + r() * 0.35;
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath();
      let x = r() * TAM;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < TAM) {
        x += (r() - 0.5) * 40;
        y += 12 + r() * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (m.padrao === 'madeira') {
    for (let y = 0; y < TAM; y += 3) {
      ctx.strokeStyle = m.detalhe;
      ctx.globalAlpha = 0.15 + 0.25 * Math.abs(Math.sin(y * 0.09 + r()));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= TAM; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + y * 0.01) * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (m.padrao === 'nevoa' || m.padrao === 'brasa') {
    for (let i = 0; i < 9; i += 1) {
      const g = ctx.createRadialGradient(r() * TAM, r() * TAM, 0, r() * TAM, r() * TAM, 50 + r() * 90);
      g.addColorStop(0, m.detalhe);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = m.padrao === 'brasa' ? 0.5 : 0.35;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TAM, TAM);
    }
    if (m.padrao === 'brasa') {
      ctx.strokeStyle = m.detalhe;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        let x = r() * TAM;
        let y = r() * TAM;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k += 1) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (m.padrao === 'cristal') {
    const g = ctx.createLinearGradient(0, 0, TAM, TAM);
    g.addColorStop(0, m.detalhe);
    g.addColorStop(0.45, m.base);
    g.addColorStop(1, m.base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TAM, TAM);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(TAM * 0.55, 0);
    ctx.lineTo(0, TAM * 0.55);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // liso (ouro): leve brilho no centro
    const g = ctx.createRadialGradient(TAM * 0.35, TAM * 0.3, 10, TAM / 2, TAM / 2, TAM * 0.8);
    g.addColorStop(0, m.detalhe);
    g.addColorStop(0.5, m.base);
    g.addColorStop(1, m.base);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TAM, TAM);
    ctx.globalAlpha = 1;
  }
}

function desenharNumero(ctx: CanvasRenderingContext2D, m: ModeloDado, valor: number, lados: number) {
  const texto = String(valor);
  const tam = lados <= 6 ? 120 : lados <= 10 ? 96 : lados === 12 ? 100 : 84;
  ctx.font = `700 ${texto.length > 1 ? tam * 0.82 : tam}px "Palatino Linotype", Palatino, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = TAM / 2 + (lados === 4 || lados === 8 || lados === 20 ? 14 : 4);
  // Contorno do lado oposto da cor do numero, para ler em qualquer modelo.
  const claro = parseInt(m.numero.slice(1, 3), 16) > 128;
  ctx.lineWidth = 10;
  ctx.strokeStyle = claro ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.45)';
  ctx.strokeText(texto, TAM / 2, y);
  ctx.fillStyle = m.numero;
  ctx.fillText(texto, TAM / 2, y);
  // Sublinha 6 e 9 para nao confundir.
  if ((valor === 6 || valor === 9) && lados > 6) {
    ctx.fillRect(TAM / 2 - 22, y + tam * 0.42, 44, 7);
  }
}

const TEXTURAS = new Map<string, THREE.CanvasTexture>();

function texturaFace(m: ModeloDado, valor: number, lados: number) {
  const chave = `${m.id}-${lados}-${valor}`;
  let t = TEXTURAS.get(chave);
  if (!t) {
    const canvas = document.createElement('canvas');
    canvas.width = TAM;
    canvas.height = TAM;
    const ctx = canvas.getContext('2d')!;
    desenharPadrao(ctx, m, valor * 31 + lados);
    desenharNumero(ctx, m, valor, lados);
    t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    TEXTURAS.set(chave, t);
  }
  return t;
}

/** Um material por face (cada uma com seu numero), na ordem dos grupos da geometria. */
export function materiaisDoDado(modeloId: string, valores: number[], lados: number) {
  const m = MODELO_POR_ID[modeloId] ?? MODELO_POR_ID.ouro;
  return valores.map((valor) => new THREE.MeshPhysicalMaterial({
    map: texturaFace(m, valor, lados),
    metalness: m.metal,
    roughness: m.aspereza,
    clearcoat: m.metal < 0.5 ? 0.6 : 0.2,
    clearcoatRoughness: 0.2,
    transparent: m.opacidade < 1,
    opacity: m.opacidade,
    emissive: new THREE.Color(m.emissivo),
    emissiveIntensity: m.padrao === 'brasa' ? 0.9 : 0.4,
    side: THREE.FrontSide,
  }));
}
