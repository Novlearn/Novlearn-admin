# Raccordement serveur Admin  Engine

## Actions et parcours

Les actions d�j� pr�sentes restent en place :

| Interface Admin                           | Route Admin                            | Appels Engine                                                                                                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `V�rifier la d�finition` dans Creator     | `POST /api/admin/engine`               | `validateDefinition` avec `{ definition }`                                                                          |
| G�n�rer / r�g�n�rer une pr�visualisation  | `POST /api/admin/preview` (`generate`) | `instantiateExercise` avec `{ definition, seed, instanceId }`, puis `projectPublicInstance` avec `{ official }`     |
| R�pondre dans l'aper�u                    | m�me route (`grade`)                   | `gradeAnswer` avec `{ official, submission }`                                                                       |
| Tester les seeds et les cas de correction | m�me route (`test` / `test_saved`)     | instanciation reproductible, projection et `gradeAnswer` pour les attendus, formats invalides et cas administrateur |
| Panneau de qualification de l'h�te        | `POST /api/admin/engine/qualification` | fixture synth�tique via les m�mes appels du runtime que l'�diteur                                                   |

Chaque route v�rifie l'origine et la session Admin, puis relit le r�le c�t�
serveur avant l'appel Engine. Les entr�es restent born�es et valid�es c�t�
serveur. L'instance officielle et la cl� Engine ne sont jamais fournis par le
navigateur. La projection publique est v�rifi�e avant affichage ; les r�ponses
attendues restent dans le stockage priv� des aper�us. Un brouillon invalide
produit les diagnostics r�els Engine. Un �chec distant ne d�clenche aucun
calcul local de remplacement.

## Contrat v�rifi�

La d�pendance embarqu�e et le lockfile Admin �pinglent `novlearn-exercise-engine`
**0.1.8**, sch�ma 5, pipeline Engine `0.1.0`, archive locale SHA-256
`82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea`. Aucune
mise � jour de ce package n'est faite dans ce raccordement.

Le code public du d�p�t Engine, tag `v0.2.1`, confirme la route `POST /run`, le
protocole de requ�te 1, les op�rations utilis�es ci-dessus, les payloads, le
token Bearer et `x-engine-archive-sha256`. Le host attend un token d'au moins 32
octets UTF-8 et une empreinte SHA-256 de 64 caract�res hexad�cimaux. Il renvoie
l'empreinte dans le m�me en-t�te. Le code HTTP renvoie un `HostResult` contenant
`requestId`, `ok`, `value` ou `error`, et `metrics`; `protocolVersion` n'est pas
pr�sent dans cette r�ponse HTTP. Le r�sum� Engine joint indique � tort ce champ
dans sa forme de r�ponse. Le transport Admin contr�le `requestId`, les mesures,
la taille, l'en-t�te d'empreinte et les erreurs document�es par le host.

La source du tag 0.2.1 v�rifie le contrat de transport, mais ne r�v�le pas la
version de l'image actuellement servie par l'URL. Le test r�seau de cet
environnement sur `https://staging.novlearn.fr/run` a �chou� sur DNS
(`ENOTFOUND`). Le digest configur� doit �tre celui de l'archive r�f�renc�e par
le d�ploiement staging Engine et compar� � son en-t�te de r�ponse ; le hash du
package Admin 0.1.8 n'est pas substituable.

## Configuration serveur

L'Admin Vercel utilise la base de pr�production existante. Dans l'environnement
Vercel **Production** qui h�berge `novlearn-admin`, renseigner ces trois
variables uniquement c�t� serveur :

```dotenv
ADMIN_ENGINE_ENABLED=true
ADMIN_ENGINE_URL=https://staging.novlearn.fr/run
ADMIN_ENGINE_TOKEN=<token Engine staging, au moins 32 octets UTF-8>
ADMIN_ENGINE_ARCHIVE_SHA256=<SHA-256 de l'archive Engine servie en staging>
```

`ADMIN_ENGINE_ARCHIVE_SHA256` est une empreinte publique, mais elle doit �tre
provisionn�e depuis l'asset de release Engine confirm�. Ne pas copier le token
dans `NEXT_PUBLIC_*`, le client, les logs ou Git. Les d�ploiements Preview ne
doivent recevoir ces variables que s'ils sont eux-m�mes prot�g�s et destin�s �
utiliser la pr�production. Les tests locaux distants peuvent utiliser le m�me
jeu de variables dans le `.env` priv� existant ; les variables locales Engine
actuelles demeurent distinctes. Ne jamais configurer `127.0.0.1` comme URL Vercel.

Le runtime Vercel s�lectionne obligatoirement ce transport HTTPS. Si la
configuration est absente ou invalide, les routes d'�dition restent ferm�es.
Hors Vercel, les transports locaux pr�c�dents sont conserv�s. La configuration
du navigateur ne contient que les routes Admin.

## Erreurs montr�es dans l'interface

Les erreurs de d�finition et de g�n�ration restent des diagnostics m�tier
Engine. Les erreurs de transport sont diff�renci�es : refus d'authentification,
empreinte d'archive divergente, incompatibilit� de contrat, panne r�seau,
timeout, saturation ou indisponibilit�. Les d�tails internes et le token ne sont
pas renvoy�s au navigateur. Le timeout HTTP c�t� Admin est de 10 secondes ; le
host Engine garde ses propres limites et quotas.

## Contr�les et limites de r�ception

Les tests simul�s du transport v�rifient payloads, en-t�tes, taille, liaison par
`requestId`, empreinte, erreurs HTTP et absence de repli. Les tests unitaires des
routes conservent les gardes de session, r�le et origine. Ils ne constituent pas
un appel au serveur staging.

Un test direct depuis le poste de travail et un code HTTP de route ne suffisent
pas � prouver l'acc�s depuis Vercel. La r�ception r�elle exige une configuration
Vercel prot�g�e, une requ�te authentifi�e depuis cet h�bergement, l'en-t�te
d'archive attendu, le r�sultat de la fixture synth�tique, puis la v�rification
connect�e des quatre actions UI. Aucun d�ploiement ni appel r�el n'est effectu�
par cette PR.

