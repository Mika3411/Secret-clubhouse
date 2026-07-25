# A04 — Vérification GitHub expurgée du 25 juillet 2026

**Dépôt :** `Mika3411/Secret-clubhouse`<br>
**Méthode :** API GitHub authentifiée et CLI `gh`, sans export de jeton<br>
**Conclusion :** contrôle GitHub partiel ; A04 reste ouverte.

## Constats vérifiés

- le dépôt est public, non archivé et sa branche par défaut est `main` ;
- `Mika3411` est l’unique collaborateur retourné et possède le rôle administrateur ;
- aucun compte partagé ou second collaborateur n’apparaît dans la liste du dépôt ;
- GitHub Secret Scanning et sa protection au push sont activés ;
- le workflow « Tests et sécurité » du SHA `4eb2073bbacd4294f845c34548f87585000ebcac` est réussi ;
- la branche `main` n’est pas protégée ;
- l’API utilisée ne fournit pas d’état exploitable de l’authentification multifacteur du compte personnel.

Les commandes n’ont affiché ni valeur de jeton, ni adresse privée, ni secret du dépôt.

## Évaluation

L’accès au dépôt est nominatif et la surface de collaboration est minimale. L’absence de protection de branche est un écart de gouvernance à décider : le workflow actuel contrôle chaque push sur `main`, mais ne bloque pas techniquement un push avant l’exécution de la CI. Ce point ne suffit pas seul à fermer ou bloquer A04 ; il doit être accepté ou corrigé avec la politique de publication directe retenue pour Render.

La preuve MFA reste manquante. Elle doit être fournie par une capture expurgée des paramètres du compte ou une attestation datée du titulaire. Cette vérification ne couvre pas Render, Cloudflare, Firebase/Google ni Apple.

## Suites

1. confirmer l’état MFA GitHub avec une preuve privée datée ;
2. décider formellement si `main` reste publiable directement ou reçoit une règle de protection compatible avec le déploiement ;
3. rapprocher cette liste d’accès des listes Render, Cloudflare, Firebase et Apple ;
4. exécuter une révocation représentative et un exercice réel de rotation/récupération avant toute clôture A04.
