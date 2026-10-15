# Documentation NovLearn Admin

Le [suivi du goal](progress.md) contient l'audit actuel, les lots autorisés,
les tests, les blocages et le point de reprise.

[Authentification préparée](auth.md) : contrôle serveur, tests locaux et conditions d'activation Staging.

[Identité visuelle appliquée](visual-implementation.md) : polices locales, couleurs et variantes SVG, selon [system-design.md](system-design.md).

[Saisie MathLive préparée](math-input.md) : composant contrôlé, clavier scientifique et banc navigateur local.

[Catalogue local](catalogue.md) : écrans Admin, brouillons et permissions SQL,
preuves de restauration, limites et étapes avant activation distante.

[Chapitres et compétences](taxonomy.md) : référentiel Staging, identifiants et
références préservés, audit, tests SQL/restauration et vérification visuelle locale.

[Flashcards Staging](flashcards.md) : intégration locale, permissions, rejeu de
58 migrations et restauration ; réception visuelle bloquée et méthode manuelle.

[Rapprochement des migrations par empreintes](lot-1a-hash-reconciliation.md) : relevé en lecture seule, sept candidats et historique partiellement dépourvu de SQL.

| Document                                                     | Objet                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [Architecture](architecture.md)                              | Applications de l'écosystème, frontières et cible technique                    |
| [Stratégie de base et migrations](database-strategy.md)      | État vivant, historique, gouvernance et pipeline proposé                       |
| [Environnements](environments.md)                            | Staging, production, secrets et déploiement                                    |
| [Modèle de données](data-model.md)                           | Tables signalées par le CDC, limites de vérification et évolutions ouvertes    |
| [Modèle versionné des exercices](exercise-data-model.md)     | Modèle validé, comparaison historique, tentatives et Engine                    |
| [Workflow des exercices](exercise-workflow.md)               | Cycle cible de création, test, validation et publication                       |
| [Publication](publication.md)                                | Pipeline sélectif Staging vers Production et contrôles                         |
| [Sécurité](security.md)                                      | Auth, RLS, fonctions, secrets et accès Production                              |
| [Préparation du Lot 1A](lot-1a-preparation.md)               | Réconciliation, plan de sécurisation SQL, tests futurs et portes d'application |
| [Inventaire des migrations](lot-1a-migration-inventory.json) | Métadonnées Git/distantes et empreintes locales pour le rapprochement          |
| [Requête de diagnostic](lot-1a-readonly-audit.sql)           | Inventaire SQL de métadonnées exclusivement en lecture                         |
| [Roadmap](roadmap.md)                                        | Lots, dépendances et état réel                                                 |
| [Décisions](decisions.md)                                    | Constats, recommandations et validations humaines ouvertes                     |
| [Développement](development.md)                              | Installation, commandes et règles de contribution                              |

Le document fonctionnel de référence reste à la racine : [CDC_reference.md](../CDC_reference.md). Cette documentation décrit la cible et le socle initial ; elle ne vaut pas preuve d'implémentation des fonctionnalités futures.
