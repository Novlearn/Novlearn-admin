# Adoption locale du correctif Engine — 17 octobre 2026

**Le build qualifié est maintenant utilisé par l’Admin connecté sur le port 3150.** La connexion, le catalogue, les rapports natifs et la relecture passent
avec SQL 64. Les comptes et identifiants existants restent valides. La publication
et les accès distants restent désactivés ; le goal n’est pas terminé.

## Changement coordonné

La migration `20261017171853_novlearn_admin_engine_archive_rotation.sql`, créée
avec l’outil local du dépôt NovLearn, appartient au commit SQL
`e41b7ae8a48956bf544c0c7e9836dbcd1373a892`. Elle remplace l’empreinte des nouveaux
reçus et du registre privé, et exige des tests du build courant pour une nouvelle
relecture ou un export. Elle conserve les identités, propriétaires, droits et
attributs des trois RPC, notamment la traduction des conflits HTTP `PT409`.

La rotation refuse une publication activée, une opération en exécution ou
incertaine, un contrat inattendu, un corps RPC divergent et une seconde
application. Le journal est verrouillé pendant la transaction. Aucun rapport,
reçu, événement, statut d’approbation ou contenu historique n’est réécrit.
Un ancien reçu reste lisible ; sa réémission est refusée. Une approbation ancienne
doit être renvoyée à corriger, retestée puis relue explicitement avant export.
Les révisions publiées restent immuables.

L’Admin consomme l’archive exacte `d4d3abc4…a582f9` de la
[qualification Engine](engine-numeric-cache.md), sans nouveau packaging.
Le vérificateur contrôle aussi le fichier installé, pour éviter de conserver
un ancien package ayant le même nom et la même version. Les signatures utilisent
l’identité centrale. Le lanceur et la configuration Auth épinglent le manifeste
des 64 SQL ; aucune liste de compatibilité ou activation distante n’est ajoutée.

L’historique affiche les succès anciens comme historiques et demande de relancer
les tests. Le formulaire de relecture ne présente plus un ancien build comme un
reçu courant. SQL reste l’autorité de contrôle. Les captures SQL/Engine antérieures
des tests sont conservées ; deux suites d’orchestration utilisent une adaptation
de métadonnées explicitement synthétique, sans prétendre à une publication neuve.

## Vérifications exécutées

La [preuve](engine-admin-adoption-proof.json) donne les empreintes et artefacts.

- Rejeu neuf de **64 migrations** avec les vraies migrations Auth, sans réseau.
- Sur schéma neuf : **21 assertions reçus et 43 assertions relecture**.
  Sur copie restaurée de SQL 63 : **15 assertions de rotation** et les refus
  de migration ci-dessus. Les données de 61 tables restent exactement identiques ;
  dans la 62e, seul le champ d’empreinte du registre privé change.
- L’instance conservée est sauvegardée puis mise à niveau après arrêt de ses seuls
  services applicatifs. Les 62 tables sont comparées, les attributs RPC conservés
  et la clé de signature inchangée. Les services sont redémarrés.
- Bootstrap neuf SQL 64 avec connexion Auth et lecture PostgREST réelles,
  puis arrêt des seuls nouveaux services en conservant leurs données.
- **735 tests Admin / 42 fichiers**, intégrité archive/installation/lockfile,
  types, lint sans erreur, format, build et smoke standalone passent.
  L’avertissement image du banc visuel préexistant reste présent.
- **16 contrôles connectés de relecture** : nouvelles identités synthétiques,
  quatre rapports natifs dont un échec attendu, six événements de relecture
  marqués comme automatisés, permissions et conservation des lignes préexistantes.
- **8 contrôles connectés supplémentaires** : vraie session du compte d’essai
  existant, catalogue, génération de la définition avancée complète à sept éléments
  pour les seeds 0/42, mêmes éléments publics que les captures historiques,
  brouillon marqué, rapport natif complet signé et enregistré sous la nouvelle
  empreinte, affichage courant et conservation exacte des 13 reçus préexistants.
  Les cas correct/incorrect/invalide, la reproductibilité et la projection sûre
  passent ; aucune attestation humaine ou publication n’est déduite de ces tests.
