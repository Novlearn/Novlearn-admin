# Journal durable et protection de la source — préparation locale

Le journal Staging et ses primitives serveur sont implémentés et testés
localement. Ils complètent la [capacité SQL cible et le diff](publication-capability.md).
**Le parcours complet de publication reste incomplet** : aucune connexion
PostgreSQL d'application, route ou confirmation de publication n'est activée.
Il reste à raccorder le transfert cible, l'Engine, la relecture après commit,
la reprise et l'interface individuelle/groupée à ces primitives.

Migration propriétaire NovLearn, commit local `18071d2` :
`20261015124209_novlearn_admin_publication_journal.sql` (60e fichier).
Aucune modification distante ou de l'application élève/Engine.

## Plan et états

Chaque opération lie un acteur vérifié, un groupe, une révision précise, son
empreinte/époque, le reçu et la relecture courants, le payload métier, la cible
logique configurée, le mode et l'inspection cible. Une empreinte calculée en SQL
lie cette confirmation à l'ensemble du plan et à son expiration de 15 minutes.
Les définitions restent dans leur texte JSON canonique ; le retour via JSON
de l'Engine doit rester égal au JSONB source. La planification réutilise le
codec et le diff existants, sans calcul mathématique supplémentaire.

| État        | Sens et transition autorisée                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned`   | Plan préparé ; seul son initiateur Admin courant peut le prendre en charge ou l'annuler. Une confirmation expirée ne peut plus démarrer.          |
| `executing` | Prise en charge durable après nouvelle vérification de la source. Une seule opération peut être en cours ou incertaine par identité de catalogue. |
| `uncertain` | L'issue cible n'est pas établie. Aucun succès ni échec certain n'est déduit d'un timeout.                                                         |
| `committed` | Observation cible vérifiée enregistrée par le serveur privé, avec identité, révision, empreinte métier et résultat concordants.                   |
| `failed`    | Échec connu ou absence d'application vérifiée ; les seuls codes sont `validation`, `target_rejected`, `not_applied`.                              |
| `cancelled` | Annulation explicite d'un plan encore préparé ; une opération en cours/incertaine ne peut pas être annulée de cette manière.                      |

Il n'existe aucune expiration qui transformerait automatiquement une opération
en cours/incertaine en échec ou libérerait son contenu. La reprise doit lire la
cible et déterminer ce qui a été appliqué avant toute répétition. Un même
résultat certain enregistré deux fois ne crée pas deux événements. Un résultat
contradictoire ou une confirmation déjà prise en charge est un conflit.

## Protection de la source

Un verrou de ligne dure seulement jusqu'à la fin de la transaction ou la perte
de sa connexion. Voir les [verrous PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html).
Il ne suffirait pas si le commit cible continuait après une déconnexion Staging.

Les opérations `executing` et `uncertain` protègent donc aussi durablement le
parent, ses révisions et les preuves de tests/relecture contre les mutations.
Quatre triggers privés à contexte fixe contrôlent ce journal ; les lectures
restent possibles. Cette protection survit à la fermeture de connexion, au
redémarrage et à la restauration des lignes du journal. Seul l'enregistrement
serveur d'un résultat établi libère le contenu. Les comptes et clés ne sont
pas inclus dans cette interdiction durable : leur révocation reste possible.

`lock_publication_source` revérifie la source et le reçu, puis conserve les
verrous du parent, de la version, du profil initiateur et de la clé de signature
dans la transaction appelante. La primitive `withSourceLease` ouvre une
connexion dédiée jusqu'à la fin du travail, avec délais SQL bornés et nettoyage
par ROLLBACK. Sa fonction de revérification contrôle la session et la connexion
encore vivante. Le journal utilise une autre connexion pour que son état soit
committé indépendamment de cette transaction de protection.

Une révocation peut attendre les courts verrous de cette transaction ; elle
n'est pas interdite indéfiniment par une opération incertaine. L'orchestrateur
à raccorder doit revérifier l'accès immédiatement avant le commit cible,
conserver les protections jusqu'au résultat et classer toute ambiguïté en
`uncertain`. Il ne doit jamais libérer le contenu sur la seule base d'une erreur
de transport. Les primitives seules ne prouvent pas encore ce parcours complet.

## Autorités et données privées

Le rôle `novlearn_publication_journal_executor` est NOLOGIN, NOINHERIT, sans
superutilisateur, contournement RLS, création de rôle/base ou réplication.
Aucun mot de passe ni appartenance n'est créé. Il ne reçoit aucun accès direct
aux tables : seulement cinq fonctions privées à corps fixe et namespace vide.
Les deux nouvelles tables ont RLS et leurs écritures API sont révoquées.
Ce rôle source est distinct de la capacité d'écriture cible.

Avant préparation, lecture privée, prise en charge, annulation et protection
de source, la primitive serveur vérifie l'utilisateur réel non invité et son
profil Admin. L'identité ne vient pas d'un formulaire. SQL revérifie aussi le
profil courant. Seul le serveur privé peut nommer cet acteur auprès des fonctions.

L'enregistrement d'un résultat est une action de la capacité machine : il peut
conserver un résultat réel même si l'initiateur a perdu son rôle après le commit.
Ces événements portent un acteur NULL explicitement machine ; l'initiateur
historique de l'opération reste conservé. Cela n'autorise pas une nouvelle
publication ni une nouvelle confirmation par l'utilisateur révoqué.

SQL vérifie la concordance du contrat de résultat, **pas la réalité d'un commit
dans une autre base**. Le futur service serveur doit fournir une observation
effectivement relue sur la cible après commit. La primitive `record` ne doit
jamais recevoir des données de formulaire ou être exposée directement en HTTP.

`admin_list_publication_operations` permet à un Admin non invité de consulter
ses 25 opérations récentes et leur total, avec contrôle de pagination. Cette
projection exclut acteurs, contenu, reçus, inspection, empreinte de confirmation
et résultat détaillé. Les enregistrements complets restent privés au serveur.
Les tables de journal ne font partie d'aucun payload de publication V1.

## Vérifications réellement exécutées

Les [preuves et empreintes](publication-journal-local-proof.json) distinguent
la sauvegarde complète, les fixtures de protocole et les parcours Engine réels.

- **41 tests Admin supplémentaires**, dont le décodage d'une opération réellement
  renvoyée par PostgreSQL, les refus Auth, révocation, SQL paramétré, contrats,
  session de protection dédiée, nettoyage et conservation d'une erreur de commit
  potentiellement incertain. Les connexions de ces tests serveur sont des doubles.
- Contrôle complet : **378 tests / 25 fichiers**, archive Engine, types, format,
  build et smoke standalone réussis. Lint sans erreur ; un avertissement `<img>`
  préexistant dans le banc catalogue.
- **Rejeu neuf des 60 migrations** sur PostgreSQL isolé sans réseau, empreintes
  stables. Un premier rejeu intermédiaire précède les guards durables ; seule
  la preuve finale est utilisée pour qualifier le fichier courant.
- **41 assertions SQL avant/après restauration** : accès dédiés, contrats,
  propriété/expiration, prise en charge unique, états, protections, révocations,
  événements, idempotence et historique minimisé. Les fixtures sont annulées et
  les **62 tables** retrouvent leurs lignes. Ces résultats ne certifient pas un
  transfert HTTP ou la qualification complète du confinement.
- Deux véritables sessions concurrentes donnent **un commit de prise en charge
  et un conflit `40001`**. Une autre session observe réellement le verrou de clé.
  Après fermeture de la session de protection, l'édition ordinaire reste refusée.
- Une opération incertaine réellement committée dans la copie survit au
  **redémarrage du conteneur puis au dump/restore**, avec ses événements et son
  guard. Le test sait qu'aucun appel cible n'a eu lieu ; il peut donc enregistrer
  `not_applied` et vérifier que l'édition redevient possible. Les **60 tables
  hors journal** et la source initiale sont préservées. Ce test de journal ne
  compare pas les séquences.
- La sauvegarde/restauration complète dans un autre conteneur compare données,
  schéma, propriétaires, ACL et séquences avec le comparateur inchangé. Équivalence
  logique réussie ; comparaison brute différente selon les normalisations
  documentées. **69 assertions historiques** passent. Le nouveau rôle NOLOGIN
  est recréé sur la cible neuve, en plus des deux précédents, car `pg_dump` ne
  sauvegarde pas les rôles du cluster. Aucun grant n'est supprimé pour restaurer.
- Sur cette restauration complète, les suites **48 catalogue, 21 reçus,
  43 relecture, 39 référentiel, 38 flashcards et 35 Dashboard** passent.
- Le vrai parcours **Engine Linux borné → signature Node → reçu SQL → relecture
  synthétique**, deux seeds et concurrence d'approbation, passe sur le rejeu final
  de 60 migrations. Ce n'est ni une véritable relecture pédagogique ni une
  nouvelle exécution complète de la suite source Engine.

Les résultats `committed` du test SQL sont des observations simulées du protocole
et sont annulés. Les cas de persistance gardent des états d'absence d'application
connue dans leurs seules copies. Aucun transfert cible nouveau ou succès de
publication réelle n'est annoncé. Aucune assertion ni critère n'a été assoupli.

## Suite et limites

Raccorder une connexion PostgreSQL privée réelle et des identités séparées,
l'exécution/revérification Engine, le plan immuable confirmé, la transaction
cible, sa relecture et la reprise des résultats incertains. Ajouter ensuite
les confirmations individuelles/groupées et le résultat par exercice.
La reprise après redémarrage devra disposer d'une lecture machine bornée des
opérations en cours, y compris après révocation de l'initiateur. Ce chemin n'est
pas encore implémenté : la lecture privée actuelle exige l'Admin initiateur,
alors que l'enregistrement d'un résultat machine est déjà indépendant de son rôle.
Le bootstrap de restauration canonique devra aussi prévoir le troisième rôle.

La [restriction de sécurité antérieure](goal-recovery.md) n'a pas été contournée
ni le contrôle refusé répété. La qualification complète du confinement reste
ouverte, distincte des contrôles ordinaires exécutés ici. Le refus navigateur
reste respecté : aucun nouveau test visuel n'est annoncé. Auth distante,
publication réelle, migrations distantes, push et déploiement restent fermés.
Le Lot 1A et le goal global restent incomplets.
