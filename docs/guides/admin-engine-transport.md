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
**0.2.3**, schéma 5, pipeline Engine `0.1.0`, archive locale SHA-256
`3068549e521d1f643ced8564e94ad645dbccace22a9ec173c912530af3766028`.

Le code public du dépôt Engine, tag `v0.2.3`, confirme la route `POST /run`, le
protocole de requête 1, les opérations utilisées ci-dessus, les payloads, le
token Bearer et `x-engine-archive-sha256`. Le host attend un token d’au moins 32
octets UTF-8 et une empreinte SHA-256 de 64 caractères hexadécimaux. Il renvoie
l’empreinte dans le même en-tête. Le code HTTP renvoie un `HostResult` contenant
`requestId`, `ok`, `value` ou `error`, et `metrics`; `protocolVersion` n’est pas
présent dans cette réponse HTTP. Le résumé Engine joint indique à tort ce champ
dans sa forme de réponse. Le transport Admin contrôle `requestId`, les mesures,
la taille, l’en-tête d’empreinte et les erreurs documentées par le host.

La source du tag 0.2.3 vérifie le contrat de transport, mais ne révèle pas la
version de l’image actuellement servie par l’URL. Le test réseau historique sur
`https://staging.novlearn.fr/run` a échoué sur DNS (`ENOTFOUND`). Le workflow
44165765404 rapporte le déploiement réussi de la release Engine ; un appel réseau
depuis l'Admin reste à effectuer avant de recevoir ce transport.

`ENGINE_ARTIFACT_SHA256` n'est pas un secret : c'est l'empreinte du contenu de
l'archive Engine exacte que l'on attend du host. Le host exige cette valeur sur
chaque requête, la compare à son archive active et renvoie `409 archive-mismatch`
si elle diffère. Le contrôle évite qu'Admin utilise silencieusement une autre
version que celle attendue. L'empreinte change normalement quand l'archive est
reconstruite. Le contrat Engine actuel n'expose pas de route de découverte de
cette empreinte (`/healthz` ne la renvoie pas) : Admin ne peut donc pas suivre
automatiquement une nouvelle archive tout en conservant ce contrôle. Une mise à
jour sans changement de configuration nécessiterait une évolution du contrat
Engine, par exemple une identité authentifiée et récupérable par Admin, ou une
politique explicite d'acceptation de toute archive derrière l'URL staging.

## Configuration serveur

L’Admin Vercel utilise la base de préproduction existante. Dans l’environnement
Vercel **Production** qui héberge `novlearn-admin`, renseigner ces quatre
variables uniquement côté serveur :

```dotenv
ADMIN_ENGINE_ENABLED=true
ENGINE_URL=https://staging.novlearn.fr/run
ENGINE_TOKEN=<token Engine staging, au moins 32 octets UTF-8>
ENGINE_ARTIFACT_SHA256=3068549e521d1f643ced8564e94ad645dbccace22a9ec173c912530af3766028
```

`ENGINE_TOKEN` réutilise le nom du token déjà présent dans l'environnement Vercel.
`ENGINE_ARTIFACT_SHA256` est une empreinte publique, pas un secret ; elle doit
être provisionnée depuis l'asset de release Engine confirmé et mise à jour si
l'archive déployée change. Ne pas copier le token
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

## Stockage privé des aperçus sur Vercel

Sur Vercel, `POST /api/admin/preview` transmet le snapshot officiel privé aux
RPC `admin_put_preview_snapshot` et le relit avec
`admin_get_preview_snapshot`, via le client Supabase de la session Staging
courante. Les fonctions doivent dériver le propriétaire de `auth.uid()`, refuser
les non-Admins côté serveur, appliquer la limite de dix minutes et n’exposer le
snapshot par aucune table publique. La route vérifie à nouveau la session et le
rôle pour chaque action ; l’instance privée ne vient jamais du navigateur.

**Constat Staging du 20 novembre 2026 :** l’historique de migrations ne contient
pas de migration de stockage d’aperçus et une lecture du catalogue PostgreSQL
ne trouve aucune fonction portant ces deux noms. Le résultat n’établit donc pas
un défaut de permissions de fonctions existantes. Les journaux Supabase montrent
deux appels `POST /rest/v1/rpc/admin_put_preview_snapshot` en HTTP 404 à 09:56
et 09:57 UTC ; aucun appel de lecture n’a été observé. Le code de l’Admin affiche
désormais un diagnostic spécifique quand PostgREST signale une fonction absente
ou une signature non chargée.

Le dépôt Admin ne porte pas les migrations canoniques : leur historique reste
dans le dépôt NovLearn, conformément à la frontière décrite dans
[Architecture](./architecture.md#schéma-et-migrations). La migration canonique
est préparée dans [NovLearn, PR #23](https://github.com/Novlearn/Novlearn/pull/23)
et a été appliquée au projet Supabase `novlearn-staging` le 20 novembre 2026.
La vérification du catalogue confirme les deux fonctions `SECURITY DEFINER`,
exécutables par `authenticated` seulement ; `anon` ne peut pas les appeler et
les utilisateurs authentifiés n’ont pas d’accès direct à la table privée. Une
[copie de référence SQL](../proposals/admin-preview-snapshot-storage.sql)
accompagne cette correction ; la migration canonique est dans le dépôt NovLearn.
Après publication Admin, tester génération, inspection et correction depuis
Vercel avec une session Admin, puis vérifier que l’autre utilisateur reçoit le
même refus qu’un aperçu expiré.

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
par cette modification fusionnée.
