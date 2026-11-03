# Architecture et contrats

Ce document décrit les responsabilités du code présent. Les capacités actives
et les limites de réception sont dans [l’état actuel](roadmap.md), les règles
fonctionnelles dans le [CDC](../CDC_reference.md).

## Application et frontières

NovLearn Admin est une application Next.js App Router full-stack distincte de
NovLearn élève, de son backend FastAPI/Colyseus et de l’ancien Creator.
[package.json](../package.json) fixe Next 15.5.28, React 18.3.1, TypeScript strict,
Tailwind 3, Supabase SSR et MathLive. Les polices Inter/Fredoka et les ressources
MathLive sont locales ; la référence visuelle reste
[system-design.md](system-design.md).

| Emplacement                                                      | Responsabilité                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/admin/`                                                 | Pages protégées : catalogue, Creator, référentiel, dashboard, statistiques et publication |
| `src/app/api/admin/`                                             | Routes contrôlées : entrées bornées, session/rôle serveur et projection des réponses      |
| `src/components/`                                                | Formulaires, saisie MathLive, rendus et interactions navigateur                           |
| `src/lib/auth/`                                                  | Configuration, client serveur Supabase et autorisations                                   |
| `src/lib/creator*`, `catalogue*`, `taxonomy.ts`, `flashcards.ts` | Contrats d’édition et accès Staging                                                       |
| `src/lib/engine-*`, `preview*`, `test-receipt*`, `review.ts`     | Identité du moteur, calcul officiel, aperçu, reçus et relecture                           |
| `src/lib/publication*`                                           | Préparation, confirmation, transfert sélectif, journal et reprise                         |
| `src/lib/*-pg.ts`, `*-config.ts`                                 | Capacités PostgreSQL et lecteurs spécialisés                                              |
| `scripts/`, `tests/`                                             | Contrôles SQL/HTTP/Engine, bancs isolés et tests de contrats/permissions                  |

Le navigateur gère la saisie et l’affichage. Le serveur vérifie l’identité et les
droits, lit Staging et appelle Engine. Les informations de correction privées
ne doivent jamais passer dans une projection élève. Les secrets restent côté
serveur ; voir [Auth et configuration](auth.md).

Staging porte Auth Admin, brouillons et référentiel. Production est une frontière
séparée pour les lectures minimisées et la publication approuvée. Les lecteurs
statistiques/utilisateurs actuellement raccordés dans le code concernent des
copies locales, pas une connexion Production établie.

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

Le parcours relie brouillon, tests, demande de relecture, approbation humaine et
publication. Les statuts SQL effectifs sont portés par les contrats et RPC ; la
formulation cible du CDC ne prouve pas l’activation de chaque étape.

La récupération Creator est facultative, désactivée par défaut, dans le
`sessionStorage` de l’onglet : 30 minutes depuis la dernière écriture, 256 Kio,
choix explicite de restaurer ou d’effacer. Elle contient les attendus privés et
n’est pas chiffrée. Elle ne restaure ni diagnostic, ni rapport, ni approbation.
Une référence modifiée prépare une nouvelle révision au lieu d’écraser la version
courante. Un refus d’effacement est signalé ; fermer l’onglet si nécessaire.
La restauration de session navigateur peut conserver physiquement la copie plus
longtemps que sa durée de récupération autorisée.

## Engine officiel

Le [contrat de bibliothèque et de distribution](engine-library.md) formalise
les exports supportés, les identités distinctes, les diagnostics et la mise à
jour coordonnée. Le manifeste est externe à l'archive qualifiée, conservée intacte.

L’archive consommée est [le tarball versionné](../vendor/novlearn-exercise-engine-0.1.8.tgz),
package 0.1.8, contrat `schema-5;engine-0.1.0`, Cortex 0.151.0. L’identité exacte,
y compris le SHA256, est définie dans
[engine-identity.ts](../src/lib/engine-identity.ts) et vérifiée par
[verify-engine-package.mjs](../scripts/verify-engine-package.mjs), avec le lockfile
et le fichier installé. Une même version npm ne suffit pas à identifier le build.

[engine-runtime.ts](../src/lib/engine-runtime.ts) appelle le host officiel côté
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
0.1.8 ajoute un échantillonnage optionnel des courbes à la projection publique,
mais l’adaptateur Admin ne l’active pas encore et l’aperçu signale le tracé comme
incomplet. Les sources 0.2.0 des preuves D10 ne sont pas adoptées dans ce dépôt ;
leurs résultats partiels et leurs échecs restent distingués dans
[Vérifications](verification.md).

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
ayant une tentative datée sur la période, anonymes inclus et dédupliqués ; ils ne
sont pas le nombre de comptes créés. Les dates manquantes ne sont pas inventées.

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

Le bundle ciblé `supabase/rollouts/20261021115604_novlearn_admin_staging_core.sql`
a été appliqué à Staging sous la version `20261021120707`, selon la
[qualification conservée](archives/staging-sql-qualification-2026-10-21.json).
Ce bundle est adapté à une baseline vivante ; ne pas l’ajouter au rejeu neuf ni
le rejouer aveuglément. Son SHA256 est dans la preuve, pas recopié ici.

Les tentatives historiques sans version restent sans version connue : ne pas
leur attribuer arbitrairement le contenu courant. La compatibilité des lecteurs
élèves et du stockage/rejeu d’instances reste une porte distincte. Une publication
de contenu ne déclenche ni migration SQL ni déploiement de code.
