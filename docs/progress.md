# Progression du goal NovLearn Admin

## Chapitres et compétences locaux — 15 octobre 2026

Le [référentiel Staging](taxonomy.md) ajoute listes/recherche, création/édition,
alias/ordre/emoji, identifiants stables, rattachement, points, liens d'exercices
et suppression contrôlée des seules fiches inutilisées. Les deux RPC protègent
les références et l'audit, avec empreinte/époque et refus de l'écriture API directe.
La 57e migration est ajoutée localement dans NovLearn (`c7e9f9e`).

**39 assertions SQL avant/après restauration, 48 catalogue, 21 reçus et 43
relecture passent**, ainsi que 257 tests Admin, types, lint, format, build et
smoke. Deux éditions concurrentes donnent un commit et un conflit. Les anciennes
colonnes des 58 tables sont préservées ; 59 snapshots sont identiques après
annulation des fixtures et restauration. Le banc navigateur synthétique vérifie
édition, fermeture annulable, conflit, erreurs et responsive avec Inter locale.
Pas de nouvelle certification Engine source, Auth réel ou rejeu neuf de 57 SQL.

Le goal a repris à l'état `active` après le checkpoint de restriction ci-dessous.
La publication et la qualification complète du confinement restent ouvertes.
Auth distante et toute propagation Production restent fermées ; les autres lots
et le Lot 1A ne sont pas déclarés terminés.

## Reprise après restriction de sécurité — 15 octobre 2026

Le [bilan de reprise](goal-recovery.md) identifie trois arrêts Codex
`cyber_policy`, distincts de l'erreur de disponibilité PostgreSQL. Le goal
est enregistré `blocked` ; la reprise manuelle autorisée progresse sans
forcer cet état ni répéter le contrôle concerné après découverte du refus.
Une migration défensive additive (56e fichier) passe sur une nouvelle copie
SQL et sa restauration : six groupes de contrôles ordinaires, 58 tables
préservées, 48 assertions catalogue, 21 reçus et 43 relecture. Neuf tests
publication, lint/format et empreinte Engine passent. Le rejeu neuf de 56
migrations et la certification complète du confinement ne sont pas annoncés.
Les résultats 55 migrations/221 tests ci-dessous sont des preuves antérieures.
Le travail de publication reste partiel ; aucun changement distant.

## Capacité locale de publication — objectif incomplet

La [fondation de publication](publication-capability.md) transfère les seuls
contenus métier autorisés entre deux bases locales : UUID stable, IDs techniques
cibles, acteurs NULL, références résolues sans copie, empreintes, concurrence,
idempotence et retour arrière. La capacité est fermée par défaut, sans LOGIN.

**55 migrations, 50 contrôles de transfert et 5 contrôles de capacité restaurée
passent.** Les 69 assertions historiques, 48 catalogue, 21 reçus et 43 relecture
restent vertes après restauration ; 221 tests Admin, types, lint, format, build
et smoke passent. Les pannes intermédiaires sont conservées et corrigées sans
assouplir les critères. Le comparateur garde ses 11 tests.

Il reste à relier service serveur, protection de la source au commit, journal
durable et UI de publication. Aucun parcours HTTP de publication ou Auth réel
n’est certifié par ces fixtures. Les autres lots restent ouverts. Aucun changement
distant, push, déploiement ou suppression de donnée existante ; l'objectif reste
incomplet et le Lot 1A distant n’est pas déclaré clos.

## Relecture humaine locale — objectif incomplet

La [relecture](editorial-review.md) ajoute les transitions protégées, l’attestation
explicite, les références Staging contrôlées et l’historique. L’approbation
directe par le rôle API est fermée. Un changement de contenu invalide la
validation ; les tests seuls ne l’accordent jamais. La route reste désactivée.

**54 migrations, 43 assertions relecture avant/après restauration, 48 catalogue,
21 reçus et 69 contrôles historiques après restauration ; 212 tests Admin.**
Le parcours Engine natif/signature/SQL passe, avec une seule approbation acceptée
sur deux sessions concurrentes. Sauvegarde/restauration, types, lint, format,
build et smoke passent. Les échecs intermédiaires et leurs corrections sont
conservés dans les preuves ; aucun critère n’est assoupli.

