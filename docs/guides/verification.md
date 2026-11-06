# Vérifications

## Commandes

| Commande | Contrôle |
| --- | --- |
| `npm.cmd run verify:engine` | Archive Engine installée, manifeste, exports et dépendances verrouillées |
| `npm.cmd run test:engine:distribution` | Intégrité et installation autonome du package Engine |
| `npm.cmd test` | Suites Vitest |
| `npm.cmd run test:math-input:browser` | Parcours navigateur de saisie MathLive |
| `npm.cmd run typecheck` | Types TypeScript |
| `npm.cmd run lint` | Règles ESLint |
| `npm.cmd run format:check` | Format Prettier |
| `npm.cmd run build` | Build Next.js et préparation standalone |
| `npm.cmd run test:smoke` | Smoke HTTP du build, Auth désactivée |
| `npm.cmd run check` | Enchaîne les contrôles définis dans `package.json` |

Ne déclare pas un contrôle réussi si une étape échoue. Un contrôle ciblé ne
remplace pas un contrôle complet.

## Vérification isolée

`node scripts/check-isolated-local.mjs` copie les sources autorisées dans un
dossier temporaire, retire les variables Auth et lance `npm run check` sur cette
copie. Il évite de modifier une instance de développement en cours. Le résultat
porte sur la copie et la révision exacte copiée.

Le lanceur `start-staging.cmd` contacte Supabase Staging et peut provoquer de
réelles écritures selon les actions effectuées dans l’interface. Ne pas le
confondre avec un test isolé ni le lancer sans la configuration privée requise.

Les fichiers SQL conservés dans `scripts/` sont les requêtes et contrats utilisés
par les lecteurs Admin ; ils ne constituent pas des bancs de test autonomes.
`test-engine-distribution.mjs` est appelé par la commande npm correspondante.
Les scripts de test historiques locaux ont été supprimés.

## Documentation

Pour une modification documentaire, vérifier les liens locaux et les références
depuis le code, puis exécuter `git diff --check`. `CDC_reference.md` reste la
référence fonctionnelle et ne doit pas être modifié sans décision explicite et
traçable.
