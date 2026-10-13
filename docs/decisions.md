# Décisions et arbitrages

## Décisions confirmées par le CDC

- Admin dans un repository séparé, développé depuis zéro ; l'ancien Creator est une référence fonctionnelle et son code métier n'est pas copié directement.
- Application Next.js full-stack, sans backend FastAPI supplémentaire.
- Exercise Engine TypeScript partagé ; aucune logique mathématique concurrente dans l'Admin.
- Authentification et travail pédagogique sur Supabase Staging.
- Données Production consultées de manière restreinte ; publication séparée et limitée aux exercices.
- V1 : seule la table métier `public.exercises` est prévue pour la synchronisation de contenu.
- MathLive est retenu pour la saisie mathématique future, sans intégration dans le Lot 0.

## Choix du socle Lot 0

Le frontend voisin NovLearn documente Next.js 15.5.12, React 18.3.1, TypeScript et Tailwind 3 ; l'Admin reprend ces versions cohérentes et maintenues dans le dépôt inspecté. Le socle ajoute ESLint 9, Prettier 3, alias `@/*` vers `src/*` et `output: 'standalone'`. La config shadcn/ui est préparée, sans installer sa CLI ou générer des composants. Ce choix n'est pas une décision fonctionnelle sur les futurs modules.

## Arbitrages ouverts

- Modèle SQL définitif des versions et stratégie de conservation des tentatives.
- Identité stable et correspondance d'exercices entre les deux bases.
- Références aux chapitres/compétences et nécessité de propager ces référentiels.
- Hôte de l'Admin et processus de déploiement.
- Permissions techniques exactes, notamment lecture Production et capacité d'écriture limitée à la publication.
- Lecture et calcul des statistiques Production.
- Gestion des ressources externes aux définitions.
- Propagation éventuelle des chapitres, compétences et flashcards, hors V1 de publication.
- Organisation future des composants React partagés.
- Compatibilité des versions Engine entre consommateurs.

Les arbitrages ci-dessus doivent être clos avant les lots qui en dépendent ; aucune hypothèse silencieuse ne doit les remplacer.
