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

## Décision des feedbacks

L’activation reste fermée tant que `ADMIN_FEEDBACK_REVIEW_ENABLED` n’est pas
`true`. Avant de l’ouvrir, appliquer et qualifier
[`production-feedback-review-access.sql`](../../scripts/production-feedback-review-access.sql)
dans Production selon la procédure autorisée. Ce script ajoute un endpoint
`SECURITY INVOKER` et un historique privé. La fonction interne ne permet qu’une
transition atomique de `pending` (ou `NULL`) vers `approved` ou `rejected`,
vérifie à nouveau l’Admin Production et conserve l’acteur et la date. Chaque
feedback ne peut être décidé qu’une fois ; les conflits sont signalés.

Le code seul n’applique pas le script, ne change aucune ligne Production et
n’active aucune écriture distante. Les décisions restent indisponibles dans
l’interface jusqu’à l’autorisation distincte d’installer le script et
d’activer la variable correspondante.
