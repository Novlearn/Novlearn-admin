# Engine Linux dans l'application locale connectée

**17 octobre :** une [optimisation Engine qualifiée](engine-numeric-cache.md)
est disponible comme candidat. L’instance décrite ici utilise toujours l’archive
précédente, en attendant sa rotation SQL locale et une adoption coordonnée.

Le serveur Next de développement Windows peut déléguer les opérations au vrai
SDK Engine Linux certifié. L'archive reste épinglée et le chemin Linux natif
du produit conserve ses quotas. Aucun changement dans le dépôt Engine et aucune
logique mathématique parallèle ne sont nécessaires.

## Lancement local

Pour l'instance d'essai existante, provisionner une seule fois la signature des
rapports dans sa base isolée, puis lancer le serveur avec le moteur :

```powershell
node scripts/configure-local-test-signing.mjs .local/local-admin-1792143739689
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --engine
```

Ajouter `--review` pour la [relecture locale connectée](local-admin-review.md).
Cette option exige le moteur et la signature, sans activer la publication.

La première commande ne contacte que le conteneur PG local explicitement nommé.
Elle insère une nouvelle clé aléatoire dans le registre privé déjà prévu par le
schéma, puis conserve le fichier ignoré `test-signing.json`. Un second lancement
vérifie et réutilise cette clé, sans remplacer ni supprimer de données.
La clé HMAC est un secret applicatif serveur distinct des identifiants opérateur
de la base. Le serveur ne lit toujours pas `private.json`.

Sans fichier de signature, la validation et l'aperçu restent possibles ;
consigner un rapport est refusé. Sans `--engine`, le lancement conserve le mode
de connexion/sauvegarde avec calculs désactivés. Les anciens tests de refus
restent exécutables dans cette configuration.

## Transport privé et limites

Le lanceur crée un worker Docker par instance, sans réseau et sans port publié.
Il monte uniquement les archives Engine/dépendances, les scripts du worker et
la définition de précontrôle, tous en lecture seule. Il ne transmet aucun
identifiant Auth ou de base. Le conteneur utilise l'image Node épinglée,
un utilisateur non privilégié, un système de fichiers en lecture seule,
aucune capacité et `no-new-privileges`.

Le worker vérifie lui-même `memory.max=402653184`, `memory.swap.max=0` et
`pids.max=64` avant d'annoncer sa disponibilité. Le SDK reste à une opération
active et quatre en attente, avec ses limites natives inchangées. Les données
temporaires d'installation restent dans un tmpfs de 192 Mio. Les images ne
sont pas téléchargées et l'installation des archives est hors réseau.

Le canal Next vers le superviseur écoute uniquement `127.0.0.1:3151`, avec une
capacité aléatoire de 32 octets conservée dans la mémoire du processus. Il refuse
un Host différent, toute origine navigateur, une capacité absente ou incorrecte,
une autre route/méthode, un protocole libre ou des champs supplémentaires.
Les messages passent ensuite par stdin/stdout vers le worker sans réseau.
Le corps est borné à 1 Mio, la réponse à la limite native plus son enveloppe ;
chaque réponse est reliée à l'identifiant exact de sa requête.

Le transport est accepté seulement avec la configuration Auth locale qualifiée,
en développement, avec URL loopback exacte et drapeau Engine explicite. Il reste
refusé en production, avec Auth Staging opérationnelle ou avec publication.
Les endpoints publics existants continuent de vérifier origine, session et rôle
avant tout calcul. Les snapshots privés et leur contrôle de propriétaire restent
dans le serveur Next ; le navigateur ne fournit jamais l'instance officielle.

Les interruptions se propagent au host natif. L'arrêt normal ferme le serveur et
le worker ; un arrêt de secours cible uniquement le nouveau conteneur de cette
instance. Les conteneurs arrêtés et preuves restent conservés. Aucune protection
Windows n'est désactivée, aucun exécutable bloqué n'est lancé par un autre chemin.

## Qualification

Le [relevé détaillé](local-admin-engine-proof.json) conserve les empreintes des
sources réellement testées et distingue les périmètres suivants :

- **641 tests / 35 fichiers**, intégrité de l'archive, types, lint sans erreur,
  format, build et smoke passent ; l'avertissement image préexistant demeure.
- **28 contrôles HTTP réels** passent, dont les calculs Linux et le rapport signé.
- **Sept contrôles du canal privé** passent ; l'inspection Docker confirme les
  quotas, réseau, droits et montages effectivement appliqués.
- **30 bundles clients inspectés** : aucune occurrence des secrets et noms
  privés recherchés. Ce contrôle ciblé ne vaut pas audit de toutes les fuites.
- Arrêt et redémarrage réels : ancien processus et worker arrêtés, services de
  base conservés, lignes des trois tables exercices/révisions/rapports identiques,
  rapport relu par PostgREST puis dans la page protégée après nouvelle connexion.

Un calcul via la route Next est aussi exécuté après le redémarrage, avec la
nouvelle capacité privée ; il passe. Le rôle Admin et le rapport restent présents,
et la publication répond toujours avec un refus d'indisponibilité.

L'instance demeure accessible sur `http://127.0.0.1:3150/`. L'exercice d'essai
`/admin/exercises/4` contient le rapport enregistré ; il reste un brouillon.

Les preuves datées distinguent les unités de transport, le précontrôle natif,
les contrôles du canal privé et le parcours HTTP connecté. La commande complète
du parcours avec moteur est :

```powershell
node scripts/test-local-admin.mjs .local/local-admin-1792143739689 --engine
```

Elle exige une vraie validation positive et négative, la génération et projection
publique sans attendus privés, une inspection Admin, des corrections correcte
et incorrecte, puis les tests reproductibles des seeds 0/42 depuis la définition
relue de SQL. Le serveur signe ce rapport et SQL vérifie la signature avant de
l'enregistrer. Le test relit le rapport par PostgREST et dans la page protégée,
sans approuver le brouillon. Un état de révision périmé est refusé.

Les tests ordinaires gardent leurs délais. Seul le nouveau parcours de rapport
multi-seeds utilise les deux minutes déjà prévues par sa route. Il n'accepte
aucun résultat partiel ou indéterminé comme succès. L'intégrité de l'archive ne
vaut pas nouvelle exécution de la suite complète source Engine.

Le premier essai du canal est conservé en échec : le client `fetch` a ignoré
l'en-tête Host fourni par le test. Le même critère est ensuite exercé par un
client HTTP natif qui transmet réellement cet en-tête ; le refus est vérifié.
Ce sont des contrôles HTTP serveur, sans navigation ou capture automatisée.

La publication locale opérationnelle demeure désactivée. La réception visuelle,
le rendu avancé, MFA/expiration, les lots et les portes SQL/distantes restent
ouverts. Ce transport de développement n'est pas une certification d'hébergement
Production. Références : [limites Docker](https://docs.docker.com/engine/containers/resource_constraints/)
et [options de lancement](https://docs.docker.com/reference/cli/docker/container/run/).
