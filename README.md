# NovLearn Admin

**État courant D13 : préparation Vercel avec Supabase Staging réel.**
[Guide de publication, variables et réception](docs/vercel.md). Les instances
Docker Admin sont retirées après archivage ; les aperçus/tests Engine sont
désactivés dans cette livraison. Connexion, catalogue, Creator et sauvegarde
restent reliés au vrai Supabase. Aucun déploiement Vercel n’est encore effectué.

**Version essentielle reliée à Supabase Staging :** ouvrir
[NovLearn Admin](http://127.0.0.1:3150/login), ou lancer `start-staging.cmd`.
Utiliser le compte Supabase choisi et créé par l’utilisateur. Le frontend peut
tourner sans Docker sur cet ordinateur ; les comptes, contenus et brouillons
utilisent le vrai Supabase Staging. [Guide et état vérifié](docs/staging-app.md).

Le socle SQL est installé après restauration ciblée et 286 assertions SQL inchangées.
Les 111 exercices, 8 chapitres et 28 compétences existants, ainsi que les 70 anciennes
migrations, sont préservés. Le compte choisi a reçu le rôle administrateur.
La connexion et l’ouverture du catalogue sont observées dans les traces serveur.
Le brouillon n°121 est sauvegardé dans Staging et sa fiche a été relue : la base et
les requêtes HTTP confirment l’écriture annoncée par l’utilisateur.
Les aperçus, tests Engine et rapports signés sont désactivés dans ce profil.

NovLearn Admin est indépendante de l’application élève et de l’ancien Creator.
Le [bilan courant](docs/readiness-current.md) distingue la version Staging utilisable,
les résultats historiques et les fonctions reportées. Les anciens parcours de
statistiques et de publication qualifiés ne sont pas actuellement réactivés.

**Supabase Production et publication de contenus restent fermés.** Le banc
entièrement local D11 est archivé ; ses anciens identifiants ne servent pas sur
Staging. Le Lot 1A et la réception restent distincts. Cette version essentielle ne vaut pas validation
complète de la cible du [CDC](CDC_reference.md), qui reste inchangé.

## Architecture technique retenue

- Next.js 15.5.28 avec App Router et sortie autonome (`standalone`), correctifs de sécurité dans la branche 15.5.
- React et React DOM 18.3.1, TypeScript strict 5.9.3.
- Tailwind CSS 3.4.18, PostCSS et Autoprefixer.
- ESLint 9 avec la configuration Next.js ; Prettier 3.
- Alias `@/*` vers `src/*`.
- Configuration shadcn/ui préparée, sans composants ni dépendance shadcn installés.
- npm et lockfile versionné.
- Supabase SSR 0.12.7 / supabase-js 2.117.3 exclusivement côté serveur, Vitest 5.0.4.

Les versions suivent autant que possible le frontend NovLearn observé. Voir [les décisions](docs/decisions.md) pour les limites de cet alignement.

## Prérequis et démarrage

**Parcours courant :** [Vercel](docs/vercel.md), ou `start-staging.cmd` pour un
frontend local avec Supabase réel. Les instructions de bancs ci-dessous sont
historiques : leurs conteneurs ont été retirés et leurs données archivées.

**Pour tester l'application connectée localement**, suivre
[l'instance avec connexion et sauvegarde](docs/local-admin.md), sur
`http://127.0.0.1:3150/`. Elle conserve les brouillons dans une base d'essai.
L'[option Engine Linux](docs/local-admin-engine.md) permet aussi validation,
génération, correction et rapports signés enregistrés. Le banc séparé ci-dessous
conserve ses exemples sans base. L'accès distant reste désactivé.

L’option [relecture locale connectée](docs/local-admin-review.md) complète ce
parcours avec `--engine --review` : demande, attestation explicite et historique.
Une approbation ne publie rien. Les identifiants d’essai sont dans le fichier
ignoré `.local/local-admin-1792143739689/login.txt` ; utiliser le port **3150**.

**Reprise du 18 octobre :** après arrêt complet et sauvegarde à froid vérifiée,
un démarrage normal de Docker rétablit les services existants. Les applications
3150/3152 sont disponibles ; huit contrôles Engine, huit de reprise publication
et sept d’accès/isolation passent. Aucun logiciel global n’est mis à jour.
Le [bilan daté](docs/local-recovery-2026-10-18.md) distingue ces résultats de la
réception navigateur encore ouverte et des travaux Production restants.

**Aperçu distinct sans connexion :** l’aperçu sans Docker reste proposé sur
`http://127.0.0.1:3140/`. Il permet les essais manuels des écrans avec des exemples,
sans connexion, sauvegarde ni calcul Engine. Ses réponses HTTP sont vérifiées ;
la réception visuelle reste à réaliser dans le navigateur.

En développement, la page de connexion désactivée propose également le lien
« Ouvrir l’aperçu local ». Ce lien ne démarre pas l’aperçu : si nécessaire,
lancer `node scripts/content-browser.mjs`. Il n’est pas affiché dans le build
Production ou lorsque la connexion est configurée. Les permissions restent
obligatoires pour l’application connectée.

Le [Creator de l’aperçu](http://127.0.0.1:3140/tests/browser/creator.html)
propose maintenant une [récupération facultative de saisie](docs/creator-recovery.md).
Son activation est explicite ; la réception de ce parcours dans le navigateur
et dans l’application connectée reste à réaliser.

Le [correctif Engine est maintenant adopté localement](docs/engine-admin-adoption.md)
avec SQL 64 : génération avancée, nouveaux rapports signés et relecture réellement
vérifiés. Les anciens rapports restent consultables et demandent de nouveaux
tests avant une nouvelle approbation ou un export.

Le [rendu des figures et vecteurs](docs/coordinate-rendering.md) s’essaie aussi
sur le banc local, avec deux projections publiques réellement capturées du moteur.

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
La [publication par lots](docs/publication-batch.md) ajoute la sélection de
plusieurs exercices et une simulation manuelle distincte, avec résultats partiels
et observation après interruption. Les transferts sont qualifiés sur copies
locales ; la publication distante reste fermée.
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
