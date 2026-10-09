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
O dado gira na mão do jogador; ele **arrasta para cima (ou toca)** para lançar, e o dado cai do alto na
mesa do telão. O resumo aparece no celular quando o golpe chega no telão. O celular vibra na vez do
jogador, quando ele leva dano e quando chega uma mensagem secreta.

## Regras automáticas (Tormenta20)

- **Ataque:** d20 + bônus contra a Defesa do alvo. Crítico só quando acerta e o d20 está na margem
  (multiplica os dados, não os bônus). Animações diferentes para acerto, crítico e erro.
- **Magias:** CD = 10 + ½ nível + atributo-chave. O alvo rola a resistência sozinho (metade, anula ou
  parcial). PM gasto, limite de PM pelo nível e condições (com duração em rodadas) são aplicados.
- **Dano:** RD (geral e por tipo), imunidade e vulnerabilidade. PV temporário sai primeiro. Herói em 0 PV
  fica inconsciente e sangrando; morre no limite negativo (−10 ou −metade do PV máximo). Sangrando rola
  Constituição CD 15 no início do turno (passa = estabiliza, falha = perde 1d6 PV).
- **Regra da casa — ninguém morre direto** (ligada por padrão, aba Jogadores): o golpe que derruba o herói
  para no 0; só os danos seguintes descem até o limite de morte.
- **Poderes e itens:** o que tiver custo, efeito ou bônus aparece na aba **Ações** do celular. Usar gasta
  PM (com o limite pelo nível), aplica o efeito e, se tiver bônus (ex.: Fúria +2 ataque e dano), fica ativo
  na mesa — o bônus entra sozinho nos ataques e na Defesa até acabar.
- **Iniciativa:** heróis rolam cada um; os inimigos fazem **um teste só, com o menor bônus** (regra do
  livro — dá para desligar). Empate: maior bônus primeiro, depois heróis.
- **Magias que ficam na mesa** (sustentadas, de cena, por rodadas): ficam no telão — aura no alvo, anel
  em quem sustenta e um selo com o nome e quanto falta — até acabarem ou serem desfeitas. Quando acabam,
  as condições que elas impuseram (ex.: *enredado* da Teia) saem junto. O jogador encerra pelo celular;
  você encerra na faixa **Magias ativas** do painel.
- Tudo cai no **Registro** (botão de lista no topo do painel), com cada dado e teste. **↶ Desfazer**
  (`Ctrl+Z`) volta a última mudança, inclusive um ataque.

## No painel do mestre

- **Combate:** cada inimigo tem os ataques e as **habilidades** dele em botões — clique e depois no alvo e o
  motor resolve (dano, teste e CD, condição, PM gasto). Ao selecionar, a descrição do livro aparece embaixo;
  habilidades só de texto (📜) apenas anunciam no telão. **Avulsa** serve para algo que não está na ficha.
  Heróis sem celular também podem agir pelo card. Dano/cura manual continua lá (`Enter` = dano,
  `Shift+Enter` = cura; clique nas fotos para selecionar vários).
- **Inimigos:** o PV fica **escondido por padrão** (menu de cada um: nada, estado, barra ou número).
  O **olho** mostra/esconde no telão; **Invocar** põe o boss no centro com clarão e tremor.
- **Turnos:** iniciativa (ou **Rolar iniciativa**, ou **Pedir teste → Iniciativa** para cada um rolar no
  celular), **Iniciar combate**, **Próximo ▶** (tecla `N`).
  Com *Em combate, cada um só age na sua vez* ligado (aba Jogadores, ligado por padrão): fora da vez o
  celular só usa **reações** (magia ou poder marcado como Reação); na vez, conta **ação padrão + movimento**
  (atacar e a maioria das magias gastam a padrão; ação completa gasta as duas; dá para trocar a padrão por
  um segundo movimento). O celular tem **Mover-se**, **Sacar / recarregar** e **Passar a vez**. No topo do
  painel, **P M** mostra o que o herói da vez já gastou — clique para devolver as ações.

## Bestiário

Aba **Bestiário**: suas fichas de inimigos guardadas, prontas para virar carta.

- **Importar do livro (PDF):** escolha o PDF do *Ameaças de Arton* (ou do livro básico) e os blocos de
  estatísticas viram fichas (PV, Defesa, resistências, RD, imunidades e ataques). Fica tudo só neste
  computador, em `data/bestiario/`. Confira as que vierem sem ND. Também dá pela linha de comando:
  `npm run bestiario -- "caminho/Ameaças de Arton.pdf"`.
- **Nova ameaça:** cole o bloco de estatísticas do livro e clique em *Preencher a ficha*.
- **Habilidades e magias:** o leitor do livro pega todas (inclusive as magias da lista com •), com descrição,
  execução, PM, dano, teste e CD. No lápis, cada uma abre para ajustar o que ele não entendeu, criar novas
  ou marcar **Telão** (o nome aparece para os jogadores). *Ler mecânica da descrição* preenche sozinho.
- **Guardar no bestiário:** no lápis de um inimigo da mesa.
- **Pôr na mesa:** escolha a quantidade e clique; com mais de um, eles são numerados (*Orc 1, Orc 2…*).
- **Chefe final** (Ameaças de Arton, p. 370): ligue a coroa antes de pôr na mesa, ou use *Tornar chefe final*
  no lápis do inimigo. Dobra o PV, +2 PM por ND, ganha **Maior que a Morte** (com metade dos PV ou mais,
  fica imune a morte instantânea — o motor já aplica), RD 5/10/20 a partir de veterano e ND +2.
