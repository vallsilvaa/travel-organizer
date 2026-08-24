# Investigação de incidentes em produção

Este documento cobre as ferramentas de observabilidade configuradas para o
projeto `travel-organizer` na Vercel e o passo a passo para investigar um
incidente de produção.

## Ferramentas

| Ferramenta | O que cobre | Onde acessar |
| --- | --- | --- |
| Sentry (`vs-software` / `javascript-nextjs`) | Erros não tratados no client, server e edge, com release (`VERCEL_GIT_COMMIT_SHA`) e ambiente (`VERCEL_ENV`) anexados a cada evento. | https://vs-software.sentry.io |
| Sentry Cron Monitoring | Execuções do cron `/api/cron/task-reminders` (declarado em `vercel.json`) — detecta execuções ausentes, atrasadas ou que retornaram erro. | Sentry → Crons |
| `/api/health` | Status agregado: conectividade com o Supabase (via `auth/v1/health`, independente de RLS/grants) e se as variáveis do serviço de lembretes estão configuradas. Retorna `200` (`ok`) ou `503` (`degraded`). | `https://travel-organizer-zeta.vercel.app/api/health` |
| Vercel Runtime Logs / Runtime Errors | Logs brutos de cada invocação de função (`console.*`, status HTTP, stack traces). | Dashboard da Vercel → projeto `travel-organizer` → Logs, ou via MCP (`get_runtime_logs` / `get_runtime_errors`) |
| Vercel Deployments | Histórico de deploys, candidatos a rollback. | Dashboard da Vercel → Deployments |

## Metadata capturada (e o que nunca é enviado)

As falhas do cron de lembretes (`src/app/api/cron/task-reminders/route.ts`)
são reportadas ao Sentry com `deliveryId` e um `code` de falha
(`owner_lookup_failed`, `missing_email`, `http_4xx`, `network_error` etc).
**Nunca** enviamos e-mail do destinatário, título da tarefa ou destino da
viagem nos eventos — isso mantém os alertas seguros de expor dados pessoais
de usuários, mesmo quando o alerta é encaminhado por e-mail ou uma
integração externa.

## Passo a passo de triagem

1. **Confirmar o sintoma** — `GET /api/health`. Se `supabase` estiver
   `error`, o problema é de infraestrutura (Supabase fora do ar, URL/chave
   incorreta). Se `reminders` estiver `error`, uma das 5 variáveis do cron
   (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `REMINDER_EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`) foi removida ou expirou.
2. **Olhar o Sentry** — filtrar por `environment:production`, ordenar por
   eventos mais recentes. O `release` de cada evento é o SHA do commit; use
   `git show <sha>` para ver exatamente o que foi deployado quando o erro
   começou.
3. **Cron especificamente** — Sentry → Crons → `task-reminders` mostra o
   histórico de check-ins (ok / erro / ausente). Um check-in ausente no
   horário esperado (09:00 UTC, ver `vercel.json`) indica que a Vercel não
   chegou a invocar o endpoint (problema de plataforma, não de código).
4. **Logs brutos** — se o Sentry não tiver contexto suficiente, puxe os
   Runtime Logs da Vercel para a rota e janela de tempo específicas
   (`get_runtime_logs` com `requestPath` ou `deploymentId`).
5. **Decidir: hotfix ou rollback** — para uma regressão introduzida por um
   deploy recente, prefira rollback (abaixo) para restaurar o serviço
   rapidamente, e investigue o hotfix separadamente sem pressão de tempo.

## Rollback

```
vercel rollback <deployment-id-ou-url-anterior> --yes
```

Liste os candidatos com `vercel list travel-organizer --prod` ou pelo
dashboard (deployments marcados como "rollback candidate"). Variáveis de
ambiente são por projeto, não por deployment — um rollback não reverte
mudanças de env vars.

## Alertas

O Sentry cria por padrão uma regra de alerta ("Alert me on every new
issue") que notifica por e-mail os membros do projeto quando um novo tipo
de erro aparece pela primeira vez. Para revisar ou ajustar o limiar
(ex.: agrupar por volume em vez de alertar a cada issue nova), acesse
**Project Settings → Alerts** em
https://vs-software.sentry.io/settings/vs-software/projects/javascript-nextjs/alerts/rules/.
