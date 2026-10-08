# Mesa T20 — Mega atualização

Objetivo: os jogadores jogam pelo celular. Cada um entra com a ficha do Fichas de Nimb (PDF exportado),
ataca e lança magias com dados 3D; o servidor resolve tudo pela regra do livro e o telão mostra a
animação da carta do herói até o alvo. O mestre deixa de digitar dano: só coloca as cartas dos
inimigos na mesa e conduz. Para as cenas de conversa, o telão vira uma visual novel.

Decisões tomadas com o grupo:

- **Rede:** mesmo Wi-Fi. O PC do mestre é o servidor e os celulares entram por QR code.
- **Regras:** as do livro. Ataque = d20 + bônus contra a Defesa (com margem de ameaça e multiplicador).
  Magia com resistência = o alvo rola Fortitude/Reflexos/Vontade contra a CD do conjurador
  (10 + metade do nível + atributo-chave). Falhou = efeito cheio; passou = metade ou nada.
- **Stack:** Vite + React + TypeScript nas telas; Three.js para os dados 3D; Canvas 2D (motor próprio,
  brilho aditivo) para os efeitos — o PixiJS ficou de fora por não ser necessário.
  O servidor continua em Node puro (HTTP + SSE) e roda em TypeScript direto (Node 22.18+).

## Fases

Situação: fases 0 a 5 prontas. Depois do primeiro teste com o grupo: o modo cena ficou sem caixa de
diálogo (a fala é na voz dos jogadores) e ganhou posição livre com profundidade; entraram as mensagens
secretas (com revelação no telão), o editor de ficha completo (magias próprias com aprimoramentos e uso
repetido, poderes e itens usáveis com bônus ativos), o Chefe Final, a iniciativa única dos inimigos, a regra
da casa "ninguém morre direto", encontros e cenas prontos e o backup. O dado gira no celular e cai do alto
no telão. Fora do escopo por decisão do grupo: instalar como app no celular (nem todos conseguiriam no iPhone).

### Fase 0 — Base
- Projeto Vite com quatro páginas: `/` (início), `/mestre`, `/telao`, `/jogador`.
- Código compartilhado em `src/shared` (tipos, regras, dados, catálogo de magias), usado pelo
  servidor e pelas telas.
- Mestre e telão portados para React, mantendo tudo o que já existe: PV/PM, condições, boss, efeitos,
  turnos, galeria e desfazer.
- Estado v3 com migração automática do `estado.json` v2.
- `iniciar.sh`/`iniciar.bat` instalam e compilam sozinhos na primeira vez.

### Fase 1 — Fichas e celular
- Importação do PDF do Nimb, lendo os campos do formulário: identidade, atributos, PV, PM, Defesa,
  perícias (com Fort/Ref/Von/Iniciativa), até 5 ataques e as magias.
- Fichas salvas em `data/fichas/` e editáveis pelo mestre e pelo jogador.
- Grimório com as 256 magias do Nimb (básico + Ameaças + Deuses + Heróis) em dados estruturados.
- App do jogador: entra por QR ou importa a ficha, mostra a carta do personagem, PV/PM, ataques,
  magias, dados e a vez dele.

### Fase 2 — Ações automáticas
- Motor de regras no servidor: ataque, crítico, dano por tipo, RD/imunidade/vulnerabilidade, custo e
  limite de PM, aprimoramentos, resistência, metade/anula, cura, PV negativo e morte.
- Dados 3D (d4, d6, d8, d10, d12, d20) com 14 modelos. O resultado sai do servidor; celular e telão
  animam juntos.
- Log de ações com desfazer.
- Bestiário: o mestre cadastra fichas de ameaças (ou cola o bloco de estatísticas do livro) e "põe a
  carta na mesa". Os inimigos atacam os heróis pelo painel, também automático.
- Efeitos persistentes: magia sustentada ou com duração fica no telão até acabar ou ser dissipada.

### Fase 3 — Efeitos visuais
- Motor de efeitos (Canvas 2D) no telão, que sai da carta do herói até o alvo.
- Ataques com arma (corte, perfuração, impacto, flecha/virote, arma de fogo, arremesso), cada um com
  três desfechos: acerto, crítico e erro.
- Magias: arquétipos (projétil, raio, explosão, cone, toque, queda do céu, surgir do chão, aura, cura,
  mental, ilusão, dreno, convocação, adivinhação, campo/névoa, teleporte) × elemento (fogo, frio,
  eletricidade, ácido, luz, trevas, essência, psíquico, natureza, som, veneno, sangue, Tormenta…).
  Cada uma das 256 magias recebe sua combinação e seus detalhes, com desfechos acerto, resistiu e erro.
- Tremor e flash proporcionais ao dano; vibração no celular de quem foi atingido.

### Fase 4 — Modo cena (visual novel)
- Fundo de cenário, personagens e NPCs em posições no palco, quem fala em destaque, caixa de diálogo
  com texto digitado e expressões.
- O mestre arrasta os personagens entre as posições; os jogadores podem falar pelo celular.

### Fase 5 — Extras
- Testes pedidos pelo mestre: o celular de cada jogador pede a rolagem (perícia ou resistência).
- Iniciativa rolada pelo celular; aviso de "sua vez" com vibração.
- Sangramento automático (Con CD 15) e condições com duração que expiram sozinhas.
- Bestiário gerado dos PDFs dos livros (script local, fora do git).
- Sons por tipo de efeito.
