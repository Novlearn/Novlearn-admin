# Écarts avant mise en service — 20 octobre 2026

## Portée du relevé

Deux requêtes de catalogues, une sur Staging et une sur Production, sont
réellement exécutées via le connecteur Supabase. Le [SELECT exact](remote-readiness-2026-10-20.sql)
ne lit aucune ligne métier/Auth, ne récupère aucun secret et ne modifie aucun
objet ni historique. Une troisième lecture utilise la copie locale conservée
du rejeu neuf des 71 migrations : transaction READ ONLY, réseau désactivé et
limites inchangées ; cette copie est ensuite arrêtée normalement.

Le [rapport et ses empreintes](remote-readiness-2026-10-20.json) couvrent quinze
catégories de métadonnées. Ils ne remplacent pas un export complet, une
sauvegarde/restauration ou une qualification sémantique. Chaque projet possède
son propre instantané SELECT ; aucun gel DDL global n’est supposé.

## Staging et Production

Les deux historiques possèdent toujours 70 entrées, dont 25 sans statements.
Les champs d’historique sélectionnés correspondent au relevé du 18 octobre.
Le schéma `novlearn_admin_private` et `exercise_versions` restent absents.

L’utilisateur indique que les archives se trouvent dans Novlearn. Les
[25 fichiers sont retrouvés et inventoriés](migration-archives-2026-10-20.json),
avec 27 variantes historiques Git : les migrations 001 et 005 ont chacune deux
révisions. Les copies de travail 010 et 022 ont des changements de contenu,
préservés. Pour les 23 autres, la différence d’octets Git/Windows se limite aux
fins de ligne. Les sources Git sont copiées dans l’artefact local avec leurs
commits et SHA-256 ; aucun fichier Novlearn n’est remplacé. L’absence de hash
de statement dans l’historique distant reste distincte de la présence des
archives : aucune égalité cryptographique des octets appliqués n’est inventée.

Les nouveaux contrôles détectent dix différences de position physique de
colonnes sur `exercises` et `profiles`. Les autres attributs de ces colonnes
comparés correspondent. Trois fonctions ont des empreintes brutes différentes,
mais leurs définitions correspondent après la seule normalisation CRLF vers LF.
Aucune reconstruction de table, remise en ordre de colonnes ou modification de
fonction n’est proposée à partir de ces seules différences de représentation.

## Écarts avec le rejeu local SQL 71

Les différences suivantes interdisent de traiter le rejeu local comme un clone
du schéma distant ou d’appliquer aveuglément ses 71 fichiers :

- `public.exercise_attempts.created_at` existe à distance et manque localement.
  Elle doit être préservée et ses consommateurs compris ; aucune suppression,
  recopie de valeurs ou fusion avec `attempted_at` n’est proposée.
- Huit index distants ne figurent pas dans le rejeu ; ils sont énumérés dans le
  rapport. Leurs noms et leur présence ne justifient aucune suppression.
- `exercise_attempts.id` et `exercises.id` sont des identités BY DEFAULT à
  distance ; le rejeu utilise des defaults de séquence. Toute transition doit
  conserver identifiants, dépendances et états de séquence. Aucun changement
  d’identité n’est exécuté.
- Six colonnes passent de nullable à NOT NULL dans le schéma local ; deux
  colonnes d’exercices suivent le changement inverse. Leur compatibilité avec
  les données existantes nécessite des précontrôles spécifiques, non exécutés
  par cette collecte de métadonnées.
- Les rôles, ACL, policies, fonctions, contraintes et objets Admin locaux ont
  évolué. Les treize relations supplémentaires, 123 colonnes supplémentaires et
  autres différences sont identifiées par catégorie ; ils ne constituent pas
  un script SQL d’installation.
- L’extension distante `pg_cron` ne figure pas dans la copie locale ; cette
  différence n’autorise pas à la supprimer ou à modifier sa configuration.

## Précontrôle des six changements vers NOT NULL

Une requête supplémentaire, réellement exécutée **sur Staging uniquement**,
compte les valeurs NULL des six colonnes concernées. Les six compteurs valent
zéro : `competences.chapter_id`, `competences.max_points`,
`profiles.current_streak`, `profiles.max_streak`, `profiles.role` et
`profiles.has_seen_tutorial`. Les contrats de colonnes relus au même instant
correspondent à la collecte précédente.

Seuls ces agrégats sont exportés ; aucun nom, e-mail, identifiant de compte ou
contenu métier n’est lu dans la réponse. Ce contrôle ne couvre pas les autres
contraintes, les écritures concurrentes futures, les fonctions, les defaults,
les identités ou Production. Il n’autorise aucune application SQL.

Les fonctions, policies et structures ne sont pas déclarées équivalentes parce
qu’elles portent le même nom. Le rapport sépare objets ajoutés, absents et
attributs modifiés, en normalisant uniquement l’ordre sans signification des
ACL et listes de rôles ; les différences de position restent visibles.

## Plan de poursuite à faire valider

1. Préserver ce relevé, les schémas existants et les 27 variantes Git retrouvées.
   Rapprocher les archives et leur contexte d’application ; les fichiers locaux
   de même numéro ne prouvent pas, seuls, les octets appliqués.
2. Si cette provenance ne peut pas être retrouvée, faire approuver une stratégie
   de baseline fondée sur un export complet du schéma vivant. Elle doit rester
   distincte de l’historique récupéré : aucun statement manquant n’est inventé,
   aucune entrée distante n’est réparée sans autorisation spécifique.
3. Restaurer ce schéma dans un environnement isolé et synthétique, puis construire
   uniquement le delta Admin nécessaire. Préserver la colonne distante, les
   index, les identités et extensions ; examiner explicitement les différences
   de nullabilité, defaults et droits. Les migrations canoniques restent dans
   NovLearn ; aucune seconde suite n’est créée dans Admin.
4. Tester contraintes et droits, compatibilité élève, Engine, sauvegarde/
   restauration et parcours Admin sur cette vraie forme de schéma, avant de
   proposer une application Staging. La preuve de rejeu neuf reste distincte.
5. Obtenir les autorisations séparées pour application Staging, activation des
   identités et de l’Auth, puis Production, première publication et déploiement.

Les workflows Supabase distinguent schéma vivant, fichiers de migration et
historique déclaré ; leur synchronisation doit précéder une génération de delta.
Les commandes disponibles doivent être vérifiées sur la CLI installée avant
toute utilisation, sans mise à jour implicite.
[Documentation officielle](https://supabase.com/docs/guides/local-development/declarative-database-schemas).
Aucune commande de réparation, synchronisation ou application distante n’a été
exécutée par ce relevé.

Le [parcours manuel court](local-reception-2026-10-20.md) est accepté par
l’utilisateur. Les défauts d’interface sont reportés à sa demande ; les portes
de mise en service et la réception plus large restent ouvertes.
