# Connexion PostgreSQL privée et lecture de reprise — qualification locale

**Checkpoint suivant :** la [transaction cible](publication-target.md) ajoute la
primitive de transfert et sa reprise vérifiées sur copies. La clé de destination
est maintenant liée au projet et la base réelle limitée à `postgres` ; ce texte
conserve les preuves datées du pilote précédent. Le service et l'UI restent ouverts.

Le pilote PostgreSQL et la lecture machine du journal disposent maintenant
d'une vérification réelle sur copies locales. **Le service complet de transfert
n'est pas encore raccordé** : aucune route de publication, configuration réelle,
identité distante ou activation Auth n'est ajoutée. Ce volet complète le
[journal durable](publication-journal.md) ; il ne certifie pas la publication.

## Connexions et autorité

`publication-pg.ts` construit deux pools distincts, avec des identifiants LOGIN
séparés des capacités NOLOGIN. Le validateur d'environnement reste fermé sans
activation et revue Auth Staging, revue de publication et configuration complète.
Il exige les hôtes directs des projets distincts, port 5432, noms de service
fixes et mots de passe distincts même après décodage URL. Il refuse les paramètres
de connexion qui pourraient remplacer la configuration SSL, les poolers et les
identités privilégiées générales. `.env.publication.example` reste désactivé et
ne fournit aucun secret. Le simple ajout de valeurs ne livre pas un transfert.

Chaque checkout remet la session à zéro, vérifie l'identité SQL réelle, puis
active sa capacité fixe. Le LOGIN est NOINHERIT, sans superutilisateur,
réplication, création de base/rôle ni contournement RLS, sans CREATE sur la base
ou le schéma public. Il possède exactement une appartenance autorisée,
sans ADMIN OPTION ni héritage implicite et avec SET permis. La capacité est
NOLOGIN, sans attribut privilégié ni appartenance à une autre capacité.
Les limites de pool, connexion, requête, verrou et transaction restent bornées.
Les erreurs de connexion sont masquées et une connexion refusée est détruite.

