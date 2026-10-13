# Publication d'exercices Staging vers Production

Conception uniquement : aucun mécanisme de publication n'est développé. La décision utilisateur du 13 octobre 2026 autorise exclusivement le contenu métier approuvé de `public.exercises` et `public.exercise_versions`. Elle clôt l'ancien arbitrage sur une ou deux tables et ne constitue pas une réplication intégrale de leurs lignes. Les utilisateurs/Auth, profils, tentatives, duels, statistiques, flashcards, chapitres, compétences, feedbacks, `exercises_claude` et toute autre table non autorisée ne sont jamais synchronisés. Les absences Staging n'entraînent aucune suppression Production.

La projection de publication sera une liste explicite de champs métier définie avec le schéma SQL : identité et pointeur actif autorisés du parent, définition canonique et métadonnées de la révision approuvée. Les statuts de brouillon, sessions de test, acteurs Staging et données éditoriales internes ne sont pas copiés par un `SELECT *`/upsert de ligne entière. L'identité parent peut être transférée avec sa première révision approuvée ; un brouillon seul ne crée pas de contenu Production.

## Parcours cible

1. Le serveur vérifie la session Auth Staging, relit côté serveur le rôle administrateur et l'autorisation de publier. L'identité et la révision candidate viennent de Staging, pas des champs de formulaire faisant autorité.
2. Charger la version approuvée et son empreinte. Refuser si le contenu, les métadonnées, le statut ou la version Engine ont changé depuis la validation.
3. Valider le contrat par une version Engine fixée et compatible avec le moteur du déploiement Production. Faire tourner les contrôles de définition, générabilité, éléments requis et tests éditoriaux enregistrés.
4. Vérifier les références pédagogiques/référentielles nécessaires en Production sans les copier. Si chapitre ou compétence manquent, ou si les IDs/références n'ont pas de mapping stable, bloquer la publication avec un rapport explicite.
5. Calculer un diff depuis les valeurs lues en Production : création du parent, ajout de révision immuable, activation d'une révision, identique ou conflit/évolution de schéma. Montrer identifiant stable, titres, révisions/empreintes, champs modifiés et impact avant confirmation. Un contenu différent pour la même révision est un conflit ; une définition publiée ne peut pas être remplacée.
6. Obtenir une confirmation explicite pour ce diff immuable. Revalider rôle, empreinte source, empreinte Production et état moteur immédiatement avant écriture.
7. Dans une transaction idempotente avec verrou par identité logique : résoudre/créer le parent `exercises`, insérer la révision approuvée dans `exercise_versions` si elle est absente, vérifier sa définition si elle existe déjà, puis modifier le pointeur actif du parent sous préconditions. Vérifier les invariants et empreintes avant commit. Aucune révision publiée n'est modifiée ou supprimée ; aucun trigger ne doit produire d'écriture métier dans les tables exclues.
8. Relire la ligne résultante, confirmer l'empreinte et les invariants, puis enregistrer le résultat par exercice et un journal d'audit côté Admin, avec acteur, date, IDs, empreintes, action, résultat et corrélation. Ne pas journaliser de clé ni de données utilisateur.

## Identifiants et versions

Ne jamais présumer que les séquences `bigint` de deux bases indépendantes produisent le même ID. Le modèle cible devrait introduire un UUID stable créé côté contenu et conservé entre environnements, avec un mapping explicite vers les `bigint` historiques. Ce choix nécessite une évolution SQL et une transition compatible des lecteurs/FK ; ne pas réattribuer les IDs existants par copie aveugle.

Le modèle validé utilise `exercise_versions` dans chaque base. La publication doit résoudre les identifiants locaux du parent et de la révision et vérifier leur appartenance. La clé stable interbases et les contraintes précises restent à finaliser ; la décision sur les deux tables ne valide pas un type d'identifiant supplémentaire par défaut.

Les migrations de structure peuvent faire évoluer les tentatives et duels pour la compatibilité, selon leur propre procédure approuvée. Elles ne synchronisent pas leurs données. Une publication attend que les structures nécessaires soient déjà déployées et n'applique aucune migration implicitement.

## Concurrence, répétition et échecs

Un verrou/idempotency key par UUID stable empêche deux publications concurrentes ; vérifier les préconditions dans la transaction pour éviter les courses entre diff et écriture. Le même lot rejoué avec mêmes empreintes devient « identique » sans duplication. Un hash différent sur une version Production plus récente devient conflit, non écrasement implicite. Les lots présentent un statut par exercice ; choisir transaction atomique de lot ou transactions par exercice et comportement de reprise avant développement. Dans les deux cas, ne rapporter jamais « publié » avant relire l'état final.

Une erreur de validation n'écrit rien. Une erreur d'écriture annule l'unité transactionnelle correspondante et laisse une trace d'échec. Un timeout après commit est résolu en relisant l'empreinte cible avant toute répétition. Une publication ne modifie jamais les lignes de tentatives existantes et ne supprime jamais une ancienne définition référencée.

Le rollback fonctionnel est une nouvelle activation explicite d'une révision précédente toujours conservée, soumise aux mêmes validations, droits et audit. Il ne réécrit ni cette définition ni les références des tentatives en cours/passées. Une restauration de backup ou suppression de ligne n'est pas un rollback fonctionnel acceptable.

## Capacité technique Production

Un nom tel que `PUBLISH_KEY` ne confère aucun privilège SQL limité. Les clés secrètes Supabase peuvent contourner RLS ; une clé service générale dans Next.js ne constitue donc pas le confinement attendu. Options à évaluer avec l'équipe DB avant lot 5 : rôle Postgres séparé avec privilèges limités aux champs métier des deux tables (lecture nécessaire, création de parent, insertion de révision, activation contrôlée, aucun droit de modifier une version publiée ou de supprimer); procédure SQL contrôlée avec signature/droits dédiés et validation explicite des colonnes; ou service de publication isolé doté d'une identité DB restreinte. Le rôle de lecture statistique doit être distinct. Les permissions et effets de triggers seront testés, y compris les écritures indirectes dans les tables exclues. Ne jamais exposer ces identifiants au navigateur.

Les contraintes Supabase/PostgREST de rôles et clés techniques sont à vérifier avant d'affirmer qu'une clé API offre un vrai périmètre table/colonne. Si une capacité effective et testable n'est pas réalisable, la publication attend une architecture approuvée ; aucune fausse séparation par nom d'env ne la remplace.

## Incompatibilité avec l'outil catalogue existant

Le script de synchronisation existant dans `Novlearn` va dans le sens Production vers Staging et synchronise chapitres/compétences/exercices, avec flashcards facultatives. Il ne publie pas des versions approuvées de Staging vers Production. Ne pas réutiliser son code ou son workflow en changeant simplement la source et la destination : son périmètre, le sens de transfert, le traitement des IDs et le modèle de confiance diffèrent de cette publication.
