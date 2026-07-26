# E2E Playwright

Les scénarios utilisent uniquement `TEST_DATABASE_URL`. L’hôte PostgreSQL doit
être local (`localhost`, `127.0.0.1` ou `::1`) et le nom de la base doit contenir
les marqueurs `e2e` et `test`, par exemple :

```text
postgresql://postgres:postgres@127.0.0.1:5432/secret_clubhouse_e2e_test
```

`DATABASE_URL`, `SOURCE_DATABASE_URL` et `RECOVERY_DATABASE_URL` doivent rester
absentes. La base est entièrement vidée et réensemencée avant chaque scénario.
Le bundle est construit en mode `e2e` sans les URL de `.env.production`, puis le
serveur refuse de démarrer si l’origine Render de production apparaît dans le
JavaScript généré.

Commande dédiée :

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/secret_clubhouse_e2e_test npm run test:e2e
```
