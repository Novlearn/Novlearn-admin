# Reprise locale du 15 octobre 2026

Le goal est **incomplet**. Son état lu par `get_goal` est `blocked` ; cet état
persistant n'empêche pas la reprise manuelle demandée par l'utilisateur.
Aucune écriture dans l'état interne de Codex ni tentative de forcer sa reprise.

## Cause du dernier arrêt

Le journal de la conversation contient trois fins de tour avec
`codex_error_info: cyber_policy`, à **06:49:15, 06:50:10 et 06:54:04 UTC**.
Le message commence par « This content was flagged for possible cybersecurity
risk ». C'est la restriction de sécurité identifiée, distincte d'un refus
d'approbation de commande. Le journal ne révèle pas le détail du classement
ni quelle instruction précise l'a déclenché : ne pas l'inventer.

L'activité en cours était l'audit des permissions indirectes du rôle de
publication. Son dernier script local avait aussi une erreur technique :
`psql` était lancé avant que PostgreSQL soit prêt, puis le conteneur était
arrêté. Ce premier essai ne constituait donc aucun résultat de sécurité.
Une reproduction locale synthétique a confirmé un défaut de permission lors
de cette reprise, avant la découverte des trois notifications dans le journal.
Sa transaction a été annulée. **Aucune répétition de cette reproduction n'a
été effectuée après identification de la restriction.**

La suite reste limitée à la correction défensive, à la lecture des droits et
aux workflows ordinaires. Pour refaire la vérification concernée avec Codex,
utiliser l'accès autorisé indiqué par la notification
[Daybreak](https://platform.openai.com/settings/organization/status-and-access),
ou solliciter le support si le classement semble erroné. Aucun changement de
modèle, de protection ou reformulation destinée à éluder le contrôle.

L'ancien refus Windows Code Integrity concernait un artefact Engine antérieur.
La [certification Linux retenue](lot-1a-engine-linux-certification.md) reste
distincte. Le refus Git « dubious ownership » dans NovLearn a été résolu par
une lecture autorisée sous le compte propriétaire, sans exception globale.

## Correction et vérifications de cette reprise

La nouvelle migration locale NovLearn
`20261015070343_novlearn_admin_friend_trigger_scope.sql` fixe `search_path`,
restreint le contexte aux tables/opérations/triggers attendus et révoque les
droits directs sur deux fonctions historiques de trigger. Aucun trigger n'est
supprimé ; leurs traitements métier restent identiques. La migration a été
créée par la CLI Supabase et appliquée uniquement à une **nouvelle copie** de
la base synthétique de publication, puis sauvegardée/restaurée localement.

Résultats réellement exécutés pendant cette reprise :

- Six groupes de contrôles de droits et workflows normaux passent sur la copie
  corrigée, puis sur sa restauration : dix combinaisons rôle/fonction, absence
  d'EXECUTE privilégié pour les deux rôles de publication, `search_path`,
  création Auth/profils/codes d'amis, attente puis acceptation par le destinataire.
- Les **58 tables** conservent exactement leurs lignes/empreintes lors de la
  migration et après annulation des fixtures. La restauration conserve aussi
  ces lignes. Les séquences ne sont pas comparées dans ces nouvelles preuves ;
  les tests annulés peuvent consommer `nextval` dans leurs seules copies.
- Régressions SQL : **48 catalogue, 21 reçus, 43 relecture** passent sur la
  copie corrigée. La première lecture de leur sortie a échoué dans le nouveau
  wrapper, qui attendait des NOTICE au lieu du JSON existant ; seul le lecteur
  de résultat a été corrigé, aucune assertion ni attente SQL n'a changé.
- Les **9 tests de publication** passent ; syntaxe Node des trois scripts,
  lint sans erreur, format et empreinte/archive/lockfile Engine passent.
  Le lint garde un avertissement `<img>` préexistant dans le banc navigateur.
- Les 51 migrations historiques, six fichiers protégés dont `.env.example`,
  CDC/design/corpus, et dix fichiers source Engine gardent leurs empreintes.

Les [preuves datées antérieures](publication-capability-local-proof.json)
restent valables dans leur périmètre : rejeu neuf de **55 migrations**,
**50 contrôles de transfert**, cinq de capacité restaurée, **221 tests Admin**,
build/smoke, sécurité historique et certification Engine. Ces suites complètes
n'ont **pas** été rejouées dans cette reprise. La nouvelle migration est
vérifiée incrémentalement ; **aucun rejeu neuf de 56 migrations, certification
complète du confinement ou nouveau test adversarial n'est annoncé**.
Voir les [preuves de reprise](goal-recovery-local-proof.json).

## État Git et suite

Au début de la reprise, Admin est sur `main` à `233ee3a` : Auth, catalogue,
Creator, aperçu/tests, reçus et relecture ont leurs commits locaux.
Les travaux de fondation publication restent non committés à ce point :
codec/diff, neuf tests, fixtures, scripts et documentation. La modification
préexistante `.env.example` est conservée, sans l'inclure dans ces travaux.

NovLearn est sur `refactor/exercise-engine` à `f036c5c`, qui contient la
migration 55 de capacité publication. Ses autres modifications historiques
(frontend, README, gitignore, SQL 010/022/028 et dossiers d'audit) sont conservées.
La nouvelle migration défensive est le seul nouveau changement dans ce dépôt.
Elle est committée localement sous `a07ad98`. La fondation publication et le
dossier de reprise Admin sont enregistrés dans un commit local dédié ;
`.env.example` reste la seule modification Admin préexistante hors commit.
Le contrôle global `git diff --check` relève son blanc final préexistant ; ce
fichier n'est pas corrigé silencieusement. Le contrôle du diff à committer
porte uniquement sur les travaux de cette reprise et de la fondation.

Le service de publication, la protection de la source jusqu'au commit cible,
le journal durable/reprise après résultat incertain et les écrans de confirmation
individuelle/groupée restent à réaliser. La réception complète du Creator et
du rendu avancé reste ouverte, puis chapitres/compétences, flashcards,
dashboard/statistiques et utilisateurs réels selon leurs permissions.

Avant toute application distante : réconciliation de l'historique SQL,
qualification complète de l'arbre final, sauvegarde/PITR réel, compatibilité
du lecteur élève, comptes et secrets distincts, qualification de l'hébergement
Engine et accord explicite pour migrations/publication/déploiement. L'activation
Auth et la publication restent fermées ; le Lot 1A n'est pas déclaré terminé.

La reprise automatique du goal se gère dans Codex, sans modifier ses fichiers
internes : voir la [documentation officielle des Goals](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).
Les outils disponibles ici ne permettent pas de passer un goal de `blocked`
à `active`. Le travail manuel demandé a cependant repris et produit les
résultats ci-dessus. Aucune donnée existante supprimée, aucun push, déploiement
ou changement distant.
