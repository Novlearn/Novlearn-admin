# Conflits métier des RPC HTTP — migration locale 63

Le premier parcours Auth/REST réel a révélé une sauvegarde obsolète bloquée
pendant 45 secondes : PostgREST 14 relance indéfiniment une transaction qui
remonte `40001`, y compris quand ce code représente un conflit métier volontaire.
Ce [défaut documenté par Supabase](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)
est distinct des restrictions Windows et du refus de politique navigateur.

La migration locale NovLearn
`20261016095425_novlearn_admin_rpc_http_conflicts.sql` intercepte uniquement
`serialization_failure` à la frontière des huit RPC publiques concernées et
renvoie `PT409`, le code de conflit HTTP prévu par PostgREST. Elle conserve le
corps original et vérifie son empreinte avant toute modification. Aucun DML,
nouveau grant, changement de propriétaire ou nouvelle fonction definer.
Tous les attributs d'exécution des fonctions sont comparés avant/après.
Les conflits du journal privé et des triggers directs restent `40001`.

Les routes Admin traduisent le code précis en conflit d'édition. Les tests
existants exigent désormais `PT409` aux seules frontières publiques, en
conservant leurs assertions de refus et de préservation. Aucun délai augmenté,
retry automatique ajouté ou assertion supprimée pour masquer le problème.

## Exécuté localement

- Rejeu neuf des **63 migrations**, empreinte globale
  `6d051125165f540db70f182a0343c014b47294c4671c728a9862209ecbed272b`.
- Qualification sur copie puis restauration : **189 assertions SQL avant et
  189 après** (catalogue 48, reçus 21, relecture 43, taxonomie 39, flashcards 38).
- Comparaison des lignes des **62 tables** et des attributs des huit fonctions :
  conservation vérifiée. Les séquences ne sont pas comparées par ce contrôle.
- Sauvegardes concurrentes catalogue et flashcards : un commit et un refus
  `PT409`, sans modification de la base source.
- Véritable sauvegarde HTTP avec empreinte périmée : réponse 409 vérifiée
  dans le parcours connecté, sans blocage PostgREST.

Les preuves restent dans `.local/lot1a/rpc-http-1792144847344/proof.json`,
`.local/lot1a/.rpc-http-fresh-replay.log`, `.local/lot1a/.rpc63-concurrency.log`
et les artefacts d'intégration de l'[instance connectée](local-admin.md).
L'empreinte de la migration est
`603c5d1e76ee2271953f9f3211c240c6f427bef852804232d0d9061254c36e1b`.
Le test natif des reçus n'a pas été relancé dans ce jalon ; ses anciennes preuves
restent datées. Aucun test de confinement par injection de trigger n'est repris.

Aucun environnement distant n'est modifié. Avant application distante : revoir
le diff de schéma, sauvegarder et qualifier la restauration, vérifier les corps
attendus sur Staging et obtenir l'autorisation de migration. La migration refuse
tout corps différent ; cet échec ne doit pas être contourné en supprimant le
contrôle d'empreinte. Les validations du Lot 1A restent obligatoires.
