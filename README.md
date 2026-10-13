# NovLearn Admin

NovLearn Admin sera l'application privée d'administration de NovLearn : gestion du contenu pédagogique, validation des exercices et, à terme, consultation contrôlée de données de production. Elle vit dans un repository distinct de l'application élève et de l'ancien Creator.

## État du projet

Le Lot 0 pose uniquement le socle technique et la documentation. **Aucune fonctionnalité métier n'est implémentée** : il n'y a ni authentification, ni connexion à Supabase, ni dashboard, ni gestion de contenu. La page d'accueil confirme seulement l'initialisation.

Le cahier des charges officiel est [CDC_reference.md](CDC_reference.md). Il fait foi pour la cible fonctionnelle et ne doit pas être modifié silencieusement. Le [sommaire documentaire](docs/README.md) donne accès aux documents d'architecture, d'environnements, de données, de workflow, de décisions et de développement.

## Architecture technique retenue

- Next.js 15.5.12 avec App Router et sortie autonome (`standalone`).
- React et React DOM 18.3.1, TypeScript strict 5.9.3.
- Tailwind CSS 3.4.18, PostCSS et Autoprefixer.
- ESLint 9 avec la configuration Next.js ; Prettier 3.
- Alias `@/*` vers `src/*`.
- Configuration shadcn/ui préparée, sans composants ni dépendance shadcn installés.
- npm et lockfile versionné.

Les versions suivent autant que possible le frontend NovLearn observé. Voir [les décisions](docs/decisions.md) pour les limites de cet alignement.

## Prérequis et démarrage

Node.js 20 ou supérieur et npm. Dans PowerShell :

```powershell
npm.cmd ci
npm.cmd run dev
```

L'application démarre sur `http://localhost:3000`. Aucune variable d'environnement n'est nécessaire pour cette page initiale. `.env.example` décrit des catégories futures et des valeurs fictives ; il ne contient aucun secret utilisable.

## Vérifications

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

`npm.cmd run check` exécute ces quatre contrôles. `npm.cmd start` sert le build de production localement après compilation.

## Périmètre et suite

Le Lot 0 est le seul lot déclaré terminé par cette initialisation. Le premier lot fonctionnel recommandé est le Lot 1 (authentification Staging et socle Admin), après validation des permissions, RLS et procédure de provisionnement du compte administrateur. Aucun travail de ce lot suivant n'est inclus ici.
