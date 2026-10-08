// Bandeja de dados 3D: joga os dados na tela e faz cada um parar no valor que o servidor sorteou.
// Sem motor de fisica: rolamento e quiques sao uma animacao controlada, e o fim e sempre exato.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { formaDado, orientacaoPara } from './geometria.ts';
import { materiaisDoDado } from './aparencia.ts';

export interface DadoParaRolar {
  faces: number;
  valor: number;
  modelo: string;
}

interface DadoEmCena {
  malha: THREE.Mesh;
  inicio: THREE.Vector3;
  fim: THREE.Vector3;
  qInicio: THREE.Quaternion;
  qFim: THREE.Quaternion;
  eixo: THREE.Vector3;
  voltas: number;
  atraso: number;
  escala: number;
}

const suave = (t: number) => 1 - (1 - t) ** 3;

export class Bandeja {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cena = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private dados: DadoEmCena[] = [];
  private quadro = 0;
  private resolver: (() => void) | null = null;
  private readonly observador: ResizeObserver;
  private largura = 1;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera.position.set(0, 13, 7.5);
    this.camera.lookAt(0, 0, 0.6);

    this.cena.add(new THREE.HemisphereLight(0xfff1d6, 0x2a1d38, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.4);
    sol.position.set(-4, 12, 6);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    this.cena.add(sol);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.35 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    this.cena.add(chao);

    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(canvas.parentElement ?? canvas);
    this.ajustar();
  }

