# Transaction cible et reprise après commit incertain — vérification locale

`PublicationTarget` relie maintenant le pilote privé à la capacité SQL existante
pour inspecter, appliquer, vérifier après commit et observer une issue incertaine.
**Ce composant n'est pas encore un service de publication utilisable depuis
l'Admin** : aucun orchestrateur avec Engine frais, route ou écran de confirmation
n'est activé. Les expérimentations décrites ici concernent exclusivement des
bases Docker synthétiques, sans connexion distante.

## Cible et plan immuable

La configuration réelle lie désormais la clé privée de destination au projet
configuré : `production-<projectRef>`. Elle accepte seulement la base `postgres`
des deux hôtes directs Supabase, en plus des contrôles TLS et d'identité existants.
Changer le projet ne peut donc pas réutiliser implicitement la destination d'un
ancien plan. Le composant refuse une opération d'une autre clé avant connexion.
Les anciennes clés logiques des fixtures restent des faits historiques ; elles
ne deviennent pas des alias silencieux d'un projet réel. Aucun plan distant
n'existe ou n'est migré par ce changement préparatoire.

Le plan privé est décodé et copié. Une confirmation modifiée, une opération
terminale ou une tentative de réappliquer directement un état `uncertain` est
refusée. La prise en charge source doit conserver l'identité et tous les champs
immuables ; seuls l'état et sa date de transition changent. Cette primitive ne
doit jamais recevoir un record de journal fourni par le navigateur.

## Verrou, transaction et journal

Le protocole du futur orchestrateur, déjà exercé par le banc, est :

1. Vérifier l'Admin et charger son plan côté serveur, puis prendre le verrou
   de session cible **avant** de réclamer l'opération source.
2. Réclamer le plan et conserver la protection durable de source. L'appelant
   doit exécuter ses contrôles Engine puis prendre la courte transaction de
   protection source ; l'Engine frais n'est pas raccordé par ce composant.
3. Appliquer sur la connexion cible dédiée, revérifier l'accès source juste
   avant commit et relire le résultat après commit.
4. Enregistrer le fait durable dans le journal source **avant** de rendre la
   main et libérer le verrou cible. La reprise utilise ce même verrou.

