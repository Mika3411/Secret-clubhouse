# A08 — Vérification publique du déploiement du 25 juillet 2026

**Périmètre :** éléments vérifiables sans accès au tableau de bord Render<br>
**Origine :** `https://secret-clubhouse.onrender.com`<br>
**Résultat :** preuve publique partielle réussie ; A08 reste ouverte pour les contrôles privés.

## 1. Constat avant la nouvelle provenance intégrée

Le 25 juillet 2026 à 07:43 UTC :

- `GET /api/health` a répondu `200` avec `{"ok":true}` ;
- la réponse portait `Cache-Control: no-store`, un `X-Request-ID`, les en-têtes de sécurité applicatifs et l’indication d’une origine Render ;
- `GET /` a répondu `200` avec une page non mise en cache durablement ;
- les ressources principales servies étaient `index-BM-c6Pq2.js` et `index-DiLKP_S7.css` ;
- un build local propre du commit `4eb2073bbacd4294f845c34548f87585000ebcac` a produit exactement ces deux empreintes de ressources ;
- le workflow GitHub Actions « Tests et sécurité » du même SHA s’est terminé avec succès le 25 juillet 2026.

Cette concordance d’assets est une preuve historique utile, mais elle ne constitue pas à elle seule une provenance cryptographique du service.

## 2. Renforcement ajouté

La version suivante :

- expose dans `/api/health` uniquement le SHA Git complet fourni par `RENDER_GIT_COMMIT`, après validation stricte de son format ;
- configure `/api/health` comme chemin de healthcheck Render ;
- fournit `npm run production:verify -- <origine> <sha-complet>` ;
- fait échouer cette vérification si HTTPS, le SHA, `no-store`, `X-Request-ID`, la page d’entrée ou ses ressources versionnées ne correspondent pas.

Le SHA Git est public et ne révèle ni variable, ni identifiant de service, ni secret Render. Le healthcheck continue de vérifier PostgreSQL par `select 1`.

## 3. Limites

La preuve publique ne montre pas :

- la région réelle du service, de PostgreSQL et du Cron ;
- la valeur effective des drapeaux et la présence des secrets attendus ;
- la connexion PostgreSQL privée, le plan et la durée des sauvegardes ;
- le contenu de `CONTENT_ENCRYPTION_PREVIOUS_KEYS` ou la capacité réelle de récupération ;
- une restauration Render isolée avec rejeu des tombstones ;
- le succès du Cron quotidien, les alertes et la durée des journaux.

Ces éléments doivent être relevés dans le tableau de bord Render avec des captures datées et expurgées conservées hors Git. A08 ne peut être fermée avant cette revue privée et une vérification publique réussie sur le SHA finalement servi.