La publication sélective et les autres lots restent à construire. La réception
complète du Creator et du rendu avancé reste ouverte. Aucun changement distant,
push, déploiement ou suppression de donnée existante ; CDC, design et corpus
Engine protégés inchangés. Le Lot 1A distant et l’objectif global ne sont pas
déclarés terminés.

## Reçus de tests par révision — objectif incomplet

Les [rapports persistés](test-receipts.md) lient les résultats Engine réels à la
révision relue en SQL, son empreinte, son compteur d’état et l’Admin vérifié.
La signature serveur et le registre privé empêchent les verdicts fabriqués par
le navigateur ; une édition suivie d’un revert ne conserve pas l’état courant.
L’historique reste accessible aux Admins, sans modification des anciens rapports.

**53 migrations, 21 assertions reçus avant/après restauration, 69 assertions
historiques et 47 assertions catalogue après restauration ; 195 tests Admin.**
Le parcours natif Engine/Node/SQL et la sauvegarde réelle passent localement.
L’approbation humaine et ses contraintes SQL restent à construire avant toute
activation ; aucun statut n’est avancé par un test, aucune action distante.

## Aperçu et tests Engine locaux — objectif incomplet

Le [parcours d’aperçu](preview.md) utilise des snapshots privés temporaires
associés à l’Admin serveur, la projection élève officielle et la correction
native. Les rapports multi-seeds contrôlent le rejeu, les attendus, les formats
invalides et les cas incorrects obligatoires. **184 tests Admin passent.**
Brave exerce une génération et une correction réelles via Docker borné, avec
propriétaire synthétique et sans Auth/base distante. Le build neuf et le smoke
standalone passent après archivage d’un artefact incrémental incomplet.

Restent les rapports persistés, la relecture/approbation, la publication sélective,
les courbes et la réception des rendus avancés, ainsi que la récupération des
sorties non annulables. Aucun verdict de test ne change un statut éditorial.
Les accès distants restent fermés et l’objectif global reste incomplet.

## Creator canonique et runtime local — objectif incomplet

Le [Creator](creator.md) ajoute les cinq familles de variables, les 20 types
d’éléments, MathLive et les politiques de correction au catalogue. La route
protégée valide la structure via l’archive Engine certifiée et un worker natif
Linux borné ; aucun repli ou verdict mathématique parallèle. **146 tests Admin
passent**, ainsi que l’adaptateur Docker et le worker du standalone. Brave
vérifie la saisie, duplication, clavier, retour interne annulé et conservation
sur erreurs dans un banc synthétique.

Le Lot 3 garde des critères restants : aperçu, réception des sorties sur tous
les navigateurs, diagnostics de génération. Le Lot 4 fournit les tests et
l’aperçu ; aucun statut approuvé ou publié n’est attribué par cette validation
structurelle. Auth distante reste fermée, NovLearn reste limité aux migrations
locales. Aucun push, déploiement ou changement distant.

## 14 octobre — catalogue Admin local et recentrage D07

Le périmètre courant est désormais **schéma NovLearn local + application Admin**.
Le correctif API NovLearn commencé pendant ce tour a été retiré avec son test ;
les changements antérieurs sont conservés. Les migrations restent dans le dépôt
NovLearn, leur propriétaire canonique. Aucune modification distante n’a lieu.

Le [catalogue](catalogue.md) est construit et testé : métadonnées, liste privée,
recherche, tri, statuts, pagination, brouillons versionnés, copie indépendante,
archivage/restauration, historique et diff de définitions. Les mutations passent
par Auth/rôle serveur frais, origine exacte et RPC invoker protégées par RLS.
L’archive Engine certifiée est installée et contrôlée par SHA256/SHA512.

**Preuves : 52 migrations, 47 assertions catalogue sur le rejeu puis sur sa
restauration, 69 assertions historiques après restauration, 98 tests Admin.**
La sauvegarde conserve toutes les données, structures, ACL et séquences selon
le comparateur existant ; les différences brutes restent archivées.
Le banc navigateur utilise des fixtures synthétiques, pas un compte distant.

