# Reprise après nettoyage Docker — 21 octobre 2026

Le nettoyage signalé par l’utilisateur a supprimé les conteneurs NovLearn Admin
et leurs bases locales. Ce constat est distinct du manque de mémoire et du
blocage de signature Windows du nouvel Engine. Aucun environnement distant
n’a été modifié. Les volumes des autres projets restent préservés.

## Application disponible et données manquantes

La [connexion locale](http://127.0.0.1:3150/login) fonctionne de nouveau avec
les identifiants existants du fichier privé indiqué dans le
[guide d’essai](local-user-testing.md). Le catalogue, le Creator, les chapitres,
les compétences, les flashcards et le moteur précédemment certifié sont
disponibles. Un avis visible précise la date de la sauvegarde restaurée et
l’absence de données plus récentes.

Cette restauration **ne rétablit pas intégralement l’état précédent**. Le dump
principal conservé date du 17 octobre à 17:26:39 UTC, au niveau SQL 63. Il a été
restauré dans un nouveau volume persistant, puis la migration canonique SQL 64
a été appliquée localement. Aucun dump existant n’a été écrasé.

| Données principales   | Avant nettoyage | Restaurées | Manquantes |
| --------------------- | --------------: | ---------: | ---------: |
| Exercices             |              18 |          6 |         12 |
| Versions d’exercice   |              18 |          6 |         12 |
| Rapports de tests     |              23 |          9 |         14 |
| Relectures            |              17 |         11 |          6 |
| Événements de contenu |              32 |         16 |         16 |
| Profils               |              12 |          6 |          6 |

Le relevé avant nettoyage contient des empreintes de lignes, pas leurs valeurs :
il permet une comparaison, mais pas une reconstruction des lignes manquantes.
49 tables sur les 62 comparées correspondent exactement à ce relevé ; les
13 écarts comprennent aussi les tables Auth et leurs sessions historiques.
Une recherche dans sept sauvegardes sélectionnées n’a retrouvé aucune ligne
supplémentaire correspondant aux empreintes manquantes du principal. Cela ne
prouve pas l’absence de toute autre archive et ne transforme pas les données
perdues en données jetables.

Les statistiques, utilisateurs, pédagogie, version cible et le banc de publication
3152 ne sont pas encore rétablis. Leurs fonctions restent fermées, avec refus
503 vérifié pour les API concernées. Les preuves historiques de qualification
restent conservées ; elles ne prouvent pas leur disponibilité actuelle.

## Contrôles réellement exécutés

Les [résultats structurés](docker-cleanup-recovery-2026-10-21.json) distinguent
les preuves privées et la portée de réception :

- La vraie connexion administrateur, la déconnexion et le refus d’un utilisateur
  sans rôle administrateur passent ; accès anonyme refusé.
- Cinq pages protégées répondent 200 et affichent l’avis de restauration.
- Le véritable worker Linux génère un aperçu, conserve les attendus privés et
  corrige une fraction équivalente, une réponse fausse et un format invalide.
- Le worker conserve 384 Mio, zéro swap, 64 processus, UID 65534, réseau absent,
  racine en lecture seule, capacités retirées et absence de nouveaux privilèges.
- Les lignes métier restaurées, séquences hors Auth, métadonnées, policies et
  huit fichiers de configuration restent identiques après ce parcours HTTP.
  Les connexions créent normalement des audits et font avancer la séquence
  Auth des jetons. Un premier contrôle comparait aussi cette séquence ; son
  échec est conservé et expliqué, sans annoncer cette passe comme réussie.
- Avant l’activation, une nouvelle sauvegarde complète de la base SQL 64 et
  des rôles a été conservée. Les mots de passe des services sont réutilisés ;
  leurs nouveaux sels SCRAM ne sont pas présentés comme identiques aux anciens.

La restauration et la migration ont conservé les lignes métier du dump. La
rotation privée de l’empreinte Engine prévue par SQL 64 est distincte de cette
conservation. Les réglages de rôles ont été rapprochés du relevé précédent ;
une erreur initiale de citation des réglages de liste a été corrigée sans
changement des lignes, séquences ou policies.

Le test HTTP ne constitue pas une nouvelle réception navigateur. Les parcours
humains déjà acceptés gardent leur date et leur portée ; aucune automatisation
navigateur refusée n’a été contournée. Le nouveau sampling de courbes n’est pas
encore installé dans cette application.

## Travail restant

1. Chercher les autres sauvegardes utiles et restaurer séparément les services
   locaux supprimés, sans écraser la base récupérée ni les volumes existants.
2. Requalifier leurs identités, permissions et parcours avant réactivation.
3. Achever la certification Linux de l’extension Engine autorisée D10, puis
   adopter son archive et raccorder les courbes dans Admin.
4. Refaire le contrôle général sur les sources finales modifiées. Le dernier
   contrôle Admin à 1 505 succès précède l’avis de restauration et cette extension.
5. Conserver les portes SQL Staging, exploitation, réception et autorisation
   distante ouvertes. Cette reprise ne termine ni le Lot 1A ni le goal.
