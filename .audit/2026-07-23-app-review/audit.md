# Avis produit — Secret Clubhouse

## Périmètre

Audit combiné UX et accessibilité de l’entrée parent visible sur le prototype local, dans Edge, le 23 juillet 2026.

## Verdict

Le produit a une vraie personnalité et une promesse de sécurité immédiatement compréhensible. La direction indigo, menthe et violette est cohérente, mémorable et suffisamment mature pour des enfants de 6 à 13 ans. Le principal problème visible est cependant bloquant : sur une fenêtre paysage basse, la carte d’authentification se trouve sous la zone visible et ne peut pas être atteinte par défilement.

## Étapes

1. **Arrivée sur l’entrée parent — santé : fragile**
   - Points forts : marque reconnaissable, promesse claire, vocabulaire rassurant, distinction Parent/Enfant exposée dans la structure accessible.
   - Risque UX majeur : le logo et le décor occupent presque toute la hauteur visible, tandis que le formulaire commence sous le bord inférieur.
   - Risque accessibilité : les contrôles existent dans l’arbre accessible mais sont visuellement hors écran et inatteignables dans cette configuration. Le zoom ou le reflow ne devrait pas être nécessaire pour se connecter.
   - Cause cohérente avec le code : à partir de 700 px de large, `.auth-layout` impose `min-height: 920px`, tandis que `.auth-screen` masque le débordement.

2. **Accès aux variantes Parent/Enfant et Inscription — santé : non vérifiable**
   - Les onglets sont correctement annoncés comme onglets dans l’arbre accessible.
   - La capture fiable des états suivants a été bloquée par le défaut de hauteur, puis par un changement de fenêtre du contrôleur visuel. Les captures ambiguës ont été rejetées.

## Priorités

1. Rendre l’écran d’authentification verticalement défilable et supprimer la hauteur minimale rigide sur les écrans paysage bas.
2. Refaire un passage complet Parent, Enfant et Inscription à 100 % et 200 % de zoom, clavier uniquement compris.
3. Charger Phaser à la demande : le build produit actuellement un chunk Phaser d’environ 1,48 Mo, ce qui risque de ralentir l’entrée dans l’app sur des appareils modestes.

## Limites

Cet audit ne valide pas la conformité WCAG complète, les contrastes mesurés, les lecteurs d’écran, les erreurs de formulaire, ni les espaces authentifiés. Aucun compte ou identifiant de test n’a été utilisé.
