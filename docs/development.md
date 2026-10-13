# Développement

## Prérequis et installation

Node.js 24.19.x et npm 11.17.x pour l'Admin courant, alignés sur le runtime de l'Engine. Le frontend NovLearn observé déclare encore Node 20+ ; ce dépôt ne le modifie pas.

```powershell
npm.cmd ci
npm.cmd run dev
```

Les commandes `npm.cmd` évitent le blocage fréquent de `npm.ps1` par la politique PowerShell. Le serveur local est à `http://localhost:3000`.

## Scripts disponibles

| Commande                   | Rôle                                            |
| -------------------------- | ----------------------------------------------- |
| `npm.cmd run dev`          | Serveur de développement Next.js                |
| `npm.cmd run build`        | Build de production autonome                    |
| `npm.cmd start`            | Sert le build déjà produit                      |
| `npm.cmd run typecheck`    | Vérification TypeScript sans émission           |
| `npm.cmd run lint`         | ESLint                                          |
| `npm.cmd run format`       | Formate les fichiers suivis par Prettier        |
| `npm.cmd run format:check` | Vérifie le format sans modifier les fichiers    |
| `npm.cmd run check`        | Typecheck, lint, format et build successivement |

`npm.cmd run test` exécute Vitest (permissions, routes directes, adaptateur Auth et cookies SSR). `check` commence par ces tests puis types, lint, format, build et `test:smoke`. Le smoke lance un standalone temporaire sur 127.0.0.1:3137 avec Auth explicitement désactivé ; il vérifie les refus HTTP, la redirection, les headers et la disponibilité du CSS, puis arrête le serveur. `postbuild` copie les assets statiques nécessaires au standalone. Les doubles ne constituent pas une preuve de droits SQL ou de connexion distante. Voir [Auth](auth.md) pour les tests nécessaires avant activation.

## Conventions et structure

- TypeScript strict ; App Router dans `src/app/`.
- Alias `@/*` vers `src/*`.
- Server Components par défaut ; ajouter du code client seulement quand un besoin d'interaction l'exige.
- Tailwind pour le style ; conserver une base responsive, sémantique et navigable au clavier.
- Garder le dépôt simple. Introduire services, hooks, composants partagés ou nouvelles dépendances lorsqu'un usage concret le justifie.
- Respecter les contrats de l'Exercise Engine pour les exercices.

## Variables et sécurité

Copier `.env.example` vers `.env.local` seulement si une future fonctionnalité l'exige, puis fournir les secrets via un gestionnaire adapté. Les valeurs de l'exemple sont fictives. Ne jamais committer de secret, exposer de clé privilégiée dans `NEXT_PUBLIC_*`, ou connecter directement le navigateur aux capacités Production. Vérifier l'autorisation côté serveur pour chaque opération protégée. Préserver la séparation Staging/Production.

## Procédure par lot

Lire `CDC_reference.md`, `AGENTS.md` et les documents du lot. Confirmer les dépendances et décisions ouvertes, implémenter uniquement le périmètre accepté, ajouter les tests de comportement correspondants, mettre à jour la documentation utile, puis exécuter les vérifications disponibles avant commit. Ne pas modifier les repositories voisins ni le CDC au fil de l'implémentation.

Avant commit, lancer au minimum `npm.cmd run check`, examiner `git diff`, vérifier qu'aucun secret ni fichier généré n'est suivi et relire la documentation modifiée. Ne déclarer une vérification distante ou manuelle que si elle a effectivement été exécutée.
