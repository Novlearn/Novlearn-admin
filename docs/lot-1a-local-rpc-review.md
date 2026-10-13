# Lot 1A — permissions des RPC privilégiés

Complément local du 13 octobre 2026 à la [restauration et confidentialité des
profils](lot-1a-local-restore-and-privacy.md). **Le Lot 1A reste incomplet**,
notamment en attente de certification Engine et des validations distantes.

## Correctif canonique local

`Novlearn/supabase/migrations/20261013174725_novlearn_privileged_rpc_hardening.sql`
ajoute les corrections suivantes, sans modification de données historiques :

- `award_weekly_top3()` perd son EXECUTE hérité de `PUBLIC`, ainsi que les
  grants clients éventuels ; seul `service_role` reçoit l'autorisation explicite.
  Le chemin de recherche devient `pg_catalog, public, pg_temp`, avec le schéma
  temporaire explicitement en dernier. Son algorithme de récompense n'est pas
  réécrit. Le consommateur existant `ensureWeeklyRewards` utilise déjà le client
  serveur service et reste compatible.
- `get_chapters_with_count` exige l'identité permanente du propriétaire avec
  une comparaison sûre lorsque le paramètre ou `auth.uid()` est NULL. Les
  agrégats et la signature du lecteur de progression sont conservés.
- `get_public_profile` conserve ses champs publics et exige une identité
  permanente ; `find_user_by_friend_code` exige également cette identité et
  conserve la résolution de code et son expiration.
- Les corps des helpers rôle/invité, trois classements et quatre fonctions de
  trigger sont relus. Leurs relations sont qualifiées ; un `search_path` vide
  est fixé. Les triggers perdent leurs grants EXECUTE directs aux clients,
  sans empêcher leur invocation automatique par Auth et les tables.

Les créations historiques de `award_weekly_top3` accordaient EXECUTE à
`service_role` sans retirer le droit de `PUBLIC` donné par défaut à une nouvelle
fonction. Le grant au serveur ne restreignait donc pas les autres acteurs.
Cette déduction est vérifiée contre les [règles PostgreSQL 17](https://www.postgresql.org/docs/17/sql-createfunction.html),
puis les refus sont testés sous les vrais rôles SQL dans le banc restauré.

Aucune nouvelle logique mathématique n'est créée. Les classements et calculs
statistiques historiques sont conservés ; leurs données issues des anciennes
tentatives ne deviennent pas certifiées par cette correction de permissions.

## Preuves finales

Le [rapport machine](lot-1a-local-rpc-proof.json) conserve les versions et les
empreintes des **50 migrations**, le binaire Auth officiel de bootstrap,
la fixture canonique Engine et l'archive restaurée. Les données et binaires
eux-mêmes restent hors Git.

| Contrôle                          | Résultat                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rejeu neuf avec Auth officiel     | **50 migrations PASS**, sources stables et hashes revérifiés.                                                                                      |
| Archive → nouvelle base restaurée | **PASS logique**, données `public`/`auth`, schéma, RLS, ACL, séquences, rôles et memberships concordants.                                          |
| Assertions après restauration     | **53 PASS**, dont les 35 précédentes conservées et 18 contrôles supplémentaires.                                                                   |
| Récompenses serveur               | Clients étudiant, anon et Admin refusés avec SQLSTATE `42501` ; service autorisé ; fixture éligible récompensée ; deuxième appel idempotent.       |
| Progression personnelle           | Propriétaire autorisé, cible NULL/croisée et invité refusés.                                                                                       |
| Helpers et triggers               | Namespace fixe contrôlé ; création des comptes et traitement des tentatives toujours fonctionnels malgré la fermeture des EXECUTE clients directs. |
| Engine                            | Sources toujours inchangées ; résultats complets précédents **1532 PASS / 1 FAIL**, autorisation de correction en attente.                         |

La fixture comprend un résultat de tentative synthétique de la semaine
précédente, sans version historique attribuée, afin de tester réellement
l'attribution et l'idempotence des récompenses. Ce n'est pas un résultat élève
ou une validation de correction mathématique. Les deux appels serveur et leurs
effets de test sont annulés dans la transaction des assertions.

Archive SHA-256 :
`4f2faef49e87fd5bae8710eb4e5ed2a643a288d784754a869eb5d75bcb323265`.
Les différences de représentation restent consignées (`rawSnapshotMatched:false`) :
ordre des entrées ACL et trous d'ordinal des colonnes Auth. Les droits, options
de grant et ordre des colonnes visibles sont comparés intégralement, selon le
comparateur déjà testé dans le relevé précédent.

Le changelog Supabase est revérifié avant ce correctif. Les [changements
PostgreSQL 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
distinguent notamment SHA/digest des anciens chiffrements PGP ; le banc utilise
le SHA-256 réel et ne qualifie pas des données chiffrées historiques. Les
[changements Studio de rôle](https://supabase.com/changelog/46081-self-hosted-supabase-switching-studio-from-supabase-admin-to-postgres-breaking-change)
ne sont pas appliqués aux services existants. Les tests utilisent les rôles
explicitement contrôlés de leurs conteneurs neufs.

## Limites et suites

Ces correctifs sont préparés et testés dans les conteneurs de certification
sans réseau. Aucun schéma de la base locale de travail, de Staging ou de
Production n'est modifié pendant cette reprise. Aucun reset ou effacement de
donnée existante n'est exécuté ; les volumes de test restent disponibles après
arrêt. Les fichiers NovLearn restent non committés pour préserver le travail
préexistant et parallèle ; seul le bilan Admin est committé localement.

L'inventaire ne certifie pas tous les chemins API/vues ou les extensions de
Supabase. Les lecteurs historiques d'exercices et la confiance dans les anciens
verdicts clients attendent leur transition vers l'Engine qualifié. Les schémas
distants, historique de migrations, backup/PITR réel et droits de publication
restent à valider avant une application distante distinctement autorisée.
L'Auth Admin reste désactivée, les lots suivants ne sont pas ouverts.
