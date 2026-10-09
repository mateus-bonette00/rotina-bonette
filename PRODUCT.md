# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Uma pessoa só: Mateus, no computador, no próprio dia de trabalho. O app não tem equipe, cliente nem segundo usuário.

## Product Purpose

Organizar o dia, os projetos, as ideias e o foco sem virar gerenciador corporativo. Sucesso é abrir o app e ver, sem esforço, o que fazer agora, o que é de hoje, o que está em execução e o que foi estacionado de propósito.

## Positioning

Um limitador pessoal de trabalho aberto. A diferença não é mais uma lista: o sistema recusa excesso (1 tarefa em execução, 3 para hoje, 4 projetos ativos), guarda ideia fora do trabalho até uma ação explícita, e explica por que uma tarefa está na frente.

## Operating Context

Uso local, no navegador, em `127.0.0.1`. Um PIN de 4 dígitos, sem cadastro. Postgres só na máquina. O dia mistura projetos de cliente e projetos próprios (clínicas, landings, produtos pessoais). A tela principal é o dia de hoje; kanban, calendário, projetos, ideias, rotinas, foco e ajustes são o mesmo trabalho visto de outro ângulo.

## Capabilities and Constraints

Telas existentes: login com teclado numérico, hoje, kanban, calendário, projetos, detalhe de projeto, ideias, rotinas, foco, ajustes.

Regras que permanecem:

- `DOING` aceita no máximo 1 tarefa; trocar pede confirmação e é atômico.
- `TODAY` aceita no máximo 3 tarefas não concluídas.
- No máximo 4 projetos `ACTIVE`. `MAINTENANCE` não entra nessa conta.
- Ideia nova entra na inbox e só vira projeto ou tarefa por ação explícita.
- A home destaca uma única tarefa como agora. Se nada está em execução, sugere a melhor de hoje e mostra o motivo (prazo, P1, compromisso externo, desbloqueio, vitória rápida, projeto ativo).
- Prioridade manual (P1–P4) ganha do score sugerido.
- Sem “criar conta”, sem ERP, sem clone de Notion.

O usuário vai ajustar funcionalidades com o tempo. Esta rodada não inventa capacidade nova. Muda UI, UX, layout e elementos de todas as telas.

Aberto: nenhuma necessidade de acessibilidade específica além de contraste legível e uso no desktop, com celular ainda utilizável.

## Brand Commitments

Nome: Rotina Bonette. Idioma da interface: português do Brasil. Tom direto, pessoal, sem jargão de empresa.

Em 8 de outubro de 2026 o usuário revogou a direção visual da especificação (dark mode, Fraunces, azul de foco, cards suaves) e a usabilidade atual. Pedido: trocar todas as telas, layouts e elementos.

No mesmo dia escolheu o padrão da categoria, sem ironia: barra, lista e uma ação, no nível de Things 3, Fantastical e Sunsama. Luz de mesa, interface clara, uma ação azul, listas quietas, calendário preciso. Funcionalidades existentes permanecem.

## Evidence on Hand

Projetos e tarefas de exemplo vêm do seed (`npm run db:seed`): OdontoClin, Landing Page Janaina, Junta Já, Pró-Saúde, Ponte Viva, Clineline. São dados reais do produto, não depoimentos. Não inventar clientes, preços, métricas ou resultados.

## Product Principles

1. Uma coisa em execução.
2. Hoje cabe em três.
3. A semana cabe em quatro projetos ativos.
4. Ideia não é tarefa até o usuário decidir.
5. O motivo da prioridade aparece junto da sugestão.
