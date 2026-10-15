# Essais progressifs locaux

Le banc rassemble les composants existants autour d'une page d'accueil et d'une
navigation commune. Il répond au besoin de tester l'interface pendant le
développement ; il ne remplace pas l'application authentifiée du CDC. Aucun code
Auth, route Next protégée, migration ou critère Engine n'est modifié par cet ajout.

## Lancement et portée

Avec Node 24.19.x, les dépendances installées et Docker Desktop sur Linux :

```powershell
node scripts/preview-browser.mjs
```

Ouvrir manuellement `http://127.0.0.1:3140/` après le message de disponibilité.
Le lancement vérifie l'archive Engine épinglée et exécute de vrais calculs avant
d'ouvrir le serveur. Le conteneur sans réseau est borné à 384 Mio, swap nul,
64 processus, utilisateur non privilégié, racine en lecture seule et capacités
retirées. Les montages source sont en lecture seule. Les dépendances locales
sont préparées hors ligne, sans modifier les sources du moteur.

Le mode `node scripts/content-browser.mjs` sert les mêmes écrans sans Docker ni
moteur ; l'accueil signale alors l'indisponibilité des calculs. Les deux modes
utilisent le même port et ne doivent pas fonctionner simultanément. Le serveur
écoute uniquement `127.0.0.1`, sans proxy ni chargement de fichiers d'environnement.
Ses routes locales refusent les origines étrangères, bornent le corps à 256 Kio
et renvoient `no-store`. Les fichiers d'environnement et répertoires privés
sont exclus du service de fichiers, selon les
[options officielles Vite](https://vite.dev/config/server-options).

`Ctrl+C` ou `stop` dans le terminal ferme le serveur et termine son worker.
Le fichier `runtime.json` du nouveau répertoire `.local/lot1a/preview-runtime-*`
identifie le PID et le conteneur de cette instance ; sa présence ne prouve pas
qu'elle fonctionne encore. Les anciennes preuves locales restent conservées.

## Parcours disponibles

Le jalon suivant ajoute une [simulation de publication](publication-ui.md) :
diff, confirmation, expiration, réponse perdue et observation. Ce parcours
supplémentaire utilise uniquement des réponses fictives, sans Auth, Engine ou
base. Les nombres de sept pages et 421 tests ci-dessous restent ceux du relevé
antérieur ; les nouvelles preuves sont séparées dans le document lié.

- **Creator et tests** : vrai `DraftMetadataForm`, exercice exemple canonique,
  champs avancés, MathLive, validation structurelle, génération, inspection
  pédagogique, réponse élève, correction native et rapports par seed.
- **Catalogue** : liste synthétique, statuts, création et états d'erreur. Les
  liens vers les fiches réelles restent non reliés ; la sauvegarde est refusée.
- **Chapitres/compétences et flashcards** : formulaires, aperçus, confirmations
  et conflits simulés des bancs existants. Leurs réponses d'enregistrement sont
  des doubles navigateur ; aucune base n'est appelée et le rechargement perd
  ces changements.
- **MathLive** : clavier scientifique et saisie des différents formats.

Dans le Creator, modifier une expression puis vérifier la définition ; générer
une instance et répondre à la question. Dans les tests, le cas incorrect `0`
convient à l'exemple initial, dont le paramètre entier varie de 2 à 8. Après
modification, fournir des cas correspondant à la nouvelle définition : aucun
résultat positif n'est inventé pour compléter le rapport. Essayer aussi une
définition invalide et une sauvegarde indisponible, puis vérifier la conservation
des champs. Ne pas utiliser de contenu privé ou de données personnelles dans
les exemples de démonstration.

Les actions non reliées à une base répondent avec une indisponibilité explicite.
Le banc n'authentifie personne et ne prouve ni permissions SQL, ni sauvegarde,
ni validation éditoriale réelle, ni publication. Il n'est pas empaqueté comme
une route publique de l'Admin. Aucun verrou de connexion n'est désactivé.

## Vérifications exécutées le 15 octobre 2026

- `npm.cmd run check` : **421 tests / 26 fichiers**, intégrité Engine, types,
  format, build standalone et smoke passent ; lint sans erreur, un avertissement
  `<img>` préexistant dans le banc catalogue. Journal
  `.local/lot1a/.local-workspace-check.log`.
- `node --test scripts/test-local-workspace.mjs` : **deux tests HTTP passent**,
  avec origine/méthode/format/volume refusés, JSON invalide, calcul sans moteur
  refusé et absence de fausse sauvegarde. L'essai initial sous le bac à sable
  échoue par `EACCES` sur localhost ; le lancement normalement autorisé sous le
  compte propriétaire passe, sans modifier les protections système.
- `node scripts/test-local-workspace-native.mjs` : **dix contrôles HTTP avec
  Engine natif passent** : validation positive/négative, génération, projection
  sans attendus privés, bonnes et mauvaises réponses, rapport complet sur seeds
  0/42, refus de mauvaise origine, sauvegarde et publication indisponibles.
  Ce contrôle utilise exclusivement les endpoints du banc sur loopback.
- Compilation Vite des **sept pages** et de leurs composants réussie. Les
  avertissements sur `use client` concernent ce bundle entièrement navigateur ;
  la compilation Next conserve son propre traitement. Ce build ne qualifie pas
  l'affichage visuel ni le chargement effectif dans un navigateur.

Les artefacts datés et leurs empreintes figurent dans
[local-workspace-proof.json](local-workspace-proof.json). La suite source Engine
complète, Auth réelle et SQL ne sont pas exécutés à nouveau par ces essais.

## Limites et point de reprise

La réception visuelle reste non exécutée après le refus de politique navigateur.
Aucun autre navigateur piloté ou capture indirecte n'est utilisé pour contourner
ce refus. Une personne peut ouvrir le banc normalement et communiquer les
résultats observés ; le pilotage automatique attend une session normalement
autorisée. La connexion Staging reste fermée pour les raisons de [Auth](auth.md).

Le checkpoint suivant qualifie séparément le [pilote PostgreSQL et la lecture
machine de reprise](publication-pg.md), avec TLS réel, révocation et restauration.
Les 421 tests ci-dessus restent le relevé daté de ce banc. Ces nouveaux contrôles
ne raccordent pas le banc à une base ou au service complet de publication et
n'achèvent pas le goal global. Avant application
distante restent réconciliation SQL, sauvegarde/PITR, compatibilité élève,
comptes et secrets séparés, réception réelle et autorisation explicite.
