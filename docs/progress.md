# Progression du goal NovLearn Admin

**20 octobre — indicateur de version active connecté :** [lecteur et permissions](active-version-connected.md)
sont qualifiés sur la cible locale conservée : huit groupes PG/TLS, 17 refus,
douze groupes Auth/HTTP, sept groupes sur 3150 et huit contrôles Engine après
redémarrage. Les fiches affichent une observation fraîche, y compris le retour
arrière vers 1 alors que MAX vaut 2 ; l’absence réelle reste distincte d’une
panne. Activation explicite, données et huit configurations préservées ;
publication ordinaire et Production fermées. Les 120 tests ciblés passent ;
le contrôle complet réussit : **1 404 tests / 75 fichiers**, intégrité Engine,
types, lint sans erreur, format, build, onze SQL standalone exacts et smoke. Les
557 sources sont exactes à sa fin ; seules huit preuves documentaires sont
complétées après le contrôle. Le goal reste ouvert.

Les relevés suivants retracent les étapes antérieures à ce raccordement.

**20 octobre — cible locale SQL 70 qualifiée :** [upgrade et régression](active-version-target-local.md)
passent après sauvegarde : 62 tables, 11 séquences et identités préexistantes
conservées, source Auth inchangée. Advisors : zéro erreur, 33 avertissements
ouverts. Treize groupes du pilote cible puis treize groupes Auth/HTTP réels
exercent publication et retour arrière. L’indicateur reste fermé en attendant
provision, Auth/HTTP spécifiques et activation explicite. Aucun distant ;
le contrôle complet réussit : **1 387 tests / 72 fichiers**, types, lint, format,
build, onze SQL standalone exacts et smoke. Les cinq nouveaux scripts sont
inclus ; les neuf documents de bilan sont complétés et vérifiés après le contrôle.
Le goal reste ouvert.

Les relevés suivants sont antérieurs à cet upgrade de la cible synthétique.

