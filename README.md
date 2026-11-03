# NovLearn Admin

Application privée d’administration de NovLearn : édition dans Supabase Staging,
exercices au format canonique du moteur partagé, publication sélective prévue
vers Production. Le périmètre est défini par le [CDC](CDC_reference.md).

**État au 21 octobre 2026 :** le raccordement Staging a été vérifié pour la
connexion, le catalogue et une sauvegarde de brouillon. Le dépôt contient une
préparation Vercel, sans preuve de déploiement. Ce profil désactive Engine,
les rapports signés, la relecture et la publication.

**Engine est une exigence centrale. Sa désactivation dans la préparation Vercel
ne constitue pas une livraison acceptable de l’Admin attendu.** La sauvegarde
d’un brouillon ne prouve pas sa validité mathématique.

## Où trouver l’information

Pour intégrer Engine comme bibliothèque : [contrat et distribution](docs/engine-library.md).

Configuration locale : **un seul `.env` privé**, avec le modèle dans
[Auth](docs/auth.md). Sur Vercel, utiliser les variables du projet.

| Besoin                                           | Document de référence                             |
| ------------------------------------------------ | ------------------------------------------------- |
| Installer et démarrer                            | [Développement](docs/development.md)              |
| Comprendre le code, les données et Engine        | [Architecture](docs/architecture.md)              |
| Configurer Auth et respecter les permissions     | [Authentification et configuration](docs/auth.md) |
| Savoir ce qui est implémenté, vérifié ou restant | [État actuel et roadmap](docs/roadmap.md)         |
| Suivre les étapes Admin, Engine et NovLearn      | [Plan de réalisation](docs/plan-realisation.md)   |
| Exécuter les contrôles et retrouver les preuves  | [Vérifications](docs/verification.md)             |
| Préparer l’hébergement et sa réception           | [Déploiement](docs/vercel.md)                     |

Pour un premier démarrage sans accès aux bases :

```powershell
npm.cmd ci
npm.cmd run dev
```

Ouvrir `http://localhost:3000`. Sans configuration Auth, l’accès est fermé.
Pour le profil Staging existant sur cette machine, suivre le guide de
développement ; aucune disponibilité locale actuelle n’est présumée.

Avant toute intervention, lire [AGENTS.md](AGENTS.md). La référence visuelle
reste [system-design.md](docs/system-design.md). Les résultats anciens sont des
preuves datées, pas des services annoncés comme disponibles. La chronologie
est conservée dans Git.

Le dossier `docs/` contient uniquement ces six guides et la référence visuelle.
Les preuves, captures et audits conservés sont rangés dans `docs/archives/`.
