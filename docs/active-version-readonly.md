# Version active de la cible — qualification locale en cours

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

Le CDC §7.3 demande de vérifier la version actuellement publiée. La fiche
prépare désormais cette observation avec une capacité distincte de publication.
**La lecture connectée n’est pas encore activée dans les applications locales.**
Les preuves SQL natives, les prérequis/restauration et le vrai lecteur TLS
réussissent. L’upgrade de la cible, le parcours HTTP réel de cet indicateur et
la réception navigateur restent ouverts.

## Comportement et autorité

La lecture résout le `catalog_id` stable depuis le parent Staging autorisé,
puis observe le pointeur `active_version_id` de la cible dans une seule requête.
Elle ne prend ni la plus grande révision, ni le statut source, ni un ancien reçu
pour une observation courante. Le retour arrière vers la révision 1 alors que
la révision 2 reste publiée est réellement exercé sur la copie peuplée.

L’écran distingue absence, parent sans version active, cible indisponible et
incohérence enregistrée. L’archivage reste séparé du pointeur actif. La comparaison
avec la version consultée utilise révision, empreinte de définition et trois
identifiants du contrat Engine ; les UUID techniques de version diffèrent entre
bases. Une correspondance ne constitue pas un nouveau reçu de transfert ou de
validation éditoriale. L’actualisation GET conserve version, comparaison et page
d’historique. La cible est explicitement étiquetée copie locale, avec date
d’observation ; aucune observation Production n’est annoncée.

Chaque requête API vérifie l’utilisateur Auth puis son rôle Admin serveur avant
toute consultation. La fiche exige aussi son contrôle Admin avant la lecture.
Le navigateur ne choisit ni catalogue cible arbitraire, ni environnement,
ni connexion. Une version source sélectionnée doit appartenir au parent demandé.
Les erreurs restent génériques, avec réponses privées non conservées en cache.

## SQL et connexion préparés

La CLI 2.98.2 a créé la migration canonique locale
`Novlearn/supabase/migrations/20261019184535_novlearn_admin_active_version_readonly.sql`.
Le rôle `novlearn_active_version_reader` est NOLOGIN/NOINHERIT, avec seulement
**14 colonnes SELECT sur deux tables RLS** : identités techniques, pointeur,
époque, archivage, révision, statut, date et empreintes/contrat. Il n’accède pas
aux définitions, réponses, profils, utilisateurs, tentatives, séquences ou
fonctions de publication. La migration ne crée ni LOGIN ni appartenance et ne
modifie aucune donnée métier. Les chemins PUBLIC et fonctions privilégiées sont
contrôlés ; la seule exception relue est `is_guest()` à empreinte fixe.

Le pilote exige une identité physique séparée, son appartenance unique sans
héritage, les permissions effectives exactes et exactement les deux policies
SELECT relues. Une policy restrictive inattendue doit provoquer une indisponibilité,
jamais une fausse absence. Le pool est limité à deux connexions, TLS vérifie CA
et nom, connexion limitée à trois secondes, statement à dix secondes et requête
à douze. Les lectures sont en transaction READ ONLY, sans verrou de publication.
Une connexion ou un nettoyage incertain détruit la lease.

Le seul endpoint préparé est le même que celui de la cible de publication locale,
`127.0.0.1:55434/admin_local`, avec le LOGIN dédié
`novlearn_admin_active_version_service`. Les paramètres d’URL, autres hôtes,
autres bases et identités privilégiées sont refusés. L’activation exige
`ADMIN_LOCAL_ACTIVE_VERSION_ENABLED=true`, la revue
`isolated-sql70-active-version-http-v1` et les deux paramètres serveur privés
`ADMIN_LOCAL_ACTIVE_VERSION_PG_URL` / `ADMIN_LOCAL_ACTIVE_VERSION_PG_CA`.
Ces valeurs ne sont ajoutées à aucune configuration applicative existante.

## Vérifications effectivement exécutées

Les [preuves datées](active-version-readonly-proof.json) séparent les périmètres :

- **Rejeu neuf des 70 migrations réussi le 19 octobre**, manifeste inchangé,
  PostgreSQL isolé sans réseau ; fixture conservée.
- **Copie intégrale de la cible synthétique SQL 64**, restauration avec identités
  SCRAM personnalisées et métadonnées contrôlées, puis migrations 65 à 70 sur
  cette copie uniquement. Les 62 tables et 11 séquences restent exactes.
- **Six observations natives**, dont le retour arrière et un catalogue absent,
  décodées par le vrai contrat TypeScript ; **16 refus SQLSTATE 42501** en session
  READ WRITE et détection d’une policy restrictive ajoutée puis annulée.
  Données, séquences, rôles, policies et métadonnées de la copie sont exacts après
  ces essais ; la cible de l’application est intégralement inchangée.
- **103 tests ciblés dans six fichiers réussis le 20 octobre**, couvrant contrat,
  pilote avec doubles, configuration, permissions API, barrière d’accès de la
  page et rendu HTML serveur. Types et lint sans erreur passent ; le seul
  avertissement `<img>` est antérieur. Ces tests ne remplacent pas TLS ou HTTP réels.

La reprise du 20 octobre réutilise l’identité et les certificats déjà préparés,
sans reprovisionnement. Huit groupes physiques SCRAM/TLS, 17 refus et trois
dérives passent ; les six observations exactes et deux connexions simultanées
sont exercées. Le snapshot des lignes, séquences, rôles et droits reste exact.
Une destination de montage manquante a été corrigée dans le banc de test, sans
modifier la lecture seule, les quotas ou les attentes. Les journaux de cet échec
et de la reprise réussie restent distincts.

Le nouveau banc des prérequis passe réellement quinze refus P0001 attendus,
l’annulation DDL, le COMMIT puis le refus de réapplication, et la restauration
peuplée de SQL 70 : 62 tables, 11 séquences, six observations, 14 colonnes.
Il conserve les rôles et empreintes personnalisés. Seul l’ordre des ACL est
normalisé entre clusters ; les mots de passe intégrés propres aux nouveaux
clusters sont exclus de cette comparaison, leurs attributs restant comparés.
Les deux nouvelles copies sont sans réseau ni port et bornées.

## État actuel et suite

La [connexion et le moteur de l’application sont rétablis](local-recovery-2026-10-20.md).
Les huit contrôles Engine après reprise passent, sans relancer les 1 540 tests
source antérieurs. La cible applicative reste intégralement SQL 64 et l’indicateur
reste fermé par défaut. La qualification physique de sa copie ne vaut pas une
activation sur la vraie cible.

Avant activation : advisors SQL 70, régression de publication sur copie, upgrade
et provision de la cible locale réelle, puis Auth/HTTP et confidentialité.
Les lanceurs devront lire la nouvelle capacité explicitement, sans remplacer
les huit configurations existantes. Réception navigateur, autorisations et
portes distantes restent ouvertes ; le Lot 1A et le goal ne sont pas terminés.

Le contrôle complet précédent de 1 387 tests / 72 fichiers, build et smoke reste
celui de la préparation committée `0a7dfc6`. Les nouvelles vérifications et leur
contrôle complet courant sont consignés séparément dans la preuve de reprise.
Le commit SQL `0808eb7` reste inchangé. Aucun accès distant n’est activé.
