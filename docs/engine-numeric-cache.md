# Correctif Engine des nombres de rendu — 17 octobre 2026

**Le nouveau build Engine est qualifié localement. Son adoption dans l’Admin
reste à réaliser avec la rotation de l’empreinte SQL.** L’instance connectée
conserve son archive précédente et les limites observées avec ce build.

## Correction autorisée et limitée

L’accord humain D05, consigné aussi comme D51 dans Engine, autorise les
corrections locales et leur certification, sans changer les critères. Le profil
Linux borné choisi par D06 reste inchangé.

Une seule source du dépôt propriétaire est modifiée : `src/instantiation.ts`.
Les nombres de rendu de source brute strictement identique peuvent réutiliser
un succès exact dans la même instanciation. Le contexte et les paramètres sont
déjà résolus. Les formules, erreurs, sources d’écriture différente et générations
suivantes restent séparées. Le détachement final existant recopie chaque
occurrence et conserve des objets/AST indépendants. Aucun contexte Cortex global,
nouvel évaluateur, changement de contrat, dépendance ou limite n’est ajouté.

## Preuves réellement exécutées

La [preuve machine](engine-numeric-cache-proof.json) conserve les sources, le
commit propriétaire, l’archive, les journaux et les scopes distincts :

- **1 540 tests Engine dans 30 fichiers**, zéro skip, build/types/lint/format
  passent ; six nouveaux tests protègent sources, chemins, domaine et isolation.
- Le tarball installé passe les exports, les types consommateur, le bundle
  browser exécuté dans Node et son smoke isolé Windows. Aucun changement de
  protection Windows ni acceptation des futurs binaires n’est déduit de ce test.
- La même définition avancée complète passe **six instanciations natives**,
  seeds 0/42 sur trois tours, entre **2,41 et 2,64 secondes**, avec le délai natif
  inchangé de **5 secondes**. L’ancienne archive avait donné 4,985 s et un timeout
  à 5,022 s ; ces observations restent conservées dans le relevé du rendu.
- Les six projections publiques sont identiques aux captures précédentes ; les
  réponses attendues, incorrectes et invalides sont contrôlées pour les deux seeds.
- **10 comparaisons JSON exactement identiques** avec l’ancienne archive vérifient
  snapshots privés et diagnostics, dont les refus d’expression indéfinie,
  paramètre inconnu, variable formelle et décimal hors budget. Ce banc portable
  ne remplace pas la vérification du délai par le host natif.
- Le package Linux installé passe ses **sept opérations distinctes** avec rejeu,
  les **12 contrôles OS existants** et les **huit parcours historiques**, avec
  recette invalide refusée. Les workers sont réellement arrêtés.

Les conteneurs inspectés gardent l’image Node 24.19.0 épinglée, 384 MiB,
swap 0, 64 pids, réseau désactivé, racine en lecture seule, UID non privilégié,
cap-drop ALL et no-new-privileges. Installation hors ligne, archives en lecture
seule, aucun identifiant Auth ou de base transmis. Aucun critère n’est assoupli
et aucun nouvel essai automatique n’est ajouté au produit.

Le package privé et le contrat restent 0.1.0 / schéma 5. Ce build exact est :

`d4d3abc408ab37f2f8a5faa512964b48947828bae9209cb1460b47111ca582f9`.

## Intégration locale suivante

Les RPC de reçus et les métadonnées de publication épinglent actuellement
l’ancienne archive `650128cd…9190290`. Remplacer seulement le fichier npm
créerait une incohérence de signature ou de publication ; cela n’a pas été fait.

Préparer une migration dans le dépôt SQL propriétaire NovLearn, la qualifier
sur copie neuve et conservée avec comparaison des données, puis coordonner
l’empreinte, le package et le lanceur de l’instance locale. Rejouer ensuite les
tests connectés avec une vraie session et de nouveaux rapports. Les anciens
reçus, approbations et journaux doivent rester conservés et ne jamais être
réétiquetés comme provenant du nouveau build. D07 couvre ce travail local ;
les environnements distants gardent leur autorisation séparée.

Cette étape ne relance pas Python/FastAPI ni une nouvelle session MathLive
navigateur et ne certifie aucun hébergement ou toutes les définitions possibles.
Courbes de formules, réception visuelle, publication HTTP complète, lectures
Production et mise en service restent ouverts. Le goal reste actif et incomplet.
