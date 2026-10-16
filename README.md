# NovLearn Admin

NovLearn Admin sera l'application privée d'administration de NovLearn : gestion du contenu pédagogique, validation des exercices et, à terme, consultation contrôlée de données de production. Elle vit dans un repository distinct de l'application élève et de l'ancien Creator.

## État du projet

Le catalogue, le Creator canonique, MathLive, l'aperçu et les tests Engine, la relecture, les chapitres, les compétences, les flashcards et le Dashboard Staging sont implémentés localement. Le [suivi du goal](docs/progress.md) distingue leurs preuves et limites. Les migrations SQL sont vérifiées sur des copies locales isolées ; aucune application distante n'est réalisée. La publication complète et les lectures Production restent à terminer.

**L'accès Staging reste désactivé** jusqu'à validation des portes SQL du [Lot 1A](docs/lot-1a-preparation.md), provisionnement du compte Admin et vérification de l'authentification réelle. Le [code Auth](docs/auth.md) refuse l'accès sans configuration autorisée. Les tests locaux avec doubles ne valent pas une connexion distante opérationnelle.

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

**Pour tester l'application connectée localement**, suivre
[l'instance avec connexion et sauvegarde](docs/local-admin.md), sur
`http://127.0.0.1:3150/`. Elle conserve les brouillons dans une base d'essai.
L'[option Engine Linux](docs/local-admin-engine.md) permet aussi validation,
génération, correction et rapports signés enregistrés. Le banc séparé ci-dessous
conserve ses exemples sans base. L'accès distant reste désactivé.

Node.js 24.19.x et npm 11.17.x. Dans PowerShell :

```powershell
npm.cmd ci
npm.cmd run dev
```

L'application démarre sur `http://localhost:3000`, avec redirection vers la connexion. Sans configuration, le formulaire est désactivé et les endpoints refusent l'accès sans contacter Supabase. `.env.example` et `.env.auth.example` décrivent la configuration ; suivre les conditions d'activation dans [Auth](docs/auth.md), après accord explicite.

Pour essayer progressivement les composants sans compte ni base distante, lancer
`node scripts/preview-browser.mjs` avec Docker Desktop Linux disponible, puis ouvrir
`http://127.0.0.1:3140/`. Ce [banc local](docs/local-workspace.md) utilise des
exemples fictifs et le vrai Engine Linux borné pour les calculs. Il ne sauvegarde
aucun exercice en base et ne publie rien. Le lancement alternatif
`node scripts/content-browser.mjs` propose les mêmes écrans sans moteur ; ne pas
lancer les deux simultanément.

Le banc propose aussi une [simulation de publication](docs/publication-ui.md) :
diff, confirmation, réponse perdue et vérification de résultat. Tous les résultats
de ce parcours sont simulés ; il n'exécute pas de tests Engine ni de transfert.
Le service et l'interface réels restent soumis aux prérequis d'activation.
La [finalisation éditoriale source](docs/publication-source-finalization.md)
est vérifiée sur copies locales, avec reprise sans répétition du transfert.
Le [retour à une révision publiée](docs/publication-rollback.md) est aussi vérifié
côté serveur/SQL, avec conservation des deux versions et des tentatives liées.

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

Le goal autorise l'avancement autonome local par lots indépendants. D07 autorise les migrations et vérifications SQL locales dans NovLearn ; l'application élève reste hors de ce périmètre. La réconciliation et l'application Staging nécessitent une procédure et une autorisation distinctes. Le Lot 1B n'est pas réceptionné à distance. Les portes de contrôle de [la roadmap](docs/roadmap.md) restent obligatoires. Aucun push ni déploiement autorisé.
