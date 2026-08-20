# Auditoria de autorização e RLS

## Escopo

A auditoria cobre os papéis de criador da viagem, organizador participante,
usuário autenticado sem relação com a viagem e visitante sem sessão. As tabelas
colaborativas verificadas são `trips`, `trip_participants`,
`trip_invitations`, `itinerary_items`, `trip_tasks`, `item_comments`,
`trip_expenses` e `task_reminder_deliveries`.

## Riscos encontrados e correções

1. Consultas de política acessavam `trip_participants` diretamente. Como essa
   tabela possui sua própria RLS, verificações de um segundo participante
   podiam falhar para atribuição de tarefas e seleção do pagador. Funções
   `security definer` restritas ao papel autenticado agora verificam a
   participação atual e a pessoa candidata sem expor a lista de participantes.
2. As concessões de UPDATE permitiam alterar colunas de procedência, como
   `trip_id` e `created_by`. Os grants agora são limitados às colunas
   realmente editáveis por cada fluxo.
3. A função privilegiada `get_trip_participants` tinha execução herdada pelo
   papel `public`. A execução foi revogada de `public` e `anon`, mantendo
   apenas `authenticated` e `service_role`.

## Garantias automatizadas

`supabase/tests/database/rls.test.sql` valida:

- acesso integral do criador e do organizador aos dados compartilhados;
- isolamento de todas as tabelas para usuário não participante;
- ausência de leitura de viagens para visitantes sem sessão;
- ausência de vazamento pela função privilegiada de participantes;
- atribuição legítima entre participantes;
- imutabilidade das colunas de procedência.

O job E2E inicia um Supabase limpo, aplica todas as migrations e executa
`npm run test:db` antes dos testes no navegador. Uma falha de política bloqueia
o merge.
