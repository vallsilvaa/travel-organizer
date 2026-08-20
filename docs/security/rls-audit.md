# Auditoria de autorização e RLS

Esta auditoria cobre o esquema existente até a migração
`20260820000000_harden_authorization_and_rls.sql`. O modelo de acesso considera
quatro perfis: criador da viagem, organizador participante, usuário autenticado
sem participação e visitante desconectado.

## Regra de acesso

- Criadores e organizadores aceitos podem consultar e administrar itinerário,
  tarefas e despesas da viagem da qual participam.
- Comentários só podem ser alterados ou excluídos pelo autor enquanto ele ainda
  participa da viagem.
- Participantes consultam a lista completa de pessoas por meio de
  `get_trip_participants`; a tabela de participação expõe diretamente apenas a
  linha do próprio usuário.
- Convites são uma exceção necessária à regra de participação: antes de entrar
  na viagem, a pessoa convidada pode consultar e responder somente ao convite
  destinado ao e-mail presente em seu token autenticado.
- Visitantes desconectados não recebem permissões nas tabelas da aplicação nem
  na função pública de participantes.
- A chave de serviço continua reservada ao processo de lembretes no servidor e
  nunca deve ser enviada ao navegador.

## Riscos identificados e correções

| Risco | Impacto | Correção |
| --- | --- | --- |
| Funções `SECURITY DEFINER` herdavam execução de `PUBLIC` | Uma função privilegiada nova ou alterada poderia ser exposta pela API sem intenção | Execução pública e anônima foi revogada; funções de trigger também foram removidas dos papéis clientes e novas funções públicas passam a exigir concessão explícita |
| Políticas consultavam `trip_participants` sob o RLS do próprio chamador | Atribuir tarefa ou despesa a outro participante podia falhar silenciosamente | A verificação de participação foi centralizada em `private.is_trip_participant`, fora dos esquemas expostos e com `search_path` vazio |
| Autor removido da viagem ainda podia alterar ou excluir comentário próprio | Uma pessoa sem acesso atual preservava escrita residual | As políticas de atualização e exclusão agora exigem autoria e participação ativa |
| Status de lembrete permanecia visível após a remoção da viagem | Metadados de uma tarefa podiam continuar acessíveis | A leitura agora exige que o proprietário ainda participe da viagem da tarefa |
| Privilégios de atualização incluíam identificadores e campos de auditoria | Um cliente poderia tentar reatribuir autoria ou mover registros entre viagens | Os grants foram reduzidos às colunas realmente editáveis pela aplicação |

## Cobertura automatizada

Os testes em `supabase/tests/rls_authorization.test.sql` validam:

- RLS habilitado em todas as tabelas da aplicação;
- leitura e escrita esperadas para criador e organizador;
- isolamento de usuário autenticado sem participação;
- ausência de acesso para visitante desconectado;
- proteção da função que lista participantes e das funções de trigger;
- convite visível apenas para criador ou destinatário e aceite único;
- remoção imediata do acesso residual a comentários e lembretes;
- atribuição legítima de tarefas e despesas entre participantes.

Execute localmente com:

```bash
npm run supabase:start
npm run test:db
npm run supabase:stop
```

O CI executa a mesma suíte depois de iniciar o Supabase local e antes dos testes
de navegador.
