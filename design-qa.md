# Design QA — écrans parent Accueil et Gestion

## Source visuelle

- Direction durable : `.design-reference/secret-clubhouse-source.png`.
- Baselines du même état : `.audit/2026-07-23-parent-tablet-balance/00-before-tablet-home-1-profile.png` et `.audit/2026-07-23-parent-tablet-balance/01-before-tablet-management-1-profile.png`.
- Le visuel durable définit les couleurs, rayons, typographies et densité Secret Clubhouse. Les captures avant modification fournissent l’état parent comparable; le brief utilisateur définit les changements de composition attendus.

## Implémentation comparée

- Accueil : `.audit/2026-07-23-parent-tablet-balance/after-tablet-home-1-profiles.png`.
- Gestion : `.audit/2026-07-23-parent-tablet-balance/after-tablet-management-1-profiles.png`.
- États supplémentaires : variantes Accueil/Gestion avec 1, 2 et 4 profils dans le même dossier, pour téléphone et tablette.
- Viewports CSS : 390 × 844 et 834 × 1112.
- Densité : `deviceScaleFactor: 1`; captures source comparables et implémentation à la même taille CSS et en pixels.
- État : parent principal, premier enfant actif, aucune demande en attente, notifications inactives.

## Comparaison plein écran

- `.audit/2026-07-23-parent-tablet-balance/comparison-home-tablet-before-after.png`
- `.audit/2026-07-23-parent-tablet-balance/comparison-management-tablet-before-after.png`

L’Accueil conserve son ordre, ses proportions principales et ses cartes. La carte multijoueur devient réellement compacte. Gestion remplace les lignes artificiellement synchronisées par deux flux indépendants et rassemble les fonctions liées au compte et à l’application.

## Comparaison ciblée

- `.audit/2026-07-23-parent-tablet-balance/comparison-focused-before-after.png`

La comparaison ciblée confirme la réduction de la carte multijoueur et la hauteur pilotée par le nombre de profils. Une vue ciblée était nécessaire car ces différences sont trop petites pour être jugées précisément dans la comparaison plein écran.

## Surfaces de fidélité

- **Typographie** : Baloo 2 et Nunito, poids, hiérarchie et retours à la ligne existants conservés. Aucun libellé de navigation n’est tronqué à 390 px.
- **Rythme et composition** : rayons, marges et espacements existants conservés; carte de jeu à 104 px sur tablette; « Mes enfants » à 103,6 px pour 1/2 profils et 183,6 px pour 4.
- **Couleurs et jetons** : indigo, menthe, violet, états verts et surfaces claires inchangés.
- **Images et icônes** : avatars et icônes Phosphor existants réutilisés; aucun nouvel actif de substitution.
- **Copie et contenu** : aucun accès parental supprimé ou dupliqué. « Installer sur Android » est désormais explicitement rattaché à « Compte et application ».
- **Responsive et accessibilité visible** : navigation fixe au bas du viewport, libellés complets, contenu final à 37 px au-dessus de la navigation sur téléphone et 39,4 px sur tablette avec quatre profils.

## Historique de comparaison

1. **Baseline**
   - P2 : carte « Jeux multijoueurs » forcée à 176 px.
   - P2 : grille Gestion créant des trous de hauteur et séparant l’installation Android de son contexte.
   - P2 : « Mes enfants » non proportionnel au nombre de profils.

2. **Première implémentation**
   - La carte de jeu est devenue compacte et les blocs de Gestion ont été regroupés.
   - P2 résiduel : le premier placement laissait encore une colonne visuellement plus courte.
   - P2 résiduel : « Mes enfants » restait trop haut sur tablette.
   - P2 résiduel : « Conversations » manquait d’un pixel de largeur à 390 px.

3. **Deuxième implémentation**
   - Sécurité et demandes ont été équilibrées face aux cartes famille/compte.
   - Le titre, l’ajout et la grille de profils partagent une rangée sur tablette.
   - Les espacements de navigation mobile ont été ajustés.
   - Les captures finales et les mesures ne montrent plus de P0, P1 ou P2.

## Vérification navigateur

- Navigation Accueil → Gestion testée : titres obtenus « Bonjour, Marie » puis « Gestion de la famille ».
- Douze états capturés : 2 écrans × 3 nombres de profils × 2 viewports.
- Défilement jusqu’au dernier contenu contrôlé sur téléphone et tablette.
- Erreurs console : 0.
- Réponses HTTP en erreur : 0.

## Findings

Aucun écart P0, P1 ou P2 restant.

## Follow-up polish

- P3 accepté : l’Accueil conserve une zone calme sous les cartes sur les grandes tablettes. Elle n’est pas remplie avec des accès dupliqués ou des données artificielles.

final result: passed
