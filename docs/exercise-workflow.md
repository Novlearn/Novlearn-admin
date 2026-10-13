# Workflow cible des exercices

Ce parcours décrit une cible fonctionnelle. Aucun de ses écrans, accès au moteur ou mécanisme de publication n'est implémenté dans le Lot 0.

## Cycle proposé

1. Créer une définition dans l'Admin sur Staging avec le format canonique de l'Exercise Engine.
2. Enregistrer cette définition comme brouillon.
3. Valider le schéma, les références et la compatibilité avec la version du moteur.
4. Prévisualiser le rendu.
5. Générer plusieurs instances avec des seeds différentes pour éprouver les contraintes.
6. Tester des réponses via le moteur partagé et ses diagnostics.
7. Faire relire et valider humainement la version candidate.
8. Publier explicitement la version autorisée en Production après contrôle des droits et affichage du diff.
9. Générer des instances destinées aux élèves depuis une version publiée.
10. Corriger les tentatives côté serveur et conserver les éléments nécessaires à leur reprise et audit.

La publication sélectionne le contenu métier approuvé de `public.exercises` (identité stable) et `public.exercise_versions` (révisions), conformément à la décision utilisateur du 13 octobre 2026. Elle ne copie pas intégralement les lignes, les brouillons ou les autres tables. Les tentatives, duels, profils/Auth, statistiques, chapitres, compétences, flashcards, feedbacks et `exercises_claude` sont exclus. Les migrations de compatibilité des autres tables sont distinctes de cette synchronisation de contenu ; voir [publication](publication.md).

## Concepts à distinguer

- **Exercice** : identité pédagogique stable du contenu.
- **Version d'exercice** : définition immuable soumise à validation ou publication. Une modification ultérieure crée une nouvelle révision.
- **Instance générée** : valeurs concrètes obtenues en générant une version avec une seed ; elle peut contenir des attendus privés.
- **Tentative élève** : réponses soumises pour une instance, corrigées par le moteur côté serveur et rattachées à la version pertinente.

L'ID bigint historique de `exercises` ne doit pas être copié aveuglément entre bases. Le choix des deux tables est clos ; la correspondance interbases, les contraintes SQL détaillées et le stockage des instances restent à finaliser. Les nouvelles tentatives devront retrouver leur version et instance ; les anciennes sans version connue ne sont jamais rattachées arbitrairement au contenu courant.
