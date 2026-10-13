# Progression du goal NovLearn Admin

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
