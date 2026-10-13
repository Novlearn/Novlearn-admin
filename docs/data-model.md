# Modèle de données : état des connaissances

## Sources et niveau de confiance

Le CDC indique que les projets Supabase Staging et Production ont chacun 22 tables `public` lors de l'audit initial et nomme les tables ci-dessous. Le CDC est ici la source descriptive ; les repositories voisins ont été inspectés en lecture seule. Les bases n'ont pas été interrogées et les migrations n'ont pas été comparées dans ce Lot 0. Par conséquent, ce document ne certifie ni le schéma courant, ni la présence identique de ces tables aujourd'hui. Vérifier les définitions, colonnes, clés, contraintes et RLS avant toute implémentation.

## Tables actuelles rapportées par le CDC

| Table                    | Rôle rapporté / intérêt futur                                                        | Limite connue                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `exercises`              | Catalogue de définitions d'exercices ; `id` bigint et `content` JSONB sont rapportés | Schéma vivant et contraintes à confirmer ; seule table de contenu synchronisée en V1 |
| `exercises_claude`       | Table existante signalée                                                             | Exclue de la publication V1 ; rôle et structure à confirmer                          |
| `exercise_attempts`      | Tentatives d'exercices                                                               | Données élève, exclues de la synchronisation                                         |
| `duels`                  | Duels                                                                                | Exclue de la synchronisation                                                         |
| `duel_attempts`          | Tentatives liées aux duels                                                           | Exclue de la synchronisation                                                         |
| `profiles`               | Profil et rôle admin potentiel                                                       | Accès Production limité ; colonnes et RLS à examiner                                 |
| `chapters`               | Taxonomie pédagogique                                                                | Gestion cible sur Staging ; pas de propagation V1                                    |
| `competences`            | Taxonomie et compétences                                                             | Gestion cible sur Staging ; pas de propagation V1                                    |
| `flashcards`             | Cartes question/réponse                                                              | Le CDC rapporte `id`, `chapter`, `question`, `answer`, `created_at` ; à confirmer    |
| `feedbacks`              | Retours utilisateurs                                                                 | Hors synchronisation ; traitement ultérieur éventuel                                 |
| `user_progress`          | Progression élève                                                                    | Source potentielle de statistiques, accès minimisé                                   |
| `user_competence_scores` | Scores par compétence                                                                | Source potentielle de statistiques                                                   |
| `user_stats`             | Statistiques utilisateur                                                             | Source potentielle d'agrégations                                                     |
| `monthly_scores`         | Scores mensuels                                                                      | Source potentielle d'agrégations                                                     |

Le CDC cite aussi d'autres tables existantes sans les inventorier toutes ici. Les noms de colonnes ci-dessus ne sont pas complétés par supposition.

## Évolutions proposées, non implémentées

- Identité logique stable d'un exercice séparée des identifiants locaux aux bases.
- Versions immuables et historique des publications.
- Snapshot privé de l'instance générée pour qu'une tentative reprise retrouve les mêmes données.
- Référence de chaque tentative à la version publiée ; instance commune possible aux participants d'un duel.
- Publication sélective idempotente avec audit et résultat vérifié.

Ces besoins ne justifient aucune table créée dans le Lot 0.

## Décisions SQL ouvertes

Le choix entre lignes versionnées dans `exercises` et table dédiée aux révisions doit être arrêté avant migration. Il faut également préserver les clés étrangères historiques des tentatives/duels, définir la correspondance des identifiants Staging/Production et gérer les références aux chapitres/compétences qui ne sont pas publiés. Toute évolution de versionnement doit résoudre explicitement son éventuel conflit avec la règle « seule `public.exercises` est synchronisée en V1 ». Aucune migration exécutable n'est incluse.