- **Encontros prontos:** monte o grupo na mesa e use *Salvar inimigos da mesa*. Na sessão, **Pôr na mesa**
  acrescenta e **Trocar a mesa** substitui os inimigos atuais.

## Modo cena (roleplay)

Aba **Cena**: o telão vira uma *visual novel*. A fala é na voz de vocês — o telão só mostra a cena.

- Escolha o **cenário** (imagens da pasta `cenarios/` — envie pela Galeria) e ponha **heróis, inimigos ou
  NPCs** no palco. **Arraste para qualquer lugar**: mais para cima fica mais ao fundo (e menor), dá para
  montar uma roda na taverna. **Em fila** e **Em roda** organizam todo mundo de uma vez.
- **Falando agora:** clique em quem está falando (ou dois cliques no personagem) e ele fica em destaque,
  com a placa do nome; os outros escurecem.
- **Expressão:** troque a imagem de um personagem só na cena (bravo, ferido, disfarçado…).
- **Cenas prontas:** *Salvar este palco* guarda cenário e personagens nas posições; um clique traz de volta.
- O botão **Combate / Cena** decide o que o telão mostra. PNG com fundo transparente aparece como
  personagem de corpo inteiro; outras imagens aparecem como carta com moldura.

## Mensagens secretas

Botão do **envelope** no topo do painel: escreva algo só para um ou mais jogadores, com foto se quiser
(anexar, colar com `Ctrl+V` ou escolher da galeria). No celular chega uma **carta lacrada** que só ele vê;
ele pode responder em segredo. Você vê quem já leu e as respostas. **Revelar no telão** mostra a carta
para todo mundo (e esconde de novo quando quiser). As fotos enviadas assim ficam em `data/segredos/`,
fora das pastas públicas, até serem reveladas.

## Editar fichas na mesa

Na aba **Jogadores**, **Editar** abre a ficha completa: identidade, atributos, PV/PM/Defesa, RD, perícias,
ataques (arma nova, item mágico), magias do livro, **magias próprias** (homebrew: dano, teste, condição,
quanto tempo fica na mesa, aprimoramentos com +PM, efeito repetível enquanto ativa e a animação no telão —
funcionam como as do livro), poderes, regras da casa, itens mágicos e notas. Poderes e itens com *Usar na
mesa* ganham custo em PM, efeito e bônus enquanto ativos. **Ficha em branco** cria um personagem sem o Nimb
(no celular também: *Criar personagem do zero*). Com *Jogadores editam a própria
ficha* ligado, cada um também edita pelo celular (aba **Mais**); desligado, eles só mexem nas anotações.
**Calcular pela regra do livro** (aba Atributos) monta PV, PM, Defesa e as perícias pela classe, nível,
armadura e escudo — bom para criar do zero (até nível 20) ou subir de nível.

**Subiu de nível no Nimb?** Exporte o PDF de novo e importe: se já existe ficha com o mesmo nome, ela é
**atualizada** (não duplica), mantendo QR/código, foto, cor, dado, notas, magias próprias, itens e os ajustes
dos poderes. O aviso mostra o que mudou (nível, PV, arma nova, magia nova). No celular: *Mais → Atualizar
ficha (novo PDF do Nimb)*.

**Biblioteca da casa:** no editor, o mestre usa o 📖 de um item, poder ou magia própria para guardar na
biblioteca (`data/casa.json`); em qualquer ficha, *Da biblioteca da casa…* põe uma cópia. Bom para itens,
acessórios, poderes e regras da casa que vários personagens usam. Vai junto no backup.

**Execução de poderes:** cada poder/item usável tem *Execução* (padrão, movimento, completa, livre, reação).
Vazio usa a que o texto cita (“Como uma reação…”). Marque como **Reação** o que pode ser usado fora da vez.

## Backup

No menu **⋯** do topo: **Baixar backup** gera um arquivo com fichas, bestiário, encontros, cenas e a mesa;
**Restaurar backup** traz tudo de volta (a mesa só se você confirmar). Cada ficha também pode ser baixada em
arquivo (aba Jogadores, ou *Baixar minha ficha* no celular) e importada em outra mesa pelo mesmo botão do
PDF do Nimb.

## Galeria

Aba **Galeria**: envie imagens (botão, arrastar para o painel ou `Ctrl+V`). **Mostrar aos jogadores**
põe a imagem em destaque no telão com título. Os filtros mandam os arquivos para `personagens/`,
`bosses/`, `galeria/` ou `cenarios/`. A lixeira não apaga: o arquivo vai para `lixeira/`.

## Para quem mexe no código

- `npm run dev` — servidor com recarga automática (telas via Vite).
- `npm run build` — monta as telas em `dist/` · `npm start` — roda sem o Vite.
- `npm run tipos` — confere os tipos (TypeScript).
- `node ferramentas/testar-regras.ts data/fichas/<id>.json` (ou um PDF de arcanista do Nimb) — roteiro do motor de regras.
- Plano e decisões: `docs/PLANO.md`.

## Segurança e porta

O painel do mestre só abre neste computador. Para controlar de outro aparelho, defina um `"pin"`
em `config/mesa.json`. A porta também é configurada ali. Os celulares só veem a própria ficha e o que
o telão mostra (Defesa, resistências e PV escondidos dos inimigos não saem do servidor).
