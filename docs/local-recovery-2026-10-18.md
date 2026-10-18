# Reprise locale après la panne Docker — 18 octobre 2026

**La connexion, la sauvegarde et l’Engine sont de nouveau utilisables localement.**
Ouvrir [NovLearn Admin](http://127.0.0.1:3150/login). Les identifiants d’essai
restent dans `.local/local-admin-1792143739689/login.txt` ; ils n’ont pas changé.
Les projets distants ne sont pas activés. La publication reste fermée sur 3150.
Le banc distinct sur 3152 sert uniquement aux deux copies locales de publication.

Le [relevé de preuve](local-recovery-2026-10-18-proof.json) conserve les dates,
artefacts, périmètres et limites ci-dessous. Il ne clôture pas la livraison.

## Sauvegarde et remise en route

Le journal de Docker Desktop 4.90 avait échoué sur le renommage de
`sailor-ingest.sock` vers `.stale`. Cette observation décrit un défaut technique ;
elle ne démontre pas une nouvelle interdiction Smart App Control. Aucune
restriction de navigateur ou protection système n’a été contournée.

Une nouvelle inspection a confirmé l’absence de processus Docker et la
distribution `docker-desktop` WSL2 arrêtée. L’arrêt normal précédemment demandé
avait donc fini par aboutir. Ce changement d’état a permis une sauvegarde à froid,
conformément au [prérequis officiel Docker](https://docs.docker.com/desktop/settings-and-maintenance/backup-and-restore/).

Les deux VHDX et deux fichiers de paramètres représentent **24 856 494 747 octets**.
Ils sont conservés dans le dossier privé ignoré
`.local/docker-cold-backup-20261018-150431/`, avec un manifeste. Les quatre sources
étaient ouvertes en lecture exclusive pendant la copie. Chaque destination est
relue et son SHA-256 comparé au SHA-256 calculé sur le flux source ; tailles et
empreintes correspondent. Le dossier est limité au compte courant et à SYSTEM.
**Il s’agit d’une sauvegarde de fichiers vérifiée, pas d’un test de restauration.**

Après libération des verrous, un seul démarrage normal de Docker réussit. La
première observation expire ; la suivante trouve le moteur prêt. Aucun nouveau
start n’est lancé entre ces observations. Docker n’est ni mis à jour ni réinitialisé.
Le succès courant ne démontre pas la résolution définitive du défaut de 4.90.

Les dix conteneurs existants sont redémarrés, sans recréation : bases conservées,
Auth, REST, passerelles et relais PG. IDs et images sont inchangés ; les deux
points de santé Auth répondent HTTP 200. Les applications et nouveaux workers
bornés sont ensuite lancés avec les comptes, secrets et signatures conservés.

## Vérifications connectées exécutées

- **Huit contrôles Engine/applicatifs** : vraie session Admin, Dashboard et
  catalogue, génération de la définition avancée à sept éléments aux seeds 0/42,
  correspondance exacte des projections, nouveau brouillon étiqueté de test,
  rapport multi-seeds signé et persisté, lecture du rapport et publication fermée.
  Les quatorze rapports préexistants conservent leurs payloads et signatures.
- **Huit contrôles de reprise publication** : vraie session après redémarrage,
  relecture des quatre opérations originales, nouveau plan « inchangé » avec
  calcul Engine frais, annulation de ce plan sans transfert, comparaison des
  lignes, clés préservées, profil Linux borné et publication toujours fermée sur
  l’application principale. Le relevé d’origine n’est pas recapturé.
- **Sept contrôles d’accès et d’isolation** : refus anonyme, vrai POST du formulaire
  avec les identifiants conservés, nouvelle session, lecture des cinq rubriques
  principales, brouillon et rapport retrouvés après cette reconnexion distincte,
  déconnexion réelle puis refus, vérification effective des deux workers.

Les workers tournent sous UID 65534, sans réseau ni capabilities, avec racine
en lecture seule et `no-new-privileges`. Les fichiers cgroup v2 confirment
384 Mio de mémoire, zéro swap et 64 processus au maximum. Les durées/critères
Engine sont inchangés. Les 1 540 tests du dépôt Engine ne sont pas relancés ici.

Le dernier contrôle complet de code reste celui du 18 octobre à 12:59 UTC :
**848 tests / 46 fichiers**, intégrité Engine, types, lint, format, build et
smoke réussis. Tous les fichiers d’implémentation qualifiés correspondent encore
à cette copie ; seules les mises à jour documentaires suivent ce contrôle.
Ce résultat n’est pas présenté comme une nouvelle exécution après la reprise.

## Données préservées et portée

Les **62 tables de la cible**, Auth compris, restent exactement identiques au
relevé original avant arrêt. Chaque ancienne ligne des **35 tables métier de la
source de publication** reste présente à l’identique ; seul un nouveau plan
annulé et son historique sont ajoutés. Aucun transfert cible n’est appliqué.

Pour l’application principale, le relevé est pris après le redémarrage de la
base, avant Auth/API/Next. Chaque ligne de ses **35 tables métier** reste ensuite
présente à l’identique. Ce relevé ne prouve pas à lui seul l’égalité avec l’état
précédant l’arrêt Docker. Le nouvel exercice de test et son rapport sont conservés.
Les tables de sessions Auth de la source et de l’application principale ne sont
pas comparées comme immuables : les connexions/déconnexions réelles les utilisent.

Les huit fichiers privés applicatifs, quatre références/fichiers protégés, huit
modifications préexistantes voisines et 64 migrations qualifiées contrôlés sont
inchangés. Le dépôt Engine reste propre. Aucun mot de passe ou clé n’est livré
dans ce document. Aucun environnement distant, migration, push ou déploiement.

## Réceptions restantes

La navigation, MathLive, le rendu visuel et la récupération/nettoyage du stockage
doivent encore être réceptionnés dans un navigateur autorisé. Les réponses HTTP
ne prouvent pas ces interactions. Le refus de pilotage antérieur reste respecté ;
une personne peut ouvrir normalement 3150 et tester progressivement.

Restent aussi le parcours HTTP de publication multi-exercices complet, les
statistiques/utilisateurs Production avec capacité de lecture qualifiée, la
version cible courante, les courbes de formules dépendantes d’une capacité Engine,
MFA/expiration, les portes distantes et l’exploitation. La panne locale courante
ne doit plus être présentée comme le blocage de ces travaux.