TLS vérifie la chaîne et le nom du serveur, avec CA optionnelle fournie par
l'opérateur ; aucune désactivation de validation n'est introduite. Les paramètres
SSL dans une URL peuvent remplacer l'objet SSL du pilote : ils sont refusés,
conformément à la [documentation node-postgres](https://node-postgres.com/features/ssl).
Les dépendances `pg` et `@types/pg` sont épinglées à 8.23.1. Cette implémentation
ne provisionne aucun LOGIN réel ; ceux des tests n'existent que dans leur nouveau
cluster synthétique. Les identités distantes demanderont une procédure opérateur
et une autorisation séparées avant toute utilisation.

## Reprise machine bornée

La 61e migration canonique, commit NovLearn local `cdf6491`, est
`20261015131620_novlearn_admin_publication_recovery.sql`.
`pending_publication_operations` retourne au maximum dix opérations
`executing`/`uncertain`, ordonnées par date et UUID, avec curseur privé.
Un curseur devenu terminal reste utilisable ; un curseur inconnu est refusé.
La fonction est stable, à namespace fixe, exclusivement accordée à la capacité
du journal. Les rôles anon/authenticated/service_role ne peuvent pas l'appeler.

La primitive `PublicationJournal.pending` utilise cette connexion privée sans
dépendre du compte initiateur, vérifie le contrat et les états retournés et ne
publie rien. Les opérations humaines conservent leurs vérifications fraîches.
La reprise peut conserver une observation connue après révocation, mais ne doit
jamais présenter un timeout comme un échec certain. Le futur orchestrateur doit
encore relire la vraie cible et traiter les résultats incertains avant répétition.

## Vérifications effectivement exécutées

Les [preuves datées](publication-pg-local-proof.json) renvoient aux journaux bruts
et aux scripts, sans inclure les mots de passe ni les clés des fixtures.

- **424 tests Admin / 26 fichiers**, types, lint sans erreur, format, build et
  smoke standalone passent. L'avertissement `<img>` préexistant demeure.
  Les 87 tests ciblés journal/pilote incluent le refus de mots de passe équivalents
  encodés différemment et les options de délégation de rôle.
- **11 contrôles d'intégration réels** passent dans un nouveau PostgreSQL
  17.11.0.003, avec deux bases synthétiques. Le client Node Linux utilise un
  réseau Docker interne, sans port publié, des montages en lecture seule,
  utilisateur non privilégié, mémoire 256 Mio sans swap et 64 processus.
- Les deux connexions utilisent **TLS 1.3**, socket chiffrée et certificat
  effectivement autorisé. Un certificat non approuvé et un certificat approuvé
  au mauvais nom sont refusés. L'Engine reste dans son profil Linux indépendant ;
  aucun critère ou protection Windows n'est modifié.
- Attribut LOGIN inattendu et droit de délégation ajouté dans la seule fixture
  sont refusés. Le pilote conserve la transaction de protection dédiée, décode
  le vrai journal SQL, retrouve l'opération après révocation réelle du profil
  et refuse alors la lecture humaine, même avec une vue Admin synthétique périmée.
  La passerelle d'identité est un double : cela ne certifie pas Supabase Auth réel.
- **16 assertions SQL avant et après dump/restore** passent : permissions,
  états, limite de page, ordre à dates égales, précision de l'époque, curseurs
  et révocation. Les copies de records utilisées pour la pagination sont des
  fixtures propriétaires de protocole ; elles ne deviennent pas des exercices
  nouvellement approuvés et ne servent à aucun transfert.
- La migration ne change aucune ligne. Le parcours du pilote conserve les
  snapshots entiers des **60 tables hors journal** avant et après la révocation
  intentionnelle faite par le test ; la ligne de profil modifiée par cette
  fixture est vérifiée intégralement contre son rôle et sa date transactionnelle
  attendus. Aucune colonne ni table n'est masquée pour obtenir un succès.
  Les **62 tables cible restent identiques**. Les 62 snapshots correspondent
  après restauration ; les fixtures SQL sont annulées. Les séquences ne sont
  pas comparées par ce nouveau contrôle.
- Le relevé antérieur de **rejeu neuf des 61 migrations** est conservé ; les
  61 empreintes correspondent encore au worktree. La sauvegarde complète,
  comparateur structure/ACL/séquences et les 69 contrôles historiques restent
  les preuves du checkpoint 60, sans nouvelle exécution revendiquée ici.
- L'audit npm enregistré pour ce lockfile relève zéro avis pour les dépendances
  d'exécution et sept avis élevés des outils de développement déjà présents,
  à versions inchangées. Aucun `audit fix --force` ou changement majeur n'est
  utilisé pour fabriquer un résultat sans avis. Ce relevé n'est pas un audit
  de sécurité complet de l'application.

Le résultat final du journal est `failed/not_applied` parce que le script n'a
effectué **aucun appel d'application cible**. Il ne le déduit pas d'une perte de
connexion et ne le présente pas comme un transfert réussi. Les bases et volumes
de test sont conservés ; seuls les processus et conteneurs créés pour ces essais
sont arrêtés. Le conteneur des essais d'interface reste disponible séparément.

## Échecs conservés et corrections

Le réseau interne Docker ne publie pas le port demandé : le client a été placé
dans ce même réseau privé, sans ouvrir le réseau du conteneur. L'image PostgreSQL
minimale n'a pas OpenSSL ; les certificats de test sont générés hors ligne avec
l'image Node locale épinglée. Aucun téléchargement n'est nécessaire.

La connexion réelle a révélé une différence masquée par les doubles : les
tableaux PostgreSQL `name[]` étaient reçus en texte. La requête les convertit en
`text[]`, sans accepter une identité ou une permission supplémentaire. Après
SET ROLE, la capacité restreinte ne voit pas son backend dans `pg_stat_ssl` ; le
test vérifie donc la socket TLS réellement autorisée, sans accorder de droit de
surveillance SQL. Le refus initial reste enregistré.

La première comparaison globale après une révocation volontaire du profil
constatait sa date `updated_at` modifiée par le trigger normal. Le banc vérifie
maintenant le changement exact de cette fixture, puis compare intégralement
les données avant/après les seules actions du pilote. Les comparaisons ne
suppriment aucun champ ; les journaux de l'échec restent conservés.

## Reproduction et suite

```powershell
node --conditions=react-server scripts/test-publication-pg-local.mjs
```

Le lanceur vérifie l'identité du conteneur de preuve natif source, le copie sans
changer ses données, puis crée ses propres bases et réseau. Il utilise le pipe
Docker local explicite, sans service distant. Les noms de source/artefact sont
ceux du checkpoint documenté ; une autre preuve doit faire l'objet d'une mise à
jour explicite du lanceur, pas d'un remplacement silencieux du périmètre.

À raccorder : Engine et relecture lors de la planification, transaction cible,
vérification après commit, reprise après issue ambiguë, routes protégées et
confirmations individuelles/groupées. La qualification complète du confinement
et la réception visuelle restent ouvertes. La restriction navigateur reste
respectée. L'application SQL distante, les identités, la connexion réelle,
la première publication, le push et le déploiement ne sont pas autorisés par
ces résultats. Le Lot 1A et le goal restent incomplets.
