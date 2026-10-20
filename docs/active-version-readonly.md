# Version active de la cible — préparation locale

Le CDC §7.3 demande de vérifier la version actuellement publiée. La fiche
prépare désormais cette observation avec une capacité distincte de publication.
**La lecture connectée n’est pas encore activée dans les applications locales.**
Les preuves SQL natives sont réussies ; la qualification du login/TLS, du
parcours HTTP réel et la réception navigateur restent ouvertes.

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

Une nouvelle identité et des certificats ont été préparés **sur cette copie
uniquement**. L’état conservé est `provisioned`, sans preuve de réussite du test
physique. Le handle initial n’est plus disponible ; le 20 octobre, l’inspection
utilisateur ne trouve ni processus de ce test ni canal Docker Linux. Aucun
redémarrage du test, réensemencement, remplacement de mot de passe ou succès
présumé n’en est déduit. La reprise explicite `--resume` vérifie le snapshot,
les fichiers TLS et HBA et réutilise cette identité, sans reprovisionnement.
Chaque nouvelle exécution conserve ses propres journaux.

## État actuel et suite

Le 20 octobre à 11:33 UTC, les ports applicatifs 3150 et 3152 refusent les
connexions dans le contexte utilisateur. Le résultat du 19 octobre reste
historique ; la connexion actuelle n’est pas déclarée opérationnelle. L’utilisateur
est invité à ouvrir Docker normalement. Aucun reset, arrêt forcé, changement de
protection, contournement navigateur ou modification distante n’est effectué.

Après retour du moteur : reprendre le test PG/TLS conservé, terminer les essais
de prérequis/restauration SQL et advisors, puis qualifier l’upgrade de la vraie
cible **locale** et sa régression de publication avant d’y activer le lecteur.
La copie de qualification ne doit pas être présentée comme une cible courante.
Raccorder ensuite les lanceurs sans changer les configurations préexistantes,
relancer les services conservés, vérifier connexion/Engine et exercer Auth/HTTP
réels et confidentialité. La réception navigateur reste soumise à une méthode
autorisée. Production, déploiement, push et première publication réelle restent
fermés ; le Lot 1A et le goal ne sont pas terminés.

**Contrôle complet du 20 octobre :** 1 387 tests / 72 fichiers, intégrité du
package Engine, types, lint, format, build standalone, onze fichiers SQL exacts
et smoke passent sur une copie des 536 sources restées identiques. Seules les
mises à jour documentaires et de preuves explicitement listées suivent ce
contrôle. Les 1 540 tests du dépôt Engine ne sont pas relancés ; aucun résultat
TLS/HTTP connecté n’est ajouté. Le commit SQL local `0808eb7`
porte uniquement la nouvelle migration.

Un [aperçu synthétique](http://127.0.0.1:3140/) est rouvert sans Auth, base ou
Engine : huit contrôles HTTP passent à 11:39 UTC, avec logos disponibles et
fichier privé existant refusé. Ce service permet les essais manuels d’interface,
sans connexion ni sauvegarde réelle ; aucun navigateur n’est piloté. Une
première attente de statut du banc sur un fichier `.env` absent était erronée
(403 attendu au lieu de 404). Son absence est maintenant vérifiée avant
l’assertion 404 ; le fichier privé existant doit toujours répondre 403.

Le dernier relevé utilisateur à 11:43 UTC retrouve le canal Docker absent et
3150/3152 toujours en refus de connexion. Les huit configurations existantes
restent exactes. La préparation et les identifiants sont conservés pour la
reprise normale, sans reset ni contournement.
