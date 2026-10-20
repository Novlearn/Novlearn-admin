# Tester NovLearn Admin au fil du développement

L’application connectée est disponible sur
[http://127.0.0.1:3150/login](http://127.0.0.1:3150/login).
Elle utilise des comptes et données d’essai sur cet ordinateur. Les brouillons
sont enregistrés dans la base locale et restent présents après déconnexion.

Les identifiants d’essai conservés figurent dans
`.local/local-admin-1792143739689/login.txt`, à la racine du projet. Utiliser le
compte administrateur pour les essais ci-dessous. Garder ce fichier privé.

## Premier parcours

1. Se connecter et vérifier que l’espace affiche son libellé local.
2. Dans le catalogue, créer un nouveau brouillon avec un titre reconnaissable,
   par exemple « Essai local — fractions ». Lui associer un chapitre et une
   compétence disponibles, puis l’enregistrer.
3. Ouvrir le Creator, ajouter du texte et une question, puis saisir les
   expressions avec MathLive. Essayer le clavier, une fraction et une puissance.
   Enregistrer, revenir au catalogue et rouvrir le même brouillon.
4. Lancer la validation et corriger les diagnostics indiqués. Générer un aperçu
   avec une seed, puis avec une autre ; essayer une réponse juste et une réponse
   fausse. Les résultats viennent du vrai Engine Linux local.
5. Lancer les tests et consulter leur rapport. La relecture pédagogique reste
   une action humaine distincte du succès des tests.
6. Consulter l’historique et comparer les révisions du brouillon. Sur une fiche
   d’exercice, l’indicateur de version publiée distingue l’absence d’une
   publication locale et une indisponibilité de lecture.
7. Se déconnecter, puis se reconnecter pour vérifier la présence du brouillon.

Les chapitres, compétences et flashcards ont également leurs écrans locaux.
Pour essayer leur édition, créer des éléments d’essai reconnaissables. Les
références utilisées par des exercices doivent rester cohérentes.

## Statistiques et utilisateurs

Les pages Statistiques, répartition pédagogique et Utilisateurs lisent des
sources locales synthétiques identifiées. Leurs chiffres ne représentent pas
l’activité réelle de NovLearn. Les filtres et périodes permettent de vérifier
les états remplis, vides et les messages d’erreur. Les fiches utilisateurs
présentent les données enregistrées, sans certifier les verdicts historiques.

## Publication et réception

La publication est fermée sur l’instance ordinaire 3150. Les essais de transfert
disposent d’un [banc de publication séparé](publication-http-connected.md), avec ses propres
prérequis et comptes synthétiques. Aucune publication réelle ou application
distante n’est autorisée par ce guide.

La réception visuelle et les interactions doivent encore être observées dans
un navigateur utilisé normalement par une personne. Les contrôles HTTP, le
build et les tests serveur ne prouvent pas l’usage du clavier MathLive, le focus,
le rendu mobile ou la récupération d’une saisie dans l’onglet. Les restrictions
de pilotage automatisé du navigateur restent respectées.

Pour signaler un problème, relever la page, l’action, le résultat attendu et
observé, ainsi que le titre du brouillon d’essai. Ne pas transmettre le fichier
d’identifiants, les cookies ou la configuration privée.

## État des vérifications

Le [bilan de livraison](readiness-current.md) distingue ce qui est implémenté,
testé localement et encore à réceptionner. Le [correctif des sessions expirées](auth-expiry-local.md)
et le [bilan SQL 71](legacy-search-path.md) conservent les essais et échecs réels.
Le contrôle complet de référence du 20 octobre passe 1 422 tests, les types,
lint, format, build, intégrité Engine et smoke HTTP. Une nouvelle expiration
naturelle complète est encore en cours au moment de ce guide ; elle n’est pas
annoncée réussie par ce relevé documentaire.
