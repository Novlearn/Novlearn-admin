# Version publiée — lecteur local connecté

**L’indicateur est actif sur les fiches des deux applications locales.**
L’[application principale](http://127.0.0.1:3150/login) conserve ses comptes,
fonctions et paramètres. La [fiche principale vérifiée](http://127.0.0.1:3150/admin/exercises/1) observe
une absence réelle sur la cible ; ce n’est pas une panne. Sur l’instance de
publication, la fiche de l’exercice 14 montre la révision 1 active après
retour arrière, alors que la révision 2 existe toujours. Les catalogues source
des deux instances restent distincts. Les [preuves datées](active-version-connected-proof.json)
séparent les observations, les essais de permissions et les limites.

## Identité et activation

La cible synthétique SQL 70 reste le conteneur conservé, avec la même liaison
TLS et le même proxy. Une sauvegarde est conservée avant ajout de l’identité
novlearn_admin_active_version_service, créée sans LOGIN puis activée après les
garde-fous. Elle est NOINHERIT et possède une seule appartenance SET sans ADMIN
ni héritage à novlearn_active_version_reader. La capacité expose seulement
**14 colonnes sur deux tables RLS**, sans définition, réponse, utilisateur,
profil, séquence ou droit de publication. Les anciens rôles, mots de passe,
lignes et séquences restent exacts. Les nouvelles règles HBA concernent
uniquement ce LOGIN : TLS/SCRAM depuis la seule adresse interne du proxy,
refus des autres sources, bases et connexions non chiffrées. Les anciennes
règles et le mode du fichier sont conservés. Aucun secret existant ne tourne.

L’option explicite --active-version charge un nouvel état privé ignoré.
Sans cette option, les deux lanceurs effacent les valeurs héritées du lecteur
et restent fermés. Le lanceur dédié exige la qualification PG ; le principal
exige en plus la qualification Auth/HTTP et son empreinte. Le code PG/SQL qualifié,
l’identité de la cible et le certificat sont vérifiés avant chargement. Les
valeurs restent dans l’environnement serveur enfant, sans NEXT_PUBLIC ni
réécriture des huit configurations existantes. La lecture n’active pas la
publication ordinaire de 3150, qui répond toujours 503.

## Essais réellement exécutés

- **Huit groupes PG/TLS réussis** sur la vraie cible via le proxy conservé :
  SCRAM, TLS vérifié, absence d’héritage, 17 refus effectifs en READ WRITE,
  mauvais mot de passe, absence de TLS, CA/nom/base incorrects refusés. Le vrai
  pool serveur lit huit observations, deux simultanément, comparées aux champs
  propriétaires indépendants ; retour arrière et absence sont présents.
- **Douze groupes Auth/HTTP réussis** : nouveaux comptes synthétiques, Admin
  réel, 401/403, refus des injections et versions d’un autre parent, comparaison
  des révisions 1/2, absence véritable, observation fraîche et fiche SSR. Le banc
  ne prétend pas lire le DOM dans un navigateur. Les scripts client servis et le
  HTML ne contiennent aucune des valeurs privées testées ; les chemins SQL et
  configuration privée répondent 404. Un NOLOGIN temporaire sur la seule nouvelle
  identité produit une indisponibilité explicite, jamais une absence, puis
  récupère. La révocation du seul nouveau compte Admin est prise en compte avec
  sa session existante, puis restaurée. Toutes les lignes, séquences et
  métadonnées cible restent exactes ; les anciennes lignes métier source aussi.
- **Sept groupes sur l’application principale réussis**, avec ses identifiants
  conservés : session, API et fiche comparées à la cible réelle, refus anonyme,
  dashboard/statistiques, publication toujours fermée et données exactes.
- **Huit contrôles Engine après redémarrage réussis**, sans changer délais,
  quotas ou archive. Les 21 anciens rapports restent exacts ; le nouveau brouillon
  et son rapport sont étiquetés essais locaux. Les 1 540 tests source Engine
  antérieurs ne sont pas relancés.
- **120 tests ciblés / neuf fichiers réussis**, dont dix-sept tests des options
  et du chargement : dépendances existantes, choix explicite, qualification PG
  puis HTTP, cible étrangère, code périmé, URL distante/identité privilégiée,
  SSL imposé et certificat expiré refusés. Le certificat public d’un banc non
  fiable et l’horloge fixe n’appartiennent qu’aux tests unitaires ; les essais
  physiques de TLS utilisent l’horloge réelle. Les deux scripts HTTP refusent
  explicitement toute URL Auth autre que leur origine locale relue ; deux tests
  prouvent ce refus avant tout réseau ou lecture de secrets. Les douze groupes
  HTTP et les sept groupes main repassent après ajout de ces garde-fous.

Le premier banc HTTP s’est arrêté sur le JSON d’une fixture UUID, sans qualifier
un succès. Le journal reste conservé ; le résultat est corrigé avec to_jsonb,
et le texte SSR est lu dans la section de la carte en tenant compte des
séparateurs de commentaires React. Aucun critère de permissions ou de succès
n’est assoupli. **Le contrôle complet courant réussit : 1 404 tests / 75 fichiers**,
intégrité de l’archive Engine, types, lint sans erreur (un avertissement `<img>`
antérieur), format, build et smoke HTTP. Onze fichiers SQL standalone sont
exacts. Il qualifie une copie des 557 sources sans interrompre les applications ;
seules les huit preuves documentaires listées sont ensuite mises à jour et
vérifiées séparément. Le contrôle 2145784 reste antérieur et distinct.

## Limites et suite

Les états sans version active et incohérents ont des tests unitaires ;
aucune incohérence n’est implantée dans la cible actuellement publiée pour
simuler une réussite HTTP. La réception visuelle/manuelle, l’accessibilité,
MathLive et la récupération dans un navigateur autorisé restent ouvertes.
Les 33 avertissements SQL antérieurs ne sont pas corrigés et ne constituent
pas une certification globale. Expiration réelle/MFA et hôte de déploiement
restent à qualifier. Production, publication réelle, push et déploiement
demeurent fermés. Avant toute application distante : schéma/historique à
réconcilier, sauvegarde/restauration et permissions à qualifier, puis
autorisation spécifique. Le goal et le Lot 1A ne sont pas déclarés terminés.
