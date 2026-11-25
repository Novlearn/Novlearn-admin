# Architecture et contrats

Architecture activée le 8 novembre après confirmation explicite : lectures
Production par API Supabase, clé publique et session Admin Production soumise
aux RLS. Une connexion vérifie séparément les rôles Staging et Production.
Le serveur sur le port 3000 utilise le build API qualifié ; voir
[le contrat de lecture Production](production-api.md).

Ce document décrit les responsabilités du code présent. Les capacités actives
et les limites de réception sont dans [l’état actuel](../roadmap.md), les règles
fonctionnelles dans le [CDC](../../CDC_reference.md).

## Application et frontières

NovLearn Admin est une application Next.js App Router full-stack distincte de
NovLearn élève, de son backend FastAPI/Colyseus et de l’ancien Creator.
[package.json](../../package.json) fixe Next 15.5.28, React 18.3.1, TypeScript strict,
Tailwind 3, Supabase SSR et MathLive. Les polices Inter/Fredoka et les ressources
MathLive sont locales ; la référence visuelle reste
[proposition d’identité visuelle](../proposals/visual-identity.md).

| Emplacement                                                      | Responsabilité                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/admin/`                                                 | Pages protégées : catalogue, Creator, référentiel, dashboard, statistiques et publication |
| `src/app/api/admin/`                                             | Routes contrôlées : entrées bornées, session/rôle serveur et projection des réponses      |
| `src/components/`                                                | Formulaires, saisie MathLive, rendus et interactions navigateur                           |
| `src/lib/auth/`                                                  | Configuration, client serveur Supabase et autorisations                                   |
| `src/lib/creator*`, `catalogue*`, `taxonomy.ts`, `flashcards.ts` | Contrats d’édition et accès Staging                                                       |
| `src/lib/engine-*`, `preview*`, `test-receipt*`, `review.ts`     | Identité du moteur, calcul officiel, aperçu, reçus et relecture                           |
| `src/lib/publication*`                                           | Préparation, confirmation, transfert sélectif, journal et reprise                         |
| `src/lib/production-api*`                                        | Lectures API Production et vérification de sa session Admin                               |
| `src/lib/*-pg.ts`, `*-config.ts`                                 | Lecteurs des copies PostgreSQL locales et sélection contrôlée de la source                |
| `scripts/`                                                       | Préparation/build Engine, aides locales et requêtes SQL utilisées par les lecteurs Admin  |
| `tests/`                                                         | Tests Vitest des contrats, permissions et rendus serveur                                  |

Le navigateur gère la saisie et l’affichage. Le serveur vérifie l’identité et les
droits, lit Staging et appelle Engine. Les informations de correction privées
ne doivent jamais passer dans une projection élève. Les secrets restent côté
serveur ; voir [Auth et configuration](./auth.md).

Staging porte Auth Admin, brouillons et référentiel. Production est une frontière
séparée pour les lectures minimisées et la publication approuvée. Les lecteurs
statistiques/utilisateurs acceptent désormais une configuration Production
explicite par API Supabase avec une session Admin Production. Les copies locales
restent isolées ; aucune configuration Production invalide ne retombe sur une
copie. Le [contrat de lecture](./production-api.md) décrit les RPC en mode invoker,
les rôles vérifiés dans chaque projet et leurs tests. Les RLS du site et celles de
l'Admin ont des noms distincts et évaluent l'identité authentifiée. Les comptes Auth passent par une projection
privée minimale, dont les colonnes, le propriétaire et la définition sont contrôlés.

## Exercices et cycle éditorial

Le modèle retenu sépare l’identité stable dans `public.exercises` et les
révisions dans `public.exercise_versions`. Le `bigint` historique est propre à
chaque base ; la correspondance de publication repose sur l’identité de catalogue
`catalog_id`, jamais sur une égalité supposée des IDs.

Le contenu historique ne devient pas canonique par simple lecture ou sauvegarde.
Le Creator produit des définitions du contrat Engine schéma 5 : paramètres,
contraintes, éléments, questions et politiques de correction. MathLive saisit le
LaTeX ; il ne génère ni ne corrige les exercices. L’éditeur propose les 20 types
d’éléments du contrat, sans que cela prouve une réception visuelle complète de
chacun. Sauvegarde de brouillon et validation mathématique sont distinctes.

Les changements sont protégés par empreinte et `test_epoch`, avec refus des
conflits. Une version publiée est immuable ; la suite passe par une nouvelle
révision. Un rapport ou une approbation ne reste pas courant après modification,
changement d’époque ou d’archive Engine. Les anciens reçus restent lisibles et
ne doivent pas être réétiquetés comme résultats du nouveau moteur.

Le Creator permet d'enregistrer en brouillon ou d'approuver la révision dans
Staging au moment de la sauvegarde. Les tests restent disponibles à la demande.
La synchronisation vers Production est une action distincte.

La liste et la fiche affichent en priorité le titre destiné à l’application.
Les underscores sont remplacés par des espaces à l’affichage, y compris quand
seul le titre interne est renseigné. Les identifiants et titres stockés restent
utilisés par les contrats existants.

L’éditeur présente le titre élève et conserve les deux titres d’une définition
existante tant que ce champ n’est pas modifié. L’aperçu et la sauvegarde
utilisent la même définition préparée. L’enregistrement d’un brouillon cible
sa révision et son empreinte. Depuis une révision en lecture seule, l’action
« Créer une nouvelle révision » ouvre l’éditeur sur une copie de sa définition
et sauvegarde un nouveau brouillon sur l’identité d’exercice existante.
La pagination de l’historique conserve la révision consultée.

Le 24 novembre 2026, le responsable a demandé une fiche de révision centrée
sur l’édition, la prévisualisation, la vérification et l’historique des versions.
Le JSON, les rapports enregistrés et la relecture humaine sont retirés de la
fiche. La vérification utilise les mêmes tirages par défaut et conserve le
contrôle des réponses incorrectes. Les signatures et les données de test
existantes restent disponibles aux services qui les utilisent.

Dans le texte, Engine interprète `@b` comme une référence à la valeur générée
`b`. Dans un champ de formule du Creator, le menu affiche `@b` et insère
`\mathrm{b}` dans le LaTeX canonique. Le choix « Type de réponse » maintient
ensemble le format de saisie et le domaine de correction. Les règles
complémentaires sont accessibles selon le type choisi.

Le sélecteur de chapitre reconnaît le nom, les alias et les identifiants du
référentiel Staging. Lors d'une sauvegarde, le serveur transforme un identifiant
reconnu en nom de chapitre. Une référence absente ou ambiguë nécessite un choix
explicite. Les compétences choisies sont indépendantes du chapitre principal.

Le Creator édite les indications et corrections expliquées dans les paramètres
des questions et des QCM. Le contrat Engine conserve les éléments `hint` et
`explanation`, reliés par `questionId`. Les éléments globaux existants restent
éditables dans la liste. L'Engine exclut ces contenus de sa projection publique.
`extensions.legacy` et `extensions.legacyPath` restent dans les données pour
retracer l'import. Le Creator les masque dans le formulaire d'édition.

Dans le catalogue Admin, une révision en relecture s’affiche comme « Brouillon »
et le statut `ready` du contrat de synchronisation comme « Approuvé ».
Le filtre « Approuvé » inclut les statuts `ready` et `approved`. L’Admin
parcourt les pages de la RPC du catalogue pour appliquer ce filtre, tout en
gardant la recherche et le tri choisis. La page Synchroniser le catalogue liste
les révisions prêtes et leurs dépendances. Après réception du reçu de
synchronisation Production, la finalisation enregistre `published` sur la
révision source. Le filtre « Publié » lit ce statut dans Staging. Le reçu et
la version active de Staging restent consultables dans leurs vues respectives.
Les anciennes révisions transférées dans Staging peuvent aussi porter
`published`. Les 111 exercices concernés ont désormais une révision locale
plus récente au statut `ready`.

L'action **Enregistrer et approuver** appelle `admin_save_and_approve_exercise`.
La RPC Staging sauvegarde la révision et l'approuve dans la même transaction.
Elle confirme que l'empreinte d'approbation rend la révision éligible à la
synchronisation. La [proposition SQL](../proposals/admin-save-and-approve-exercise.sql)
rétablit cette empreinte dans le déclencheur Staging et ajoute la RPC. Sa
mise en service relève du dépôt canonique NovLearn.

La récupération Creator est facultative, désactivée par défaut, dans le
`sessionStorage` de l’onglet : 30 minutes depuis la dernière écriture, 256 Kio,
choix explicite de restaurer ou d’effacer. Elle contient les attendus privés et
n’est pas chiffrée. Elle ne restaure ni diagnostic, ni rapport, ni approbation.
Une référence modifiée prépare une nouvelle révision au lieu d’écraser la version
courante. Un refus d’effacement est signalé ; fermer l’onglet si nécessaire.
La restauration de session navigateur peut conserver physiquement la copie plus
longtemps que sa durée de récupération autorisée.

## Engine officiel

Le [contrat de bibliothèque et de distribution](../engine/engine-library.md) formalise
les exports supportés, les identités distinctes, les diagnostics et la mise à
jour coordonnée. Le manifeste est externe à l'archive qualifiée, conservée intacte.

L’archive consommée est [le tarball versionné](../../vendor/novlearn-exercise-engine-0.2.3.tgz),
package 0.2.3, contrat `schema-5;engine-0.1.0`, Cortex 0.151.0. L’identité exacte,
y compris le SHA256, est définie dans
[engine-identity.ts](../../src/lib/engine-identity.ts) et vérifiée par
[verify-engine-package.mjs](../../scripts/verify-engine-package.mjs), avec le lockfile
et le fichier installé. Une même version npm ne suffit pas à identifier le build.

[engine-runtime.ts](../../src/lib/engine-runtime.ts) appelle le host officiel côté
serveur. Le profil qualifié est Linux cgroup v2 : 384 Mio, aucun swap
supplémentaire, 64 processus, utilisateur non privilégié, réseau absent, racine en
lecture seule, capacités retirées et aucun nouveau privilège. Le délai natif
reste cinq secondes ; une opération active et quatre en attente. Le transport
local permet de joindre ce worker depuis le frontend Windows sous gardes
explicites. **Aucun évaluateur de secours dans Admin.**

`isEngineEnabled` refuse Vercel, même si `ADMIN_ENGINE_ENABLED=true`. Installer
l’archive ou réussir un build n’établit pas l’existence d’un hôte qualifié.
La certification d’un package ne se transfère pas à un nouvel hébergement.

L’aperçu conserve les snapshots privés dans la mémoire du processus : dix minutes,
deux par Admin, 32 au total, 512 Kio chacun. Le navigateur reçoit une projection
publique et une référence opaque ; l’inspection des attendus exige un contrôle
séparé. La correction utilise le snapshot serveur, jamais une instance fournie
par le client. Une référence expirée ou perdue au redémarrage produit un refus 410. Plusieurs processus exigent une stratégie privée partagée ou une affinité
qualifiée avant réception.

Les tests multi-seeds vérifient génération, rejeu identique, projection, attendus,
formats invalides et cas incorrects explicites. Leur réussite n’est pas une
validation humaine. Les reçus persistés ajoutent une signature liée à la version,
à l’empreinte, à l’époque et à l’archive exacte.

Le rendu de coordonnées publiques couvre notamment figures et vecteurs. Engine
0.1.8 a ajouté un échantillonnage optionnel des courbes à la projection publique,
mais l’adaptateur Admin ne l’active pas encore et l’aperçu signale le tracé comme
incomplet. Les sources 0.2.0 des preuves D10 ne sont pas adoptées dans ce dépôt ;
leurs résultats partiels et leurs échecs restent distingués dans
[Vérifications](./verification.md).

## Publication et reprise

Seul le contenu métier approuvé de `exercises` et `exercise_versions` peut passer
vers Production. Il s’agit d’une projection autorisée, jamais d’un `SELECT *` ou
d’une copie de base. Les références aux chapitres, compétences et ressources
exigent un contrôle : ces tables ne sont pas publiées avec les exercices.
Auth, profils, tentatives, duels, statistiques, flashcards, feedbacks et
`exercises_claude` sont exclus. Une absence Staging ne supprime rien en Production.

Le service relit la source approuvée, les permissions et les reçus courants,
refait les contrôles Engine, calcule le diff, puis exige une confirmation signée.
Les identités SQL du journal source et d’écriture cible sont distinctes ; les
connexions sont privées et vérifiées avec TLS. La cible applique une transaction
idempotente et produit un résultat observable. La finalisation source conserve
statut, pointeur et journal ensemble. Un rollback réactive explicitement une
ancienne version publiée sans réécrire les révisions ni les tentatives liées.

Le journal distingue `planned`, `executing`, `uncertain`, `committed`, `failed`
et `cancelled`. Une issue incertaine conserve la protection durable de la source.
Un timeout ne prouve ni l’échec ni le succès : observer la cible avant toute
répétition. L’annulation d’un plan préparé n’annule pas une transaction engagée.
Les lots gardent un résultat par exercice ; une reprise ne réapplique pas les
succès déjà établis. Les preuves locales de ce pipeline ne prouvent pas une
publication distante.

## Indicateurs et données historiques

Le dashboard catalogue compte les identités, utilise la dernière révision pour
le statut éditorial et donne priorité à l’archive. Le pointeur `active_version_id`
est distinct de `MAX(revision)` : un nouveau brouillon ne remplace pas une version
publiée active. « Tests en échec » désigne le dernier reçu courant échoué, pas
l’absence de reçu. Les cinq versions actives récentes ne sont pas un journal de
transferts.

Les statistiques d’activité utilisent des périodes UTC de 1 à 90 jours,
`[from, until)`. Les tentatives suivent `attempted_at` ou `submitted_at`, les duels
terminés `finished_at`. Les comptes actifs sont les identités Auth encore présentes
non invités ayant une tentative datée sur la période, dédupliqués ; ils ne
sont pas le nombre de comptes créés. Les dates manquantes ne sont pas inventées.

Décision du 8 novembre : les invités sont exclus du stock de comptes, des
créations, de la liste des utilisateurs et de tous les volumes et taux généraux
ou pédagogiques. Les tentatives sans compte encore présent sont aussi exclues.
Les duels terminés exigent deux participants inscrits ; la tentative d'un inscrit
contre un invité reste une activité de cet inscrit.

La réussite enregistrée vaut `correct / (correct + incorrect)`, abandons exclus ;
sans dénominateur, elle est non calculable. Elle ne certifie pas les verdicts
historiques. Les deux compteurs décidés sont les exercices distincts traités
hors abandons et les réponses terminées avec répétitions. Une réponse sans ID
d’exercice compte seulement dans le second.

Les regroupements pédagogiques utilisent les métadonnées actuelles, pas une
reconstitution historique. Une tentative multi-compétences peut figurer dans
plusieurs groupes mais une seule fois dans les totaux. Références inconnues,
valeurs absentes et rapprochements ambigus restent explicites. Les compteurs SQL
sont des chaînes décimales traitées avec `BigInt`. Une panne de lecture affiche
« indisponible », jamais des zéros fabriqués. La consultation nominative retenue
porte sur nom, e-mail et activité, avec progression/historique minimisés.

## Schéma et migrations

L’historique canonique appartient au dépôt NovLearn ; Admin conserve les contrats,
audits et outils de contrôle, sans deuxième suite concurrente de migrations.
Les preuves de rejeu **SQL71 local** et les **71 entrées distantes après bundle
Staging** ne désignent pas nécessairement les mêmes fichiers SQL.

Les bundles SQL ciblés sont adaptés à une baseline vivante ; ne pas les ajouter
au rejeu neuf ni les rejouer aveuglément. Vérifier l’état réel de la cible et les
migrations existantes avant toute opération distante.

Les tentatives historiques sans version restent sans version connue : ne pas
leur attribuer arbitrairement le contenu courant. La compatibilité des lecteurs
élèves et du stockage/rejeu d’instances reste une porte distincte. Une publication
de contenu ne déclenche ni migration SQL ni déploiement de code.
