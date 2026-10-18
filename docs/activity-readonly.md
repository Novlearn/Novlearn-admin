# Statistiques — rôle de lecture et agrégats SQL locaux

La migration locale **65**, `20261018162349_novlearn_admin_activity_readonly.sql`,
est préparée dans le dépôt propriétaire NovLearn. Le rejeu neuf, les permissions,
les agrégats et la restauration sur copies synthétiques passent. Les
[preuves](activity-readonly-proof.json) distinguent ce jalon du lecteur applicatif
Production, **encore non raccordé**. Les bases de l’application sur 3150/3152
restent au schéma conservé 64 ; aucun projet distant n’est modifié.

## Périmètre de la capacité

`novlearn_activity_reader` est NOLOGIN, NOINHERIT, sans privilèges élevés,
membership, bypass RLS, écriture métier ou capacité de publication. Aucun compte,
mot de passe, secret Production, fonction definer ou vue privilégiée n’est créé.
Le rôle lit uniquement les colonnes nécessaires d’Auth, tentatives et duels :

- `auth.users` : identifiant, création et caractère anonyme.
- `exercise_attempts` : compte, date, verdict enregistré et abandon.
- `duel_attempts` : compte, date et identifiant de duel.
- `duels` : statut/fin et identifiants nécessaires à la policy SELECT historique.

Les identifiants et dates restent lisibles par ce compte SQL interne ; le futur
serveur transmettra uniquement les agrégats au navigateur. E-mails, profils
nominatifs, réponses, définitions et rapports privés sont refusés. La consultation
nom/e-mail/activité de [D08](decisions.md) exige une capacité distincte.

Les deux policies restrictives ALL d’identité sont réparties par opération.
Seul SELECT reçoit une exception fondée sur le rôle SQL effectif ; les prédicats
INSERT/UPDATE/DELETE sont recopiés exactement. Une claim JWT ne donne pas ce rôle.
Les protections des clients permanents et invités restent testées.

Trois classements definer perdaient leur confinement via EXECUTE hérité de PUBLIC.
Les grants explicites à anon/authenticated/service_role conservent leurs clients
API établis. Le nouveau rôle ne peut plus utiliser ces projections nominales.
Les créations de tables temporaires et d’objets volumineux sont également fermées
pour ce rôle. Les droits de création effectifs des **32 rôles préexistants** sont
conservés par grants explicites ; les futures identités nécessitent provisionnement.
Un nom « readonly » ou une transaction read-only ne constitue pas cette preuve.

## Requête et vérifications exécutées

`scripts/activity-statistics-query.sql` utilise deux paramètres date, une fenêtre
UTC `[from, until)` de 1–90 jours et un seul snapshot de statement. Les volumes
excluent les dates NULL/futures ; l’abandon prévaut sur un verdict enregistré.
Les comptes actifs sont des identités Auth présentes, dédupliquées entre jours et
sources. Tous les compteurs sortent en texte, sans perte de précision bigint.
L’environnement est ajouté ensuite par le futur serveur depuis sa configuration
attestée ; aucune donnée SQL ne choisit elle-même son libellé de source.

Le pilote versionné `scripts/test-activity-readonly-local.mjs` vérifie le pipe
Docker local, l’isolation réseau et le digest PostgreSQL exact. Il exécute :

- **31 assertions** : droits effectifs, refus réels, séparation des rôles,
  profils privés, écritures, créations, JWT falsifié et accès clients conservés.
- **Trois agrégations** : fixture non vide, même période en heure de New York,
  période vide ; valeurs attendues et vrai décodeur du contrat Admin.
- **Cinq contrôles de bornes** : ordre inversé, fenêtre excessive, futur, NULL
  et période valide. Les demandes invalides ne renvoient aucun relevé.
- Comparaison des lignes des **62 tables** avant/après rollback. Les séquences
  peuvent avancer dans cette fixture pristine ; elles ne sont pas comparées ici.

Les suites NovLearn existantes passent inchangées : **30 assertions d’intégration
et 26 de sécurité**, avec empreintes des sources vérifiées avant/après. Un rejeu
neuf final de **65 migrations** passe sur PostgreSQL/Auth officiels isolés.

Une autre copie 64 contient déjà quatre identités, sept tentatives et trois duels.
L’application de 65 conserve les lignes des 62 tables, dont 12 non vides, les
corps de fonctions existants et les droits de création des rôles préexistants.
Une seconde application est refusée atomiquement. Le dump est réellement restauré
dans une nouvelle instance : lignes, agrégats, cinq refus effectifs, 73 relations,
77 fonctions et 11 états de séquences sont vérifiés. Les entrées ACL sont comparées
en totalité après tri ; leur représentation brute reste différente par ordre.
Aucun bénéficiaire, donneur, droit ou option n’est supprimé du comparateur.

Les échecs intermédiaires sont conservés : profil synthétique anonyme initialement
manquant pour une FK historique, création de large object initialement autorisée,
puis comparaison brute d’ordre ACL. Aucun trigger, contrainte ou test n’est retiré.

Le contrôle complet Admin passe **848 tests / 46 fichiers**, intégrité Engine,
types, lint sans erreur, format, build et smoke HTTP sur copie indépendante.
L’avertissement `<img>` préexistant reste visible. Les 398 sources copiées sont
identiques au retour du contrôle ; les adaptations documentaires suivantes ne
modifient pas le code testé. La migration est commitée localement dans NovLearn
(`26cb551`), sans push ; les modifications préexistantes restent hors de ce commit.

## Reproduction et suite

Après le rejeu local propriétaire, démarrer uniquement sa nouvelle instance
conservée, puis exécuter dans Admin :

```powershell
node scripts/test-activity-readonly-local.mjs novlearn-admin-lot1a-replay-20261018162820709
```

Le pilote refuse une base applicative ou Auth non pristine. Les données non vides
et la restauration ont leurs artefacts séparés indiqués dans les preuves.
Les ressources de qualification sont arrêtées normalement, volumes conservés.
L’application utilisateur continue sur 3150 avec ses comptes et données.

Restent : nouvelle identité SQL dédiée après migration, vrai login PostgreSQL/TLS,
audit des droits du login et du rôle assumé, attestations de connexion, lecteur
serveur, permissions Auth fraîches, route/page, filtres
pédagogiques et tests HTTP. La liste utilisateurs reste à construire séparément.
Aucun secret privilégié Production n’est récupéré et aucun accès distant n’est
activé sur la seule réussite de ces tests SQL. Le lot et le goal restent incomplets.

Les références utilisées sont les [grants PostgreSQL](https://www.postgresql.org/docs/17/sql-grant.html),
les [privilèges](https://www.postgresql.org/docs/17/ddl-priv.html), les
[large objects](https://www.postgresql.org/docs/17/lo-funcs.html) et les
[policies Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
