---
name: Rotina Bonette
description: Mesa clara para o dia de uma pessoa, com uma ação azul e listas quietas.
colors:
  bg: "#f5f5f7"
  panel: "#ffffff"
  panel-2: "#f0f0f3"
  line: "#e5e5ea"
  ink: "#1d1d1f"
  muted: "#55555b"
  focus: "#0071e3"
  hot: "#b42318"
  warn: "#8a5a00"
  ok: "#17663f"
  strategy: "#1d4f91"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.025em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  button:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    letterSpacing: "normal"
rounded:
  control: "10px"
  panel: "16px"
  pill: "9999px"
spacing:
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.focus}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-capsule:
    backgroundColor: "{colors.focus}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "{colors.hot}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    width: "100%"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px 20px 24px"
    width: "min(32rem, calc(100% - 2rem))"
  nav-item:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "color-mix(in srgb, #0071e3 10%, transparent)"
    textColor: "{colors.focus}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  priority-p1:
    textColor: "{colors.hot}"
  priority-p2:
    textColor: "{colors.strategy}"
  priority-p3:
    textColor: "{colors.warn}"
  priority-p4:
    textColor: "{colors.muted}"
---

# Design System: Rotina Bonette

## Overview

**Creative North Star: "Luz de mesa"**

Rotina Bonette é a mesa clara da categoria, no nível de Things 3, Fantastical e Sunsama. Fundo de mesa, painéis brancos, tinta quase preta, uma ação azul. O resto é lista, fio e horário. A densidade é de app pessoal.

A luz é o padrão. O escuro só inverte os mesmos tokens para um cinza frio. A sans do sistema cobre display, título e corpo. A palavra Hoje é o único display: 3rem, peso 700, tracking -0.03em, com a data do dia em texto muted imediatamente acima.

A navegação é uma coluna branca de 240px. O item ativo é texto azul sobre um wash de 10% do azul, nunca uma pílula preenchida. A captura fica no pé dessa coluna e, abaixo de 768px, acima da barra inferior. A home, a partir de 1024px, abre em duas colunas: Hoje e a linha Agora à esquerda, trilho de horas de 09 a 18 à direita.

**Key Characteristics:**

- Mesa clara, um azul de ação
- Sans do sistema em tudo; display só em Hoje
- 10px nos controles, 16px nos painéis e no diálogo
- Agrupamento em fio de 1px; sombra só no diálogo
- Ativo em wash, não em pílula
- Home em split, com trilho de horas

## Colors

Paleta de mesa: neutros frios e um único azul de ação. Cores de estado existem para prioridade e retorno, e não disputam o botão.

O tema claro é o valor normativo de cada token. No escuro, o mesmo nome troca de valor:

- `bg` #1c1c1e, `panel` #2c2c2e, `panel-2` #3a3a3c, `line` #48484a
- `ink` #f5f5f7, `muted` #d1d1d6, `focus` #4da3ff
- `hot` #ff8a80, `warn` #ffd60a, `ok` #6ee7b7, `strategy` #9ec1ff

### Primary

- **Azul de ação** (`focus`): o único acento de ação. Botão primário, item de navegação ativo, anel de foco, borda de campo focado e cor de fallback dos blocos da agenda.

### Neutral

- **Mesa** (`bg`): fundo da página. Também o fundo do cartão de tarefa dentro de uma coluna.
- **Papel** (`panel`): sidebar, cartão, diálogo, campo e barra inferior. Branco opaco no tema claro.
- **Recolhido** (`panel-2`): hover de item, botão ghost e poço de carregamento. Um passo abaixo do papel, sem sombra.
- **Fio** (`line`): borda de 1px de cartão, campo, coluna e divisória de lista.
- **Tinta** (`ink`): texto principal e o aviso transitório (fundo tinta, texto mesa).
- **Tinta baixa** (`muted`): data, meta, rótulo de campo, item de navegação em repouso, placeholder.

### Status

- **Urgente** (`hot`): P1 e erro de ação. Também o botão danger.
- **Estratégia** (`strategy`): P2.
- **Atenção** (`warn`): P3.
- **Feito** (`ok`): estado positivo pontual, como rotina ligada. Não substitui o azul de ação.

P4 usa `muted`. Não há chip de fundo nesses tons.

### Named Rules

**The One Action Rule.** O azul `focus` é a única cor de ação. Hot, warn, ok e strategy marcam prioridade ou retorno e não viram um segundo primário.

**The Cool Inversion Rule.** O tema escuro reatribui os mesmos nomes para um cinza frio. Não cria acento novo nem muda o raio, o tipo ou a sombra.

## Typography

