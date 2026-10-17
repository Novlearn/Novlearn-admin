# Aperçu et tests Engine — implémentation locale

**Rendu du 16 octobre :** les [figures et vecteurs](coordinate-rendering.md)
ajoutent les flèches 2D/3D, le découpage des droites à la fenêtre prescrite,
les bornes MathLive et une description géométrique. Les projections réellement
capturées du moteur servent aux tests et à une page d’essai manuel distincte.
Le tracé des courbes de formules et la réception visuelle restent ouverts.

**Mise à jour du 16 octobre :** le [parcours connecté](local-admin-engine.md)
relie désormais les vraies routes Next au worker Linux borné, avec génération,
correction et rapport signé enregistré depuis la révision relue de SQL. La
réception navigateur reste distincte des contrôles HTTP réels.

**Complément :** les [rapports signés par révision](test-receipts.md) ajoutent
désormais la persistance des tests relus de SQL et leur historique. Ce document
conserve le checkpoint de l’aperçu temporaire ; les nouvelles preuves et portes
de relecture sont documentées séparément.

Le parcours du Creator génère maintenant une instance depuis la définition
courante et une seed entière de 0 à 4294967295. Il affiche la projection élève,
permet une réponse MathLive, texte ou QCM, puis demande la correction au worker
officiel. Les révisions conservées disposent aussi de cet aperçu sans modifier
leur contenu. Les résultats ne changent aucun statut éditorial.

## Provenance et confidentialité

`POST /api/admin/preview` vérifie configuration Staging, drapeau serveur
`ADMIN_ENGINE_ENABLED`, origine exacte, identité Auth vérifiée et rôle Admin
relus à chaque opération. Les invités et les autres rôles sont refusés avant
tout calcul. Chaque corps JSON est limité à 256 Kio réellement reçus.

Les actions autorisées sont génération, inspection privée, correction et tests.
Chaque action possède une liste exacte de champs. Aucune instance officielle,
identité de propriétaire, opération native libre ou destination Production n’est
acceptée du navigateur. La correction utilise uniquement le snapshot généré et
retenu par le serveur, avec l’ID d’instance attribué côté serveur.

La réponse de génération contient seulement la projection publique produite par
l’Engine, sa seed, son empreinte et une référence opaque temporaire. Une garde
refuse les champs privés et les indications/explications dans cette projection.
Le composant `PublicExercise` reçoit seulement `PublicInstance`. Les variables
tirées et les attendus demandent une inspection propriétaire distincte, après
nouvelle vérification du rôle. Toutes les variantes textuelles sont conservées.
Les verdicts de correction exposent uniquement les champs de leur contrat.
Toutes les réponses HTTP sont privées et `no-store`.

Les snapshots restent dans la mémoire du processus : dix minutes, deux par
Admin, trente-deux globalement, 512 Kio maximum par snapshot. Ils sont détachés
des objets entrants et des lectures retournées. Expiration, redémarrage ou
autre processus produisent un refus 410, jamais une correction sur une instance
recréée implicitement. Un hébergement à plusieurs processus nécessitera un
stockage partagé privé ou une affinité explicite avant sa réception.

Deux travaux au maximum peuvent être actifs, un par Admin. Le host natif garde
une opération active et quatre en attente, ainsi que ses quotas certifiés.
Les requêtes d’aperçu/correction sont bornées à vingt secondes, les lots de tests
à deux minutes ; une interruption ne devient pas un résultat positif.
Une modification de définition retire l’aperçu, les données privées et le
rapport affichés, annule la requête du navigateur et écarte les réponses tardives.
Les cas de réponse conservés doivent encore correspondre aux questions ; le
serveur signale les références absentes, sans les convertir silencieusement.

## Tests par seed

Une requête accepte une à cinq seeds distinctes, seize cas de réponse et huit
questions au maximum. Pour chaque seed, le serveur :

1. Instancie deux fois la même définition avec le même ID et la même seed.
2. Compare intégralement les snapshots privés détachés pour vérifier le rejeu.
3. Exécute et contrôle la projection élève officielle.
4. Soumet l’attendu dérivé par l’Engine à sa propre politique de correction.
5. Vérifie le refus d’un format de soumission volontairement invalide.
6. Soumet les cas administrateur et compare leurs verdicts aux résultats requis.

