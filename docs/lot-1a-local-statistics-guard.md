# Lot 1A — protection des écritures de statistiques

Complément local du 13 octobre 2026 à la [revue des RPC](lot-1a-local-rpc-review.md).
Le Lot 1A reste incomplet ; les corrections ci-dessous ne qualifient pas les
verdicts historiques côté client ou l'isolation Engine.

La policy de mise à jour de son propre profil permettait de modifier directement
`crown_count`, `star_count`, `current_streak`, `max_streak`. La protection du rôle
et la fermeture du RPC de récompenses ne fermaient pas ce second chemin.

La migration locale canonique
`20261013174726_novlearn_server_owned_statistics.sql` ajoute un trigger invoker
qui refuse l'attribution de toute valeur autre que zéro à ces quatre compteurs
à INSERT et tout changement à UPDATE par les rôles clients. Les profils créés
par les clients doivent conserver les valeurs initiales zéro. L'upsert passe
par les mêmes vérifications. La protection distincte du rôle et de l'identité
reste en place. Les chemins privilégiés Auth, triggers et service restent
autorisés selon leur rôle SQL effectif.

Les droits de mutation de `monthly_scores`, `user_stats`, `user_weekly_rewards`
et `leaderboard_snapshots` sont retirés à PUBLIC, anon et authenticated ; des
grants serveur explicites conservent les inserts/updates nécessaires. Les
lectures ne sont pas élargies. Aucun backfill, remise à zéro ou changement de
donnée historique n'est exécuté par cette migration.

Les consommateurs frontend repérés lisent les compteurs et éditent des champs
personnels ou de préférence. Le banc vérifie l'édition d'avatar, la création
des comptes, les triggers de tentative et l'attribution serveur de récompenses.
Il ne prétend pas exécuter chaque parcours de préférences dans un navigateur.

| Vérification                                           | Résultat                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rejeu final, Auth officiel, instance neuve sans réseau | **51 migrations PASS**, empreintes stables.                                                                                                                   |
| Sauvegarde/restauration sur nouvelle cible             | **Intégrité logique PASS**, mêmes données, schéma, roles, memberships, ACL et séquences.                                                                      |
| Assertions après restauration                          | **69 PASS** : 53 précédentes conservées, 16 nouvelles.                                                                                                        |
| Nouveaux refus                                         | INSERT/UPDATE de chaque compteur, upsert de couronne, écritures des quatre tables dérivées, mutation par un client Admin. SQLSTATE `42501` attendu et obtenu. |
| Chemins conservés                                      | Avatar personnel modifiable ; séries calculées par les triggers ; récompense serveur effective et idempotente.                                                |

Le [rapport machine](lot-1a-local-statistics-proof.json) contient les empreintes
vérifiées, aucune archive ou donnée élève. SHA-256 de l'archive locale :
`450b8acf36e9705ae402e7b979a44aa354c2db16f0acaa45d25f622ad0c5d50e`.
Les différences de représentation restent conservées (`rawSnapshotMatched:false`),
selon le comparateur documenté dans le bilan de restauration.

Ces corrections sont préparées et testées exclusivement dans des fixtures
neuves. La base locale de travail, Staging et Production sont inchangés pendant
cette reprise ; aucune donnée existante n'est supprimée. Les conteneurs de
certification sont arrêtés et leurs volumes conservés. Les modifications
NovLearn restent dans son arbre de travail, sans commit ou push de ce dépôt.

Il reste possible de falsifier des résultats historiques par les anciens
chemins qui font confiance aux verdicts clients. Fermer ces chemins demande
la transition vers la correction officielle et les instances privées de
l'Engine qualifié. Cette migration n'ajoute aucun calcul ou moteur concurrent
et ne constitue pas une certification d'intégrité de toutes les statistiques.

La certification Engine Windows reste rouge et ses sources restent inchangées.
L'autorisation distincte demandée est en attente. Les schémas et historiques
distants, sauvegarde/PITR réel et principal de publication restent à valider.
Aucune activation Auth Admin ni ouverture de lot suivant n'est réalisée.

Le chemin critique reste bloqué par la même absence d'autorisation de correction
Engine, constatée depuis la reprise D04 et les trois continuations locales
suivantes. Ces continuations ont livré les protections SQL indépendantes ;
les travaux restants sur la correction officielle et les lecteurs d'exercices
exigent désormais la qualification du moteur. La roadmap ne permet pas de
réceptionner 1A ou d'activer les lots dépendants avec ce prérequis rouge. Les
reprises ne valent pas l'accord explicite demandé pour modifier ce dépôt.