**Display Font:** sans do sistema (`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
**Body Font:** a mesma sans
**Label/Mono Font:** a mesma sans; horários usam números tabulares, sem família mono

**Character:** Uma voz só, a da interface nativa. O peso e o tracking fazem a hierarquia. Não há serifada de display.

### Hierarchy

- **Display** (700, 3rem, line-height 1, tracking -0.03em): só a palavra Hoje.
- **Headline** (650, 1.75rem, line-height 1.15, tracking -0.02em): título das outras páginas.
- **Title** (600, 1.125rem, line-height 1.75rem, tracking -0.025em): título de diálogo, nome da tarefa em Agora e o rótulo Agenda.
- **Body** (400, 1rem, line-height 1.5): texto de linha e cópia corrida, em tinta.
- **Label** (400, 0.875rem, line-height 1.25rem): data, meta, rótulo de campo, item de navegação. O botão usa o mesmo tamanho no peso 600. O item ativo sobe para 500.

### Named Rules

**The Single Face Rule.** Uma família, a sans do sistema, do display ao rótulo. Sem Fraunces e sem segunda fonte.

**The Hoje Display Rule.** 3rem, peso 700 e tracking -0.03em pertencem só à palavra Hoje. A data do dia, em 0.875rem e cor muted, senta imediatamente acima e não se repete como sobretítulo nas outras páginas. Título de página é 1.75rem / 650.

## Layout

O shell é uma sidebar fixa de 240px (`panel`, fio à direita, 12px nas laterais e 20px na vertical) e uma coluna de conteúdo. Abaixo de 768px a sidebar some. A main respira 16px na horizontal e 32px no topo; a partir de 768px a horizontal vai a 32px. No estreito, o padding inferior é 112px para a barra fixa não cobrir o conteúdo. Login fica fora do shell. Foco entra na rota e o shell se retira: a sessão ocupa a viewport sozinha.

A captura é uma linha de campo mais um select. No desktop ela ancora o pé da sidebar. Abaixo de 768px ela fica na barra inferior, acima dos itens de navegação.

A home é a única superfície em duas colunas. Até 1024px a agenda empilha embaixo. A partir daí a grade é `minmax(0, 1fr)` e `minmax(280px, 340px)`, com 40px de vão e 48px a partir de 1024px. À esquerda: a data, Hoje, a linha Agora (título, projeto, motivo, cápsula primária) e as linhas seguintes com check circular. À direita: o trilho de horas. A janela padrão é 09–18, a 56px por hora, e o trilho só cresce se um bloco cair fora dela. As outras páginas ficam numa coluna sob o mesmo shell, abrindo no título de página.

O ritmo que se repete é 8px, 12px, 16px e 32px: vão curto, padding de controle, padding de painel, respiro de página.

### Named Rules

**The Sidebar Rule.** 240px, papel branco, fio à direita, invisível abaixo de 768px. A barra inferior só existe nessa quebra.

**The Capture Anchor Rule.** A captura fica no fim da sidebar no desktop e, em tela pequena, acima da navegação inferior.

**The Home Split Rule.** Só a home abre em duas colunas a partir de 1024px: o dia à esquerda, o trilho de horas à direita. As outras páginas permanecem numa coluna.

## Elevation & Depth

Profundidade por camada de tom e por fio. A mesa fica atrás, o papel fica na frente, o recolhido marca hover e poço. Cartão, coluna, lista e campo não flutuam. A única sombra do sistema levanta o diálogo. O véu atrás dele é `rgb(29 29 31 / 0.42)`.

### Shadow Vocabulary

- **Diálogo** (`box-shadow: 0 16px 40px rgb(29 29 31 / 0.16)`): modal aberto. Sem borda. Some junto com a animação quando o usuário pede menos movimento.

### Named Rules

**The Line Or Shadow Rule.** Superfície que só agrupa leva fio de 1px e nenhuma sombra. O diálogo leva sombra e nenhum fio. Os dois tratamentos não se misturam.

## Shapes

Cantos em dois passos, mais o círculo quando a forma é a ação de concluir ou o primário da linha Agora. Bordas são fio de 1px na cor `line`, retas, sem deslocamento. O diálogo corta o fio e fica só no raio de painel.

- **Controle** (10px): botão, campo, select, item de navegação, cartão aninhado, bloco da agenda, aviso transitório.
- **Painel** (16px): cartão que agrupa, coluna, diálogo.
- **Cápsula** (pílula): o primário da linha Agora. Círculo de 20px: o check vazio da lista, borda `line`, borda `focus` no hover.

### Named Rules

**The Two Corners Rule.** 10px é controle, item de navegação, cartão aninhado e bloco de agenda. 16px é painel grande e diálogo. Cápsula e círculo ficam no primário da linha Agora e no check da lista.

## Components

### Buttons

Texto semibold de 0.875rem, padding 8px 12px. Ao pressionar, descem 1px, salvo com `prefers-reduced-motion: reduce`. Desabilitados ficam a 50% de opacidade. O anel de foco é o contorno global: 2px `focus`, offset 2px.

- **Shape:** controle (10px), exceto a cápsula da home.
- **Primary:** fundo `focus`, texto branco. Hover clareia com `brightness(1.1)` em 150ms. É a única ação cheia da tela.
- **Capsule:** o mesmo primário em pílula, padding 8px 16px. Usado na linha Agora ("Iniciar foco").
- **Ghost:** papel, texto tinta, fio de 1px. Hover troca o fundo para `panel-2`.
- **Danger:** fundo `hot`, texto branco. Sem hover próprio.
- **Quiet:** sem fundo, texto muted. Hover só escurece o texto para tinta. É saída e ação terciária.

### Cards / Containers

- **Corner Style:** painel (16px) quando o bloco agrupa; controle (10px) quando o cartão é um item dentro de outro, como a tarefa no kanban.
- **Background:** papel. O item aninhado pode usar a mesa para se separar da coluna.
- **Shadow Strategy:** nenhuma. Ver Elevation.
- **Border:** fio de 1px.
- **Internal Padding:** 16px no cartão de agrupamento. O item aninhado usa 12px.

### Inputs / Fields

- **Style:** rótulo muted em 0.875rem, 8px acima do controle. O controle é papel, fio de 1px, raio de 10px, padding 8px 12px, largura da coluna. Placeholder em muted.
- **Focus:** o campo apaga o contorno e passa o fio para `focus`. Botões e links seguem o contorno de 2px.
- **Capture:** o mesmo cromado de controle, em linha com um select de tipo. O lugar dela está em Layout.
- **Disabled:** a opacidade de 50% dos botões. O campo não tem tratamento disabled próprio.

### Navigation

Coluna de 240px, papel, fio à direita. Marca "Rotina Bonette" em 1rem semibold com tracking apertado, 24px acima da lista. Itens em 0.875rem, padding 8px 12px, raio 10px, vão de 2px. Repouso: texto muted. Hover: fundo `panel-2` e texto tinta. Ativo: texto `focus`, peso 500, fundo `color-mix(in srgb, var(--focus) 10%, transparent)`.

Abaixo de 768px os mesmos itens viram uma faixa horizontal de 0.75rem dentro da barra inferior, com o mesmo ativo em wash. A captura fica acima dessa faixa.

### Dialog

Papel opaco, raio 16px, largura `min(32rem, calc(100% - 2rem))`, altura máxima `min(85dvh, 40rem)`, padding 20px 20px 24px, sem borda. Sombra do vocabulário de Elevation. Título no estilo Title. O miolo abre 16px abaixo, em coluna com 12px de vão. Ao abrir, sobe 8px e aparece em 180ms com `cubic-bezier(0.16, 1, 0.3, 1)`. Com menos movimento, aparece sem deslocar. Clique no véu fecha.

### Priority

P1–P4 são texto de 0.75rem, peso 600, sem caixa. P1 `hot`, P2 `strategy`, P3 `warn`, P4 `muted`.

### List rows

Linha de hoje: check circular de 20px, fio de 1px, vazio, hover no fio `focus`; título em 1rem peso 500; meta em 0.875rem muted; divisória `line` embaixo, padding vertical 12px. A linha Agora é a mesma divisória com o título em Title e a cápsula à direita. Ações secundárias dessa linha (concluir, trocar) são texto muted de 0.875rem, hover para tinta.

### Agenda rail

Rótulo Agenda no estilo Title. Horas em 0.75rem, peso 400, números tabulares, muted, numa calha de 48px. Cada hora mede 56px. O bloco encosta à direita da calha, raio 10px, padding 4px 8px, fundo `color-mix(in srgb, <cor do projeto> 22%, var(--panel))`. Sem cor de projeto, a mistura usa `focus`. Título do bloco em 0.875rem peso 500; a segunda linha é 0.75rem muted. Altura mínima do bloco: 28px.

### Named Rules

**The Wash Rule.** Item ativo da navegação é texto `focus` sobre wash de 10% do mesmo azul, no raio de controle. Não é fundo azul sólido.

**The Bare Priority Rule.** P1–P4 são texto semibold de 0.75rem na cor do estado. Sem fundo, sem borda, sem cápsula.

## Do's and Don'ts

### Do:

- **Do** usar o tema claro como padrão: fundo `bg`, painel `panel`, tinta `ink`, secundário `muted`, ação `focus`.
- **Do** reservar 3rem / 700 / -0.03em para Hoje e 1.75rem / 650 para os outros títulos de página.
- **Do** desenhar o diálogo em papel opaco, raio 16px, largura min(32rem, calc(100% - 2rem)), sem borda, com sombra 0 16px 40px rgb(29 29 31 / 0.16).
- **Do** manter a home em split: data acima de Hoje, linha Agora com primário em cápsula, linhas com círculo de 20px, trilho 09–18 com blocos a 22% da cor do projeto sobre o painel.

### Don't:

- **Don't** usar Fraunces ou qualquer serifada de display.
- **Don't** pintar o item ativo da sidebar como pílula preenchida.
- **Don't** colocar sombra em card que só agrupa, nem borda no diálogo.
- **Don't** criar um segundo azul de ação. Cores de prioridade não substituem `focus`.
- **Don't** repetir o display de Hoje, nem a linha de data acima dele, nas outras páginas.