Chaque question exige un cas volontairement incorrect. Son absence, une réponse
en réalité correcte dans ce cas, un résultat indéterminé, une divergence de rejeu
ou un diagnostic de génération empêche la réussite du rapport. Un exercice sans
question garde une couverture de correction incomplète. Les politiques de forme
restent appliquées à l’attendu affiché : aucun assouplissement automatique n’est
introduit pour le faire passer.

Le rapport précise empreinte SHA256 du contenu, Engine 0.1.0, seeds, questions,
diagnostics et verdicts. Cette empreinte de contenu sert à identifier ce test ;
elle n’est pas substituée à l’empreinte SQL du catalogue. Le rapport est encore
temporaire et n’est pas une attestation persistée ni une autorisation de publication.

## Rendu

Texte, sections, expressions, équations, systèmes, texte enrichi, questions et
QCM disposent d’un rendu canonique. Les tableaux de signes, variations, valeurs
et statistiques utilisent les données prescrites par l’Engine. Les points de
suite, géométrie et plan complexe sont positionnés dans leur fenêtre ; les
vecteurs montrent les coordonnées autorisées et les arbres montrent les branches
prescrites. Les opérations de coordonnées servent seulement au dessin.

**Limites explicites :** les formules de graphes de fonctions et de suites
explicites/récurrentes ne sont pas échantillonnées. Le contrat actuel les expose
en présentation avec `formulaDomain: unverified`, sans données calculées de courbe.
L’interface affiche cette limite ; aucune logique mathématique héritée ou
concurrente n’est importée. Le rendu historique NovLearn utilise un autre contrat
et des calculs clients ; il n’a pas été modifié ou repris dans ce cœur.
Le rendu avancé doit encore recevoir ses cas limites, son accessibilité et sa
qualification visuelle complète avant réception de tous ces éléments.

## Vérifications et portée

- **184 tests Admin passent** : permissions, propriétaire/expiration/quotas,
  rejet d’instances forgées, protocoles, fuite privée, rejeu divergent, résultat
  indéterminé, variantes textuelles, tests positifs/négatifs et rendu serveur.
- Types, lint sans erreur et format passent. Un build incrémental a échoué avec
  un manifeste Next incomplet ; son artefact et son log restent conservés.
  Le build depuis un nouveau dossier passe, puis le smoke HTTP du vrai standalone
  passe, notamment le refus de l’API d’aperçu désactivée.
- Le service source réel est exercé via l’archive épinglée dans Docker Linux
  sans réseau, 384 Mio, swap 0, 64 processus, lecture seule, sans capacités,
  utilisateur non privilégié. Génération, correction, isolation propriétaire,
  projection et rapport de deux seeds sont exercés dans ce profil.
- Brave utilise les mêmes composants et ce service natif dans un banc **à
  propriétaire fictif**, sans Auth ni base : seed 42, réponse 6 puis 3+3 acceptées,
  inspection privée distincte, rapport seeds 0/42 avec cas incorrect 0, retrait du
  rapport après modification. À 390 px, aucun débordement horizontal global ;
  aucune erreur console. Ce banc ne certifie pas une session distante.

Les preuves datées et empreintes figurent dans [preview-local-proof.json](preview-local-proof.json).
`node scripts/preview-browser.mjs` démarre ce banc sur 127.0.0.1:3140 avec un
nouveau conteneur éphémère. Ses ponts et son propriétaire fictif restent dans les
scripts/tests ; aucune dérogation Auth n’est ajoutée au produit. La copie de test
ajuste uniquement l’extension d’import ESM pour le chargement TypeScript natif.

## Suite et portes avant activation

Persister les rapports liés à une révision et à son empreinte SQL, protéger la
relecture/approbation et son invalidation, puis construire la publication sélective
autorisée. La récupération des sorties d’éditeur non annulables, le rendu des
courbes et la réception avancée restent aussi nécessaires.

Le serveur complet avec Auth réelle, sa mémoire et son exploitation restent à
qualifier sur la cible d’hébergement. Les portes SQL, sauvegarde/restauration
réelles, compte Admin/révocation et compatibilité élève restent distinctes.
Aucune donnée existante, SQL, base distante, publication ou déploiement n’est
modifié dans cette étape. L’objectif global reste actif et incomplet.