- Inspection du worker réellement utilisé : 384 MiB, swap supplémentaire nul,
  64 pids, UID 65534, racine en lecture seule, toutes capacités retirées,
  `no-new-privileges`, aucun réseau ni port publié. Les délais restent inchangés.

Les temps HTTP de génération incluent le serveur et la projection ; la durée
de rapport conservée dans l’artefact inclut aussi ses vérifications de relecture.
Ils ne remplacent pas les mesures d’instanciation natives de la qualification.

## Reproduction locale

Avec le rejeu SQL 64 arrêté et la sauvegarde privée SQL 63 conservée :

```powershell
node scripts/qualify-engine-rotation-local.mjs --source-container novlearn-admin-lot1a-replay-20261017171950360 --baseline-dump .local/lot1a/engine-adoption-1792257903984/database-before-64.dump
```

Ce script crée une nouvelle base de copie, conserve les artefacts et arrête
seulement le conteneur de test qu’il a démarré. Il refuse une source déjà active.
Les suites SQL synthétiques ne certifient aucun calcul natif.

Pour l’instance connectée déjà configurée, conserver un seul serveur :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --engine --review
node scripts/test-local-review.mjs .local/local-admin-1792143739689
node scripts/test-local-engine-adoption.mjs .local/local-admin-1792143739689
```

L’application est sur `http://127.0.0.1:3150/login` ; les identifiants sont dans
le fichier privé `login.txt` du dossier d’instance. Le lancement standard sur
3000 conserve l’authentification opérationnelle fermée. Le banc 3140 déjà lancé
n’a pas été interrompu : son ancien worker ne certifie pas le nouveau build ;
son prochain lancement utilisera la nouvelle archive.

## Incidents conservés et limites

Le premier test SQL a rencontré un nom de colonne ambigu dans le script de
test, corrigé sans changer les assertions. Un script de reprise a aussi échoué
sur son délimiteur SQL ; ces tentatives ne sont pas comptées comme réussies.
Les tests d’orchestration ont refusé les anciennes empreintes des captures,
comme prévu ; les captures restent intactes et les nouveaux cas synthétiques
sont explicitement distincts. Le typage du nouvel outil réseau a été corrigé.

Le premier build a été refusé en écriture par le bac à sable. Le contrôle complet
a ensuite été exécuté avec l’autorisation d’exécution prévue, sans changer les
protections. Docker a refusé un bootstrap faute de sous-réseaux automatiques.
Après inspection des réseaux et routes locales, deux /28 privés distincts ont été
choisis explicitement. L’outil accepte désormais ces options bornées ; Docker
reste responsable du refus des chevauchements. Aucun réseau n’a été supprimé
ni aucune configuration globale Docker modifiée.

La réception navigateur automatisée reste non exécutée après le refus de politique
antérieur. Aucun contournement. Python/FastAPI, nouvelle session MathLive, MFA,
expiration, hébergement et application élève ne sont pas requalifiés ici.
Le tracé des formules, la publication HTTP complète, les lectures Production
et la mise en service restent ouverts. La suite source Engine de 1 540 tests
n’a pas été répétée : sa preuve datée reste distincte.

Avant une application distante : réconcilier l’historique et le schéma réellement
déployés, faire approuver la procédure et la sauvegarde/restauration, résoudre
les opérations incertaines, arrêter la publication, vérifier les préconditions
des deux bases et coordonner SQL/package/configuration. Prévoir de nouveaux
tests et relectures pour les contenus à publier. Toute modification distante,
publication, push et déploiement nécessite l’autorisation séparée convenue.

Les références utilisées pour préparer le fichier et conserver les attributs sont
la [commande officielle de création de migration](https://supabase.com/docs/reference/cli/supabase-migration-new)
et [CREATE FUNCTION PostgreSQL 17](https://www.postgresql.org/docs/17/sql-createfunction.html).
