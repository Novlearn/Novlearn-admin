# Statistiques — connexion et lecteur SQL locaux

Le login PostgreSQL/TLS et le lecteur serveur passent sur la copie synthétique
SQL 65 conservée. Ce jalon prolonge la [qualification SQL](activity-readonly.md) ;
il ne raccorde pas encore la page Admin et n’active aucune lecture Production.
Les [preuves](activity-pg-proof.json) séparent contrôles natifs et tests simulés.
L’application sur 3150 conserve son schéma 64 et ses données.

## Identités et transport

Un nouveau login `novlearn_admin_activity_service` est créé **après** SQL 65,
uniquement sur la copie isolée, avec mot de passe aléatoire SCRAM. Il est LOGIN,
NOINHERIT, sans privilèges élevés ; sa seule appartenance permet SET vers
`novlearn_activity_reader`, sans ADMIN ni INHERIT. Aucun ancien login ayant
conservé des droits PUBLIC n’est réutilisé.

PostgreSQL termine lui-même TLS. Le relais de test transporte les octets sur
loopback dans le namespace réseau isolé, sans port publié. La racine auto-signée
est propre à la fixture, son SAN est vérifié, sa validité est de sept jours.
Les règles HBA spécifiques exigent TLS et SCRAM pour ce login, refusent le clair,
les autres bases et les sockets Unix. Les autres règles restent présentes.
Ce provisionnement n’est pas une migration ou une configuration d’exploitation.

## Lecteur serveur

`src/lib/activity-pg.ts` accepte seulement une configuration opérateur locale :
loopback 55435, base `activity_copy`, login exact, CA explicite, sans options URL.
Il n’existe pas encore de parseur d’environnement ou de route qui l’active.
Le pool est paresseux, limité à deux connexions, avec délais de connexion/requête
et timeouts SQL ; TLS vérifié et channel binding sont explicitement configurés.

Chaque lecture remet la connexion à zéro, vérifie le transport, ouvre une
transaction read-only et audite **le login puis le rôle assumé** : attributs,
appartenances, quinze colonnes exactes, RLS des quatre tables, absence de droits
de mutation, création, séquences, grands objets et propriétés d’objets.
Les colonnes tiennent compte de l’accès au schéma : les vues
`extensions.pg_stat_statements*` ne deviennent pas lisibles sans USAGE sur
`extensions`.

L’unique definer utilisateur autorisé est le helper RLS existant `is_guest()` :
il retourne seulement `coalesce(auth.jwt()->'is_anonymous',false)`, sans table
lue. Sa définition complète, attributs et search_path inclus, est épinglée par
empreinte. Toute autre fonction definer accessible dans un schéma utilisateur
est refusée. Les fonctions natives du catalogue ne sont pas toutes interdites ;
les créations de large objects le sont explicitement.

Seule la requête SQL paramétrée versionnée s’exécute. Le lecteur retourne le DTO
décodé, jamais un client SQL. La période est copiée avant les attentes ; la source
`local-copy` est ajoutée par le serveur et une source fournie par SQL est refusée.
L’affichage distingue cette base SQL synthétique de l’exemple `local-fixture`
sans base. Une erreur détruit la connexion, annule sa transaction et retourne un
message générique sans secret. La future route devra encore autoriser fraîchement
l’Admin à chaque lecture.

## Contrôles exécutés

Le pilote `scripts/test-activity-pg-local.mjs` vérifie le pipe local, le digest
PostgreSQL, l’absence de réseau externe/ports et les quatre identités synthétiques.
Son worker est non-root, sans capabilities, avec rootfs read-only et limites
mémoire/PID.

- **Treize groupes natifs** : TLS, SCRAM, mauvais mot de passe, CA et nom de
  certificat, connexion claire et autre base ; timeout réel, agrégats connus,
  réutilisation de connexion, période vide et bornes.
- **Dix-huit refus réels `42501`**, neuf par identité, en transactions
  **read-write** : e-mail, profil, UPDATE, TEMP, trois créations de large object,
  rôle publication et clés privées. Le read-only applicatif ne masque pas
  l’absence d’une permission SQL.
- **Deux dérives ajoutées puis retirées** sur cette seule copie : SELECT e-mail
  au rôle et TEMP au login. Le vrai lecteur refuse les deux ; après retrait, le
  parcours positif est réellement rejoué.
- Les lignes des **62 tables** restent identiques au relevé avant provisionnement.

Le premier worker échouait avant les tests : un point de montage imbriqué
n’existait pas dans son parent read-only. Le répertoire vide est créé avant
montage ; les restrictions restent identiques. La reprise explicite conserve
artefact, mot de passe et conteneur, sans reprovisionner le login.

Après démarrage explicite de la copie conservée :

```powershell
node scripts/test-activity-pg-local.mjs novlearn-admin-activity-sql-1792341273740 --resume .local/lot1a/activity-pg-1792343332880
```

Le mode initial refuse un login existant. Ce pilote n’accepte pas de base
applicative ; ne pas remplacer silencieusement certificat ou mot de passe.

## Contrôle complet du code

Le contrôle complet final passe **877 tests / 47 fichiers**, intégrité de l’archive
Engine installée, types, lint sans erreur, format, build et smoke HTTP. Les
405 fichiers copiés sont identiques au retour. Les ajouts documentaires suivants
ne modifient pas le code qualifié ; l’avertissement `<img>` préexistant reste visible.

Une première exécution dans le dossier temporaire éphémère du bac Windows s’est
terminée en échec après les 877 tests et les avertissements EPERM de renommage
de cache. Le dossier a disparu à la fermeture du bac, y compris pour la lecture
opérateur autorisée ; l’erreur terminale exacte du build n’est donc pas connue.
Cette tentative n’est pas annoncée réussie. La même commande et les mêmes sources
passent ensuite via le canal d’exécution locale autorisé, dans le dossier Temp
ordinaire conservé. Aucun paramètre de protection, timeout ou critère de test
n’est changé. Les preuves conservent les deux résultats et leur portée.

La recherche ciblée de 45 secrets ou identifiants privés dans les 48 bundles JS
Production ne trouve aucune correspondance. Elle comprend les nouveaux
identifiants et clés privés de fixture ; ce n’est pas un audit exhaustif de fuite.
Les huit configurations privées conservées, les huit fichiers déjà modifiés dans
NovLearn, le CDC et le design de référence gardent leurs empreintes.

## Suite et limites

Restent configuration locale, accès loopback depuis le serveur Admin,
conditionnement des fichiers SQL dans le build autonome, routes, page et contrôles
Auth/HTTP. Filtres pédagogiques, classements et utilisateurs nom/e-mail/activité
restent à construire. Rotation des secrets, certificats d’exploitation,
attestation Production et déploiement ne sont pas qualifiés par ce test.
Aucun secret Production, SQL distant ou navigateur n’est utilisé ; goal incomplet.

Références : [TLS PostgreSQL](https://www.postgresql.org/docs/17/libpq-ssl.html),
[TLS node-postgres](https://node-postgres.com/features/ssl),
[changelog Supabase](https://supabase.com/changelog). Aucun SDK n’est modifié.
