# Statistiques — page et API SQL locales

La page [Statistiques locale](http://127.0.0.1:3150/admin/statistics) est raccordée
au lecteur PostgreSQL qualifié. Elle conserve Inter, couleurs et composants de
l’Admin. Les [preuves](activity-http-proof.json) distinguent les tests simulés,
les sessions/HTTP/SQL réels et la réception navigateur encore non exécutée.

## Utilisation et origine

Se connecter avec les comptes conservés indiqués dans
`.local/local-admin-1792143739689/login.txt`, puis ouvrir **Statistiques**.
La période du [15 au 17 octobre](http://127.0.0.1:3150/admin/statistics?from=2026-10-15&to=2026-10-17)
donne cinq tentatives d’exercice et deux tentatives de duel. Les trente jours
jusqu’au jour UTC courant sont proposés par défaut ; les périodes vides sont
calculées réellement et ne sont pas confondues avec une panne.

La source est une **base SQL synthétique séparée**, restaurée depuis le dump 65
validé. Ses quatre identités ne représentent pas les comptes de connexion de
l’Admin ni des élèves Production. Le badge « Base locale synthétique · lecture
seule » et la notice restent visibles. L’exemple sans base du banc 3140 demeure
distinct. Aucune clé, donnée ou connexion Production n’est activée.

## Contrôle serveur

Le parseur exige le profil Auth local principal, l’activation explicite et la
revue `isolated-sql65-activity-http-v1`. Il refuse les profils Production,
Staging distant et publication locale, les options SSL d’URL et les endpoints
hors loopback 55435. Les identifiants restent côté serveur. `--statistics` est
une option indépendante du lanceur, désactivée par défaut ; ni l’existence des
secrets ni celle de la base ne suffit à ouvrir la fonctionnalité.

La page et l’API vérifient à nouveau l’identité et le rôle Admin avant toute
lecture. Le layout ne remplace pas cette vérification. GET accepte uniquement
la période UTC validée de 1–90 jours ; doublons, dates futures et choix de source
par le client sont refusés. Les réponses API sont privées/no-store et conservent
les cookies rafraîchis. Le résultat n’est pas mis en cache ; seul le pool borné
est partagé. Les droits du login et du rôle SQL restent audités à chaque lecture.

Les pannes et dérives de permissions donnent une indisponibilité explicite,
sans zéros fabriqués ni détail de connexion. Le lien de navigation n’apparaît
que lorsque la configuration serveur active cette lecture. Les deux fichiers
SQL sont tracés dans le build autonome ; son postbuild exige leur égalité exacte
avec les sources. Le smoke exige aussi le refus des nouvelles routes lorsque
l’Auth est désactivée.

## Source locale et reprise

Le nouveau PostgreSQL ne possède aucun port publié et reste sur un réseau
interne. Un relais borné, non-root, sans capabilities et à rootfs read-only
expose uniquement `127.0.0.1:55435`. PostgreSQL termine TLS ; HBA impose SCRAM/TLS
au nouveau login et borne ses adresses/base. Le relais ferme normalement ses
connexions sur SIGTERM. Les bases applicatives 3150/3152 restent au schéma 64.

Le lanceur lit l’artefact ignoré `.local/lot1a/activity-http-current.json` préparé.
Après vérification des ressources conservées, le lancement reproductible est :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --engine --review --statistics
```

Ne pas démarrer un deuxième processus sur le même port. Le premier passage a
rencontré l’épuisement des pools réseau automatiques Docker. Deux petits
sous-réseaux explicites sont vérifiés contre les routes hôte et Docker ; aucun
réseau, volume ou réglage global n’est supprimé/modifié.

Une première restauration a été interrompue par l’arrêt du serveur temporaire
d’initialisation PostgreSQL. Le contrôle attend désormais le serveur TCP
permanent. La base partielle est conservée sous
`activity_incomplete_1792345213648`, sans suppression ; une nouvelle base
`activity_copy` est restaurée et comparée aux 62 tables du dump qualifié.
La préparation a été reprise sur les mêmes ressources ; son chemin initial
complet corrigé n’a pas été rejoué sur une seconde installation neuve.

## Vérifications réelles

Les **douze groupes HTTP** passent avec de vraies sessions locales : refus
anonyme/non-Admin et faux rôle metadata, agrégats exacts, page/formulaire/table,
cinq filtres invalides, période vide et défaut trente jours, révocation immédiate
du rôle pour le même jeton, dérive de grant SQL, perte/reprise du transport,
isolation des cookies/publication et logout. Les 62 tables d’activité restent
identiques ; toutes les anciennes lignes des 35 tables métier principales sont
conservées.

Deux comptes synthétiques dédiés sont conservés et réutilisés lors des reprises.
Leurs quatre lignes d’initialisation sont identifiées strictement : deux profils
et deux `friend_codes`, créés par les triggers Auth existants vérifiés. Après
retrait de ces seules empreintes connues dans la comparaison, les 35 tables
doivent correspondre exactement au relevé initial. Aucun trigger n’est désactivé,
aucune baseline n’est recapturée et aucune ancienne ligne n’est exclue.

Les échecs du pilote restent conservés : syntaxe avant exécution ; observation
d’arrêt du relais expirée, corrigée par son arrêt explicite ; route Statistiques
absente du build indépendant 3152, l’isolation étant ensuite exigée sur son vrai
endpoint session avec 401 et son absence avec 404 ; oubli initial des deux lignes
friend_codes d’initialisation ; puis parenthèse SQL manquante du comparateur.
Ces tentatives ne sont pas annoncées comme une suite réussie.

La suite Engine connectée **inchangée** passe ensuite huit contrôles : deux seeds,
projections publiques/privées, correction et nouveau reçu signé. Les anciens
reçus sont préservés. Elle ajoute un brouillon synthétique et son rapport après
la comparaison HTTP, sans publication. Les limites natives restent inchangées ;
un temps HTTP global de projection n’est pas le délai interne d’une opération SDK.

Le contrôle complet passe **913 tests / 49 fichiers**, intégrité Engine, types,
lint sans erreur, format, build, égalité des deux fichiers SQL tracés et smoke
HTTP avec Auth désactivée. Les 417 fichiers copiés sont identiques au retour.
Les treize tests distincts des options du lanceur passent aussi. L’avertissement
`<img>` préexistant reste visible. La recherche ciblée de 56 secrets ou noms
privés dans 50 bundles navigateur ne trouve aucune correspondance ; elle n’est
pas un audit exhaustif. Les configurations conservées et fichiers préexistants
NovLearn gardent leurs empreintes.

Le contrôle final après Engine confirme encore les anciennes lignes des 35 tables,
les agrégats, l’absence de secrets SQL dans le HTML, la non-publication du fichier
SQL et les limites du worker courant. La page de développement renvoie
`no-store, must-revalidate` : le premier contrôle exigeait en plus le mot
`private`. Le critère vérifié est l’interdiction de stockage par les caches privés
et partagés, imposée par [no-store, RFC 9111 §5.2.2.5](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5).
L’API vérifie séparément `private` et `no-store`. Aucun nettoyage du stockage
navigateur n’est déduit de ces contrôles HTTP.

## Travail restant

La lecture Production, les métriques/classements et filtres pédagogiques restants,
ainsi que la consultation utilisateurs nom/e-mail/activité ne sont pas livrés.
La rotation des secrets/certificats et l’exploitation demandent encore leur
qualification. La réception visuelle et les interactions navigateur restent
ouvertes, sans contournement de la restriction d’automatisation. Les permissions
locales vérifiées n’autorisent ni migration distante, ni publication ou déploiement.

Références consultées : [Route Handlers Next 15](https://nextjs.org/docs/15/app/api-reference/file-conventions/route)
et [qualification du lecteur](activity-pg.md). Aucun SDK ni source Engine/NovLearn
n’est modifié pour ce raccordement.
