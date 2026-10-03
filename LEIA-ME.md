# Mesa T20

Duas telas, um programa só, sem internet:

| Tela | Onde abrir |
|------|-----------|
| **Mestre** (você) | `http://localhost:8787/mestre` |
| **Telão** (a outra tela, que todo mundo vê) | `http://<IP-do-mestre>:8787/telao?fundo=1` |

O telão mostra os **6 heróis** (foto, PV, PM, condições) embaixo, o **boss no centro** com efeitos,
os capangas nos lados e a **ordem de turno** no topo. Os jogadores só olham para ele.

## Ligar

**Linux / macOS:** `./iniciar.sh` (precisa do Node.js 18+).
**Windows:** dois cliques em `iniciar.bat`.

A janela mostra o endereço do telão para o outro aparelho (mesmo Wi-Fi). Se não abrir,
libere a porta no firewall: `sudo ufw allow 8787/tcp`. No telão, `F` = tela cheia.
Para usar no OBS, adicione `http://localhost:8787/telao` como fonte de navegador (fundo transparente).

## No painel do mestre

- **Dano / Cura:** digite o valor no cartão e clique (`Enter` = dano, `Shift+Enter` = cura).
  O botão **⋯** abre os botões rápidos (−10 … +10), PV temporário, PM e condições de T20.
- **Vários de uma vez:** clique na foto dos cartões para selecionar; aparece uma barra flutuante de dano/cura em área.
- **Inimigos:** o PV é **escondido por padrão**. O menu de cada inimigo escolhe o que o telão mostra:
  nada, só o estado ("Ferido"…), só a barra ou o número. O botão do **olho** mostra/esconde o inimigo no telão;
  **Invocar** põe o boss no centro com entrada de clarão e tremor.
- **Habilidades do boss:** os chips ligam/desligam o que aparece no telão. As notas secretas e a Defesa
  nunca saem do servidor.
- **Efeitos:** tremor, clarão, raio, chamas, gelo, sangue, escuridão, luz de cura.
- **Turnos:** preencha a iniciativa (ou **Rolar iniciativa**, d20 + bônus), **Iniciar combate**, depois
  **Próximo ▶** (tecla `N`). Clicar numa ficha da fila dá a vez a ela.
- **↶ Desfazer** (`Ctrl+Z`). O menu **⋯** do topo tem copiar endereço do telão, Descanso e Reiniciar.
- O estado fica em `data/estado.json`: ao reabrir, tudo volta como estava.

## Galeria: mostrar imagens aos jogadores

Na aba **Galeria** do painel (topo, ao lado de *Combate*):

- **Enviar:** clique em *Enviar imagens*, arraste arquivos para qualquer lugar do painel ou cole com `Ctrl+V`
  (um print ou "copiar imagem" do navegador). PNG, JPG, WEBP, GIF ou SVG, até 25 MB.
- **Mostrar aos jogadores:** passe o mouse na imagem e clique. Ela aparece em destaque no telão, com moldura
  e o título que você escrever em *No telão agora*. **Esconder** (ou o **×** no topo do painel) tira do telão.
- Os filtros **Heróis** e **Inimigos** mostram os tokens; enviar com um deles selecionado já coloca a imagem
  em `personagens/` ou `bosses/`, pronta para escolher no **lápis** do cartão. O resto fica em `galeria/`.
- A **lixeira** de cada imagem não apaga nada: o arquivo vai para a pasta `lixeira/`, de onde dá para recuperar.

## Suas fotos

Coloque `.png .jpg .webp .gif .svg` em `personagens/` (heróis) e `bosses/` (inimigos). No cartão,
clique no **lápis** e escolha a imagem (o editor mostra uma prévia). Use **Novo herói / Novo inimigo** para criar.
As imagens atuais são brasões de exemplo (`node ferramentas/gerar-exemplos.js` recria).

## Segurança e porta

O painel do mestre só abre neste computador. Para controlar de outro aparelho, defina um `"pin"`
em `config/mesa.json`. A porta também é configurada ali.
