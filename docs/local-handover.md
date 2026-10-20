# Réception locale et conditions de mise en service

## Ce qui est disponible

L’[application locale](http://127.0.0.1:3150/login) permet de tester le catalogue,
le Creator, MathLive, les calculs Engine Linux, les sauvegardes, les référentiels,
les statistiques et les utilisateurs synthétiques. Les identifiants restent dans
le fichier privé indiqué par le [guide d’essai](local-user-testing.md).
La publication ordinaire reste fermée ; son banc de qualification est séparé.

Le commit `4ab94d1` conserve la dernière réalisation fonctionnelle : deux
compteurs, huit rapports SQL/TLS/HTTP, 28 mesures de charge et contrôle général
de 1 432 tests / 75 fichiers, build et smoke réussis. La nouvelle expiration
naturelle de 3 600 secondes passe. Voir les [preuves](completed-work-local-proof.json).
Le [parcours court](local-reception-2026-10-20.md) est ensuite accepté par
l’utilisateur ; la réception plus large garde ses contrôles distincts.

## Actions qui restent nécessaires

| Étape                   | Travail concret                                                                                                                                                                    | Condition pour avancer                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Réception locale        | Sur 3150 : connexion, brouillon, fraction MathLive, sauvegarde/réouverture ; puis aperçu Engine, clavier, focus, mobile et récupération d’une saisie selon le guide                | Parcours court accepté ; réception élargie restante. Le pilotage automatisé précédemment refusé reste respecté                         |
| Historique SQL          | Archives001–025 identifiées dans Novlearn ; rapprocher leur provenance et les écarts du schéma vivant                                                                              | Le relevé élargi du 20 octobre et les archives ne suffisent pas, seuls, à qualifier un delta distant sûr                               |
| Exploitation Staging    | Choisir l’hôte, le premier Admin, la politique MFA/récupération, les identités PG distinctes et le stockage des secrets ; qualifier sauvegarde/restauration et compatibilité élève | Dossier et autorisation propres à Staging ; aucune clé privilégiée générale utilisée comme lecteur limité                              |
| Staging puis Production | Revoir les changements réellement nécessaires après réconciliation, faire valider le plan et ses vérifications ; qualifier Staging avant de proposer Production                    | Accords explicites et séparés ; pas d’application automatique des fichiers locaux, de réparation d’historique ou de publication réelle |

Les courbes de formules restent signalées comme indisponibles : le contrat
Engine fournit des formules non vérifiées sans points calculés. Les figures,
vecteurs et points prescrits sont distincts. Toute extension du contrat Engine
demande une proposition et une autorisation séparées ; aucun calcul parallèle
n’est introduit dans Admin. Le périmètre initial demande justement de signaler
les types dont le renderer est incomplet.

## Avertissements SQL : portée du relevé

Le [classement vérifiable](sql-findings-triage.json) reprend le relevé CLI 2.98.2
du 20 octobre sur la **copie SQL 71**, sans relancer les advisors ni modifier SQL.
Il distingue 30 avertissements de catégorie PERFORMANCE : 14 évaluations Auth
répétées dans les policies et 16 chevauchements de policies permissives. Ces
16 constats concernent trois tables, dont 14 combinaisons de rôle sur les
flashcards ; ils ne représentent pas 16 défauts indépendants de schéma.

Les 67 informations comprennent 24 clés étrangères sans index couvrant,
37 index inutilisés dans cette copie synthétique et six tables avec RLS sans
policy. Aucun index n’est supprimé à partir de cette observation limitée.
Pour ces six tables, le comportement de refus par défaut doit être rapproché
des chemins privilégiés et de leurs droits réels ; aucune policy publique
n’est ajoutée pour supprimer un message. PostgreSQL distingue les rôles usuels,
le propriétaire et les rôles qui contournent RLS.
[Contrat RLS PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Le niveau et la catégorie décrivent les règles exécutées, sans certification
globale de sécurité. Supabase recommande de confronter les constats au modèle
d’accès avant toute modification.
[Documentation Advisors](https://supabase.com/docs/guides/observability/advisors).
Les qualifications locales existantes restent valables pour leurs seules copies
et scénarios. La cible applicative SQL 70 conserve son ancien relevé distinct de
33 avertissements ; aucun résultat de la copie SQL 71 ne lui est attribué.

Les optimisations SQL peuvent donc être examinées séparément de la réception
locale, sans prolonger artificiellement celle-ci jusqu’à obtenir zéro message.
La performance de la requête pédagogique a ses propres mesures sous une limite
inchangée de dix secondes ; elles ne remplacent pas une qualification de charge
sur l’hôte et les données cibles.

Le goal complet reste ouvert. Aucun nouvel accord distant, résultat navigateur,
succès SQL ou déploiement n’est déduit de ce document.