Le verrou utilise la même identité de catalogue et le même espace de clés que
la fonction SQL d'application. Il s'agit d'un verrou de session, conservé après
COMMIT jusqu'à la fin du callback. Une reprise concurrente ne peut pas déclarer
`not_applied` pendant qu'un éditeur actif attend encore sa vérification source.
Le verrou est obtenu avant de commencer le snapshot `REPEATABLE READ` ; la
relecture voit ainsi le commit du détenteur précédent plutôt qu'un snapshot
pris avant l'attente. Voir [verrous PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html)
et [isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

L'inspection prend les verrous de références prévus par la capacité SQL ; sa
transaction utilise ROLLBACK pour les libérer. Elle n'est pas déclarée SQL
`READ ONLY`, car le helper existant utilise `FOR SHARE`. L'observation de reprise
n'appelle jamais la fonction d'application et n'écrit aucune table cible.

L'application compare de nouveau le token et la résolution des références au
plan confirmé. Un état déjà convergé peut donner `unchanged` ; une résolution
modifiée n'est pas appliquée silencieusement. La réponse SQL, son type de résultat,
l'empreinte, la définition exacte, les identités et le pointeur actif sont vérifiés.
Après le callback de contrôle source, seul un accusé SQL `COMMIT` est accepté.
Une nouvelle transaction relit ensuite la cible sous le verrou de session.

Les transactions utilisent un même client dédié, selon la
[documentation node-postgres](https://node-postgres.com/features/transactions).
Les connexions remettent aussi le namespace à vide avant leurs contrôles SQL.
Une connexion perdue, un déverrouillage refusé ou un nettoyage non confirmé
entraîne sa destruction. Un gestionnaire d'erreur est présent pendant le prêt
d'un client ; la perte du transport ne devient pas une erreur asynchrone non
traitée qui ferait tomber Node. Les détails de connexion ne sont pas journalisés.

Une lease ne peut pas être réutilisée après fermeture, employée simultanément
ou utilisée pour une seconde application. Si l'appelant termine son callback
avec un travail détaché encore en cours, le composant ferme la connexion et
refuse le résultat ; une vérification source tardive ne peut pas committer ensuite.

## Faits établis et résultats incertains

| Situation                                                                  | Résultat autorisé                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Erreur avant COMMIT avec ROLLBACK confirmé                                 | `aborted` ; aucune application committée                                      |
| Accusé de commit perdu ou invalide                                         | `uncertain` ; aucun succès ou échec définitif                                 |
| Commit confirmé et relecture conforme                                      | `committed` avec résultat vérifié                                             |
| Reprise : état cible convergé                                              | `committed/unchanged`, sans attribuer historiquement le commit à ce processus |
| Reprise : token initial inchangé pour un plan qui devait modifier la cible | `not_applied`, après attente du verrou                                        |
| Autre état, lecture impossible ou ambiguïté d'un ancien no-op              | `uncertain`, sans répétition automatique                                      |

La perte d'un accusé de rollback reste aussi incertaine. Si seule la fermeture
d'une transaction de lecture échoue après commit et observation vérifiés, le fait
connu peut être conservé tandis que la connexion est détruite. Un changement de
runtime, de référence ou une intervention extérieure empêchant l'inspection
laisse l'opération incertaine pour traitement autorisé ; aucune déduction de
succès n'est faite à partir de la seule présence d'une révision.

## Vérifications exécutées le 15 octobre 2026

- **463 tests Admin / 27 fichiers** passent, dont **36 tests du composant cible**
  et **126 tests ciblés cible/pilote/journal**. Types, lint sans erreur, format,
  build standalone et smoke passent. L'avertissement `<img>` préexistant demeure.
- Le lanceur vérifie à nouveau TLS, les identités, les options de rôle et les
  **16 assertions de reprise avant/après restauration**, puis exécute les
  **neuf scénarios cible** ci-dessous. Les tests utilisent les vrais pools,
  les fonctions SQL canoniques et le vrai journal dans des bases distinctes.
- L'historique cible contient déjà des profils fictifs, une amitié, un ancien
  exercice, une tentative, un duel et une tentative de duel. Les lignes/empreintes
  des **60 tables hors exercices/révisions** restent identiques à chaque étape,
  ainsi que la ligne entière de l'ancien exercice. Les tentatives historiques
  sans version gardent explicitement leur version inconnue.
- Les **60 tables source hors journal** restent identiques pendant les scénarios.
  Les rejeux, annulations et reprises comparent aussi les **62 tables cible**
  intégralement. Les comparaisons ne retirent aucune colonne. Les séquences ne
  sont pas comparées ; une transaction annulée peut consommer un identifiant.

| Scénario réel local                                               | Observation                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Publication                                                       | Nouveau parent et nouvelle révision ; IDs techniques attribués par la cible ; journal committé |
| Rejeu du contenu déjà actif                                       | `unchanged`, aucune ligne ni époque cible modifiée                                             |
| Contrôle source refusé après application SQL mais avant COMMIT    | ROLLBACK confirmé, cible intégralement identique                                               |
| Vrai COMMIT suivi d'une exception simulant la perte de sa réponse | État incertain, sans faux succès                                                               |
| Reprise du cas précédent                                          | État convergé relu, journal `committed/unchanged`, zéro appel d'application                    |
| Exception avant émission de COMMIT                                | État incertain, cible annulée                                                                  |
| Reprise sans application                                          | Token initial relu, `not_applied`, zéro nouvelle application                                   |
| Socket PostgreSQL réellement fermée avant COMMIT                  | Node reste vivant ; journal incertain ; aucune écriture cible committée                        |
| Reprise après cette fermeture                                     | Absence d'application vérifiée, cible intégralement identique, zéro nouvelle application       |

Une deuxième connexion tente effectivement la reprise pendant le contrôle source,
puis après COMMIT avant écriture du journal : le verrou la bloque dans les deux
cas. Le contrôle utilise le timeout normal et vérifie que son callback n'est pas
entré. La protection ne repose donc pas seulement sur un ordre de mocks.

Le retour à une ancienne révision est couvert par les tests unitaires de ce
nouveau composant ; il n'est pas rejoué ici dans le nouveau parcours serveur.
Les tests SQL de rollback du checkpoint de capacité restent une preuve distincte.
La source du banc provient de la révision conservée, testée précédemment par
l'Engine Linux avec reçu signé et relecture synthétique. Aucune nouvelle
certification mathématique ni relecture humaine réelle n'est annoncée.

Le lanceur utilise seulement le pipe Docker local, un réseau interne sans port
publié et les images épinglées déjà installées. Les copies, sauvegardes et volumes
sont conservés, les conteneurs propres à l'essai arrêtés. Le worker est non
privilégié, à filesystem en lecture seule et ressources bornées. Le banc UI
indépendant n'est pas arrêté par cette certification.

Les [preuves et empreintes](publication-target-local-proof.json) identifient les
versions exactes testées. Une première préparation exigeait à tort une compétence
dans la source, alors que son contrat canonique permet une liste vide. La source
approuvée est conservée inchangée ; une compétence sans lien avec l'exercice est
ajoutée uniquement à la fixture cible pour garder le test de préservation non vide.
Cet échec est conservé. Le contrôle global de format s'est aussi arrêté sur un
rapport d'audit ajouté en parallèle ; seule sa mise en forme et la largeur des
séparateurs de tableau ont été corrigées, avec texte vérifié identique. Le rapport
reste hors du commit de ce chantier.

## Reproduction et reste à raccorder

```powershell
node --conditions=react-server scripts/test-publication-pg-local.mjs --target-transactions
```

Le lanceur sans cette option garde son périmètre de connexion/reprise précédent.
Aucune nouvelle migration SQL n'est ajoutée par ce volet ; les 61 empreintes
canoniques et les sources Engine protégées restent vérifiées.

L'orchestrateur applicatif doit encore sélectionner/exporter la source à partir
de la session vérifiée, exécuter l'Engine frais, construire les plans, assurer
l'ordre verrou/claim/journal pour toutes les voies et gérer les résultats par
exercice et rattacher le résultat à l'état éditorial Staging. Il reste ensuite les routes protégées, confirmations individuelles
et groupées, l'historique dans l'interface et la réception visuelle. Le banc ne
certifie pas Auth réelle, un déploiement à plusieurs processus ou le confinement
complet. La restriction navigateur n'est pas contournée. Auth distante, migrations
distantes, publication réelle, push et déploiement restent fermés ; le goal reste
actif et incomplet.