  private ajustar() {
    const caixa = (this.canvas.parentElement ?? this.canvas).getBoundingClientRect();
    const w = Math.max(1, caixa.width);
    const h = Math.max(1, caixa.height);
    this.largura = w / h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.largura;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.cena, this.camera);
  }

  limpar() {
    for (const d of this.dados) {
      this.cena.remove(d.malha);
      for (const m of d.malha.material as THREE.Material[]) m.dispose();
    }
    this.dados = [];
    this.renderer.render(this.cena, this.camera);
  }

  /**
   * Rola os dados e resolve quando todos param.
   * `origem`: de onde o dado entra, de -1 (canto esquerdo) a 1 (direito) na beira de baixo da tela
   * (no telao, a carta do heroi que lancou). Sem origem, entra por um dos lados.
   */
  rolar(lista: DadoParaRolar[], duracaoMs = 1700, origem?: number): Promise<void> {
    cancelAnimationFrame(this.quadro);
    this.resolver?.();
    this.limpar();
    if (!lista.length) return Promise.resolve();

    // Ate 6 por fileira; muitos dados ficam menores.
    const porFila = Math.min(6, lista.length);
    const filas = Math.ceil(lista.length / porFila);
    const escala = Math.max(0.45, Math.min(1, 3.2 / Math.max(porFila, filas * 1.4)));
    const espaco = 2.5 * escala;
    const larguraVisivel = Math.min(1, this.largura / 1.4);
    const cimaTela = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    this.dados = lista.map((d, i) => {
      const forma = formaDado(d.faces);
      const malha = new THREE.Mesh(forma.geometria, materiaisDoDado(d.modelo, forma.faces.map((f) => f.valor), d.faces));
      malha.castShadow = true;
      const linha = Math.floor(i / porFila);
      const naLinha = Math.min(porFila, lista.length - linha * porFila);
      const col = i % porFila;
      const fim = new THREE.Vector3(
        (col - (naLinha - 1) / 2) * espaco * larguraVisivel,
        forma.raio * escala * 0.9,
        (linha - (filas - 1) / 2) * espaco * 1.05,
      );
      const lado = Math.random() < 0.5 ? -1 : 1;
      const inicio = origem === undefined
        ? new THREE.Vector3(lado * (7 + Math.random() * 3), 4 + Math.random() * 2, 3 + Math.random() * 2)
        : new THREE.Vector3(origem * 6.5 * Math.max(1, this.largura / 1.6) + (Math.random() - 0.5), 3 + Math.random(), 8 + Math.random());
      const paraCamera = new THREE.Vector3().subVectors(this.camera.position, fim).normalize();
      const qFim = orientacaoPara(forma, d.valor, paraCamera, cimaTela, (Math.random() - 0.5) * 0.35);
      const qInicio = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      malha.scale.setScalar(escala);
      malha.position.copy(inicio);
      malha.quaternion.copy(qInicio);
      this.cena.add(malha);
      return {
        malha, inicio, fim, qInicio, qFim, escala,
        eixo: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        voltas: 3 + Math.random() * 3,
        atraso: i * 55,
      };
    });

    return new Promise((resolve) => {
      this.resolver = resolve;
      const t0 = performance.now();
      const passo = (agora: number) => {
        let terminou = true;
        for (const d of this.dados) {
          const t = Math.min(1, Math.max(0, (agora - t0 - d.atraso) / duracaoMs));
          if (t < 1) terminou = false;
          // Caminho: desliza ate o lugar e quica tres vezes, cada vez mais baixo.
          const avanco = suave(Math.min(1, t * 1.25));
          d.malha.position.lerpVectors(d.inicio, d.fim, avanco);
          const quique = Math.abs(Math.sin(t * Math.PI * 3.2)) * (1 - t) ** 2 * 3.2;
          d.malha.position.y = THREE.MathUtils.lerp(d.inicio.y, d.fim.y, Math.min(1, t * 2.2)) + quique;
          // Rolamento livre que desacelera e encaixa na face sorteada no fim.
          const giro = new THREE.Quaternion().setFromAxisAngle(d.eixo, d.voltas * Math.PI * 2 * suave(t));
          const rolando = d.qInicio.clone().premultiply(giro);
          const encaixe = THREE.MathUtils.smoothstep(t, 0.55, 0.97);
          d.malha.quaternion.slerpQuaternions(rolando, d.qFim, encaixe);
        }
        this.renderer.render(this.cena, this.camera);
        if (terminou) {
          this.resolver = null;
          resolve();
          return;
        }
        this.quadro = requestAnimationFrame(passo);
      };
      this.quadro = requestAnimationFrame(passo);
    });
  }

  /** Dados "na mao": giram no meio da tela esperando o jogador lancar. */
  segurar(lista: { faces: number; modelo: string }[]) {
    cancelAnimationFrame(this.quadro);
    this.resolver?.();
    this.limpar();
    const n = Math.min(lista.length, 6);
    const escala = n > 3 ? 0.7 : 1;
    this.dados = lista.slice(0, 6).map((d, i) => {
      const forma = formaDado(d.faces);
      const malha = new THREE.Mesh(forma.geometria, materiaisDoDado(d.modelo, forma.faces.map((f) => f.valor), d.faces));
      malha.castShadow = true;
      malha.scale.setScalar(escala * 1.25);
      const fim = new THREE.Vector3((i - (n - 1) / 2) * 2.6 * escala, 2.2, 0.8);
      malha.position.copy(fim);
      this.cena.add(malha);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      malha.quaternion.copy(q);
      return {
        malha, inicio: fim.clone(), fim, qInicio: q, qFim: q, escala,
        eixo: new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize(), voltas: 0, atraso: i * 0.7,
      };
    });
    const t0 = performance.now();
    const girar = (agora: number) => {
      const t = (agora - t0) / 1000;
      for (const d of this.dados) {
        const giro = new THREE.Quaternion().setFromAxisAngle(d.eixo, t * 2.6);
        d.malha.quaternion.copy(d.qInicio).premultiply(giro);
        d.malha.position.y = d.fim.y + Math.sin(t * 2.4 + d.atraso) * 0.25;
      }
      this.renderer.render(this.cena, this.camera);
      this.quadro = requestAnimationFrame(girar);
    };
    this.quadro = requestAnimationFrame(girar);
  }

  /** Os dados na mao saem voando para cima (para o telao). */
  arremessar(duracaoMs = 520): Promise<void> {
    cancelAnimationFrame(this.quadro);
    const partida = this.dados.map((d) => ({ d, p: d.malha.position.clone(), q: d.malha.quaternion.clone() }));
    return new Promise((resolve) => {
      const t0 = performance.now();
      const voar = (agora: number) => {
        const t = Math.min(1, (agora - t0) / duracaoMs);
        for (const { d, p, q } of partida) {
          // Sobe em direcao a camera e some pelo topo da tela, girando rapido.
          d.malha.position.set(p.x * (1 - t), p.y + t * t * 14, p.z - t * t * 9);
          d.malha.quaternion.copy(q).premultiply(new THREE.Quaternion().setFromAxisAngle(d.eixo, t * 9));
          d.malha.scale.setScalar(d.escala * 1.25 * (1 - t * 0.5));
        }
        this.renderer.render(this.cena, this.camera);
        if (t < 1) this.quadro = requestAnimationFrame(voar);
        else {
          this.limpar();
          resolve();
        }
      };
      this.quadro = requestAnimationFrame(voar);
    });
  }

  destruir() {
    cancelAnimationFrame(this.quadro);
    this.observador.disconnect();
    this.limpar();
    this.renderer.dispose();
  }
}
