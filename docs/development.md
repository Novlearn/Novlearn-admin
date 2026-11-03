# Démarrer et travailler sur le dépôt

## Installation

La configuration locale se trouve dans un seul `.env` privé à la racine.
Le modèle et les paramètres utiles sont dans [Auth](auth.md) ; aucun fichier
d'exemple `.env.*.example` n'est à copier ni à combiner.

Utiliser Node.js `>=24.19.0 <25` selon [package.json](../package.json).
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

## Profil Staging déjà configuré sur cette machine

`start-staging.cmd` lance [run-staging-admin.mjs](../scripts/run-staging-admin.mjs)
sur `http://127.0.0.1:3150/login`, sans Docker. Il exige les fichiers privés
existants `.env` et `.local/staging-admin-config.json`, ainsi que le dossier
d’instance désigné par cette configuration. Ce n’est pas un bootstrap portable
pour une nouvelle machine.

Le lanceur vérifie le projet et l’empreinte de la qualification SQL, puis contacte
Supabase Staging. Il fixe les capacités conformément au
[profil actuel](roadmap.md). Ne pas modifier l’empreinte ni contourner un refus
pour obtenir un démarrage. Utiliser le compte Supabase existant choisi par
l’utilisateur ; les anciens comptes locaux ne sont pas des comptes Staging.

Pour arrêter uniquement cette instance :

```powershell
node scripts/run-staging-admin.mjs --stop
```

Le simple lancement de ce frontend peut conduire à des écritures **réelles dans
Staging** lors des actions de l’utilisateur. Il ne faut pas l’assimiler à un banc
fictif. Pour configurer un autre poste, lire [Auth](auth.md) avant toute activation.

## Bancs d’essai

`node scripts/content-browser.mjs` sert les écrans d’exemple sans base ni calcul
Engine sur le port 3140. Il ne prouve ni la sauvegarde ni les permissions SQL.

Les scripts `preview-browser.mjs`, `create-local-admin.mjs`, `run-local-admin.mjs`
et les bancs HTTP/PG restent dans `scripts/`. Ils concernent des fixtures ou des
instances Docker distinctes. Les anciens conteneurs Admin ont été retirés après
sauvegarde : `start-local.cmd` et un ancien dossier d’instance ne garantissent
pas leur restauration. Reconstituer un banc demande ses dépendances exactes et
une procédure de restauration vérifiée ; ne pas lancer ces outils comme une
réparation automatique du profil Staging.

Les captures et pages de `tests/browser/` permettent les essais manuels. Un HTTP
200 ou un rendu serveur ne vaut pas réception des interactions navigateur.

## Contribution

Lire [les consignes](../AGENTS.md), le [CDC](../CDC_reference.md) et
[l’état actuel](roadmap.md). Ne pas commencer automatiquement le lot suivant.
Les accès distants, migrations, dépôts voisins, publications et déploiements
nécessitent leur autorisation propre. Une décision historique n’est pas une
autorisation permanente pour une nouvelle intervention.

L’alias `@/*` désigne `src/*`. Conserver les contrôles de permissions côté serveur,
le format canonique Engine et la séparation Staging/Production.
Les commandes de qualité et leurs limites sont dans
[Vérifications](verification.md). Éviter `npm run format` à la racine pour une
retouche documentaire : formater seulement les fichiers concernés.
