# Utilisateurs — liste locale, recherche et activité

Les champs retenus par [D08](decisions.md#d08--champs-de-consultation-des-utilisateurs-v1)
sont raccordés à une source SQL synthétique séparée. La page
`http://127.0.0.1:3150/admin/users` permet la recherche nom/e-mail, les périodes
UTC de 1 à 90 jours et la pagination par UUID. Les comptes invités gardent un
libellé générique et leur e-mail est masqué avant la recherche. Les
[preuves datées](users-readonly-proof.json) distinguent chaque niveau de contrôle.

La [fiche détaillée locale](user-detail.md) ajoute depuis le profil, la progression
et l’historique synthétique avec une capacité distincte SQL 67. Les preuves de
ce document restent celles de la liste SQL 66. La lecture Production et la
réception navigateur restent ouvertes ; aucun de ces jalons ne clôture le goal.

## Définition et affichage

L’activité correspond aux volumes et à la dernière tentative d’exercice ou de
duel **dans la période choisie** (`attempted_at` / `submitted_at`). Une absence de
tentative n’est pas assimilée à une absence de connexion. Les dates nulles ou
futures ne sont pas inventées. Les filtres sont en UTC ; les dates visibles
précisent le fuseau Europe/Paris. Les verdicts mathématiques et les réponses ne
sont pas nécessaires à cette liste.

Le nom provient de `profiles.first_name/last_name`, l’e-mail d’`auth.users.email`.
Un nom vide, y compris les espaces Unicode, devient « Nom non renseigné ».
Les noms longs sont limités à 200 points de code avec indication d’abréviation.
La recherche est littérale, insensible à la casse : `%`, `_` et `\` ne deviennent
pas des jokers SQL. Les résultats sont limités à 25 comptes ; une nouvelle
recherche remet les curseurs à zéro. Une page vide après changement de données
propose un retour au début. Une indisponibilité n’affiche jamais une fausse liste vide.

Le tableau conserve Inter, les surfaces claires et le bleu de la référence
visuelle. Le rendu serveur échappe les noms et e-mails, fournit légende et
en-têtes accessibles, formulaires GET et liens de pagination sans préchargement.
Ces vérifications SSR ne constituent pas une réception visuelle.

## Capacité SQL locale 66

La migration canonique est
`Novlearn/supabase/migrations/20261018181426_novlearn_admin_user_readonly.sql`,
créée par la CLI Supabase existante. Son empreinte SHA-256 est
`e72c7df6bcf4761c37d127ff967d247664e18ce0aa162d4e009c695bea4fedc9`.
NovLearn est modifié seulement dans son périmètre SQL local autorisé ; aucun
code de l’application élève ou de l’Engine n’est changé pour cette fonctionnalité.

Le rôle `novlearn_users_reader` est NOLOGIN/NOINHERIT, sans privilège élevé ni
appartenance. Ses quatorze colonnes d’entrée concernent l’identité, le nom,
l’e-mail et les dates d’activité. Trois colonnes de `duels` sont nécessaires aux
sous-requêtes des anciennes policies RLS ; aucun statut ou contenu de duel
n’est lu. Ni naissance, rôle applicatif, mot de passe, metadata, réponse,
verdict, clé privée ou droit d’écriture n’est accordé.

Les cinq tables gardent RLS. La policy restrictive ALL de `profiles` est
décomposée par opération : seule SELECT admet l’identité physique du nouveau
rôle ; les prédicats de mutation sont conservés. Les exceptions SELECT des
deux tables déjà traitées par SQL 65 sont étendues au nouveau rôle. La comparaison
des prédicats de mutation et des définitions de toutes les anciennes fonctions
passe. Le lecteur statistique conserve ses propres permissions minimisées.

## Connexion et serveur

Un login neuf `novlearn_admin_users_service`, créé après SQL 66 sur la seule
fixture, utilise SCRAM, NOINHERIT et une appartenance SET sans ADMIN/INHERIT au
rôle nominal. Il ne peut pas assumer le rôle statistique ou celui de publication.
HBA impose TLS, la base et les adresses locales attendues. La CA et le nom de
certificat sont vérifiés ; aucun mode SSL permissif n’est utilisé.

Le lecteur possède un pool borné à deux connexions. Chaque lecture valide et
copie les paramètres, remet la connexion à zéro, ouvre une transaction read-only
et audite séparément login et rôle : colonnes exactes, appartenances, flags,
RLS et absence de droits inattendus de mutation, création, séquences, fonctions
definer ou grands objets. Le helper RLS existant `is_guest()` reste le seul
definer utilisateur admis et sa définition complète est épinglée. Les requêtes
et leur audit sont des fichiers fixes tracés dans le build autonome.

La source `local-copy` est ajoutée par le serveur. Le DTO refuse les champs
supplémentaires, nombres non sûrs, bornes, ordre ou contexte incohérents.
Une dérive de droits détruit la connexion et rend la fonctionnalité indisponible.
La page et l’API autorisent fraîchement l’Admin avant lecture ; les résultats
ne sont pas mis en cache et les cookies rafraîchis sont transmis. L’activation
requiert le profil Auth local principal et un choix opérateur distinct ; ni une
clé Production, ni le banc de publication, ni la seule présence des secrets
n’active cette liste.

## Vérifications réellement exécutées

- Rejeu neuf des **66 migrations**, puis régression de **56 assertions SQL
  historiques inchangées**. Le lecteur agrégé conserve ses **31 assertions**.
- **35 assertions de permissions**, **14 requêtes nominales** avec le vrai
  décodeur et **7 contrôles de bornes** : recherche littérale, dates, pagination,
  masquage invité, noms Unicode et contexte. Les fixtures sont annulées par
  rollback ; les séquences non transactionnelles ne sont pas réputées inchangées.
- Restauration logique SQL 66 : **62 tables**, **73 relations**, **77 fonctions**
  et **11 états de séquence** identiques, ACL complètes, propriétaires et RLS
  comparés. Les 35 assertions passent aussi sur la restauration.
- **16 groupes natifs PG/TLS**, **24 refus réels 42501 en transactions read-write**,
  deux dérives contrôlées refusées puis retrait des grants et rejeu positif.
  Les 62 tables restent identiques.
- Préparation de la source HTTP conservée après dump et sauvegarde des rôles/HBA :
  SQL 66, nouveau login, puis **les deux lecteurs réels** passent sur TLS.
  Les 62 tables sont conservées ; les anciens mots de passe ne sont pas tournés.
- **13 groupes Auth/HTTP/SQL réels** : anonyme, non-Admin avec faux rôle metadata,
  DTO et page, six filtres invalides, recherche, deux sens de curseur, période vide,
  révocation/restauration du rôle, dérive de grant, catalogue/statistiques,
  publication désactivée, isolation des sessions et logout.

La lecture conserve exactement les 35 tables métier avant le test volontaire de
révocation. Ce test met à jour le rôle du seul Admin synthétique, puis le restaure.
Le trigger existant `profiles_updated_at` change normalement `updated_at` : le
pilote vérifie tous les autres champs de ce profil, borne cette date à l’essai,
et compare ensuite toutes les tables avec cette seule modification attendue.
Aucun trigger n’est désactivé, aucune autre ligne ou colonne n’est ignorée.
Le logout de cette session ne certifie pas la révocation d’un JWT volé.

Deux premières tentatives HTTP restent non réussies : démarrage encore incomplet
avant lecture de l’état runtime, puis comparaison exigeant à tort l’égalité de
`updated_at` après l’UPDATE volontaire du rôle. La séparation explicite des phases
de lecture et de mutation garde le contrôle exact de conservation et qualifie
précisément l’effet attendu du trigger. Le blocage antérieur de revue automatique
était une limite d’usage temporaire ; la même action a ensuite passé la revue
après réinitialisation. Aucun autre chemin d’exécution n’a contourné ce blocage.

## Contrôle du code et Engine après redémarrage

Les huit contrôles Engine connectés passent après le redémarrage : projections
des seeds 0/42, correction et nouveau rapport signé. Les seize anciens rapports
conservent leur contenu et signature. La lecture de cgroup v2 confirme non-root,
384 Mio, swap zéro et 64 PID, avec réseau none, rootfs read-only et sans capabilities.
Aucun délai ni seuil Engine n’est modifié. La suite source Engine complète
précédemment qualifiée n’est pas relancée pour cette liste.

La première chaîne complète passe 1 023 tests / 54 fichiers et TypeScript, puis
s’arrête au lint : nom de variable `module` interdit dans le script de préparation
et deux imports inutilisés. Le nom est corrigé et les imports retirés sans modifier
les critères ; cette tentative ne valide ni le build ni le smoke. Le lint ciblé
passe et les treize groupes HTTP sont rejoués sur le pilote final. Le contrôle
complet final passe ensuite **1 023 tests / 54 fichiers**, intégrité Engine, types,
lint sans erreur, format, build, quatre fichiers SQL tracés à l’identique et
smoke HTTP Auth désactivée. Les 441 fichiers copiés restent identiques au retour.
L’avertissement `<img>` préexistant reste visible. Les ajouts documentaires finaux
ne changent pas le code qualifié. Les seize tests distincts des choix du lanceur passent.
La recherche ciblée de 69 secrets ou identifiants privés dans 52 bundles navigateur
ne trouve aucune correspondance ; elle ne constitue pas un audit exhaustif.
Les huit configurations privées, les huit fichiers NovLearn préexistants, le CDC
et le design gardent leurs empreintes.

## Utilisation et suite

L’instance principale conserve ses identifiants et son schéma métier 64. Seule la
source SQL synthétique d’activité passe à 66 ; son dump préalable est conservé.
Le lancement local dispose maintenant d’un choix explicite supplémentaire :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --engine --review --statistics --users
```

Ne pas démarrer un deuxième processus sur 3150 ; utiliser l’instance déjà active.
Les secrets et données de fixture restent dans `.local/`, jamais dans le dépôt
ou les variables `NEXT_PUBLIC_*`. Les anciennes configurations sont conservées.

Avant toute application distante restent nécessaires : réconciliation SQL,
sauvegarde/restauration et PITR, compatibilité élève, identités et certificats
d’exploitation, permissions approuvées, réception humaine et accord distinct.
MFA, expiration stricte des sessions, détails/progression/historique utilisateurs,
métriques restantes et publication HTTP multi-exercices restent ouverts.

Références techniques : [RLS PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
et [TLS node-postgres](https://node-postgres.com/features/ssl). Aucun changement
de version SDK, moteur mathématique concurrent, écriture distante ou navigateur
automatisé n’est inclus dans ce jalon.