**20 octobre — reprise confirmée après réparation utilisateur :** les 14 services
conservés sont redémarrés sans recréation. La [connexion réelle et huit contrôles
Engine](local-recovery-2026-10-20.md) passent sur [3150](http://127.0.0.1:3150/login),
avec les mêmes identifiants ; les vingt anciens rapports restent exacts.
SQL 70 passe quinze prérequis négatifs, l’annulation DDL et une restauration
peuplée (62 tables, 11 séquences). Le vrai lecteur TLS passe huit groupes,
17 refus et trois dérives de droits. La cible applicative demeure SQL 64,
intégralement inchangée : advisors, régression de publication, upgrade et
qualification HTTP du nouvel indicateur restent à effectuer avant activation.
Le contrôle complet courant réussit : **1 387 tests / 72 fichiers**, types, lint
sans erreur, format, build, onze SQL standalone exacts et smoke. Les 539 sources
incluent les deux bancs de test ; seules les preuves documentaires listées sont
complétées après le contrôle. Aucun distant ni navigateur automatisé ; le goal
et le Lot 1A restent ouverts.

Les relevés suivants décrivent les observations antérieures à cette reprise.

**20 octobre — cause du démarrage Docker identifiée :** le [journal courant](local-recovery-2026-10-20.md)
confirme un crash sur le renommage de `sailor-ingest.sock`, après un seul lancement
normal. La fermeture « Quit », puis un lancement depuis le menu Démarrer sont
la suite autorisée ; aucun socket, volume ou réglage n’est modifié. Le banc des
quinze prérequis SQL 70 et de restauration est préparé et passe trois contrôles
statiques ; ses tests PostgreSQL restent non exécutés. Le contrôle complet
antérieur de 1 387 tests n’est pas présenté comme une nouvelle qualification.

**Contrôle complet du 20 octobre réussi :** 1 387 tests / 72 fichiers, types,
lint, format, build et smoke ; le [lecteur cible reste en préparation](active-version-readonly.md).
L’[aperçu 3140](http://127.0.0.1:3140/) est accessible avec des exemples fictifs,
sans Auth, base ou Engine. Le relevé 11:43 UTC confirme 3150/3152 arrêtés et
Docker absent ; aucune connexion réelle actuelle n’est déclarée réussie.

**20 octobre — version active et disponibilité :** la [lecture de la version cible](active-version-readonly.md)
est préparée, fermée par défaut. Rejeu neuf de 70 migrations, upgrade d’une copie
peuplée, six observations natives, 16 refus SQL et 103 tests ciblés passent.
Le test physique PG/TLS reste non validé, sa préparation conservée. Docker n’est
plus joignable ; 3150/3152 refusent la connexion à 11:33 UTC. Les résultats de
disponibilité du 19 octobre ci-dessous sont historiques. Aucun reset, accès
distant ou contournement de sécurité ; reprise normale Docker demandée.

**Performance pédagogique du 19 octobre :** une [requête optimisée et mesurée](pedagogy-performance.md)
remplace le plan qui dépassait dix secondes sur 100 000 réponses synthétiques.
Les 28 mesures passent (maximum 3,443 s), puis quatre lectures du vrai pool TLS
avec deux appels simultanés (maximum observé 3,727 s). Les bornes SQL sont
renforcées à quatorze cas négatifs ; permissions et API restent qualifiées.
La volumétrie réelle, les caches froids et l’hôte cible restent à vérifier.

**Raccordement pédagogique du 19 octobre :** la [page et les API locales](pedagogy-connected.md)
sont disponibles sur 3150, depuis Statistiques. Le lecteur TLS et les quatorze
groupes HTTP réels passent ; la source SQL 69 synthétique reste distincte de
l’activité générale. Les [preuves](pedagogy-connected-proof.json) séparent les
résultats Engine et du contrôle complet. Réception navigateur, performances,
33 avertissements SQL et portes distantes restent ouverts.

Le relevé suivant décrit le socle antérieur à ce raccordement.

**Socle pédagogique du 19 octobre :** les [requêtes, filtres et droits SQL](pedagogy-readonly.md)
passent sur copies isolées. Le nouveau lecteur ne donne accès ni aux profils ni
aux définitions/réponses. Login/TLS, API et interface restent à raccorder ; les
filtres pédagogiques ne sont pas encore disponibles dans l’application.

## Reprise et qualifications locales — 19 octobre 2026

Les [services conservés sont disponibles](local-recovery-2026-10-19.md) après
intervention utilisateur sur Docker. Connexion réelle, huit contrôles Engine
(18 anciens reçus conservés), SQL 68, restauration, 56 assertions historiques,
19 groupes PG/TLS et 16 Auth/HTTP passent. Les [advisors](reader-policies.md)
confirment treize avertissements supprimés ; 32 WARN et 65 INFO restent ouverts.
Le [parcours HTTP de publication par lot](publication-batch-http-proof.json)
passe sept groupes avec trois transferts locaux, arrêt sur réponse perdue et
reprise sans doublon. Les échecs initiaux restent documentés. Aucun distant
activé ; réception navigateur et objectifs restants du CDC toujours ouverts.

## Relevé antérieur — préparation et panne du 19 octobre

La [correction des policies](reader-policies.md) vise treize doublons SELECT des
trois lecteurs, sans nouvelle colonne ni mutation. La CLI a créé SQL 68 ; le
pilote de comparaison RLS et de conservation est préparé et contrôlé statiquement.
Sa première exécution s'arrête avant SQL : le moteur Docker est indisponible.
Le démarrage normal reproduit à 09:44:59 UTC l'erreur du socket interne ; aucun
socket, droit ou réglage n'est modifié. Les services 3150/3152 et Auth refusent
la connexion à 09:50 UTC. Fermeture « Quit » et lancement utilisateur normal sont
demandés ; aucun test SQL 68 n'est déclaré réussi, aucun distant n'est modifié.
Le contrôle complet hors ligne passe 1 143 tests / 59 fichiers, types, lint,
format, build et smoke Auth désactivée ; 473 sources restent identiques. La
migration reste non appliquée et hors commit, en attente des essais natifs.

## Fiches utilisateurs — 19 octobre 2026

La [fiche locale](user-detail.md) raccorde profil, trois vues paginées, historique
et progression enregistrée sur copie synthétique SQL 67. Rejeu neuf, restauration
peuplée, 48 assertions de permissions, 24 cas SQL, sept bornes, 56 régressions
historiques, 19 groupes PG/TLS (42 refus) et 16 groupes Auth/HTTP passent réellement.
Les huit contrôles Engine passent après redémarrage ; 17 rapports antérieurs
restent exacts. La chaîne complète passe **1 143 tests / 59 fichiers**, types, lint, format, build
et smoke ; les 469 fichiers copiés restent identiques. Les [preuves](user-detail-proof.json)
distinguent ces contrôles des essais PG/TLS/HTTP et de la réception navigateur.

L’instance 3150 reste disponible. Les advisors locaux ont 0 erreur, 45 avertissements
et 65 informations ; sept doublons de policies du nouveau rôle restent à réduire
avec comparaison d’accès, sans considérer le Lot 1A comme terminé. Les restrictions
de pilotage navigateur restent respectées ; aucun accès ni changement distant.

## Statistiques — parcours connecté local du 18 octobre

La [page/API locale](activity-http.md) est raccordée avec source synthétique
distincte, activation explicite, contrôle frais Admin et refus de dérive SQL.
Douze groupes HTTP réels passent, puis huit contrôles Engine inchangés après
redémarrage. Les données antérieures sont conservées ; deux comptes de test
dédiés et un brouillon/rapport Engine synthétiques sont ajoutés et retenus.
Les échecs de préparation et du pilote sont détaillés dans les preuves, sans
les convertir en réussites. Production et utilisateurs nominatifs restent ouverts.

## Lecteur analytique — PostgreSQL/TLS local du 18 octobre

Le [login dédié et lecteur serveur](activity-pg.md) passent sur la copie SQL 65
conservée : treize groupes natifs, dix-huit refus effectifs en read-write et deux
dérives de privilèges refusées. Les 62 tables restent identiques. Le source label
`local-copy` distingue une vraie requête SQL synthétique de l’exemple sans base.
Routes/page, permissions Auth/HTTP et capacités Production restent à réaliser.
Les services 3150/3152 et leurs configurations ne sont pas modifiés.
Le contrôle complet final passe 877 tests / 47 fichiers, types, lint, format,
build et smoke HTTP. La première tentative dans le Temp éphémère du bac Windows
reste un échec conservé ; la même suite passe via l’exécution locale autorisée.
Les [preuves](activity-pg-proof.json) distinguent ces tentatives et le test SQL natif.

## Lecture analytique — qualification SQL locale du 18 octobre

Le [rôle et les agrégats SQL](activity-readonly.md) disposent d’une migration 65
dans NovLearn, sans modification des 64 fichiers antérieurs. Rejeu neuf et
31 assertions de permissions passent ; trois agrégations, cinq bornes et le
décodeur réel vérifient les résultats, dont comptes anonymes et période vide.
Les suites existantes passent inchangées : 30 assertions d’intégration et 26 de
sécurité. L’héritage PUBLIC est borné sans nouveau definer ni rôle privilégié.

La migration sur copie déjà peuplée et sa restauration conservent 62 tables,
73 relations, 77 fonctions et 11 séquences dans leurs comparaisons respectives.
Les droits de création des 32 rôles préexistants restent effectifs ; l’ordre brut
d’ACL diffère et reste conservé. Les échecs de fixture et de large object sont
documentés dans la [preuve](activity-readonly-proof.json), sans critère retiré.

Le vrai login PG/TLS, le lecteur/route/page et les utilisateurs nominaux restent
à implémenter et qualifier. L’application 3150 est préservée ; aucun accès distant.
Le contrôle complet passe **848 tests / 46 fichiers**, types, lint sans erreur,
format, build et smoke sur copie indépendante. La migration seule est commitée
localement dans NovLearn dans `26cb551`, sans push ni inclusion des modifications
préexistantes. La preuve conserve séparément chaque portée de qualification.

## Services connectés rétablis — 18 octobre 2026

La [reprise](local-recovery-2026-10-18.md) sauvegarde à froid les deux VHDX et
deux paramètres Docker, puis redémarre normalement le moteur et les dix services
conservés. Aucune mise à jour, réinitialisation ou intervention sur une protection.
L’application sur 3150 permet de nouveau connexion, sauvegarde et Engine.

Huit contrôles Engine, huit de reprise publication et sept d’accès/isolation
passent. Les 62 tables de la cible sont exactement conservées ; toutes les
anciennes lignes des 35 tables métier de chaque source comparée restent intactes.
Un brouillon et son rapport de test, un plan de publication annulé et son
historique sont ajoutés. Le relevé principal commence après le redémarrage de
sa base, celui de publication précède l’arrêt ; leurs portées sont distinctes.
Les configurations, SQL et modifications préexistantes contrôlées sont conservées.

Les 848 tests du dernier contrôle complet ne sont pas relancés après cette
reprise ; le code qualifié est revérifié identique. Les interactions navigateur,
la récupération connectée et la publication HTTP multi-exercices restent ouvertes.
[D08](decisions.md#d08--champs-de-consultation-des-utilisateurs-v1) retient désormais
nom, e-mail et activité pour les utilisateurs ; aucune lecture distante activée.

## Accès aux essais depuis la connexion — 18 octobre 2026

La page de connexion désactivée propose maintenant le lien vers l’aperçu, en
développement seulement. Ses exemples fictifs et l’absence de sauvegarde sont
annoncés. Une connexion configurée conserve son parcours normal ; le build
Production ne propose aucun lien loopback. Auth et les permissions ne changent pas.

Les [preuves](login-preview-proof.json) conservent quatre tests SSR et cinq
contrôles HTTP réels sur serveur temporaire, puis son arrêt. Le contrôle complet
passe **848 tests / 46 fichiers**, types, lint, format, build et smoke HTTP.
L’aperçu répond sur 3140 sans base ni Engine ; Docker et l’instance connectée
restent à rétablir. Aucun test navigateur ou de connexion réelle supplémentaire.

## Statistiques d’activité — préparation du Lot 8

Le [contrat et l’affichage](activity-statistics.md) préparent les agrégats,
périodes UTC et contrôles de cohérence sans client Production ni nouvelle SQL.
Le banc comporte un exemple figé explicitement fictif, avec états indisponibles
et tableau accessible. Les statistiques réelles, le rôle de lecture, les filtres
pédagogiques, les utilisateurs et la qualification SQL/HTTP restent à réaliser.
Le choix nominatif a ensuite été précisé par D08 ; il n’active pas le lecteur.

Le contrôle complet du 18 octobre à 12:50 UTC passe **844 tests / 45 fichiers**,
types, lint, format, build et smoke HTTP. Les onze pages du banc compilent ;
trois réponses HTTP de l’aperçu sont vérifiées. Les 39 nouveaux tests couvrent
les périodes, agrégats, précision et rendus serveur. Le premier échec de
réentrance du décodage est conservé dans la [preuve](activity-statistics-proof.json).
Aucun test navigateur, agrégat réel Production ou qualification SQL de lecture
n’est revendiqué. Les 64 SQL, huit configurations privées et modifications
préexistantes contrôlées sont conservées.

## Reprise et contrôle du périmètre — 18 octobre 2026

La [matrice de livraison](readiness-current.md) distingue les vingt sections de
la demande. Les statistiques/utilisateurs Production et l’indication courante
de version cible sont encore à construire ; Docker ne constitue pas leur seule
limite. Les courbes n’ont pas de points calculés dans l’API Engine actuelle.
Les réceptions navigateur, sessions et exploitation restent explicitement ouvertes.

Un [correctif de nettoyage](recovery-cleanup.md) reproduit puis traite le refus
d’accès au stockage pendant la déconnexion, sans bloquer la fin de session ni
supprimer d’autres données du navigateur. Les résultats datés seront conservés
dans sa preuve ; aucune écriture distante ou réparation globale n’est effectuée.

Le [relevé de réconciliation actualisé](lot-1a-remote-reconciliation-current.md)
lit uniquement les métadonnées des deux projets : 70 migrations, 25 sans
statements et 22 tables publiques sans `exercise_versions`. Git HEAD conserve
sept candidats par empreinte normalisée, l’arbre qualifié six, avec trois SQL
préexistantes préservées. Les différences brutes de trois fonctions ne sont
pas transformées en dérive fonctionnelle prouvée ; leurs corps rapprochés et
attributs sélectionnés correspondent. Aucun historique n’est réparé.

Le contrôle complet final passe **805 tests / 44 fichiers**, types, lint sans
erreur, format, build et smoke HTTP ; dix pages du banc compilent. Les échecs
de régression et de typage intermédiaire restent des échecs documentés.
Ces résultats ne certifient ni les effets navigateur ni la reprise connectée.
Le correctif de nettoyage est commité localement dans `4260d80`, sans push.

## Récupération Creator — 18 octobre 2026

La [copie de récupération](creator-recovery.md) est facultative et explicitement
privée. Elle distingue compte, API, exercice, version et mode d’édition ; les
copies périmées ne sont pas restaurées et une référence modifiée conduit à
une nouvelle révision. Les gardes de sortie et les contrôles serveur restent
actifs. Les résultats Node/SSR et de compilation sont distingués des essais
navigateur et connectés, encore non exécutés pour ce jalon.

Le contrôle complet passe **802 tests / 44 fichiers**, types, lint sans erreur,
format, compilation et smoke. Trente-cinq tests nouveaux couvrent récupération
et confirmations de sauvegarde ; un HTTP 200 incompatible ne supprime plus
la copie. Dix pages du banc compilent ; la recherche ciblée de secrets passe.
Les références protégées, configurations et migrations restent inchangées.
Le commit de publication HTTP est `d17fbfa` ; aucun push ni accès distant.

## Publication HTTP réelle sur copies — 17–18 octobre 2026

Le [parcours connecté](publication-http-connected.md) qualifie la vraie route
Next avec GoTrue, PostgREST, Engine Linux borné et PG TLS. Treize contrôles
passent : deux révisions transférées, confirmations altérées refusées, révocation,
retour à la première version et conservation d’historiques non vides. Une socket
cliente fermée après les en-têtes est traitée séparément d’une perte d’acquittement
COMMIT. Le profil local possède ses propres paramètres, cookie et libellés ;
le profil ordinaire et les environnements distants ne sont pas activés.

Le contrôle complet passe 767 tests / 43 fichiers, types, lint, format, build
et smoke sur copie indépendante aux sources vérifiées identiques. Les échecs
intermédiaires restent conservés. Aucun critère ou délai n’est assoupli.

À la reprise du 18 octobre, Docker Desktop 4.90 échoue sur `sailor-ingest.sock`.
Les processus applicatifs sont arrêtés et la reprise HTTP reste non exécutée.
Les huit fichiers privés comparés sont inchangés ; aucune réinitialisation ni
modification des protections n’est tentée. La mise à jour officielle avec
sauvegarde est proposée séparément car elle touche un logiciel global.
Le goal reste actif ; les autres lots locaux indépendants et portes de la
roadmap restent ouverts.

## Préparation de la publication HTTP — 17 octobre 2026

Le [banc dédié](publication-http-local.md) conserve une source SQL 64 avec comptes
Auth réels et une cible pristine séparée. Les cinq contrôles Auth/REST et six
contrôles TLS/PG passent ; les snapshots des 62 tables de chaque copie sont
préservés pendant les vérifications PG. Le profil ordinaire reste fermé à la
publication, ses fichiers privés sont inchangés et l’instance 3150 reste active.

Le bootstrap partagé est importable sans effet ; son CLI refuse toujours le
port occupé. Les 74 tests ciblés Auth/configuration passent. Ce jalon prépare
l’intégration ; il ne certifie aucun transfert HTTP ou nouvelle exécution Engine.
Prochaine étape : profil Next isolé, cookies séparés, parcours réel de transfert
et reprise. Aucune nouvelle migration ou opération distante.

## Correctif Engine adopté dans l’Admin — 17 octobre 2026

L’[adoption locale](engine-admin-adoption.md) coordonne l’archive qualifiée, les
signatures, le manifeste Auth et SQL 64. La migration propriétaire est commitée
localement dans NovLearn ; aucune modification distante. Les 63 anciennes SQL
et les huit fichiers préalablement modifiés restent identiques.

Le rejeu neuf, les assertions SQL (21 reçus, 43 relecture, 15 rotation), les refus
de migration, la copie restaurée et le bootstrap Auth/PostgREST passent. Sur les
62 tables de l’instance conservée, seul le champ d’empreinte du registre privé
change. La sauvegarde complète, l’ancienne archive et les clés sont conservées.
735 tests Admin et le contrôle complet passent. Les 16 contrôles connectés de
relecture et huit contrôles de l’exercice avancé passent avec le nouveau build.
L’instance 3150 est rouverte avec les mêmes identifiants.

Les incidents et échecs intermédiaires sont conservés et distingués des succès.
La réception visuelle, les courbes de formules, la publication HTTP complète,
les lectures Production et les portes distantes restent ouvertes. Le goal reste
actif ; ce jalon ne clôture pas le Lot 1A ou la livraison complète.

## Correctif Engine qualifié — 17 octobre 2026

L’autorisation D05 / Engine D51 permet la [correction locale des recalculs
numériques](engine-numeric-cache.md), sans changement de délai ou de critères.
Un seul fichier du cœur est modifié ; six tests d’isolation complètent la suite.
**1 540 tests / 30 fichiers, zéro skip** et le contrôle complet Engine passent,
ainsi que le smoke du tarball exact. Linux : six générations de la définition
avancée complète prennent **2,41–2,64 s** sous le délai inchangé de cinq secondes.
Les projections sont identiques ; dix comparaisons privées/diagnostiques,
sept opérations, 12 contrôles OS et huit parcours historiques passent.

Le nouveau build d4d3abc4…a582f9 est qualifié, mais **l’Admin conserve son ancienne
archive** : SQL épingle encore cette identité pour les reçus/publications. La
rotation locale qualifiée et l’adoption coordonnée sont les prochaines étapes ;
les anciens reçus et journaux ne seront pas réécrits. Aucun changement SQL,
donnée métier, environnement distant ou protection Windows dans ce jalon.
La qualification applicative de cette nouvelle archive reste à réaliser.

## Figures et vecteurs — 16 octobre 2026

Le [rendu des coordonnées publiques](coordinate-rendering.md) ajoute des
flèches 2D et une projection 3D explicitement annoncée, un découpage réel des
droites à la fenêtre, les bornes MathLive et une description textuelle des
objets géométriques. Aucun calcul de formule ni changement Engine/SQL.

Les projections natives des seeds 0/42 sont capturées par les vraies routes
Next avec Auth locale, sans mutation métier. **24 tests ciblés** passent,
dont 22 nouveaux, et les **10 pages du banc manuel** compilent. La page
« Figures et vecteurs » affiche ces captures sans prétendre relancer le moteur.
Le [relevé](coordinate-rendering-proof.json) distingue les preuves natives,
le rendu serveur et la réception visuelle non exécutée.

**718 tests dans 41 fichiers** et le contrôle complet passent. Les 48 bundles
clients de l’application et 22 du banc inspectés ne contiennent aucun des
secrets ou noms privés recherchés. Le serveur est relancé et neuf contrôles
réels passent lors de l’unique reproduction après un échec initial : la
génération avait dépassé son délai natif de cinq secondes (5 022 ms, file 1,3 ms).
Définition, sources et limites sont inchangées. La cause de cette intermittence
reste ouverte ; la preuve globale est partielle et ne certifie pas une
disponibilité stable du runtime pour cette charge avancée.

Le tracé de fonctions/suites définies par formules reste ouvert : le contrat
fournit leur présentation avec `formulaDomain: unverified`, sans échantillons.
La réception visuelle, publication HTTP complète, lectures Production et mise
en service restent aussi ouvertes. Le goal reste actif et incomplet.

## Relecture connectée — 16 octobre 2026

La [relecture locale](local-admin-review.md) s’active explicitement avec
`--engine --review`. Le formulaire lie la confirmation à la révision, au reçu
et à son état, remet les attestations à zéro si ce contexte change et exige
une observation après réponse perdue ou conflit, sans nouvel envoi automatique.
L’API projette et valide les cinq métadonnées utiles de l’événement SQL.

**16 contrôles réels** passent avec de nouveaux comptes d’essai, sessions
GoTrue/SSR, Next, PostgREST et Engine Linux borné : quatre rapports natifs,
dont un refus pour couverture négative manquante, et six événements marqués
comme attestations synthétiques. Révocation, archive, ancien reçu, édition,
attestation incomplète et répétition périmée sont refusés. Les lignes métier
préexistantes sont conservées ; le nouveau brouillon termine sans approbation.
La [preuve](local-admin-review-proof.json) conserve les périmètres et l’échec
intermédiaire du test d’archive, corrigé selon son contrat HTTP 409.

**696 tests dans 39 fichiers**, intégrité Engine, types, lint sans erreur,
format, build et smoke passent, ainsi que les **10 contrôles du lancement**.
Les 48 bundles clients du build inspectés ne contiennent aucun des secrets
ou noms privés recherchés. Ce contrôle ciblé ne vaut pas audit exhaustif.
Après redémarrage, huit contrôles réels supplémentaires passent : nouvelle
connexion, conservation des rapports et de l’historique, moteur natif,
permissions et publication toujours fermée, sans mutation métier.

Le serveur d’essai reste destiné aux essais progressifs manuels sur le port 3150. La réception visuelle automatisée, MFA/expiration, publication HTTP
complète, rendu avancé, lectures Production et mise en service restent ouverts.
Aucune migration ni modification distante ; le goal reste actif et incomplet.

## Publication par lots — 16 octobre 2026

La [sélection de cinq exercices maximum](publication-batch.md) réutilise le
service unitaire et son journal : diffs et confirmations par exercice, arrêt
sur refus/résultat incertain, observation après rechargement sans jeton et
nouvelle préparation explicite après annulation. Aucune migration supplémentaire.
Le catalogue projette explicitement ses métadonnées à sa nouvelle frontière client.

**676 tests dans 38 fichiers**, intégrité Engine, types, lint sans erreur,
format, build et smoke passent. **Cinq phases de transfert sur copies SQL**
passent : trois reçus natifs, sept vérifications Engine fraîches, deux COMMIT
dont une perte d'acquittement injectée, reprise sans application, annulation
et confirmation fraîche du dernier exercice. Les trois transferts finaux sont
confirmés ; les deux bases d'origine et les tables exclues restent conservées.
Auth/REST et relecture de ce banc natif sont synthétiques.

**13 contrôles HTTP séparés** passent avec GoTrue/PostgREST/Next réels, dont
catalogue, page de lot, permissions et publication refusée. Neuf pages du banc
compilent ; une simulation de lot permet les essais manuels. Les 19 bundles
clients de l'instance et les 20 du banc inspectés n'exposent aucun des secrets
ou noms privés recherchés. La [preuve](publication-batch-proof.json) conserve
les périmètres, l'échec initial de format et la compatibilité AST du worker.

L'application avec Engine est relancée. Le transfert par l'API avec une vraie
session, la réception visuelle, le rendu avancé, les statistiques/utilisateurs
Production et les portes de mise en service restent ouverts. Aucun accès ou
changement distant ; le goal reste actif et incomplet.

## Engine dans la session connectée — 16 octobre 2026

Le [worker Linux borné](local-admin-engine.md) est raccordé au serveur Windows
de développement par un transport privé. **28 contrôles HTTP réels passent** :
Auth, sauvegarde, génération, corrections, tests reproductibles seeds 0/42,
signature HMAC, enregistrement SQL et affichage du rapport dans la page protégée.
Le brouillon reste un brouillon. Les refus de session, origine, rôle révoqué,
instance fournie par le navigateur et état de test périmé sont exercés.

**641 tests dans 35 fichiers**, intégrité Engine, types, lint sans erreur,
format, build et smoke passent. Sept contrôles du canal privé passent et
l'inspection Docker confirme les quotas/réseau/montages. Les 30 bundles clients
inspectés ne contiennent aucun des secrets ou noms de configuration privés
recherchés. Les preuves du jalon précédent restent datées et distinctes.

Le redémarrage conserve les lignes des trois tables exercices/révisions/rapports,
arrête l'ancien worker et laisse les services de base actifs. Une nouvelle
connexion retrouve le rapport dans PostgREST et la page protégée. Les
[preuves et empreintes](local-admin-engine-proof.json) distinguent ces contrôles
de la réception visuelle non exécutée et de la suite source Engine non relancée.

Aucun changement source Engine, migration ou accès distant dans ce jalon.
Réception visuelle, rendu avancé, publication par lots et portes de mise en
service restent ouverts ; le goal reste actif et incomplet.

## Connexion et sauvegarde locales réelles — 16 octobre 2026

L'[application connectée](local-admin.md) est disponible sur le port 3150 avec
des comptes d'essai, GoTrue, PostgREST et les vraies routes Next. **17 contrôles
HTTP réels passent**, dont connexion, refus non-Admin, sauvegarde, rechargement,
conflit, révocation du rôle et persistance après reconnexion. Le serveur ne lit
aucun secret opérateur. **621 tests / 34 fichiers**, types, lint, format, build,
intégrité Engine et smoke passent. La réception visuelle, l'expiration et MFA
ne sont pas certifiés par ces essais.

La [migration 63](rpc-http-conflicts.md) corrige un conflit métier qui provoquait
des retries infinis de PostgREST 14 : huit frontières RPC renvoient maintenant
`PT409`, sans modification des droits ou des données. Rejeu neuf des 63 SQL,
189 assertions avant/après restauration, comparaison des 62 tables et concurrence
catalogue/flashcards passent. Un bootstrap neuf Auth/REST passe aussi.

Le moteur reste à raccorder à cette instance Windows ; son banc Linux séparé
reste disponible pour les calculs. Publication et accès distants restent fermés.
Les restrictions de sécurité sont conservées. Le goal reste actif : rendu avancé,
réception, publication par lots et portes de mise en service restent ouverts.

## Retour à une révision publiée — 16 octobre 2026

Le [retour serveur/SQL](publication-rollback.md) passe dix étapes réelles sur
deux révisions, dont création par RPC, nouveau reçu Engine, relecture synthétique,
refus des modes incompatibles, commit avec réponse perdue, reprise sans transfert,
répétition identique et réactivations. Les définitions publiées, les deux
tentatives liées aux versions et toutes les tables exclues restent conservées.
Un défaut de diagnostic est corrigé : conflit métier et indisponibilité technique
restent distincts, avec nettoyage de la connexion dans les deux cas.

**584 tests Admin**, types, lint sans erreur, format, build et smoke passent.
Les 13 groupes ciblés passent ; les neuf scénarios cibles et les sept du service
sont documentés séparément avec leur preuve de compatibilité des sources.
Les [preuves](publication-rollback-local-proof.json) conservent tous les échecs
intermédiaires et n'annoncent aucun test Auth/REST réel ou navigateur exécuté.
Les 62 migrations sont inchangées. Le banc manuel est relancé après l'arrêt de
Docker, avec contrôle natif et HTTP 200 ; il reste sans sauvegarde en base.

Restent les lots, le parcours connecté avec sauvegarde, la réception visuelle,
le rendu avancé et les portes de mise en service. Aucun changement distant ;
le goal reste actif et incomplet.

## Finalisation atomique source — 15 octobre 2026

La [finalisation source](publication-source-finalization.md) ajoute la 62e
migration locale : journal terminal, statut publié et pointeur actif source
sont conservés dans la même transaction après vérification cible. Le pilote
refuse une base dépourvue du nouveau contrat. Une reprise termine ce travail
sans nouveau transfert, y compris après révocation de l'initiateur.

Le rejeu neuf des **62 migrations**, **31 assertions SQL avant et après
restauration**, les **15 groupes d'intégration** et leurs huit scénarios source
passent. Le contrôle complet passe **578 tests dans 33 fichiers**, types, lint
sans erreur, format, build et smoke. Les [preuves datées](publication-source-local-proof.json) distinguent
SQL synthétique, vrai transfert local avec Engine Linux, et Auth/REST simulés.
Les données et les protections existantes sont conservées. Aucune activation
distante ; rollback complet, lots, vraie connexion et réception restent ouverts.

## Interface de publication et historique — 15 octobre 2026

Le [panneau de révision et l'historique](publication-ui.md) sont raccordés à l'API
existante. Le diff exige confirmation, un plan expiré est refusé et une réponse
perdue propose une observation du plan conservé, sans retry de publication.
Le banc local comporte une page de simulation clairement signalée, avec huit
scénarios et un historique simulé ; aucune écriture SQL n'y est réalisée.
Les [preuves](publication-ui-local-proof.json) distinguent unités, rendu serveur,
HTTP et compilation de la réception navigateur non exécutée.

**575 tests Admin**, types, lint sans erreur, format, build et smoke passent.
Les huit pages du banc compilent et six contrôles HTTP passent. Une lecture SQL
réelle en transaction `READ ONLY` fournit onze opérations acceptées par le codec ;
trois identités interdites et un offset hors borne sont refusés. Les 45 bundles
JavaScript clients vérifiés ne contiennent pas les noms de configuration privée
de publication. Les 61 migrations et le backend certifié précédent sont inchangés.

La finalisation de l'état source Staging reste à implémenter et vérifier en SQL,
ainsi que les lots, le rollback complet et les vrais parcours Auth. Aucun accès
distant n'est activé et le goal reste incomplet.

## Orchestration de publication et route fermée — 15 octobre 2026

Le [service local](publication-service.md) relie désormais l'export SQL de la
source, les nouveaux tests Engine à chaque étape, le diff signé, la prise en
charge sous verrou cible, le transfert et la reprise par observation seule.
La nouvelle route exige Auth, origine, configuration et secret serveur distinct ;
elle reste désactivée. Les tests et leurs limites figurent dans les
[preuves](publication-service-local-proof.json).

**547 tests Admin** passent, ainsi que types, lint sans erreur, format, build et
smoke. Sept scénarios du service avec Engine Linux frais, neuf transactions
cibles et les assertions SQL avant/après restauration passent sur copies locales.
Les échecs intermédiaires sont conservés ; les délais et critères restent
inchangés, avec quatre workers Vitest. Les 61 migrations existantes sont
inchangées et les 33 empreintes de sources natives correspondent au code testé.

Ce jalon n'active ni connexion réelle ni données distantes. Restent la transition
éditoriale source après transfert, l'historique et les confirmations UI,
les lots et le rollback complet, les parcours Auth réels et les portes de mise
en service. Les restrictions de sécurité ne sont pas contournées.

## Transaction cible et issue de commit — 15 octobre 2026

La [primitive cible](publication-target.md) ajoute inspection, transaction,
revérification source avant commit, relecture après commit et observation sans
répétition. Le verrou de session précède la prise en charge source et reste
tenu jusqu'au journal ; une reprise ne peut donc pas libérer un travail actif.
La clé de destination est liée au projet configuré et à sa base `postgres`.

**463 tests Admin**, types, lint sans erreur, format, build et smoke passent.
Neuf scénarios PostgreSQL réels passent, avec historique existant, concurrence,
idempotence, annulation, perte d'accusé et vraie fermeture de socket. Les reprises
n'appellent jamais l'application ; les snapshots complets du périmètre exclu
restent identiques. Les 16 assertions SQL avant/après restauration sont rejouées.
Voir les [preuves](publication-target-local-proof.json).

Ce composant privé n'est pas encore raccordé à l'orchestrateur Engine, aux routes
et aux confirmations UI. Auth réelle, confinement complet et réception visuelle
restent ouverts. Aucun changement SQL distant, publication réelle, push ou
suppression de données existantes. Le goal reste actif et incomplet.

## Pilote PostgreSQL et reprise machine — 15 octobre 2026

Le [pilote privé](publication-pg.md) relie les primitives du journal à de vraies
identités LOGIN contrôlées, avec TLS strict et pools source/cible distincts.
La migration 61 NovLearn `cdf6491` fournit une lecture machine paginée des
opérations en cours/incertaines, y compris après révocation de leur initiateur.
Elle n'autorise aucune nouvelle publication ni lecture API de contenu privé.

**424 tests Admin**, types, lint sans erreur, format, build et smoke passent.
Onze contrôles d'intégration et 16 assertions SQL avant/après restauration passent.
La révocation du profil est une action explicite sur la copie synthétique, dont
le rôle et la date attendus sont vérifiés exactement ; les actions du pilote
conservent intégralement les tables hors journal. Voir les [preuves](publication-pg-local-proof.json).

Le transfert cible complet, sa relecture, la reprise de commit ambigu et l'UI
restent à raccorder. Les profils de tests ne certifient pas Auth réelle ni le
confinement complet. Aucun accès distant ou nouvelle activation. Les modifications
préexistantes sont préservées ; le goal reste actif et incomplet.

## Essais progressifs accessibles — 15 octobre 2026

Le [banc commun](local-workspace.md) rassemble les écrans existants et le vrai
Creator avec Engine Linux sur `http://127.0.0.1:3140/`. Aucun compte ou fichier
d'environnement n'est nécessaire. Les opérations sans base sont signalées comme
indisponibles ; les formulaires référentiel/flashcards utilisent leurs doubles
synthétiques existants. Ce parcours ne remplace pas l'Admin authentifié.

**421 tests Admin**, types, lint sans erreur, format, build et smoke passent.
Deux tests HTTP du banc, dix contrôles avec le moteur natif (dont rapport complet
sur deux seeds) et la compilation des sept pages passent. La réception visuelle
n'est pas exécutée après le refus navigateur. Le README obsolète qui indiquait
encore l'absence de catalogue/Creator est corrigé. Voir les [preuves](local-workspace-proof.json).

La connexion PostgreSQL et la lecture machine de reprise de publication sont
encore en cours et non certifiées en intégration ; leurs changements existants
sont conservés séparément. Aucun accès distant, publication, push, suppression
de donnée existante ni activation Auth. Le goal reste actif et incomplet.

## Journal durable de publication — 15 octobre 2026

Le [journal Staging et la protection de source](publication-journal.md) ajoutent
des plans confirmables de 15 minutes, une prise en charge unique et un état
incertain sans faux succès. Les contenus restent protégés après perte de
connexion, redémarrage et restauration jusqu'à observation cible établie.
La capacité machine peut conserver ce fait après révocation de l'initiateur ;
elle ne permet pas à cet utilisateur de démarrer un nouveau transfert.
Migration locale 60 NovLearn `18071d2`, sans LOGIN ni appartenance provisionnés.

**378 tests Admin, types, lint sans erreur, format, build et smoke passent.**
Le rejeu neuf de 60 migrations, le parcours Engine natif/signature/relecture,
41 assertions journal avant/après restauration, concurrence et persistance
passent. La sauvegarde complète conserve logiquement schéma, ACL, données et
séquences ; comparaison brute différente selon les normalisations inchangées.
Les 69 contrôles historiques et les six suites de contenu passent après cette
restauration. Voir les [preuves](publication-journal-local-proof.json).

Le transfert complet reste à raccorder : véritable connexion serveur, Engine,
confirmation, commit cible, relecture, reprise et UI individuelle/groupée.
Les observations de succès des fixtures ne certifient aucun nouveau transfert.
La qualification du confinement et la réception visuelle restent ouvertes ;
aucune restriction contournée, modification distante, publication réelle ou
suppression de données existantes. Le goal reste actif et incomplet.

## Dashboard Staging et 59 migrations — 15 octobre 2026

Le [tableau de bord](dashboard.md) remplace son texte d'attente par des agrégats
SQL Staging : statuts du catalogue, derniers échecs courants, versions actives
et inventaire du référentiel/flashcards. Les statuts correspondent aux filtres
du catalogue ; les pointeurs actifs sont distingués des nouvelles révisions.
Les données indisponibles restent distinctes d'un zéro. Migration locale 59
NovLearn `882850e`, sans ajout de droit de lecture personnelle ou d'écriture.

**337 tests Admin, types, lint sans erreur, format, build et smoke passent.**
Les 35 assertions Dashboard passent avant/après restauration ; les 60 tables
conservent leurs lignes. Le rejeu neuf des **59 migrations**, la restauration
complète avec comparateur inchangé et les 69 contrôles historiques passent.
Sur cette restauration, 48 catalogue, 21 reçus, 43 relecture, 39 référentiel,
38 flashcards et 35 Dashboard passent. Voir les [preuves](dashboard-local-proof.json).

La réception visuelle reste non exécutée après le refus de politique navigateur.
Production, utilisateurs réels, publication complète et portes distantes restent
ouverts. Aucun changement distant, push ou suppression de données existantes.
La certification Engine antérieure n'est pas présentée comme une nouvelle suite
source exécutée. Le goal reste actif et incomplet ; les relevés suivants sont datés.

## Flashcards et rejeu complet local — 15 octobre 2026

Les [flashcards Staging](flashcards.md) disposent de leur formulaire, aperçu,
insertion MathLive, API protégée et audit SQL. Migration 58 NovLearn locale
`62629ac` ; aucune modification de l'application élève ou du moteur.
**302 tests Admin, types, lint sans erreur, format, build et smoke passent.**
Les 38 assertions flashcards passent avant/après restauration et la concurrence
accepte une seule édition. Les anciennes colonnes des 59 tables sont préservées.

Le nouveau rejeu **des 58 migrations** passe, suivi du parcours Engine natif /
HMAC / reçu / relecture synthétique. La sauvegarde/restauration complète passe
avec le comparateur inchangé (équivalence logique, comparaison brute différente),
les 69 assertions historiques et les suites 48 catalogue, 21 reçus, 43 relecture,
39 référentiel et 38 flashcards. Voir les [preuves](flashcards-local-proof.json).

**Le pilotage visuel flashcards est bloqué par la politique d'URL du navigateur.**
Aucun contournement ni succès visuel n'est déclaré. La réception peut être faite
manuellement dans le banc synthétique documenté. Le goal est lu `active` ;
publication, réception complète du Creator, statistiques/utilisateurs et portes
distantes restent ouvertes. Aucun changement distant ni suppression de données.
Les sections suivantes sont des relevés datés, antérieurs à ce rejeu de 58 SQL.

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
