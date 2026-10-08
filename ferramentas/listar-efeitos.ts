// Lista o efeito derivado de cada magia (para revisar): node ferramentas/listar-efeitos.ts [inicio] [fim]
import { TODAS_COM_EFEITO } from '../src/shared/magias-efeitos.ts';
const [ini = 0, fim = 999] = process.argv.slice(2).map(Number);
TODAS_COM_EFEITO().slice(ini, fim).forEach(({ m, e }, i) => {
  const partes = [
    `${ini + i} ${m.id}`, `${e.alvo}${e.maxAlvos ? `x${e.maxAlvos}` : ''}`,
    e.dano ? `dano=${e.dano} ${e.tipoDano ?? '?'}` : '', e.cura ? `cura=${e.cura}` : '',
    e.res ? `${e.res}/${e.sucesso}` : '', e.falhou ? `cond=${e.falhou.join(',')}` : '',
    e.persistente ? `pers=${e.persistente}` : '', `anim=${e.anim.tipo}/${e.anim.elemento}`,
  ];
  console.log(partes.filter(Boolean).join(' | '));
});
