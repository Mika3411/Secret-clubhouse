# Registre des violations de données

**Propriétaire :** responsable du traitement<br>
**Version :** 1.0<br>
**Date d’ouverture :** 23 juillet 2026

Toute violation, notifiée ou non, est enregistrée. Les incidents réels et les exercices sont tenus dans des sections distinctes. Le registre ne contient ni texte de message, ni nom d’enfant, ni adresse électronique, ni jeton, ni secret.

## Violations réelles

**Aucune violation réelle n’est consignée dans ce dépôt au 23 juillet 2026.**

Une entrée réelle utilise la trame suivante dans le registre d’exploitation à accès restreint :

| Champ | Valeur attendue |
|---|---|
| Référence et état | `INC-AAAA-NNN`, ouvert/confiné/rétabli/clos |
| Premier signal | Horodatage, source et destinataire du signalement |
| Prise de connaissance `T0` | Horodatage, faits établis, décideur et échéance `T0 + 72 h` |
| Nature | Confidentialité, intégrité et/ou disponibilité |
| Personnes | Catégories et nombres approximatifs |
| Enregistrements | Catégories, période et nombres approximatifs |
| Effets | Conséquences avérées et probables |
| Mesures | Confinement, éradication, rétablissement et atténuation |
| Risque | Gravité, probabilité, score, facteurs aggravants/atténuants |
| CNIL | Décision, motif, date de notification et compléments, ou justification de l’absence |
| Personnes concernées | Décision, motif, canaux et dates, ou exception RGPD |
| Sous-traitants | Notifications reçues/envoyées et éléments demandés |
| Preuves | Emplacement restreint, empreintes et journal d’accès |
| Clôture | Cause, corrections, propriétaires, échéances et validation |

## Exercices — entrées fictives

### SIM-A05-2026-07-23 — fuite fictive de messages d’enfants

| Champ | Valeur simulée |
|---|---|
| Nature | Confidentialité ; régression fictive d’autorisation horizontale sur une route de lecture. |
| Premier signal | 23 juillet 2026, 09:00 CEST ; alerte synthétique de lectures inhabituelles. |
| `T0` | 23 juillet 2026, 09:08 CEST ; accès non autorisé à des messages synthétiques raisonnablement certain. |
| Échéance CNIL | 26 juillet 2026, 09:08 CEST (`T0 + 72 h`). |
| Personnes | 3 profils enfants fictifs de 2 familles fictives ; 1 session adulte fictive non autorisée. |
| Enregistrements | 12 messages texte synthétiques ; aucun média, mot de passe, jeton, clé ou signal WebRTC. |
| Effets probables | Atteinte à l’intimité, détresse, risque de harcèlement ou de contact indésirable. Aucun effet réel. |
| Mesures simulées | Révocation de session, fermeture de la route, gel des déploiements, contrôle de portée, correctif et surveillance. |
| Risque | Gravité 4, probabilité 3, score 12 : risque élevé, notamment en raison de l’âge et du contenu conversationnel lisible. |
| Décision CNIL | Notification requise dans le scénario ; brouillon prêt à 11:30 CEST, non envoyé car exercice. |
| Décision personnes | Information des familles et enfants concernés requise dans le scénario ; modèles prêts à 12:15 CEST, non envoyés. |
| Confinement | Atteint à 09:22 CEST ; rétablissement simulé autorisé à 13:30 CEST après tests. |
| Clôture | Exercice terminé avec corrections le 23 juillet 2026 ; preuves dans `docs/exercices/a05-2026-07-23-*`. |

Cette entrée n’est pas une notification et ne décrit aucun incident réel.
