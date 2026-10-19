# Fiche utilisateur — intégration locale du 19 octobre 2026

**Reprise du 19 octobre :** [connexion et services locaux rétablis](local-recovery-2026-10-19.md),
SQL 68 et parcours de publication par lot qualifiés sur copies synthétiques.
Aucune activation distante ; voir les preuves et limites datées.

La [liste Utilisateurs](http://127.0.0.1:3150/admin/users) ouvre maintenant une
fiche avec nom, e-mail, activité, historique synthétique et progression, conformément
au CDC §15.2 et au choix nominatif D08. Les trois vues consultent une vraie base
SQL **synthétique séparée**. Aucune donnée Production n'est lue ou modifiée.
Les [preuves](user-detail-proof.json) conservent les portées et les dates des essais.
Ce jalon ne clôture ni le Lot 8, ni le Lot 1A, ni le goal global.

## Données présentées

L'identité vient du compte Auth et du profil ; celle des invités reste masquée.
Le filtre couvre 1 à 90 jours UTC. L'activité compte les tentatives d'exercices
et de duels datées dans cette période, sans l'assimiler à une connexion. Les
tentatives sans date sont signalées séparément. Un abandon prévaut sur l'ancien
champ de réussite pour éviter de compter la même tentative dans deux catégories.
Une ligne de duel représente une **tentative**, pas un match complet.

L'historique est paginé par date, identifiant et type, avec précision à la
microseconde et deux sens de navigation. Une référence de version existante est
affichée ; une référence absente reste inconnue. Aucun rattachement rétrospectif
à la version actuelle n'est inventé. Le titre d'exercice et le référentiel de
compétences sont explicitement ceux d'aujourd'hui.

La progression décrit l'état enregistré **actuel**, indépendamment de la période
historique. Les points bruts restent visibles, y compris 15 points pour un maximum
actuel de 10. Données manquantes, compteurs négatifs, date future, compétence
orpheline et incohérences du référentiel sont signalés ; ils ne deviennent ni
zéros ni corrections implicites. Les verdicts et progressions historiques ne
sont pas présentés comme certifiés par l'Engine.

Les vues reprennent Inter, les surfaces claires et le bleu du design existant.
Elles disposent de formulaires GET, tableaux avec légende et en-têtes, échappement
du contenu et liens sans préchargement. Le rendu serveur vérifié ne vaut pas
réception visuelle ou essai du clavier dans un navigateur.

## Capacité SQL et serveur

La migration canonique locale 67 appartient à NovLearn :
`supabase/migrations/20261018213847_novlearn_admin_user_detail_readonly.sql`,
SHA-256 `215d3a9ce19a9b3216c4aa20667732105933ab546a526fdf8c008fd2a64ee3ac`.
Les 66 fichiers antérieurs et le code de l'application élève sont préservés.

Le rôle nominal `novlearn_user_detail_reader` possède exactement 41 colonnes
d'entrée sur dix tables avec RLS. Certaines sont nécessaires aux anciennes
policies ou aux jointures de métadonnées et ne sont pas renvoyées par l'API.
Il n'a ni login ni privilège élevé, appartenance, accès aux réponses, définitions,
instances privées, rapports, naissance, rôle applicatif ou secrets Auth.
Les prédicats de mutation et les 77 fonctions préexistantes restent identiques.

Un login SCRAM neuf, NOINHERIT, assume seulement ce rôle après contrôle. Le pool
est limité à deux connexions ; chaque lecture remet la session à zéro, ouvre une
transaction read-only et audite séparément login, rôle et droits effectifs.
Les deux requêtes SQL fixes sont incluses à l'identique dans le build autonome.
TLS vérifie CA et nom d'hôte ; HBA refuse le transport clair et les autres bases.
L'ancien certificat et les anciens identifiants des deux lecteurs sont conservés.
Leurs requêtes réelles repassent après SQL 67.

Page et API revérifient fraîchement le rôle Admin avant lecture. Aucun résultat
n'est mis en cache ; les cookies rafraîchis sont transmis. Une dérive SQL ou
une panne rend la lecture indisponible, sans fabriquer une fiche vide. L'absence
réelle renvoie 404 dans l'API. La page utilise `notFound()` ; le statut d'une réponse
déjà diffusée peut être 200 selon le [contrat Next.js 15](https://nextjs.org/docs/15/app/api-reference/file-conventions/not-found),
mais la page d'absence et l'absence de données d'un autre compte sont vérifiées.

## Essais réellement exécutés

- Rejeu neuf des **67 migrations** et upgrade sur copie peuplée : 62 tables
  conservées, prédicats de mutation et fonctions identiques, réapplication refusée.
- **48 assertions de permissions**, **24 cas SQL avec le vrai décodeur** et
  **7 contrôles de bornes** : trois vues, deux sens de pagination, égalités à la
  microseconde, ordre Unicode PostgreSQL, versions connues/inconnues, invités,
  progression incohérente et distinction absence/indisponibilité.
- **56 assertions historiques inchangées** et **35 permissions de la liste**
  repassent. Les fixtures SQL nominales sont annulées ; leurs séquences ne sont
  pas réputées identiques en l'absence de comparaison.
- Restauration logique peuplée : **62 tables, 73 relations, 77 fonctions,
  11 séquences**, ACL ordonnées, RLS, propriétaires, huit rôles et appartenances,
  empreintes SCRAM et trois vues comparés. Les 48 assertions repassent ; les
  séquences restent exactes après ces tests. La configuration TLS n'est pas
  comprise dans cette qualification de restauration logique.
- **19 groupes PG/TLS**, dont **42 refus réels 42501** dans des transactions
  read-write, temporisation serveur réelle, mauvais mot de passe/CA/hôte,
  transport clair, autre base, deux dérives contrôlées retirées puis lecture
  positive. Les 62 tables restent identiques pendant les lectures.
- **16 groupes Auth/HTTP réels** : anonyme, faux rôle metadata, Admin, trois
  vues et liens, sept entrées invalides, pagination, période vide, absence,
  invité, révocation/restauration du rôle, dérive de grant, panne réelle du proxy
  local et reconnexion, séparation publication, fichiers SQL non servis et logout.
- **Huit contrôles Engine natifs** après redémarrage : seeds 0/42, correction,
  nouveau rapport signé ; les **17 anciens rapports** gardent contenu et signature.
  La suite source Engine complète antérieure n'est pas relancée pour cette fiche.

La préparation ajoute onze lignes de progression synthétique après dump et
comparaison de toutes les anciennes lignes **dans la transaction avant commit**.
Aucun compte, tentative ou version n'est ajouté à cette source. Le test HTTP
compare ses 62 tables ; les 35 tables métier principales sont identiques avant
le test volontaire de rôle. Celui-ci restaure le rôle du seul Admin synthétique,
vérifie tous ses autres champs et borne le `updated_at` normalement changé par
le trigger. Un brouillon et un rapport Engine de test sont ensuite ajoutés et
conservés. Ni trigger ni critère de validation n'est désactivé.

Deux premiers essais de restauration ne passent pas : stock d'exercices vide
pour la fixture de permissions, puis séquence avancée par un INSERT refusé
malgré rollback. Une métadonnée temporaire est ajoutée dans BEGIN/ROLLBACK ;
les INSERT de permissions utilisent maintenant des identifiants explicites et
vérifient aussi le cas permanent autorisé. Une nouvelle cible, depuis **la même
archive immuable**, passe tous les contrôles. Les cibles et échecs restent conservés ;
aucune séquence n'est réinitialisée et aucun contrôle supprimé.

La chaîne complète **actuelle** passe : **1 143 tests / 59 fichiers**, intégrité
Engine, types, lint sans erreur, format, build autonome et smoke Auth. Les
469 fichiers copiés restent identiques au retour ; les six SQL requis sont
tracés à l’identique. Le seul avertissement lint `<img>` préexistant est conservé.
Les **20 tests distincts du lanceur** passent aussi. La recherche ciblée de 78
secrets ou identifiants privés dans 55 bundles navigateur ne trouve aucune
correspondance ; elle ne constitue pas un audit exhaustif. Les huit configurations
privées, huit fichiers NovLearn préexistants, CDC et design gardent leurs empreintes.
Seuls les résultats documentaires sont ajoutés après ce contrôle ; le code qualifié
ne change pas. Le commit SQL local est `7149d3c`, sans push.

## Avertissements et limites ouverts

La CLI Supabase installée a réellement exécuté les advisors sur
`127.0.0.1:55435`, avec TLS vérifié et transaction read-only : **0 erreur,
45 avertissements, 65 informations**. Le message générique « Connecting to
remote database » vient de son chemin `--db-url` ; la cible est exclusivement locale.
L'absence d'erreur ne vaut pas absence de constat ni certification globale.

Sept doublons de policies permissives concernent le nouveau rôle sur chapitres,
compétences, tentatives d'exercices/de duels, duels et progression. Ils n'ajoutent
aucune colonne ni mutation, mais leur coût doit être réduit par une évolution
SQL traçable avec comparaison des accès avant/après, sans réécrire silencieusement
la migration déjà qualifiée. Les autres constats incluent policies historiques,
index et deux fonctions historiques à search_path mutable (`handle_updated_at`,
`generate_random_code`). Les tables privées sans policy restent fermées par défaut.
Ces constats restent ouverts avant toute certification SQL globale ou mise en service.

Le logout testé ne prouve pas la révocation d'un JWT volé. MFA, expiration stricte,
réception navigateur autorisée, filtres et métriques supplémentaires, identité/source
Production, réconciliation SQL, sauvegarde/PITR et compatibilité élève restent des
portes distinctes. Aucun secret Production n'est récupéré, aucun distant modifié.

## Utilisation locale

Utiliser l'instance déjà active sur [3150](http://127.0.0.1:3150/login), puis
Utilisateurs et un nom dans la liste. Les identifiants conservés sont dans
`.local/local-admin-1792143739689/login.txt`. La source de test contient aussi des
données volontairement incohérentes pour vérifier leur signalement.

Lors d'un prochain démarrage normal, l'option explicite est :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --engine --review --statistics --users --user-detail
```

Ne pas lancer une seconde instance sur le même port. Le profil principal reste
en schéma 64 ; seule la source synthétique séparée passe à 67. Les dumps, logins,
CA et clés restent ignorés dans `.local/`, jamais dans `NEXT_PUBLIC_*` ou Git.
