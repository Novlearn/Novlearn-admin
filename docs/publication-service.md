# Orchestration de publication — intégration locale

Le service serveur relie désormais la source autorisée, une nouvelle exécution
Engine, le diff signé, le journal durable et la transaction cible. La route
`POST /api/admin/publication` est raccordée mais **désactivée par défaut**.
Ce jalon ne livre pas encore l'écran de publication ni l'application connectée.
Aucune configuration, migration ou publication distante n'est effectuée.

## Préparer et confirmer

L'entrée du navigateur contient uniquement la version, son empreinte et son epoch
décimal, le mode et un identifiant de lot. Le serveur vérifie la session Staging
et relit le rôle, puis utilise son client Supabase de session. Il lit uniquement
la définition demandée et appelle `admin_export_exercise_publication` avec son
aller-retour JSON. SQL vérifie indépendamment le rôle réel, la relecture, le reçu,
la clé active, le contenu courant et l'absence d'arrondi lors du transport JSON.
Les définitions, rapports, endpoints et résultats fournis par le navigateur
ne font jamais autorité pour publier.

Le codec accepte le diagnostic natif de format invalide, dont `questionId` est
vide ; les résultats corrects et incorrects doivent identifier leur question.
La fixture SQL native conservée et le rejeu officiel exercent ce contrat réel.
Les critères restent : deux à cinq seeds distincts, génération reproductible,
projection publique sûre, absence de diagnostic et couverture correcte,
incorrecte et invalide pour chaque question.

Le véritable Engine fixé par l'archive certifiée rejoue les seeds et cas
approuvés, à la préparation **et à la confirmation**. Le serveur compare la
définition, la version, les seeds et la couverture à la relecture conservée.
Il n'ajoute pas de reçu qui invaliderait cette relecture. Il n'ajoute aucune
logique mathématique. L'admission partagée avec l'aperçu reste limitée à deux
travaux globaux et un par administrateur dans le processus serveur.

La préparation persiste un plan de quinze minutes et renvoie le diff accompagné
d'une confirmation HMAC SHA-256. Sa clé serveur distincte
`ADMIN_PUBLICATION_CONFIRMATION_KEY` comporte 32 octets, encodés en 64 caractères
hexadécimaux. Elle reste absente dans l'exemple et n'est jamais générée
implicitement. La signature lie acteur, plan et empreinte, destination physique,
expiration et métadonnées de la nouvelle vérification. Changer la clé invalide
les confirmations existantes. Le jeton ne contient ni définition ni cas privé.
Il ne dispense jamais des nouveaux tests lors de la confirmation.

Avant transfert, le service recharge et compare exactement le snapshot approuvé.
Il acquiert le verrou de session cible **avant** de réclamer le plan, puis
conserve la protection source pendant la transaction. L'accès et l'annulation
sont revérifiés immédiatement avant commit. Le verrou cible reste tenu jusqu'à
l'enregistrement durable du résultat source.

## Résultats et reprise

Un rollback confirmé devient `failed/not_applied`. Une réponse perdue au claim
ou un enregistrement source indisponible appelle une vérification de résultat,
sans nouvelle application automatique. Un COMMIT dont l'issue n'est pas établie
reste `uncertain`. Une annulation du navigateur après un commit confirmé
n'empêche pas de conserver ce fait dans le journal.

La reprise observe la cible sous le même verrou puis enregistre son constat.
Elle ne réclame jamais de nouveau plan et n'appelle jamais l'application SQL.
La convergence observée porte `unchanged` ; elle ne prouve pas quelle opération
a historiquement créé la révision. La file machine reste privée et bornée,
utilisable après révocation de l'initiateur pour établir un fait. Le parcours
humain exige toujours un administrateur courant et son propre plan.
Une opération d'une autre destination reste en attente, sans remapping implicite.

La route exige aussi l'origine exacte, un JSON limité à 8 Kio et des champs
stricts. Elle transporte les cookies renouvelés, ferme les pools de la requête
et répond sans cache. Une issue incertaine renvoie HTTP 202 avec son état
explicite ; un résultat à récupérer ne devient jamais un faux succès.
Le calcul est borné à deux minutes par requête, en plus des limites du runtime.
L'observation machine n'est exposée par aucune action HTTP.

## Vérifications locales et limites