**Le goal reste actif et incomplet.** Prochaine réalisation : Creator canonique
avec MathLive, éléments et variables, puis validation/aperçu via le runtime
Engine Linux borné. L’activation distante reste fermée : réconciliation SQL,
restauration réelle, compte Admin et compatibilité élève à traiter séparément.
Les sections suivantes conservent l’historique des étapes ; leurs anciens
blocages applicatifs sont remplacés par D07 pour le développement local.

## Certification Engine locale validée — objectif incomplet

La [certification locale Linux](lot-1a-engine-linux-certification.md) est validée
sur l'archive exacte choisie après D06 : sept opérations publiques, rejeu privé,
projection et arrêt des workers, avec cgroup v2 borné. La suite source passe
**1 534 tests sans skip** ; les 12 contrôles OS Linux, 8 parcours historiques,
13 tests Python/FastAPI et le dernier smoke de package passent.
**Le Lot 1A reste incomplet**, avec compatibilité des anciens consommateurs et
portes SQL restantes. Les refus Windows antérieurs restent documentés ; aucune
protection Windows ni environnement distant n'est modifié.

Les correctifs SQL indépendants autorisés localement sont testés jusqu'à
51 migrations et 69 assertions après restauration. Les anciens lecteurs et
verdicts d'exercices attendent la transition vers l'Engine qualifié. L'utilisateur
autorise maintenant explicitement les corrections locales Engine et leur
certification ([D05](decisions.md#d05--corrections-locales-et-certification-engine-autorisées)).

L'objectif complet reste inchangé et incomplet. Le travail reprend sur la
compatibilité des lecteurs officiels et sur les autres portes de 1A. La porte
Engine locale Linux est franchie sans assouplir ses critères.
Les applications distantes, publication, push et déploiement gardent leurs
autorisations séparées. Aucun lot suivant n'est ouvert pour contourner 1A.

## État courant — écritures de statistiques protégées

La [migration locale 26](lot-1a-local-statistics-guard.md) protège les quatre
compteurs dérivés de profils et ferme les mutations clients de quatre tables
de statistiques/récompenses. **51 migrations passent et 69 assertions passent
après restauration**, avec toutes les 53 précédentes conservées. Les
[empreintes finales](lot-1a-local-statistics-proof.json) sont vérifiées.
Les compteurs ne deviennent pas pour autant fiables sur les anciens verdicts
clients : leur transition vers la correction officielle reste bloquante.
La certification locale Engine Linux est maintenant validée par D06.
L'autorisation Engine est accordée par D05, l'Auth est désactivée et
aucun lot dépendant n'est ouvert.

## État courant — RPC privilégiés et namespace

La [revue locale des RPC](lot-1a-local-rpc-review.md) ajoute le correctif 25 :
récompenses réservées au serveur, identité NULL/croisée refusée pour la
progression, helpers et triggers avec namespace fixe. Le consommateur serveur
des récompenses existant conserve son fonctionnement et son idempotence.
**50 migrations passent et 53 assertions de sécurité passent après restauration**,
avec les 35 assertions précédentes conservées. Les [empreintes finales](lot-1a-local-rpc-proof.json)
sont archivées ; aucun environnement distant ou donnée réelle n'est modifié.
L'Engine et les portes restantes du Lot 1A restent non validés ; l'autorisation
distincte de correction Engine est toujours en attente.

## État courant — restauration et profils privés

Le [complément de validation](lot-1a-local-restore-and-privacy.md) dépasse le
relevé de 48 migrations ci-dessous : **49 migrations** passent avec le bootstrap
officiel Supabase Auth 2.197.0, dans une nouvelle instance sans réseau.
La nouvelle migration 24 ferme les profils privés d'autrui, expose une
projection minimale des noms/avatars et sécurise deux RPC historiques.
Les lecteurs duel/feedback sont adaptés et les types, lint et 183 tests frontend
passent, avec les 9 todo préexistants inchangés.

Une archive logique est restaurée sur une autre instance neuve : intégrité
des données, schéma, ACL, rôles et séquences vérifiée, **35 assertions de
sécurité après restauration** et **11 tests du comparateur** passent. Les
différences brutes d'ordre ACL et de trous d'ordinal Auth sont conservées.
Les fixtures utilisent une définition canonique et une instance produites
par l'API publique Engine ; aucune donnée réelle ou environnement distant
n'est modifié. Les [empreintes finales](lot-1a-local-restore-proof.json) sont
archivées, les volumes de test conservés et les conteneurs arrêtés.

Le Lot 1A reste incomplet : certification Engine Windows, fermeture des anciens
lecteurs d'exercices, réconciliation distante, sauvegarde/PITR réelle et droits
de publication restent à valider. Une autorisation distincte de modification
Engine est demandée et demeure en attente ; aucun accord n'est présumé. Les
lots dépendants et l'Auth Admin restent fermés.

## État courant — reprise locale du Lot 1A autorisée

L'autorisation utilisateur D04 remplace le blocage de permission des relevés
historiques ci-dessous. Des corrections sont appliquées localement dans
NovLearn ; aucun environnement distant ni source Engine n'est modifié.
Le [bilan détaillé](lot-1a-local-validation.md) et le
[manifeste des 48 SQL rejoués](lot-1a-local-replay-manifest.json) décrivent
les sources, responsabilités, commandes et limites des preuves.

Les 48 migrations passent sur une instance Supabase PostgreSQL neuve, sans
réseau ; les bancs réels locaux passent 30 + 26 assertions, avec fixtures
annulées. PGlite passe 57 assertions avec pgcrypto réel et les URL de tests
sont verrouillées sur loopback (9 tests). Types/lint et suites NovLearn passent
avec le runner backend isolé existant ; les 9 todo frontend restent visibles.

La certification Engine reste bloquée : deux `check` complets donnent chacun
1532 PASS / 1 FAIL (timeout Windows du host réel), malgré 40 tests ciblés,
package et 13 tests Python réussis. Aucun skip ni limite n'est assoupli.
Les lectures privées historiques, la réconciliation distante complète,
backup/restauration et les droits de publication demeurent des portes ouvertes.
Le Lot 1A et le goal complet restent incomplets ; aucun lot dépendant ni
activation Auth n'est ouvert automatiquement.

## Mission du 13 octobre 2026

La demande `/goal` jointe autorise le développement local par lots, les tests,
la documentation et les commits locaux. Elle remplace la restriction de la
mission documentaire précédente et autorise le passage automatique aux lots
indépendants lorsque leurs prérequis sont satisfaits. Le CDC reste inchangé.
Les migrations distantes, modifications NovLearn/Engine, secrets privilégiés
Production, publications réelles, push et déploiements restent interdits sans
validation humaine explicite.

## Audit de démarrage

- Base Git : `ad92efb`. Seul `.env.example` est modifié à l'arrivée ; préserver
  ses octets et le laisser hors des commits de cette mission.
- CDC et documents existants examinés. Socle : Next 15.5.12, React 18.3.1,
  TypeScript strict, Tailwind 3.4.18, sortie standalone. Aucun accès métier.
- NovLearn lu uniquement : mêmes versions majeures, tokens CSS HSL, accents
  bleu/indigo/violet ; Supabase SSR, MathLive et Vitest déjà utilisés.
- Engine lu uniquement : package ESM 0.1.0, schéma 5, exports canoniques et
  sous-chemin `node-host`. Certification du 13 octobre : isolation Windows
  non qualifiée, 25 échecs de transport. Aucun calcul alternatif autorisé.
- Runtime local : Node 24.19.0, npm 11.17.0.
- Métadonnées Staging relues via Supabase, sans écriture ni lignes nominatives :
  `exercise_versions` absente ; `auth.users` compte **0** lignes.
- `chapters` : UUID, name, order_index, aliases text[], emoji. `competences` :
  id text, chapter_id UUID nullable, name, max_points nullable. `flashcards` :
  UUID, chapter, question, answer, created_at nullable.
- Les policies chapitres/compétences n'autorisent que la lecture. Flashcards
  possède une policy d'écriture dépendant de `profiles.role`. Sur profiles,
  la policy ALL PERMISSIVE `NOT is_guest()` et la lecture transversale restent
  présentes. Le rôle ne peut donc pas être considéré comme une source sûre.
- Les identifiants de projets et la version PostgreSQL restent ceux documentés
  dans `database-strategy.md`. Aucun secret récupéré, aucune donnée Production
  personnelle consultée, aucune migration ou modification de repo voisin.

## Plan d'exécution et critères

| Lot | Travail local autorisé                                                              | Condition de réception réelle                                                                                |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1A  | Dossier de sécurité et schéma, inventaire en lecture                                | Réconciliation canonique, SQL revu/testé, application Staging autorisée, rôle protégé                        |
| 1B  | Auth serveur, connexion/déconnexion, contrôle par opération, tests avec doubles, UI | 1A validé, premier admin provisionné, parcours réel et politique MFA/révocation vérifiés                     |
| 2   | Catalogue paginé sur colonnes observées, accès contrôlé                             | 1B actif ; schéma exercise_versions détaillé et appliqué pour les écritures/versionnement                    |
| 3   | Éditeur utilisant les types du package Engine et MathLive                           | 2, validation isolée opérationnelle, sauvegarde réelle et permissions testées                                |
| 4   | Adaptateur Engine isolé, seeds/correction/projections                               | Hôte qualifié, instances privées serveur, tests multi-seeds et non-divulgation                               |
| 5   | Plan/service testé sur doubles uniquement                                           | Mapping/champs SQL approuvés, capacité confinée, moteur élève compatible ; première publication exige accord |
| 6   | Chapitres/compétences sur contrat observé                                           | 1B et droits d'écriture/RPC de références atomiques, sans suppression cassant les liens                      |
| 7   | Flashcards et saisie/prévisualisation                                               | 1B, rôle protégé, droits réels et tests des mutations                                                        |
| 8   | Définitions d'indicateurs et interface de consultation                              | Identité Production réellement read-only, champs nominatifs approuvés, agrégats serveur                      |
| 9   | Vérifications locales et runbook                                                    | P0 satisfaits, hébergement approuvé ; déploiement exige accord distinct                                      |

Chaque lot reçoit des tests de comportement et de permissions, lint, typecheck,
format et build, une relecture du diff et un commit local. Aucun lot dépendant
n'est annoncé terminé sur la seule base de doubles ou d'un bouton désactivé.

## État et reprise

Audit réalisé. Préparation locale du Lot 1B livrée ; activation bloquée par 1A.
Le code comprend connexion/déconnexion serveur, vérification Auth et rôle,
protection de la page et du layout, endpoint de session contrôlé, cookies SSR
renouvelés, refus de cache, interface responsive et erreurs.
Le dashboard affiche uniquement l'indisponibilité des sources ; aucun compteur
fictif. Aucun endpoint d'édition ni CRUD n'est annoncé comme réalisé.

Preuves locales du 13 octobre 2026 :

- Vitest : **54 tests PASS**, 4 fichiers (autorisations, endpoints directs,
  adaptateur Supabase et renouvellement SSR).
- `npm.cmd run check` : tests, TypeScript, lint, format et build PASS ; smoke
  HTTP séparé PASS puis intégré à check. Le smoke utilise un vrai standalone
  temporaire avec Auth forcé désactivé, contrôle CSS, redirection Admin,
  endpoints 503/405, absence de cache et headers de sécurité.
- Navigateur réel : redirection `/admin` vers `/login?error=disabled`, formulaire
  désactivé, styles présents. Desktop et viewport 390 × 844 inspectés ; largeur
  de page 375 px avec scrollbar, aucun débordement horizontal.
- Next corrigé 15.5.27, PostCSS/sharp/selector-parser verrouillés.
  `npm audit --omit=dev` : **0 vulnérabilité déclarée**. L'audit complet conserve
  **7 alertes high** dans l'outillage Tailwind/ESLint, remontant à braces 3.0.3,
  sans version corrective publiée lors de la lecture du registre. Aucun
  `audit fix --force`, downgrade Next ou migration majeure Tailwind effectué.
- `.env.example` SHA-256 inchangé :
  `bef315e2915404a579ed290b3f31ec738565219eacb46c4f83e16295314854cf`.
- CDC SHA-256 inchangé :
  `b6bfea6d74b008e54ed61aa7598ccd01bd438d496cc22add15da2ff8abb04401`.

Les tests avec comptes réels, RLS/ACL, MFA, révocation stricte, mutations métier,
Creator/Engine, publication et statistiques restent **non réalisés**. Les lots
2 à 8 ne peuvent pas être réceptionnés sur les tables et droits actuels. Leur
préparation ne doit pas figer des champs SQL encore soumis à décision.

La revue finale en lecture seule trouve des modifications locales dans NovLearn
au commit `07a1764`, notamment une route d'exercices, ses tests, un audit et des
propositions SQL dans `docs/sql-proposals/` et `supabase/proposals/`. Ces fichiers
n'ont pas été modifiés par ce goal. Leur audit indique une préparation non
appliquée, un smoke PGlite avec digest stub et un historique toujours non
réconcilié. Ils ne constituent pas une preuve de rôle sécurisé sur Staging.
La proposition de protection des profils ne protège pas à elle seule toutes
les INSERT de rôle : cette porte doit être testée explicitement avant activation.
Le dépôt Engine est propre lors de la revue finale.

Prochain point humain : autoriser une tâche locale ciblée dans NovLearn pour
relire les propositions existantes, réconcilier l'historique canonique et finaliser les correctifs du Lot 1A
(policies permissives, rôle non modifiable, projections/RPC, droits éditoriaux),
avec tests SQL sur base isolée. Cette demande n'inclut ni application distante,
ni provisionnement effectif, ni accès Production. Ces étapes demanderont leurs
accords propres. Le plan détaillé reste dans `lot-1a-preparation.md` et les
conditions d'ouverture dans `auth.md`. Aucun lot suivant indépendant ne peut
être activé sans ces prérequis ; le goal reste incomplet.

Commit local de cette préparation : `feat(auth): prepare gated staging admin access`.
Le hash est consultable par `git log -1 --oneline` ; `.env.example` en est exclu.

## Ajustement visuel demandé pendant le goal

L'utilisateur fournit `docs/system-design.md` et deux logos SVG. Inter/Fredoka
locales, palette et variantes cadrées sont intégrées selon D03 et décrites dans
`visual-implementation.md`. Les fichiers utilisateur originaux restent intacts.
Le smoke vérifie aussi les polices WOFF2 et logos servis par le standalone.
Le rendu Inter et les deux logos sont contrôlés dans le navigateur ; sur mobile
390 × 844, le formulaire commence à environ 514 px et le bouton est visible.
Un rebuild est resté sans nouvelle sortie plusieurs minutes puis a réussi.
Les serveurs QA sont arrêtés avant les rebuilds suivants pour éviter les
concurrences d'accès aux artefacts standalone sous Windows ; la cause exacte
de l'attente n'est pas établie.

## Préparation indépendante de MathLive

Continuation du goal : l'accord de modification NovLearn n'est pas reçu et
l'arbre Admin reste au commit `cd20e8d` avant ce travail (seul `.env.example`
préexistant est modifié). Le tour précédent a livré du code, des tests, des
preuves navigateur et un commit : il constitue une progression.

Une partie indépendante est préparée dans Admin : champ React MathLive réel,
clavier scientifique français, valeurs contrôlées sans boucle, lecture seule,
fallback annoncé et polices locales. Le banc de test est hors routes Next et
utilise seulement des fixtures synthétiques ; aucun accès DB/Engine n'est activé.
Voir `math-input.md` et la capture machine `tests/fixtures/mathlive-observed.json`.
Les 61 tests unitaires passent (54 Auth + 7 liaisons du champ) ; types, lint,
format, build et smoke HTTP passent. Le smoke confirme aussi les polices
MathLive et la licence présentes dans le standalone. Le clavier mobile est
inspecté à 390 × 844 sans débordement, avec une largeur de page de 375 px.
Commit local de ce travail : `feat(ui): prepare scientific MathLive input`.

Les prérequis sont revalidés par un SELECT de métadonnées Staging :
`exercise_versions` reste absente, Auth compte zéro utilisateur, et la policy
profil `ALL PERMISSIVE NOT is_guest()` reste présente. Aucun correctif ou
provisionnement distant n'est constaté dans ce relevé, aucune écriture n'est
effectuée. L'accord de modification des repositories voisins reste requis.

Ce travail ne réceptionne pas les lots 3/4 : Creator, sauvegarde, génération et
correction restent à réaliser après les prérequis. Les limites et autorisations
du point de reprise SQL précédent restent inchangées.

## Rapprochement en lecture seule des migrations

État de reprise : commit Admin `8e81ccf`, seule modification locale préexistante
de `.env.example`. Le tour MathLive a livré du code testé, des observations et
un commit : progression réelle. L'accord de modification NovLearn reste absent.

Les statements archivés sont comparés uniquement par hashes, sans exporter leur
contenu ou les identités d'acteurs. Deux SELECT sur les projets connus relèvent
70 entrées chacun, avec listes identiques dans le périmètre sélectionné. Les
versions `001` à `025` ont leurs statements NULL ; les 45 autres entrées gardent
65 statements. Les 45 fichiers locaux suivis sont relus dans un dossier de
migrations Git propre, au commit source `07a1764`.

Sept correspondances candidates sont établies après normalisation LF et trim
extérieur documenté ; aucun match LF strict, aucun historique réparé. Les
résultats détaillés et limites sont dans `lot-1a-hash-reconciliation.md`, le
SELECT dans `lot-1a-migration-hashes-readonly.sql` et les métadonnées dans
`lot-1a-migration-hashes.json`. Ces preuves affinent les prochains rapprochements
sans autoriser une migration ou conclure à l'équivalence des effets.

Le goal reste incomplet. L'examen sémantique des SQL et les correctifs doivent
être conduits avec le propriétaire dans NovLearn après accord explicite ; les
25 statements manquants demandent une preuve historique externe. Aucune base,
permission, donnée Production, repository voisin ou CDC n'est modifié.
Les 45 empreintes locales et leurs 45 lignes de comparaison sont revérifiées
par une assertion Node sur les fichiers actuels et le rapport capturé : PASS.
Le format et le diff sont vérifiés ; les contrôles applicatifs restent ceux
du socle Auth/MathLive, pas des preuves de RLS ou de migrations correctives.
Commit local : `docs: reconcile recorded migration hashes`.

## Audit du blocage — accord humain requis

Reprise au commit `33a0c10` : aucun accord de modification NovLearn n'est reçu.
Le même point d'arrêt demeure depuis la demande initiale et les continuations
MathLive, rapprochement SQL, puis cette revalidation (au moins trois tours
consécutifs avec le même blocage). Les deux tours précédents ont produit une
progression réelle ; ce relevé ne livre aucune nouvelle fonctionnalité.

La dernière lecture Staging confirme zéro compte Auth, `exercise_versions`
absente et la policy profil ALL permissive toujours présente. Le rapport
Engine courant reste non qualifié pour intégration pilote sur Windows. Les
lots fonctionnels dépendants ne peuvent pas être ouverts ou réceptionnés en
respectant leurs prérequis ; les prepared components et hashes ne remplacent
pas la sécurisation SQL, les droits réels ou la certification.

Le goal est marqué **bloqué**, pas terminé. L'objectif complet reste inchangé.
Pour reprendre : obtenir l'accord explicite de travailler localement dans
NovLearn sur le Lot 1A, en partant de ses propositions existantes (historique,
protection du rôle, RLS/grants/RPC et tests SQL isolés). Cette autorisation doit
être distincte de toute application distante ou publication. Les migrations
distantes, modification Engine, secrets privilégiés Production, première
publication réelle et déploiement conservent leurs validations séparées.

Ce point d'arrêt provient de la règle du goal : « Toute modification du
repository NovLearn » exige une validation humaine préalable. Aucune permission
n'est déduite des continuations automatiques du goal.
