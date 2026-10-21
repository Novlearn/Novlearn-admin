# Audit d’avancement — 15 octobre 2026

## Résumé exécutif

Le dépôt contient un socle Admin étendu et plusieurs lots métier vérifiés localement. Le projet global n’est pas terminé : les lots distants de sécurité/Auth, la réception visuelle, l’accès Production et la mise en service restent ouverts. Le lot Publication est le chantier local actif : le dernier checkpoint documenté qualifie le pilote PostgreSQL source et la reprise, tandis que le worktree ajoute maintenant une primitive de transaction cible qui n’est pas encore raccordée à une route ou à l’interface.

Le goal Codex n’est pas exposé comme goal actif dans l’état de cette conversation (`get_goal` retourne `null`). Le dépôt et `docs/progress.md` décrivent néanmoins le goal global comme actif et incomplet. L’audit se fonde sur cet état documentaire et sur le worktree au 15 octobre 2026.

## État du dépôt

- Branche `main`, à **7 commits en avance sur `origin/main`**.
- **10 fichiers de travail non commités** après ajout de ce rapport : 6 modifiés et 4 nouveaux. Le chantier préexistant à ce rapport touche 9 fichiers (6 modifiés, 3 nouveaux), principalement autour du transfert de publication PostgreSQL.
- Aucun changement observé dans `CDC_reference.md`.
- Les derniers résultats enregistrés dans `docs/publication-pg-local-proof.json` portent sur le checkpoint précédent : **424 tests / 26 fichiers**, types, lint, format, build et smoke, plus 11 contrôles d’intégration PostgreSQL et 16 assertions SQL après restauration.
- Ces preuves ne couvrent pas la nouvelle primitive de transfert cible non commitée. Aucun test n’a été exécuté pendant cet audit.

## Avancement par lot

| Lot                                 | État au dernier checkpoint                                                                                                        | Ce qui reste                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Initialisation                  | Terminé                                                                                                                           | —                                                                                                                                                                   |
| 0 bis — Audit d’architecture        | Terminé                                                                                                                           | —                                                                                                                                                                   |
| 1A — Réconciliation et sécurité SQL | SQL/Engine préparés et vérifiés localement                                                                                        | Réception distante, historique canonique, sécurité réelle et validation séparée des environnements                                                                  |
| 1B — Auth et socle Admin            | Préparé localement, accès fermé                                                                                                   | Prérequis 1A, compte Admin et vérifications réelles                                                                                                                 |
| 2 — Catalogue                       | Implémenté et vérifié localement                                                                                                  | Activation distante fermée                                                                                                                                          |
| 3 — Creator                         | Creator canonique et aperçu locaux                                                                                                | Réception complète de l’édition et du rendu                                                                                                                         |
| 4 — Tests et aperçu                 | Rapports, Engine et relecture locaux                                                                                              | Rendu avancé et réception complète                                                                                                                                  |
| 5 — Publication                     | Payload/diff, capacité SQL, journal et pilote PostgreSQL source/reprise documentés ; primitive de cible en cours dans le worktree | Vérifier la primitive en cours, raccorder l’orchestration Engine/source/cible et la reprise, ajouter routes et confirmations UI, produire une preuve datée intégrée |
| 6 — Chapitres et compétences        | CRUD local vérifié                                                                                                                | Activation distante fermée                                                                                                                                          |
| 7 — Flashcards                      | CRUD/API/SQL local                                                                                                                | Réception visuelle à reprendre ; activation distante fermée                                                                                                         |
| 8 — Statistiques et utilisateurs    | Non démarré                                                                                                                       | Accès Production read-only, définitions et confidentialité                                                                                                          |
| 9 — Mise en service                 | Non démarré                                                                                                                       | Prérequis des lots, hébergement, exploitation et audit final                                                                                                        |

Les états sont repris de `docs/roadmap.md` et `docs/progress.md`. « Vérifié localement » ne signifie pas activé dans Supabase ou prêt à être mis en service.

## Travail local non intégré

Les fichiers nouveaux `src/lib/publication-target.ts`, `tests/publication-target.test.ts` et `scripts/test-publication-target-worker.mjs` implémentent/exercent une primitive privée pour inspecter, appliquer, vérifier après commit et observer une issue incertaine. Les changements connexes dans `src/lib/publication-pg.ts`, `src/lib/publication-journal-server.ts`, les scripts et leurs tests ajustent la configuration et le banc d’intégration.

À la lecture du code, cette primitive n’est pas encore appelée par un orchestrateur applicatif ou une route. Le dernier checkpoint `docs/publication-pg.md` indique encore que le transfert complet et l’UI restent à raccorder ; `docs/progress.md` ne reflète pas encore le travail non commité. Il faut préserver cette distinction jusqu’à exécution des contrôles correspondants et mise à jour des preuves.

## Portes de sécurité et limites

- Auth réelle Staging et Production, publication réelle, migrations distantes, push et déploiement ne sont pas qualifiés par les preuves locales.
- Le CDC interdit les modifications directes à NovLearn, à l’Exercise Engine et aux bases Supabase sans autorisation spécifique ; cet audit n’a effectué aucune de ces opérations.
- La restriction de navigateur a empêché la réception visuelle précédemment documentée ; aucune nouvelle inspection visuelle n’est revendiquée ici.
- L’audit porte sur l’état des fichiers, les documents de suivi et les diff locaux. Il n’est pas une certification sécurité complète ni une validation de l’exécution des changements non commités.

## Prochaine étape conseillée

Terminer la qualification locale de la primitive cible déjà commencée, enregistrer les résultats et mettre à jour le checkpoint de progression avec les limites réelles. Ensuite seulement, raccorder cette primitive à l’orchestration de publication et à son interface, en gardant Auth distante et toute publication réelle désactivées tant que les portes correspondantes ne sont pas explicitement validées.