Les preuves datées sont recensées dans
[publication-service-local-proof.json](publication-service-local-proof.json).
Le contrôle complet couvre intégrité de l'archive, tests Admin, types, lint,
format, compilation et smoke de la route fermée. Les tests HTTP unitaires
utilisent des doubles ; ils ne prouvent pas une session Auth réelle.

Le contrôle complet final passe **547 tests dans 31 fichiers**, types, lint
sans erreur (un avertissement préexistant), format, build standalone et smoke.
La nouvelle route est bien présente dans le build ; le smoke vérifie son refus
HTTP 503 lorsque l'accès est désactivé et son refus GET. Les sept scénarios
natifs, les neuf scénarios cibles et les 16 assertions SQL avant/après
restauration passent. Le manifeste natif contient 33 empreintes qui correspondent
aux sources actuelles ; aucune migration n'est ajoutée ou modifiée par ce jalon.

Un essai complet a rencontré le délai Vitest inchangé de cinq secondes sur le
rejeu SDK, avec 31 workers et des suites Docker simultanées. Son journal reste
conservé. La concurrence Vitest est maintenant bornée à quatre workers ; aucun
délai, cas ni critère de réussite n'est augmenté ou retiré. Voir la
[configuration officielle](https://vitest.dev/config/maxworkers.html).

Un rejeu natif intermédiaire a aussi refusé une nouvelle vérification avant
transfert, au scénario de confirmation altérée. Le service a masqué son détail
interne : la cause exacte de ce refus n'est donc pas établie. L'étiquette de
phase du banc provenait encore du contrôle précédent de certificat ; elle ne
prouve pas un défaut TLS. Ce résultat reste un échec conservé, distinct du
rejeu final complet dont les sources et le bundle sont enregistrés par empreinte.

`node --conditions=react-server scripts/test-publication-pg-local.mjs --publication-service`
ajoute sept scénarios aux neuf transactions cibles et aux contrôles du pilote :
publication avec tests frais aux deux étapes, répétition identique, confirmation
altérée, échec réel d'un cas Engine, perte d'acquittement après COMMIT réel,
reprise sans application, et annulation du plan. Les bases sont synthétiques,
avec historique élève non vide conservé et snapshots de toutes les tables.
Les deux bases partagent un cluster isolé sans port publié ; aucune donnée
distante ne sert de fixture. Les volumes et artefacts sont conservés.

Le worker utilise l'Engine natif Linux x64, cgroup v2 à 384 Mio, swap nul,
64 processus, utilisateur non privilégié et racine en lecture seule. Le réseau
Docker interne sert uniquement les bases locales de cette expérience. Le client
Supabase installé est réellement utilisé, mais son transport HTTP est remplacé
par un adaptateur de test vers les requêtes SQL fixes sous `authenticated`.
L'identité et les claims sont synthétiques. **Ce dispositif ne certifie donc
ni PostgREST réel ni connexion Auth Supabase réelle.** Les identifiants de ce
transport n'appartiennent qu'au cluster de test et ne sont jamais ceux d'Admin.

Le service enregistre le journal de résultat mais **ne finalise pas encore le
statut éditorial/pointeur Staging de la version source**. Le raccordement de
cette transition, l'historique visible, la confirmation UI, les lots par exercice
et le rollback fonctionnel de bout en bout restent à terminer. Les tests du
service présent ne constituent pas une validation de ces parcours absents.

Avant mise en service restent aussi la réconciliation et l'application SQL
autorisées séparément, le compte Admin, les secrets et rôles limités, les vrais
parcours Auth/révocation, la réception visuelle, la qualification complète du
confinement, la compatibilité élève et les procédures d'exploitation. Le Lot 1A
et le goal complet restent ouverts. Les restrictions navigateur et Windows
restent respectées ; aucun contournement n'est tenté.

## Références

Le [changelog Supabase](https://supabase.com/changelog) et la
[documentation RPC](https://supabase.com/docs/reference/javascript/rpc) ont été
consultés. L'index Markdown du changelog n'était pas lisible par l'outil web ;
la page officielle HTML a été utilisée. La méthode `abortSignal` est vérifiée
dans les sources du client installé et par les tests de transport et de types.
Les [transactions et reprises cibles](publication-target.md) conservent leur
périmètre de preuve daté ; leurs anciens nombres de tests ne sont pas des
résultats de cette nouvelle intégration.
