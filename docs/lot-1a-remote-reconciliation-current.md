# Réconciliation distante — actualisation en lecture seule

Relevé du **18 octobre 2026**, sans DDL, DML, réparation d’historique ou lecture
de données métier/Auth. Le connecteur Supabase est utilisé uniquement pour les
projets, versions de migration et catalogues système. Aucune clé privilégiée
n’est récupérée ou configurée dans Admin.

Les [données et comparaisons](lot-1a-remote-reconciliation-current.json) conservent
les requêtes exactes, empreintes, différences brutes et limites. Le Lot 1A reste
**incomplet** et l’accès distant de l’application reste désactivé.

## Résultats

| Observation                                          | Résultat                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Migrations déclarées par projet                      | 70, listes et empreintes identiques entre Staging et Production      |
| Comparaison au relevé du 13 octobre                  | Identique pour les champs de migration sélectionnés                  |
| Entrées sans statements                              | 25 par projet ; leur texte historique reste inconnu                  |
| Statements archivés                                  | 65 dans les 45 autres entrées                                        |
| Fichiers locaux qualifiés                            | 64, empreintes intactes par rapport au rejeu SQL 64                  |
| Versions locales présentes dans l’historique distant | 35 ; cela ne prouve pas l’identité de leur SQL                       |
| Versions locales absentes de cet historique          | 29 ; cela n’autorise pas leur application aveugle                    |
| Candidats exacts après seule normalisation CRLF → LF | 0, dans Git HEAD comme dans l’arbre de travail                       |
| Candidats après trim extérieur supplémentaire        | 7 dans Git HEAD ; 6 dans l’arbre de travail actuel                   |
| Tables publiques distantes                           | 22 dans chaque projet ; `exercise_versions` absente dans les deux    |
| Métadonnées publiques comparées                      | 22 relations, 59 policies, 20 fonctions et 71 contraintes par projet |

La source Git NovLearn observée est `e41b7ae8a48956bf544c0c7e9836dbcd1373a892`,
branche `refactor/exercise-engine`. L’arbre qualifié inclut trois fichiers SQL
préexistants différents de ce HEAD : `010_taxonomy_chapters.sql`,
`022_chapters_uuid_and_competences_fix.sql`, `028_claude_exercises.sql`.
Ces fichiers sont **préservés**, pas remis à leur version Git pour obtenir un
meilleur rapprochement. La différence 7/6 porte sur la méthode/copie comparée,
pas sur une migration soudainement déclarée identique ou appliquée.

## Différences de représentation conservées

Les listes de colonnes/types/defaults empreintés, flags RLS, privilèges effectifs
SELECT/INSERT/UPDATE/DELETE de `anon`/`authenticated`, empreintes de policies et
de contraintes correspondent dans les champs sélectionnés. Les définitions
complètes de trois fonctions ont des MD5 bruts différents :

- `get_monthly_leaderboard` ;
- `get_random_exercise` ;
- `get_weekly_leaderboard`.

Le contrôle supplémentaire compare leurs corps après CRLF → LF et retrait
des seuls espaces/tabulations/fins de ligne extérieurs. Ces empreintes
correspondent ; les attributs sélectionnés, signatures, defaults et empreintes
de configuration correspondent également. Les hashes bruts et longueurs restent
différents et sont conservés. Aucun commentaire, littéral ou espace interne
n’est retiré pour fabriquer une égalité. Aucun changement de comportement
n’est déduit de la seule différence brute ; aucune équivalence globale des
deux bases n’est certifiée par ces rapprochements.

Les trois fonctions restent `SECURITY DEFINER` et exécutables par les deux
rôles API dans ce relevé. `get_weekly_leaderboard` n’a pas de configuration
`search_path` dans les attributs observés. Aucun appel de ces RPC métier,
exploit, édition de profil ou modification de privilège n’est exécuté.

## Requêtes reproductibles et limites

Les trois artefacts sont des **SELECT de métadonnées**, pas des migrations :

- [Empreintes des statements](lot-1a-migration-hashes-readonly.sql) ;
- [Catalogues publics](lot-1a-schema-metadata-readonly.sql) ;
- [Corps empreintés et attributs des trois fonctions](lot-1a-function-hashes-readonly.sql).

Le fichier documentaire de la première requête contenait un `+` parasite devant
`select`. Il est corrigé dans Admin. La requête SELECT correspondante est
réellement exécutée séparément dans les deux projets ; aucun succès d’exécution
de l’ancien fichier avec ce caractère n’est revendiqué.

Les métadonnées ne constituent ni un dump structurel complet, ni une restauration,
ni un gel de DDL ou un snapshot global des deux projets. Les triggers, séquences,
schémas privés, extensions, rôles/propriétaires complets, données et effets
historiques ne sont pas tous comparés. MD5 sert au rapprochement, pas à signer
un changement sensible. Les SHA-256 locaux conservent les octets qualifiés.

La panne Docker ne bloque pas ces lectures ; elle bloque toujours le rejeu ou
la vérification locale de nouveaux parcours connectés. Le changelog Supabase
a été consulté via sa [page HTML officielle](https://supabase.com/changelog)
après refus de son index Markdown par l’outil de lecture ; aucune dépendance,
configuration TLS ou version de projet n’est modifiée.

## Avant toute application distante

Obtenir les archives d’origine des 25 entrées sans statements, examiner les
autres différences SQL sous revue, puis préparer un plan de réconciliation
structurelle et de migrations explicite. Les identifiants ne seront ni
renommés ni supprimés pour masquer le désaccord. Un état vivant ne reconstitue
pas les statements historiques disparus.

Il reste ensuite à qualifier sauvegarde/restauration/PITR, compatibilité élève,
droits effectifs, runtime et procédure de retour sur l’environnement approuvé.
Une autorisation distincte est nécessaire pour toute écriture distante ; ce
rapport n’ouvre ni Auth Staging, ni capacité Production, ni publication réelle.
