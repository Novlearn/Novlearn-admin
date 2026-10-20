# Reprise MCP et contrôle préalable de publication — 20 octobre

Le MCP dédié est relié à **Staging `tksvbkvfusrnxulpahky`**. Il permet
l’examen des catalogues et des advisors sans export manuel. Il ne remplace
pas un `pg_dump` complet ni une restauration qualifiée. Les tentatives
d’export direct/pooler sont arrêtées à la demande de l’utilisateur.

## État SQL réellement observé

Le relevé security retourne 45 avertissements et une information : cinq
chemins de recherche modifiables, vingt fonctions definer exécutables par
`anon`, vingt par `authenticated`, et une table RLS sans policy. Il s’agit
d’avis à examiner, pas de quarante exploits prouvés.

Quatre définitions sont lues sans exécuter leurs RPC :

- `admin_get_profile` vérifie un rôle `admin` dans `profiles` ; cette garde
  dépend de la protection effective de la colonne de rôle.
- `get_my_role` limite sa lecture à `auth.uid()`.
- `get_public_profile` retourne directement une projection du profil demandé,
  sans vérification de session dans le corps relevé ; son exposition reste
  à décider au regard des usages sociaux existants.
- `is_guest` retourne `false` en l’absence du claim `is_anonymous`.

Les policies `ALL PERMISSIVE` utilisant `NOT is_guest()` restent présentes
sur `profiles`, `exercise_attempts` et `duels`, pour le rôle `public`.
Les droits effectifs SELECT/INSERT/UPDATE/DELETE sont vrais pour `anon` et
`authenticated` sur ces trois tables. La combinaison demeure une condition
à corriger et qualifier avant mise en service distante. Aucun exploit,
appel métier, modification de droits ou lecture de lignes personnelles
n’a été exécuté. Les correctifs locaux antérieurs ne sont pas réputés
appliqués à Staging.

Sources : [avis definer anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[avis definer connecté](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[sécurisation des fonctions](https://supabase.com/docs/guides/database/functions).

## Publication locale

Le serveur refuse désormais un reçu approuvé invalide ou une définition dont
l’empreinte ne correspond plus **avant** d’admettre des opérations Engine.
La comparaison finale et le vrai rejeu officiel restent obligatoires : le
cas valide exerce toujours quatre générations et six corrections sur les
deux seeds approuvés. Aucun délai, cas mathématique ou assertion n’est retiré.
Trois tests supplémentaires exigent le refus sans aucun appel Engine pour
un rapport échoué, une empreinte différente et une seed dupliquée.

Les **84 tests ciblés / deux fichiers** passent, avec l’extension préparée du
sélecteur Session pooler. Les types et le lint ciblés sont vérifiés séparément.
Un diagnostic local du SDK mesure les générations/corrections ; il ne vaut
pas réussite de la limite Vitest de cinq secondes. Son attente initiale
« a+1 devient correct » était erronée pour le profil numérique : le SDK
retourne `indeterminate/numeric-profile`. Ce résultat n’est pas changé et
continue de faire refuser le rapport de publication.

Le contrôle complet de cette révision : **PASS**, 1505 tests réussis, 0 en échec. Les sources copiées sont exactes à la fin du contrôle. L’échec précédent
(1 493 réussites et un timeout) est conservé et ne devient pas un succès.
Voir les [preuves datées](mcp-resume-2026-10-20.json).

## Application locale remise en service

Le contrôle final trouve 3150 arrêté (`ECONNREFUSED`) ; la cause de cet arrêt
n’est pas établie. Les quatorze dépendances sont déjà démarrées. Les deux
processus Next/Engine sont relancés avec leurs options conservées, sans arrêt
forcé ni recréation de base. Les 62 tables, onze séquences et métadonnées
des cinq bases restent exactes au redémarrage. Huit configurations privées
sont préservées. Les nouveaux workers gardent les limites cgroup v2 de
mémoire/processus, UID65534, réseau absent et racine en lecture seule.

La vraie connexion/déconnexion, les pages catalogue/référentiels/statistiques/
utilisateurs et les anciens reçus passent sept groupes de vérifications. Le
vrai Engine passe huit contrôles HTTP, projections des seeds0/42, nouveau
brouillon synthétique identifié et rapport signé ; les 22 anciens rapports
restent exacts. Ces données d’essai sont ajoutées, aucune donnée existante
n’est supprimée. La préparation de publication utilise le code courant et
un nouveau rejeu officiel, puis son plan est annulé sans confirmation ni
transfert. Les 62 tables et onze séquences cibles restent intégralement exactes.
Après qualification, les anciennes lignes des 35 tables métier de chacune
des cinq bases sont conservées ; les ajouts synthétiques sont inventoriés
dans les preuves. Les sessions Auth d’essai sont fermées normalement.

Tester sur [3150](http://127.0.0.1:3150/login), avec les identifiants locaux
conservés. Aucun parcours navigateur automatisé ou nouvelle réception
visuelle n’est annoncé.

## Suite

Qualifier le delta SQL sur une copie fidèle, conserver les objets distants
et l’historique, puis obtenir une autorisation distincte avant toute application
Staging. Auth URL/clé publishable et droits SQL sont des sujets distincts :
une connexion Auth réussie ne démontre pas la protection des profils et rôles.
Production, publication réelle et déploiement restent fermés.
