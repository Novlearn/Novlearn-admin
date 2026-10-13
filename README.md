# NovLearn Admin

NovLearn Admin sera l'application privée d'administration de NovLearn : gestion du contenu pédagogique, validation des exercices et, à terme, consultation contrôlée de données de production. Elle vit dans un repository distinct de l'application élève et de l'ancien Creator.

## État du projet

Les lots 0 et 0 bis sont livrés. Le [suivi du goal](docs/progress.md) décrit l'audit et l'avancement courant. Le code du [Lot 1B Auth](docs/auth.md), le layout privé et les tests locaux sont préparés. **L'accès Staging reste désactivé** jusqu'à la sécurisation SQL du [Lot 1A](docs/lot-1a-preparation.md) et au provisionnement du premier admin. Il n'existe pas encore de gestion de contenu, de dashboard chiffré, de Creator, de publication ou de lecture Production. `exercise_versions` est absente du schéma relevé ; aucune migration n'est exécutée.

Le cahier des charges officiel est [CDC_reference.md](CDC_reference.md). Il fait foi pour la cible fonctionnelle et ne doit pas être modifié silencieusement. Le [sommaire documentaire](docs/README.md) donne accès à l'audit, à la stratégie DB, au modèle de versions, à la publication, à la sécurité et aux documents de fonctionnement.

## Architecture technique retenue

- Next.js 15.5.27 avec App Router et sortie autonome (`standalone`), correctifs de sécurité dans la branche 15.5.
- React et React DOM 18.3.1, TypeScript strict 5.9.3.
- Tailwind CSS 3.4.18, PostCSS et Autoprefixer.
- ESLint 9 avec la configuration Next.js ; Prettier 3.
- Alias `@/*` vers `src/*`.
- Configuration shadcn/ui préparée, sans composants ni dépendance shadcn installés.
- npm et lockfile versionné.
- Supabase SSR 0.12.7 / supabase-js 2.117.3 exclusivement côté serveur, Vitest 5.0.4.

Les versions suivent autant que possible le frontend NovLearn observé. Voir [les décisions](docs/decisions.md) pour les limites de cet alignement.

## Prérequis et démarrage

Node.js 24.19.x et npm 11.17.x. Dans PowerShell :

```powershell
npm.cmd ci
npm.cmd run dev
```

L'application démarre sur `http://localhost:3000`, avec redirection vers la connexion. Sans configuration, le formulaire est désactivé et les endpoints refusent l'accès sans contacter Supabase. `.env.example` et `.env.auth.example` décrivent la configuration ; suivre les conditions d'activation dans [Auth](docs/auth.md), après accord explicite.

## Vérifications

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

`npm.cmd run check` exécute tests, types, lint, format, build et smoke HTTP avec Auth désactivé. `postbuild` prépare les fichiers statiques du standalone. `npm.cmd start` sert le build de production localement après compilation.

## Périmètre et suite

Le goal autorise l'avancement autonome local par lots indépendants. La préparation du Lot 1A est disponible ; sa réconciliation, ses correctifs dans NovLearn et son application Staging nécessitent les autorisations correspondantes. Le Lot 1B n'est pas réceptionné à distance. Les autres lots restent dépendants des portes de contrôle de [la roadmap](docs/roadmap.md). Aucun push ni déploiement autorisé.
