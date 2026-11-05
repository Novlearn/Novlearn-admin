# Raccordement serveur Admin → Engine

## Actions et parcours

Les actions déjà présentes restent en place :

| Interface Admin                           | Route Admin                            | Appels Engine                                                                                                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Vérifier la définition` dans Creator     | `POST /api/admin/engine`               | `validateDefinition` avec `{ definition }`                                                                          |
| Générer / régénérer une prévisualisation  | `POST /api/admin/preview` (`generate`) | `instantiateExercise` avec `{ definition, seed, instanceId }`, puis `projectPublicInstance` avec `{ official }`     |
| Répondre dans l’aperçu                    | même route (`grade`)                   | `gradeAnswer` avec `{ official, submission }`                                                                       |
| Tester les seeds et les cas de correction | même route (`test` / `test_saved`)     | instanciation reproductible, projection et `gradeAnswer` pour les attendus, formats invalides et cas administrateur |
| Panneau de qualification de l’hôte        | `POST /api/admin/engine/qualification` | fixture synthétique via les mêmes appels du runtime que l’éditeur                                                   |

Chaque route vérifie l’origine et la session Admin, puis relit le rôle côté
serveur avant l’appel Engine. Les entrées restent bornées et validées côté
serveur. L’instance officielle et la clé Engine ne sont jamais fournis par le
navigateur. La projection publique est vérifiée avant affichage ; les réponses
attendues restent dans le stockage privé des aperçus. Un brouillon invalide
produit les diagnostics réels Engine. Un échec distant ne déclenche aucun
calcul local de remplacement.

## Contrat vérifié

La dépendance embarquée et le lockfile Admin épinglent `novlearn-exercise-engine`
**0.1.8**, schéma 5, pipeline Engine `0.1.0`, archive locale SHA-256
`82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea`. Aucune
mise à jour de ce package n’est faite dans ce raccordement.

Le code public du dépôt Engine, tag `v0.2.1`, confirme la route `POST /run`, le
protocole de requête 1, les opérations utilisées ci-dessus, les payloads, le
token Bearer et `x-engine-archive-sha256`. Le host attend un token d’au moins 32
octets UTF-8 et une empreinte SHA-256 de 64 caractères hexadécimaux. Il renvoie
l’empreinte dans le même en-tête. Le code HTTP renvoie un `HostResult` contenant
`requestId`, `ok`, `value` ou `error`, et `metrics`; `protocolVersion` n’est pas
présent dans cette réponse HTTP. Le résumé Engine joint indique à tort ce champ
dans sa forme de réponse. Le transport Admin contrôle `requestId`, les mesures,
la taille, l’en-tête d’empreinte et les erreurs documentées par le host.

La source du tag 0.2.1 vérifie le contrat de transport, mais ne révèle pas la
version de l’image actuellement servie par l’URL. Le test réseau de cet
environnement sur `https://staging.novlearn.fr/run` a échoué sur DNS
(`ENOTFOUND`). Le digest configuré doit être celui de l’archive référencée par
le déploiement staging Engine et comparé à son en-tête de réponse ; le hash du
package Admin 0.1.8 n’est pas substituable.

## Configuration serveur

L’Admin Vercel utilise la base de préproduction existante. Dans l’environnement
Vercel **Production** qui héberge `novlearn-admin`, renseigner ces trois
variables uniquement côté serveur :

```dotenv
ADMIN_ENGINE_ENABLED=true
ADMIN_ENGINE_URL=https://staging.novlearn.fr/run
ADMIN_ENGINE_TOKEN=<token Engine staging, au moins 32 octets UTF-8>
ADMIN_ENGINE_ARCHIVE_SHA256=<SHA-256 de l’archive Engine servie en staging>
```

`ADMIN_ENGINE_ARCHIVE_SHA256` est une empreinte publique, mais elle doit être
provisionnée depuis l’asset de release Engine confirmé. Ne pas copier le token
dans `NEXT_PUBLIC_*`, le client, les logs ou Git. Les déploiements Preview ne
doivent recevoir ces variables que s’ils sont eux-mêmes protégés et destinés à
utiliser la préproduction. Les tests locaux distants peuvent utiliser le même
jeu de variables dans le `.env` privé existant ; les variables locales Engine
actuelles demeurent distinctes. Ne jamais configurer `127.0.0.1` comme URL Vercel.

Le runtime Vercel sélectionne obligatoirement ce transport HTTPS. Si la
configuration est absente ou invalide, les routes d’édition restent fermées.
Hors Vercel, les transports locaux précédents sont conservés. La configuration
du navigateur ne contient que les routes Admin.

## Erreurs montrées dans l’interface

Les erreurs de définition et de génération restent des diagnostics métier
Engine. Les erreurs de transport sont différenciées : refus d’authentification,
empreinte d’archive divergente, incompatibilité de contrat, panne réseau,
timeout, saturation ou indisponibilité. Une erreur inattendue d’Admin reçoit un
statut interne distinct. Les détails internes et le token ne sont
pas renvoyés au navigateur. Le timeout HTTP côté Admin est de 10 secondes ; le
host Engine garde ses propres limites et quotas.

## Contrôles et limites de réception

Les tests simulés du transport vérifient payloads, en-têtes, taille, liaison par
`requestId`, empreinte, erreurs HTTP et absence de repli. Les tests unitaires des
routes conservent les gardes de session, rôle et origine. Ils ne constituent pas
un appel au serveur staging.

Le contrôle complet local a exécuté la vérification d’intégrité de l’archive,
1 591 tests, TypeScript et ESLint. Le lint signale un avertissement existant dans
`tests/browser/catalogue.tsx`. Le formatage des fichiers modifiés passe ; le
contrôle global reste bloqué par neuf fichiers préexistants d’archives,
documentation Engine et manifestes. Le build s’arrête sur `EPERM` en créant
`.next/static/chunks/app/admin/statistics/pedagogy`. Le smoke de build n’a donc
pas été exécuté.

Un test direct depuis le poste de travail et un code HTTP de route ne suffisent
pas à prouver l’accès depuis Vercel. La réception réelle exige une configuration
Vercel protégée, une requête authentifiée depuis cet hébergement, l’en-tête
d’archive attendu, le résultat de la fixture synthétique, puis la vérification
connectée des quatre actions UI. Aucun déploiement ni appel réel n’est effectué
par cette PR.
