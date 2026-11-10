# Démarrer et travailler sur le dépôt

## Installation

La configuration locale se trouve dans un seul `.env` privé à la racine.
Le modèle et les paramètres utiles sont dans [Auth](./auth.md) ; aucun fichier
d'exemple `.env.*.example` n'est à copier ni à combiner.

Utiliser Node.js `>=24.19.0 <25` selon [package.json](../../package.json).
Les preuves de qualification utilisent Node 24.19.0 et npm 11.17.0.
Le lockfile fixe les dépendances, dont l’archive Engine locale.

```powershell
npm.cmd ci
npm.cmd run dev
```

Sous PowerShell, `npm.cmd` évite les restrictions éventuelles de `npm.ps1`.
Next démarre sur `http://localhost:3000`, puis redirige vers la connexion.
Sans configuration Auth valide, le formulaire est désactivé et les opérations
protégées refusées. `npm ci` nécessite l’accès aux dépendances ; il ne provisionne
aucune base ni aucun compte.

Les scripts `predev` et `prebuild` préparent les ressources MathLive locales.
`npm.cmd run build` produit une sortie autonome et `postbuild` y copie les
ressources nécessaires. `npm.cmd start` sert ce build.

## Lanceur local Staging

`start-staging.cmd` lance [run-staging-admin.mjs](../../scripts/run-staging-admin.mjs)
sur `http://127.0.0.1:3150/login`, sans Docker. Ce lanceur optionnel exige `.env`,
`.local/staging-admin-config.json` et le dossier d’instance désigné par cette
configuration. Ces fichiers privés ne sont pas versionnés ; ils ne sont pas
présents par défaut dans un nouveau checkout. Ce n’est pas un bootstrap portable.

Le lanceur vérifie le projet et l’empreinte de la qualification SQL, puis contacte
Supabase Staging. Il fixe les capacités conformément au
[profil actuel](../roadmap.md). Ne pas modifier l’empreinte ni contourner un refus
pour obtenir un démarrage. Utiliser le compte Supabase existant choisi par
l’utilisateur ; les anciens comptes locaux ne sont pas des comptes Staging.

Pour arrêter uniquement cette instance :

```powershell
node scripts/run-staging-admin.mjs --stop
```

Le simple lancement de ce frontend peut conduire à des écritures **réelles dans
Staging** lors des actions de l’utilisateur. Il ne faut pas l’assimiler à un banc
fictif. Pour configurer un autre poste, lire [Auth](./auth.md) avant toute activation.

## Outils locaux

`node scripts/content-browser.mjs` sert les écrans d’exemple sans base ni calcul
Engine sur le port 3140. Il ne prouve ni la sauvegarde ni les permissions SQL.

Le lanceur Staging exige les fichiers privés décrits plus haut. Le démarrage
Next normal peut aussi utiliser les [lectures Production par API/RLS](./production-api.md)
explicitement configurées dans le `.env` privé. Les scripts conservés couvrent les
outils de build et de distribution Engine, quelques aides de développement,
ainsi que les requêtes SQL utilisées par les lecteurs Admin. Les anciens bancs
locaux Docker/PostgreSQL ont été supprimés.

Les captures et pages de `tests/browser/` permettent les essais manuels. Un HTTP
200 ou un rendu serveur ne vaut pas réception des interactions navigateur.

## Contribution

Lire [les consignes](../../AGENTS.md), le [CDC](../../CDC_reference.md) et
[l’état actuel](../roadmap.md). Ne pas commencer automatiquement le lot suivant.
Les accès distants, migrations, dépôts voisins, publications et déploiements
nécessitent leur autorisation propre. Une décision historique n’est pas une
autorisation permanente pour une nouvelle intervention.

L’alias `@/*` désigne `src/*`. Conserver les contrôles de permissions côté serveur,
le format canonique Engine et la séparation Staging/Production.
Les commandes de qualité et leurs limites sont dans
[Vérifications](./verification.md). Éviter `npm run format` à la racine pour une
retouche documentaire : formater seulement les fichiers concernés.
