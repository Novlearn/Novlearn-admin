# Déploiement et exploitation

## Portée de la préparation Vercel

Le dépôt contient [vercel.json](../vercel.json) et
[.env.vercel.example](../.env.vercel.example), avec Next.js et les données
**Supabase Staging**. La préparation D13 n’est pas une réception sur Vercel.
L’environnement nommé « Production » dans Vercel désigne l’hébergement, pas une
autorisation d’utiliser Supabase Production.

**Le profil proposé désactive Engine et ne constitue pas une livraison acceptable
de l’Admin attendu.** Ne pas déclarer la mise en service achevée tant que le
parcours officiel Engine n’est pas raccordé et qualifié sur l’hôte retenu.
Le blocage est dans le code, pas seulement dans les variables : changer un
`false` en `true` sur Vercel ne lève pas la garde. La décision d’hébergement doit
traiter l’isolation du moteur, son transport authentifié et les snapshots privés
d’aperçu décrits dans [l’architecture](architecture.md).

Les étapes ci-dessous décrivent la préparation existante pour une future
intervention autorisée. Elles n’autorisent aucun déploiement dans cette mission.

## Préparation de l’hébergement

1. Importer `BBuclon/Novlearn-admin`, branche `main`, racine du dépôt, preset
   Next.js et Node 24.x. Les commandes versionnées sont `npm ci` et
   `npm run build`. Leur présence ne vaut pas vérification des limites actuelles
   de l’offre d’hébergement.
2. Choisir un domaine HTTPS stable. Renseigner les variables Staging décrites
   dans [Auth](auth.md) à partir de `.env.vercel.example`, notamment l’origine
   exacte dans `APP_BASE_URL` et la clé publishable du bon projet.
3. Le profil préparé conserve à `false` les quatre portes Engine, transport
   Engine local Staging, relecture et publication listées dans cet exemple.
   Ne pas importer les variables `ADMIN_LOCAL_*`, clés privées, URL PostgreSQL,
   `.env`, dossiers `.local/` ou sauvegardes.
4. Avant un déploiement destiné à l’usage attendu, résoudre le blocage Engine,
   reprendre les réserves de sécurité et exécuter les contrôles adaptés à cette
   cible. Déployer seulement sous l’autorisation correspondante.

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
