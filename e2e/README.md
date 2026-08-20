# Testes ponta a ponta

Os testes usam Chromium e uma instância local isolada do Supabase. Antes de
executar, inicie o Docker e o Supabase e exporte as variáveis retornadas por
`supabase status -o env`:

```bash
npm run supabase:start
eval "$(npx supabase status -o env)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
npx playwright install chromium
npm run test:e2e
```

Cada execução gera e remove seus próprios usuários e viagens. O CI roda os
testes com um único worker para manter as mutações determinísticas.
