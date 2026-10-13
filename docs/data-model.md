# État du modèle de données

Le schéma vivant a été inspecté en lecture seule le 13 octobre 2026. Les projets `novlearn-prod` et `novlearn-staging` exposent chacun les mêmes 22 tables `public`. Les tables et colonnes d'exercices, tentatives, duels et profils décrites dans le [modèle cible](exercise-data-model.md) sont identiques dans les métadonnées reçues.

Les faits vérifiés incluent `exercises.id bigint`, `content jsonb`, FK depuis `exercise_attempts` et `duels`, et l'absence de champs de version/seed dans les colonnes actuelles de `exercise_attempts`. Les duels ont `exercise_data jsonb`, qui peut être une copie d'instance existante ; son contrat réel est à cartographier depuis les appels et données synthétiques avant migration. `duel_attempts` référence le duel, pas directement un exercice. `profiles` contient notamment identité et données personnelles : ce n'est pas un référentiel public.

Les noms de tables ne suffisent pas à décrire tout le schéma ; le périmètre des métadonnées relevées et les limites sont dans [stratégie DB](database-strategy.md) et [sécurité](security.md). Aucun enregistrement utilisateur n'a été extrait pour cet audit. Le modèle `exercises` + `exercise_versions` est validé, mais cette seconde table n'existe pas dans le schéma vivant relevé et aucune migration n'est appliquée ici.

**À ne pas inférer :** égalité des données, absence de modification Dashboard, équivalence de toutes les contraintes/policies, ou historique entièrement représenté par les fichiers Git. Un inventaire structurel complet et une réconciliation restent des prérequis.
