# Fondation locale de publication

Le transfert SQL sélectif et le calcul des différences sont implémentés et testés
sur deux bases Docker locales distinctes. Le [journal et la protection durable
de source](publication-journal.md) sont maintenant ajoutés localement.
**Le parcours de publication Admin n’est pas livré** : connexion PostgreSQL,
orchestration du commit et de sa reprise, routes et écrans restent à relier.
Aucune connexion Production, publication réelle ou activation distante n’a lieu.

## Contrat et identité

**Réserve de qualification du 15 octobre :** l'audit ultérieur relève une
permission indirecte dans deux triggers historiques. La migration défensive
56 et ses contrôles ordinaires passent incrémentalement ; les 50 contrôles
ci-dessous ne constituent pas une certification complète du confinement.
Le contrôle de sécurité concerné reste non exécuté après restriction Codex.
Le rejeu neuf atteint depuis 60 migrations et les workflows ordinaires passent ;
cela ne remplace pas cette qualification. Voir la [reprise](goal-recovery.md)
et le [journal](publication-journal.md).

La migration propriétaire
`Novlearn/supabase/migrations/20261014220625_novlearn_admin_publication_capability.sql`
est créée avec la CLI locale et committée dans NovLearn sous `f036c5c`.

`admin_export_exercise_publication` exige un Admin non invité, une révision et
son empreinte/époque inchangées, une approbation humaine enregistrée et son
dernier reçu courant réussi avec clé toujours active. Un nouveau rapport après
l’approbation impose une nouvelle relecture. Les acteurs et rapports restent
dans les données de contrôle Staging, hors du payload envoyé à la cible.

Ce payload contient exactement neuf champs : version du transport, UUID stable
du catalogue, révision, JSON canonique, empreinte métier et contrats/archive
Engine. La cible attribue ses propres `bigint` et UUID techniques, puis recalcule
ses empreintes. Une collision de `bigint` ne réattribue pas l’identité d’une ligne
historique. Les FK et anciennes révisions sont conservées.

`definitionJson` préserve le texte JSON PostgreSQL sans réécrire le contenu
approuvé. Avant export, le JSON transmis à l’Engine doit être égal au JSONB
enregistré. Un nombre SQL arrondi par JavaScript est notamment refusé. Ce codec
de transport n’est pas un format mathématique supplémentaire.

Les champs `approved_by`, `approved_at`, `created_by`, `updated_by`, les reçus,
audits et clés ne sont pas copiés. La cible construit une version publiée avec
`publication_origin='transfer'` et acteurs NULL. Cette insertion est réservée au
rôle de capacité ; les transitions locales et l’immuabilité restent protégées.

## Capacité cible

Les rôles `novlearn_publication_executor` et `novlearn_publication_writer` sont
NOLOGIN, NOINHERIT, sans superutilisateur, contournement RLS, création de rôle
ou de base. Aucun mot de passe ni appartenance aux rôles API n’est provisionné.
L’exécuteur n’a que les fonctions de capacité. Le propriétaire de leurs corps
fixes possède les droits par colonne nécessaires sur les deux tables : création
du parent, insertion de révision, métadonnées et pointeur actif. Il n’a aucun
UPDATE de révision, DELETE, TRUNCATE ou écriture dans les tables exclues.

`novlearn_admin_private.publication_runtime` est désactivé par défaut. Le registre
local fixe contrats, génération, canonicalisation et archive Engine ; il ne
constitue pas une preuve du runtime réellement déployé en Production.

`inspect_exercise_publication` valide le payload et résout les références cibles.
Une référence absente, ambiguë ou extérieure au chapitre bloque le préflight.
Les références UUID doivent déjà exister ; noms et alias ne sont acceptés que
s’ils sont uniques. Aucune taxonomie n’est copiée ni définition réécrite.
Le header historique est dérivé explicitement. Sa difficulté utilise `1 → easy`,
`2 → medium`, `3 → hard`, ou NULL si absente ; toute autre valeur est bloquée.

`apply_exercise_publication` vérifie empreinte et contrats, puis verrouille
l’identité et le parent. Le token cible inclut les versions, métadonnées et
l’époque monotone du parent : une édition suivie d’un revert invalide le diff.
Une révision différente ou non publiée est un conflit, jamais un remplacement.
La transaction n’écrit que dans `exercises` et `exercise_versions`, avec
`content={}` pour le parent canonique. Le résultat est relu avant retour.
Un rejeu d’un état final identique retourne `unchanged` sans ajout ni nouvelle
époque. Le mode `rollback` réactive explicitement une ancienne version conservée.

