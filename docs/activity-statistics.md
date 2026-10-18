# Statistiques d’activité — contrat et affichage préparatoires

Ce jalon prépare le contrat d’agrégats, les périodes et l’affichage du Lot 8.
**Il ne livre pas encore les statistiques réelles de Production.** Aucun pilote
Production, secret, rôle SQL, nouvelle migration ou route Admin n’est activé.
La navigation de l’application connectée n’ajoute pas une page vide en attente
de permissions. Le composant pourra être branché sur un lecteur qualifié.

## Périodes et contrat

Les filtres `from`/`to` utilisent des dates UTC, avec fin incluse dans le
formulaire et borne `until` exclusive dans le contrat. Ils couvrent 1 à 90 jours.
Sans filtre, trente jours calendaires jusqu’au jour UTC courant sont proposés.
Dates impossibles/futures, doublons, filtre partiel et paramètres inconnus sont
refusés ; la période n’est jamais tronquée silencieusement. Les filtres chapitre,
compétence, difficulté et type restent à implémenter après leurs jointures réelles.

Le décodage exige le schéma 1, l’environnement **attendu par l’appelant**, la
période attendue, des compteurs décimaux textuels jusqu’au bigint PostgreSQL,
une date de relevé valide et une série quotidienne complète/ordonnée. Les
champs supplémentaires, notamment profils, e-mails et identifiants d’utilisateurs,
sont refusés. Les additions restent en `BigInt` ; aucune conversion imprécise des
compteurs SQL en nombres JavaScript n’est utilisée.

Les totaux quotidiens doivent correspondre aux agrégats, sauf pour les comptes
actifs : un compte peut être présent plusieurs jours mais une seule fois sur la
période. L’environnement de démonstration `local-fixture` n’est pas accepté quand
l’appelant attend `production`. **Ce contrôle de format ne prouve ni l’origine
du relevé ni les permissions SQL** ; il ne remplace pas le futur lecteur sécurisé.

## Définitions à appliquer au futur lecteur

| Indicateur               | Définition et source nécessaires                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comptes présents         | Nombre de lignes Auth au moment du relevé ; ne pas le remplacer par un nombre de profils.                                                                     |
| Comptes anonymes         | Sous-ensemble `auth.users.is_anonymous IS TRUE`.                                                                                                              |
| Nouveaux comptes         | `auth.users.created_at` dans `[from, until)`, au plus jusqu’à l’heure du relevé. Une date NULL ne devient pas une création sur la période.                    |
| Comptes actifs           | Identités Auth encore présentes, ayant au moins une tentative d’exercice ou de duel datée dans la période ; anonymes inclus, sans double comptage.            |
| Tentatives d’exercice    | Lignes `exercise_attempts` dont `attempted_at` est connu et dans la période. Les lignes sans compte connu restent dans le volume, sans créer un compte actif. |
| Tentatives de duel       | Lignes `duel_attempts` selon `submitted_at`, avec la même règle de période.                                                                                   |
| Duels terminés           | Lignes `duels` au statut `finished`, selon `finished_at`, pas selon leur date de création.                                                                    |
| Réussite déclarée        | Positifs / (positifs + négatifs) enregistrés pour les tentatives non abandonnées et classées. Sans dénominateur, afficher « Non calculable ».                 |
| Catégories des exercices | Positifs, négatifs, abandons et non classés partitionnent les tentatives retenues. Une donnée manquante/ambiguë ne devient pas automatiquement un échec.      |

La réussite déclarée décrit le stockage ; elle ne certifie pas les verdicts
historiques. La provenance Engine des corrections nécessitera ses propres
preuves et, si utile, un indicateur distinct. Aucun état officiel `indeterminate`
n’est transformé en `incorrect` par ce module. Les timestamps NULL sont exclus
des volumes datés, jamais inventés à partir d’une autre colonne.

Les métadonnées Auth ont été lues séparément, sans compte ou donnée personnelle :
`id` UUID non nul, `created_at` timestamptz nullable et `is_anonymous` booléen non
nul sont présents dans les deux projets au relevé. Les colonnes de tentatives,
d’abandon et de duel proviennent du [relevé public](lot-1a-remote-reconciliation-current.md).
Cela ne donne aucune autorisation de lecture métier.

## Affichage et essai manuel

Inter, couleurs et cartes restent ceux du design existant. Les compteurs, le
taux et le graphique possèdent des libellés distincts ; le graphique est doublé
d’un tableau avec caption, en-têtes de colonnes et de lignes. La date du relevé
est annoncée en heure de Paris, les périodes et jours restent UTC. Une absence
ou incohérence de relevé affiche « Statistiques indisponibles », sans zéros ou
pourcentage fabriqués. Un relevé valide vide reste distinct d’une indisponibilité.

Ouvrir manuellement
`http://127.0.0.1:3140/tests/browser/statistics.html`. L’exemple est figé au
15–17 octobre 2026 et marqué **chiffres fictifs**. Il utilise le même décodage
et composant. Une autre période ne fabrique pas d’activité : elle affiche
l’absence de données de cet exemple. Aucun endpoint de base n’est appelé.

Les [preuves](activity-statistics-proof.json) distinguent les tests Node/SSR,
la compilation et les réponses HTTP des interactions navigateur non exécutées.
Le premier test de rendu a identifié un décalage entre la période décodée et
le contrat réentrant ; le format est unifié et l’idempotence du décodage est testée,
sans assouplir les champs acceptés.

Le contrôle complet du 18 octobre à 12:50 UTC passe **844 tests / 45 fichiers**,
avec intégrité Engine, types, lint, format, build et smoke HTTP. Les 39 tests
ajoutés portent sur ce contrat et le rendu serveur. Les onze pages du banc
compilent ; statut, HTML et module transformé de la page répondent en HTTP 200.
Ces réponses ne prouvent pas l’exécution du JavaScript dans un navigateur.
La recherche ciblée de 34 secrets ou noms privés dans 48 bundles applicatifs
et 23 bundles du banc ne trouve aucune correspondance ; elle n’est pas un audit
exhaustif de fuite. Les configurations et sources SQL protégées restent identiques.

## Travail restant pour les données réelles

Concevoir et qualifier une capacité distincte de publication et de consultation
nominative. Les policies restrictives locales destinées à PUBLIC imposent des
conditions d’identité : ajouter une policy permissive pour un nouveau rôle ne
suffit pas. Toute exception doit préserver les refus des clients existants ;
une fonction definer ne sera pas ajoutée pour simplement contourner cette règle.
Vérifier droits effectifs, héritage PUBLIC, ACL de fonctions, colonnes minimales,
TLS, limites de ressources, audit et cohérence de snapshot sur une copie.

Après qualification seulement : lecteur serveur, Auth/permissions fraîches,
route/page Admin, filtres restants, agrégations réelles et tests SQL/HTTP de
cohérence, de refus et de préservation des données. [D08](decisions.md#d08--champs-de-consultation-des-utilisateurs-v1)
retient nom, e-mail et activité pour la liste des utilisateurs ; cette capacité
nominative reste distincte des agrégats. Les [services locaux sont rétablis](local-recovery-2026-10-18.md).
L’absence de capacité SQL qualifiée et les agrégations réelles non implémentées
restent les prérequis de ce raccordement ; Docker n’est plus le blocage courant.
