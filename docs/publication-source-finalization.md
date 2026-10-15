# Finalisation de la source après publication — vérification locale

La migration locale NovLearn
`20261015191720_novlearn_admin_publication_source_finalization.sql` complète
l'enregistrement privé du résultat de publication. Après constat vérifié du
commit cible, une même transaction enregistre le résultat, passe la révision
source approuvée à `published` et active son UUID **source** dans le parent.
Cette évolution est autorisée par D07 ; aucune base distante n'est modifiée.

## Transaction et reprise

La fonction privée verrouille le parent, la révision puis l'opération dans
l'ordre des autres écritures source. Elle relit l'état après attente et vérifie
exactement le contenu, les contrats Engine, les empreintes, l'epoch, la relecture
et le reçu conservés dans le plan. Elle ne copie aucun identifiant cible dans
le pointeur source et conserve les métadonnées de brouillon Staging.

Le journal terminal et les écritures source sont atomiques. Une erreur annule
leur ensemble et conserve l'opération récupérable. Le service libère sa courte
protection source avant cet enregistrement, tout en gardant le verrou de session
cible. Le résultat n'est pas présenté comme confirmé si cet enregistrement
échoue ; la reprise observe la cible et termine sans réappliquer son transfert.

Une révision déjà publiée n'est pas réécrite. Le rejeu identique d'une opération
terminale ne réactive pas une ancienne révision et n'ajoute pas d'événement.
L'application de la migration n'effectue aucun backfill des anciennes opérations
ou révisions. Le texte de résultat de l'interface décrit maintenant un fait
historique confirmé, sans affirmer quelle révision est active au moment où
l'historique est consulté.

La révocation de l'initiateur ou de sa clé après commit cible ne doit pas
empêcher la machine de consigner ce fait. Le contrôle humain reste refusé après
révocation ; la reprise privée n'autorise aucun nouveau transfert. Son événement
machine possède un acteur nul. Les rôles API n'ont pas accès à cette fonction
et le rôle journal n'acquiert pas de droit direct sur les tables de contenu.

Le pilote exige désormais le contrat privé `atomic-source-finalization-v1`
avant de fournir une connexion source. Une base sans cette migration est
refusée. La fonction de contrat et la finalisation sont installées dans la même
transaction ; ce marqueur ne remplace pas la revue SQL ni les droits existants.

## Vérifications réellement exécutées

Les artefacts et leurs empreintes figurent dans
[publication-source-local-proof.json](publication-source-local-proof.json).

- Contrôle complet Admin : **578 tests dans 33 fichiers**, types, format,
  compilation standalone et smoke passent ; lint sans erreur et un avertissement
  préexistant. Les noms privés de configuration publication sont absents des
  45 bundles JavaScript clients vérifiés. Les 35 fichiers du manifeste natif
  correspondent aux sources testées ; les 61 migrations précédentes sont intactes.
- Rejeu neuf des **62 migrations** sur PostgreSQL local sans réseau : réussite,
  avec empreintes stables et sans utilisation des bases distantes.
- **31 assertions SQL**, puis les mêmes **31 après sauvegarde/restauration** :
  permissions, validation du résultat, transitions exactes, révocation, rejeu
  terminal et réactivation d'une révision publiée. Les observations cible de
  cette suite SQL sont synthétiques. Tous les essais sont annulés ; les lignes
  des 62 tables comparées restent identiques.
- **15 groupes d'intégration** avec PostgreSQL réel et TLS vérifié : les neuf
  scénarios cibles et les sept scénarios du service sont rejoués ; huit scénarios
  dédiés vérifient la finalisation source. Une ancienne base sans contrat est
  effectivement refusée. Les 16 assertions de reprise passent aussi avant et
  après restauration.
- Les huit scénarios source couvrent publication, répétition, perte avant
  commit et constat d'échec, perte après commit puis reprise machine après
  révocation, blocage réel de la finalisation source après commit cible puis
  reprise. Les reprises n'appellent jamais l'application cible.
- Les publications dédiées exécutent de nouveaux tests Engine à la préparation
  et à la confirmation. Le worker Linux x64 reste borné par cgroup v2 à 384 Mio,
  swap nul et 64 processus, sous utilisateur non privilégié et racine en lecture
  seule. Aucun quota ni critère n'est assoupli.
- Les lignes complètes parent/révision sont comparées à la transition exacte
  autorisée, y compris les horodatages SQL. Les autres lignes de ces deux tables
  et les 58 tables restantes sont préservées. Les révocations de fixture sont
  vérifiées séparément. L'historique élève synthétique est non vide et conservé.

## Portée et limites

Les deux destinations des essais partagent un cluster PostgreSQL isolé, sans
port publié. Le client Supabase installé est utilisé avec identité Auth et
transport REST synthétiques vers des requêtes SQL fixes. **Il ne s'agit pas
d'une connexion GoTrue ou d'un parcours PostgREST réel.** Les séquences ne sont
pas comparées. Les volumes, dumps et échecs intermédiaires restent conservés.

La suite SQL vérifie le protocole de réactivation avec une observation cible
synthétique. Elle ne réceptionne pas le rollback fonctionnel complet entre
deux vraies révisions cibles. Celui-ci, la publication groupée, l'enrichissement
de l'historique et le rendu avancé restent à terminer.

L'accès Auth et la publication distante restent désactivés. Avant activation
restent réconciliation de l'historique SQL, sauvegarde/retour, compatibilité
élève, compte Admin, secrets et rôles limités, vrais parcours Auth/révocation,
réception visuelle et qualification complète du confinement. Les restrictions
Windows et navigateur sont conservées. Le Lot 1A et le goal restent incomplets.

Les règles d'ordre de verrouillage et de transactions courtes sont cohérentes
avec la [documentation PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).
Cette référence explique la conception ; les résultats locaux ci-dessus en
définissent le périmètre de preuve.
