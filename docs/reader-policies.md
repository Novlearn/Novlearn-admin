# Consolidation des lectures SQL — qualification locale du 19 octobre 2026

**SQL 68 est qualifié sur copies locales synthétiques.** Les treize doublons
SELECT visés ont disparu des advisors : 45 avertissements avant, 32 après, avec
65 informations et zéro erreur. Ce résultat ne clôture ni le Lot 1A ni le goal.
Les [preuves détaillées](reader-policies-proof.json) conservent aussi l'échec
initial avant SQL et les limites de chaque vérification.

## Modification

La migration canonique appartient à NovLearn :

`supabase/migrations/20261019093842_consolidate_novlearn_admin_reader_policies.sql`
(SHA-256 `0e93f2931501ecb3f7575be0467d4f454fd43a061420a566d8abc4268479863f`).
Commit local `b5159ae2d54ab23a9d401d55099b497ca7464f54` ; aucun push ni distant.
Les 67 migrations antérieures, les huit fichiers NovLearn déjà modifiés et
les configurations applicatives gardent leurs empreintes.

Les treize alternatives permissives SELECT limitées aux lecteurs statistiques,
liste et fiche sont supprimées. Pour cinq tables, leur exception d'identité
physique rejoint la policy publique existante ; l'ancien prédicat reste
inchangé pour les autres rôles. Chapitres et compétences étaient déjà lisibles
par la policy existante. Les policies restrictives, grants, DML, rôles,
fonctions et données ne sont pas modifiés. Les contrôles préalables épinglent
rôles, commandes, noms et prédicats ; toute dérive ou réapplication échoue.

PostgreSQL combine les policies permissives par OR puis les restrictives par AND ;
les grants restent une condition distincte. Voir le
[contrat PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Vérifications réellement exécutées

- Sur restauration SQL 67 peuplée : 22 rôles, huit contextes de claims et dix
  tables, soit 1 760 requêtes par matrice avant/après ; résultats identiques,
  dont invités, comptes permanents et claims forgés. Quatre prérequis négatifs,
  dry-run annulé et refus de réapplication passent.
- Les 62 tables, 11 séquences et métadonnées ACL/rôles/empreintes de mots de
  passe restent exactes. Seules treize policies supprimées et cinq expressions
  SELECT changent, conformément au contrôle à blanc.
- Rejeu neuf de 68 migrations sans réseau. Suites historiques inchangées :
  56 assertions. Fiche : 48 permissions, 24 cas et sept bornes ; liste :
  35 permissions ; statistiques : 31 permissions, avec requêtes réelles.
- Nouvelle sauvegarde/restauration peuplée : 62 tables, 73 relations,
  77 fonctions, 11 séquences et huit rôles applicatifs/empreintes SCRAM exacts ;
  48 permissions restaurées et trois vues identiques hors date d'observation.
  La configuration TLS n'est pas incluse dans cette restauration logique.
- Copie PG/TLS conservée puis source HTTP synthétique : sauvegardes distinctes,
  contrôle à blanc, lignes et configuration SQL préservées. Les vrais essais
  PG/TLS passent 19 groupes, 42 refus d'écriture et deux dérives refusées ;
  les 16 groupes Auth/HTTP passent ensuite sur SQL 68.
- Advisors CLI 2.98.2 réellement exécutés sur 127.0.0.1 avec TLS vérifié et
  transactions en lecture seule : 97 constats, dont 32 WARN et 65 INFO. Les
  treize doublons visés disparaissent ; seize autres doublons permissifs,
  quatorze avertissements initplan et deux search_path restent ouverts.
- Après redémarrage : huit contrôles Engine réels, archive verrouillée inchangée,
  worker Linux borné et les 18 anciens reçus exacts. La suite source Engine
  complète précédemment certifiée n'est pas réexécutée dans ce jalon.

Le contrôle complet Admin et ses limites sont référencés dans le relevé JSON.
Les essais sur fixture vide annulent les lignes ; certains incréments de
séquences non transactionnels peuvent persister uniquement dans cette fixture.
Les comparaisons de migration et restauration peuplées portent aussi sur les
états de séquences et passent exactement.

## Panne et reprise

Le premier essai s'arrêtait à docker inspect, avant SQL. À 09:44:59 UTC,
Docker échouait sur le renommage de sailor-ingest.sock vers .stale. Ce message
ne prouvait pas une interdiction Smart App Control. Après correction et
démarrage normal par l'utilisateur, l'API Docker répond et les services
conservés redémarrent sans recréation. Deux tentatives supplémentaires de
lancement applicatif ont été refusées par des ports déjà utilisés ; les
processus initiaux sont confirmés et conservés. Aucune protection, socket ou
configuration système n'est modifié ; aucun reset ou arrêt forcé.

La [reprise du 19 octobre](local-recovery-2026-10-19.md) indique comment tester.
Réception navigateur, mises en service distantes, métriques manquantes,
MFA/révocation stricte et autres findings SQL restent ouverts.
