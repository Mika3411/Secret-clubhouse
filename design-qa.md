# Design QA — compositeur de messagerie parentale sur smartphone

- Source visuelle : `C:\Users\admin\AppData\Local\Temp\codex-clipboard-9cb356c4-68ff-40ad-9291-aea94f5b9208.png`
- État ciblé : conversation parentale ouverte en portrait, avec une grande photo reçue et la navigation parent fixe.
- Défaut P0 observé : le compositeur est entièrement masqué sous la navigation parent.
- Correction appliquée : la messagerie occupe désormais une hauteur bornée, seul l’historique défile, et une réserve correspondant à la navigation et à la zone sûre maintient le compositeur visible.
- Vérification structurelle : couverte par `server/parent-composer-layout.test.js`.
- Comparaison visuelle après correction : bloquée, car l’utilisateur a explicitement demandé de ne pas contrôler son navigateur ou son appareil.

final result: blocked
