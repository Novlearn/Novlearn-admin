# Feedbacks Production

La page `/admin/feedback` lit `public.feedbacks` dans le projet Production,
après contrôle du rôle Admin dans Staging puis Production. Les lectures
utilisent la clé publique et la session Production, sous les RLS existantes.
La requête ne retourne que l’identifiant, la date, la catégorie, le message,
le statut, la note de difficulté et l’identifiant éventuel de l’exercice. Les
comptes utilisateurs ne sont pas projetés dans la page.

Les catégories présentes en Production au 8 novembre 2026 sont `difficulty`,
`content_error`, `suggestion` et `other`. Les statuts `pending` et `NULL` sont
présentés comme « À traiter ». Les résultats sont paginés par 25 ; le filtre
de statut, la sélection multiple de catégories et le tri par catégorie et date
sont appliqués dans Production.

Par défaut, la page liste `content_error`, `suggestion` et `other`. L’onglet
**Difficulté** regroupe les feedbacks par exercice, calcule la moyenne des notes
renseignées sans filtrer sur le statut, puis permet de déplier les notes,
commentaires et dates associés. Les retours de difficulté ne sont pas
décidables dans l’Admin ; l’API de décision les refuse également.

## Décision des feedbacks

**État au 23 novembre 2026 :** le responsable confirme que le script a été
appliqué en Production. La qualification des permissions et du parcours de
décision reste à effectuer.

Pour une installation dans un autre environnement, appliquer et qualifier
[`production-feedback-review-access.sql`](../../scripts/production-feedback-review-access.sql)
selon la procédure autorisée. Dans le Dashboard Supabase, sélectionner le projet
cible puis ouvrir **SQL Editor** et exécuter le script avec le rôle propriétaire
`postgres`. Ce script ajoute un endpoint `SECURITY INVOKER` et un historique
privé. La fonction vérifie à nouveau l’Admin Production, verrouille la ligne
concernée et n’enregistre l’audit que lors du premier passage de `pending` (ou
`NULL`) à `approved` ou `rejected`. Une répétition de la même décision est un
succès sans nouvelle écriture d’audit. Une décision opposée renvoie le conflit
PostgREST `PT409`, qui n’est pas un code d’erreur de sérialisation réessayable.

### Projet Production où l’ancienne fonction est déjà installée

Après revue et autorisation de l’opérateur, appliquer le script de mise à niveau
[`production-feedback-review-idempotency.sql`](../../scripts/production-feedback-review-idempotency.sql)
avec le rôle propriétaire `postgres`. Il remplace uniquement le corps de la
fonction interne existante et vérifie la présence du schéma, de l’endpoint et de
la table d’audit attendus. Il ne traite ni ne supprime de feedback. Le code Admin
évite aussi d’appeler le RPC quand le statut terminal est déjà connu.

Le code seul n’applique aucun script et ne change aucune ligne Production.
Les permissions de session, le rôle Admin Production et les règles de mutation
côté serveur restent vérifiés à chaque décision.
