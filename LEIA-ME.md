# Mesa T20

Três telas, um programa só, sem internet (todo mundo no mesmo Wi-Fi):

| Tela | Onde abrir |
|------|-----------|
| **Mestre** (você) | `http://localhost:8787/mestre` |
| **Telão** (a tela que todo mundo vê) | `http://<IP-do-mestre>:8787/telao?fundo=1` |
| **Celular** de cada jogador | `http://<IP-do-mestre>:8787/jogador` (ou o QR code da aba *Jogadores*) |

O telão mostra os heróis embaixo, o **boss no centro**, os capangas nos lados e a **ordem de turno** no topo.
Os jogadores agem pelo celular: atacam, lançam magias e rolam dados. As regras são aplicadas sozinhas e
o resultado aparece animado no telão.

## Ligar

**Linux / macOS:** `./iniciar.sh` · **Windows:** dois cliques em `iniciar.bat` (precisa do Node.js 22.18+).

Na primeira vez ele instala as dependências e monta as telas (`npm install` e `npm run build`).
A janela mostra os endereços para os outros aparelhos. Se não abrir, libere a porta no firewall:
`sudo ufw allow 8787/tcp`. No telão, `F` = tela cheia e `B` = liga/desliga o fundo.
Para o OBS, use `http://localhost:8787/telao` como fonte de navegador (fundo transparente).

## Jogadores no celular

1. Cada jogador exporta a ficha em PDF no **Fichas de Nimb** e abre o endereço do QR code da aba **Jogadores**.
2. Ele importa o PDF ali mesmo (ou você importa pelo painel). A ficha fica salva em `data/fichas/` com um
   **código de 6 letras**: o QR de cada personagem entra direto nele da próxima vez.
3. **Pôr na mesa** coloca a carta do herói no telão.

No celular: aba **Ações** (ataques da ficha, com alvo, bônus da situação e dano extra), **Magias**
(as magias da ficha, com aprimoramentos, custo em PM e limite pelo nível), **Dados** (14 modelos de dado
3D, perícias e rolagem livre — pode ser secreta), **Carta** (foto, cor e dado preferido) e **Mais**.
O dado gira na mão do jogador; ele **arrasta para cima (ou toca)** para lançar, e o dado cai no telão
saindo da carta dele. O celular vibra quando chega a vez do jogador.

## Regras automáticas (Tormenta20)

- **Ataque:** d20 + bônus contra a Defesa do alvo. Crítico só quando acerta e o d20 está na margem
  (multiplica os dados, não os bônus). Animações diferentes para acerto, crítico e erro.
- **Magias:** CD = 10 + ½ nível + atributo-chave. O alvo rola a resistência sozinho (metade, anula ou
  parcial). PM gasto, limite de PM pelo nível e condições (com duração em rodadas) são aplicados.
- **Dano:** RD (geral e por tipo), imunidade e vulnerabilidade. PV temporário sai primeiro. Herói em 0 PV
  fica inconsciente e sangrando; morre no limite negativo. Sangrando rola Constituição CD 15 no início do
  turno (passa = estabiliza, falha = perde 1d6 PV).
- **Magias que ficam na mesa** (sustentadas, de cena, por rodadas): ficam no telão — aura no alvo, anel
  em quem sustenta e um selo com o nome e quanto falta — até acabarem ou serem desfeitas. Quando acabam,
  as condições que elas impuseram (ex.: *enredado* da Teia) saem junto. O jogador encerra pelo celular;
  você encerra na faixa **Magias ativas** do painel.
- Tudo cai no **Registro** (botão de lista no topo do painel), com cada dado e teste. **↶ Desfazer**
  (`Ctrl+Z`) volta a última mudança, inclusive um ataque.

## No painel do mestre

- **Combate:** cada inimigo tem os ataques dele em botões — clique no ataque e depois no alvo e o
  motor resolve. **Habilidade** serve para sopros, explosões e afins (dano, teste, CD, condição, vários alvos).
  Heróis sem celular também podem agir pelo card. Dano/cura manual continua lá (`Enter` = dano,
  `Shift+Enter` = cura; clique nas fotos para selecionar vários).
- **Inimigos:** o PV fica **escondido por padrão** (menu de cada um: nada, estado, barra ou número).
  O **olho** mostra/esconde no telão; **Invocar** põe o boss no centro com clarão e tremor.
- **Turnos:** iniciativa (ou **Rolar iniciativa**), **Iniciar combate**, **Próximo ▶** (tecla `N`).
  Com *Em combate, cada um só age na sua vez* ligado (aba Jogadores), o celular espera a vez.

## Bestiário

Aba **Bestiário**: suas fichas de inimigos guardadas, prontas para virar carta.

- **Importar do livro (PDF):** escolha o PDF do *Ameaças de Arton* (ou do livro básico) e os blocos de
  estatísticas viram fichas (PV, Defesa, resistências, RD, imunidades e ataques). Fica tudo só neste
  computador, em `data/bestiario/`. Confira as que vierem sem ND. Também dá pela linha de comando:
  `npm run bestiario -- "caminho/Ameaças de Arton.pdf"`.
- **Nova ameaça:** cole o bloco de estatísticas do livro e clique em *Preencher a ficha*.
- **Guardar no bestiário:** no lápis de um inimigo da mesa.
- **Pôr na mesa:** escolha a quantidade e clique; com mais de um, eles são numerados (*Orc 1, Orc 2…*).

## Modo cena (roleplay)

Aba **Cena**: o telão vira uma *visual novel*.

- Escolha o **cenário** (imagens da pasta `cenarios/` — envie pela Galeria) e ponha **heróis, inimigos ou
  NPCs** no palco. **Arraste** para mudar de lugar; clique num personagem para virar, trazer para frente
  ou tirar de cena. **Organizar** espalha todo mundo por igual.
- Escreva a fala escolhendo **quem fala** (ou *Narrador*) e `Enter`. Quem fala fica em destaque e os
  outros escurecem; o texto corre na caixa de diálogo.
- Os jogadores falam pela aba **Cena** do celular (o herói entra em cena sozinho). Dá para desligar.
- O botão **Combate / Cena** decide o que o telão mostra. PNG com fundo transparente aparece como
  personagem de corpo inteiro; outras imagens aparecem como carta com moldura.

## Galeria

Aba **Galeria**: envie imagens (botão, arrastar para o painel ou `Ctrl+V`). **Mostrar aos jogadores**
põe a imagem em destaque no telão com título. Os filtros mandam os arquivos para `personagens/`,
`bosses/`, `galeria/` ou `cenarios/`. A lixeira não apaga: o arquivo vai para `lixeira/`.

## Para quem mexe no código

- `npm run dev` — servidor com recarga automática (telas via Vite).
- `npm run build` — monta as telas em `dist/` · `npm start` — roda sem o Vite.
- `npm run tipos` — confere os tipos (TypeScript).
- `node ferramentas/testar-regras.ts <pdf de arcanista do Nimb>` — roteiro do motor de regras.
- Plano e decisões: `docs/PLANO.md`.

## Segurança e porta

O painel do mestre só abre neste computador. Para controlar de outro aparelho, defina um `"pin"`
em `config/mesa.json`. A porta também é configurada ali. Os celulares só veem a própria ficha e o que
o telão mostra (Defesa, resistências e PV escondidos dos inimigos não saem do servidor).
