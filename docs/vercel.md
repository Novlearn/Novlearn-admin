# Déploiement et exploitation

**Mise à jour du 5 novembre 2026 :** la PR de raccordement ajoute le transport
HTTPS serveur vers le host staging et conserve Engine fermé tant que ses
variables serveur ne sont pas configurées. Le code ne démarre pas le host natif
sur Vercel. Voir [transport Admin–Engine](admin-engine-transport.md) pour la
configuration et les contrôles à refaire après déploiement. Aucun déploiement ni
accès distant depuis Vercel n’est revendiqué ici.
La mission du 30 octobre prépare maintenant un
[banc protégé](../src/app/admin/engine-qualification/page.tsx) avec un payload
serveur synthétique et le host officiel. L'utilisateur a autorisé séparément
son déploiement de qualification. Les opérations d'édition Engine restent
fermées sur Vercel. Voir le [dossier de réception](mission-admin-engine-reception.md)
pour l'archive 0.1.1 et les résultats nouveaux ; les observations ci-dessous
décrivent le déploiement antérieur tant qu'une réception plus récente n'est pas consignée.

## Déploiement Production Vercel et base de préproduction

Le dépôt contient [vercel.json](../vercel.json) et un
[guide de configuration unique](auth.md). Next.js utilise la
**base de préproduction existante**, historiquement nommée Supabase Staging.
Le 30 octobre, l'utilisateur a autorisé le déploiement Production Vercel avec
trois variables seulement et le retrait des marqueurs d'activation Auth.
L’environnement nommé « Production » dans Vercel désigne l’hébergement, pas une
autorisation d’utiliser Supabase Production.

**Le profil proposé désactive Engine et ne constitue pas une livraison acceptable
de l’Admin attendu.** Ne pas déclarer la mise en service achevée tant que le
parcours officiel Engine n’est pas raccordé et qualifié sur l’hôte retenu.
Le blocage est dans le code, pas seulement dans les variables : changer un
`false` en `true` sur Vercel ne lève pas la garde. La décision d’hébergement doit
traiter l’isolation du moteur, son transport authentifié et les snapshots privés
d’aperçu décrits dans [l’architecture](architecture.md).

La qualification D13 reste historique. La réception du nouveau déploiement doit
distinguer formulaire disponible, refus non connectés et connexion réelle avec
le compte de l'utilisateur ; aucun succès de connexion n'est déduit du formulaire.

## Vérification du 30 octobre 2026

Le déploiement `dpl_42RMJasZuoDnMonCm665vGkq84LV` est **READY**, cible
Production, sur [novlearn-admin.vercel.app](https://novlearn-admin.vercel.app).
Il provient des fichiers locaux, incluant les changements non commités ; aucun
push ni changement de données ou de configuration Supabase n'a été effectué.
La [preuve datée](archives/vercel-production-2026-10-30.json) conserve l'empreinte
des sources envoyées et les résultats HTTP.

- Formulaire actif : HTTP 200, trois contrôles actifs, ancien `?error=disabled`
  sans alerte obsolète ; données de préproduction indiquées.
- Sans session : `/admin` redirige vers la connexion ; les API session et
  catalogue répondent 401. Réponses privées `no-store`.
- Engine répond 503 : toujours indisponible sur cet hôte.
- Installation et build Vercel réussis. Localement : 1 533 tests dans 80 fichiers,
  types, lint sans erreur, build isolé et smoke du serveur réussis. Le lint
  conserve un avertissement historique sur une image du banc navigateur.
  `npm run check` reste en échec sur le format de deux rapports archivés
  (`audit-v1-2026-10-21.md`, `plan-v1-2026-10-21.md`), conservés sans modification ;
  le build et le smoke ont donc été exécutés séparément avec succès.

La connexion réelle avec un compte Admin, les sauvegardes de brouillon et leur
réouverture n'ont pas été testées à distance pendant cette intervention.

## Préparation de l’hébergement

1. Importer `BBuclon/Novlearn-admin`, branche `main`, racine du dépôt, preset
   Next.js et Node 24.x. Les commandes versionnées sont `npm ci` et
   `npm run build`. Leur présence ne vaut pas vérification des limites actuelles
   de l’offre d’hébergement.
2. Utiliser `https://novlearn-admin.vercel.app` comme origine stable et renseigner
   les trois variables de préproduction décrites
   dans [Auth](auth.md), notamment l’origine
   exacte dans `APP_BASE_URL` et la clé publishable du bon projet.
3. Le profil préparé conserve à `false` les quatre portes Engine, transport
   Engine local Staging, relecture et publication. Leur absence conserve aussi
   ces capacités désactivées ; inutile de multiplier les valeurs `false`.
   Ne pas importer les variables `ADMIN_LOCAL_*`, clés privées, URL PostgreSQL,
   `.env`, dossiers `.local/` ou sauvegardes.
4. Exécuter les contrôles locaux, déployer le code autorisé, puis vérifier le
   formulaire et les refus d'accès sur le domaine réel. Ce déploiement rend le
   socle éditorial accessible ; il ne vaut pas réception du parcours Engine.

Une origine Preview différente de `APP_BASE_URL` est refusée pour les mutations.
Utiliser une origine exacte propre à chaque environnement, sans joker. Une
modification des variables d’un déploiement demande un nouveau déploiement.

## Réception sur le domaine réel

Après déploiement autorisé, consigner le domaine, la révision, la configuration
sans secrets, la date et le résultat de chaque parcours :

- Connexion avec le compte Admin Staging, ouverture du catalogue, création d’un
  brouillon d’essai, sauvegarde, réouverture, déconnexion puis reconnexion et lecture.
- MathLive, récupération facultative de saisie, conflits et messages d’erreur.
- Validation Engine, génération avec seed, projection élève et correction par le
  moteur officiel. Un bouton masqué ou une réponse 503 est une indisponibilité.
- Refus des pages et API en fenêtre privée non connectée, sans rôle Admin et avec
  une origine incorrecte ; aucune fuite de données privées.
- Rapports/relecture uniquement si leur signature a été explicitement provisionnée
  et qualifiée. Publication uniquement avec sa procédure séparée approuvée.

Les contrôles généraux sont dans [Vérifications](verification.md). Une réception
HTTP, un test simulé ou un ancien parcours local ne remplace pas ces essais sur
l’hôte réel. Les résultats manquants restent à faire.

## Incident, retour arrière et sauvegardes

En cas de refus d’origine, contrôler domaine et `APP_BASE_URL`. En cas de refus de
rôle, contrôler le profil dans **Staging**, sans élargir les policies ni exposer
une clé privilégiée. Ne pas rejouer un bundle SQL pour résoudre un problème UI.
Un retour au déploiement précédent restaure le code, pas les données Supabase.
Une restauration SQL et un rollback de publication sont des opérations distinctes.

La preuve D13 enregistre le retrait des conteneurs Admin après sauvegarde. Les
archives privées restent dans `.local/release-cleanup-20261021/backups/`, hors Git
et Docker : dump natif et archives des deux volumes, empreintes et lecture des
archives vérifiées. **Aucune nouvelle restauration de ces archives n’a été
exécutée à cette étape.** Ne pas déduire leur restaurabilité complète d’une simple
décompression réussie. Elles ne constituent pas une sauvegarde intégrale du projet
Supabase, d’Auth ou de Storage.

Conserver les configurations privées et les autres sauvegardes existantes.
Avant une modification de données autorisée, adapter la sauvegarde à la cible,
prouver sa restauration isolée et définir le retour arrière. La disponibilité
actuelle d’un processus local ou distant reste à vérifier lors de l’exploitation.