Les fonctions font confiance au **service serveur autorisé** pour sélectionner
la source et exécuter l’Engine. Elles ne contactent pas Staging depuis la cible
et ne développent aucune correction mathématique SQL.

## Vérifications

- **55 migrations** passent sur PostgreSQL Supabase neuf, réseau `none`, avec
  bootstrap Auth officiel et empreintes stables.
- **50 contrôles de publication** passent : Engine Linux borné réel, signature
  Node, reçu/approbation SQL synthétiques, transfert, collision d’IDs, références
  portant des IDs différents, contrats, acteurs NULL, rôles, concurrence,
  idempotence, archivage et retour arrière. Les payloads de concurrence restent
  des fixtures de protocole, pas de nouvelles certifications mathématiques.
- Deux contenus concurrents de la même révision donnent une réussite et un
  conflit `40001`. Une panne volontaire **après insertion** annule toute la
  transaction ; son erreur spécifique est vérifiée et aucune révision ne reste.
- Les **56 tables exclues** sont comparées par nombre de lignes et empreinte.
  Une tentative est ajoutée volontairement entre les phases pour vérifier son
  lien à la première version : chaque opération compare son propre avant/après.
  Les snapshots globaux encadrent aussi cette préparation de fixture et ne
  doivent donc pas être comparés comme s’il s’agissait d’une seule publication.
- La sauvegarde/restauration conserve données, séquences, schémas, propriétaires,
  RLS, ACL et droits par colonne. Les deux propriétaires NOLOGIN sont recréés
  sur l’instance neuve avant `pg_restore`, car `pg_dump` n’exporte pas les rôles
  du cluster. Le comparateur et ses **11 tests** ne sont pas assouplis.
- Après restauration, **69 assertions historiques, 48 catalogue, 21 reçus et
  43 relecture** passent. La capacité restaurée passe **5 assertions** dans une
  transaction annulée : les **58 tables** retrouvent exactement leurs lignes
  et empreintes. Ce test ne compare pas les séquences, puisque `nextval` n’est
  pas transactionnel ; leur restauration est vérifiée séparément auparavant.
- **221 tests Admin**, types, lint sans erreur, format, build et smoke passent.
  Les neuf tests de diff incluent le JSON réellement produit par PostgreSQL.

Les erreurs intermédiaires sont conservées : chemins, opérateurs JSON, parent
absent, booléens psql et identité de session. `SET ROLE` depuis une connexion
superutilisateur ne suffit pas pour tester une escalade : le test utilise aussi
`SET SESSION AUTHORIZATION`. Aucun droit n’est élargi pour obtenir un succès.
Voir PostgreSQL [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html)
et [SET SESSION AUTHORIZATION](https://www.postgresql.org/docs/17/sql-set-session-authorization.html).

Les preuves sont dans [publication-capability-local-proof.json](publication-capability-local-proof.json).
Auth et attestations sont synthétiques ; aucune connexion réelle ou publication
HTTP n’est certifiée. Le rejeu qualifie l’arbre local avec les modifications
historiques 010/022/028 préexistantes, pas un clone propre ou le drift distant.

## Prochaine réalisation

Relier la capacité à une connexion PostgreSQL dédiée et bornée, vérifier Auth/
rôle avant chaque étape, valider/tester avec l’Engine, puis relire et protéger
la source pendant l’écriture cible. Le verrou d’une RPC, libéré à son retour,
ne suffit pas à empêcher une édition entre les deux bases. Raccorder le journal
Staging et la protection durable maintenant préparés à la transaction cible,
à la reprise des résultats incertains et aux écrans individuel/groupé, avec
résultat par exercice.
Aucune route de publication n’est exposée avant ces contrôles.

Avant usage distant : réconciliation SQL, backup/PITR réel, comptes Admin et
technique restreint, secrets séparés, qualification du runtime et du lecteur
élève, revue des effets indirects et autorisation explicite. Première publication
réelle, migration distante, push et déploiement gardent leur validation distincte.
Les autres lots et la réception du Creator restent ouverts ; l’objectif global
n’est pas terminé.
