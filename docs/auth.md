# Authentification, permissions et configuration

Mission Admin–Engine (5 novembre 2026) : le transport HTTPS serveur vers le host
staging est implémenté sur la branche de raccordement, derrière
`ADMIN_ENGINE_ENABLED`. Vercel requiert aussi `ENGINE_URL`,
`ENGINE_TOKEN` et `ENGINE_ARTIFACT_SHA256`; voir la
[configuration et le contrat détaillés](admin-engine-transport.md). Aucune de
ces valeurs n’est versionnée. Le transport reste inactif tant que les variables
ne sont pas configurées et que la PR n’est pas déployée.

## Contrôle d’accès

L’Admin déployé en **Production Vercel** utilise Supabase Auth de la base de
**préproduction existante**, puis relit le rôle `admin` dans
`profiles` côté serveur pour chaque opération protégée. Une session invitée est
refusée. Les claims du navigateur, `user_metadata` et le masquage des boutons ne
confèrent aucun droit. Les erreurs Auth ou SQL ferment l’accès.

Les contrôles sont dans [authorization.ts](../src/lib/auth/authorization.ts),
[supabase.ts](../src/lib/auth/supabase.ts) et les routes de
[src/app/api/admin](../src/app/api/admin). Les mutations exigent l’origine exacte
de `APP_BASE_URL`, des corps bornés et une session vérifiée. Les réponses privées
utilisent `no-store`. Les cookies sont HttpOnly, SameSite et Secure sous HTTPS.
Les contrôles SQL/RLS restent nécessaires en complément des gardes Next.

## Une configuration, trois variables

La configuration locale utilise **un seul fichier `.env` à la racine**, privé
et ignoré par Git. Les quatre fichiers d'exemple dispersés ont été supprimés
le 30 octobre 2026 à la demande de l'utilisateur. Le modèle est conservé ici,
sans créer d'autre fichier de configuration.

```dotenv
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://tksvbkvfusrnxulpahky.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

Remplacer la clé d'exemple par celle du projet de préproduction. Sur Vercel, renseigner
ces mêmes noms dans les variables du projet, avec l'origine HTTPS exacte du site.
Ne pas transférer le `.env` privé ni le versionner. Une seule source de valeurs
par environnement suffit ; pas de fichiers `.env.auth`, `.env.vercel` ou
`.env.production` supplémentaires à maintenir.

[config.ts](../src/lib/auth/config.ts) reste l'autorité sur les valeurs acceptées.
Le 30 octobre, l'utilisateur a explicitement confirmé le retrait des anciens
marqueurs `ADMIN_STAGING_AUTH_ENABLED` et `ADMIN_STAGING_SECURITY_REVIEW` et le
déploiement en Production Vercel sur la base de préproduction. Ils ne sont plus
lus ni nécessaires. Une configuration valide rend la connexion disponible ; elle
n'accorde aucun droit sans session vérifiée et rôle Admin.

| Variable                               | Fonction                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| `APP_BASE_URL`                         | Origine exacte de l’Admin, sans chemin ; HTTPS hors localhost        |
| `NEXT_PUBLIC_SUPABASE_URL`             | Préproduction existante : `https://tksvbkvfusrnxulpahky.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publishable de ce même projet                                    |

Le projet Supabase conserve son nom historique `novlearn-staging` et sa référence
technique ; il sert ici de préproduction. Aucun projet ni environnement de base
supplémentaire n'est créé. Le projet Supabase de production élèves reste distinct.
Le lanceur historique local vérifie toujours sa qualification SQL avant de
lancer son banc ; le déploiement Vercel n'a pas besoin de ces fichiers privés.

Le formulaire signale désormais une configuration de connexion incomplète,
sans prétendre qu'une revue de sécurité a échoué. Un ancien paramètre
`?error=disabled` ne maintient plus ce message lorsque le serveur est configuré.

La clé publishable est publique et ne donne pas le rôle Admin. Ne jamais mettre
de clé `service_role`, `sb_secret_*`, mot de passe PostgreSQL ou clé de signature
dans `NEXT_PUBLIC_*`, le navigateur ou Git. Conserver `.env`, `.local/`, les
configurations privées et les sauvegardes hors publication.

## Capacités séparées

Mission Admin/Engine : le banc synthétique `/api/admin/engine/qualification`
vérifie session, rôle et origine avant le host et n'accepte qu'un objet vide.
Il ne dépend pas du drapeau d'édition Engine, qui conserve sa garde Vercel.
Sa page `/admin/engine-qualification` permet la réception avec la session Admin.
Les instantanés partagés prévus utilisent deux RPC et une table privée sur la
base existante : [proposition et limites](mission-admin-engine-reception.md).
Aucune migration distante ni nouvelle clé n'est implicite dans le déploiement.

| Porte serveur                        | Rôle et limite                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_ENGINE_ENABLED`               | Active le moteur : local avec son profil qualifié, Vercel seulement avec les trois paramètres HTTPS valides ci-dessous |
| `ADMIN_STAGING_LOCAL_ENGINE_ENABLED` | Transport de développement Staging vers le worker local ; nécessite les autres prérequis, limité à loopback            |
| `ADMIN_EDITORIAL_REVIEW_ENABLED`     | Relecture, soumise aux reçus courants et aux gardes SQL                                                                |
| `ADMIN_PUBLICATION_ENABLED`          | Publication, soumise aux identités SQL dédiées, à Engine et aux vérifications source/cible                             |

Le [profil courant et les désactivations](roadmap.md) sont décrits à un seul
endroit. Aucun de ces drapeaux ne remplace les prérequis, la qualification de
l’hôte ou l’autorisation d’une opération. La signature des rapports demande une
clé privée explicitement provisionnée ; aucune clé n’a été installée dans le
profil Staging documenté. Le refus de consignation reste normal dans ce profil.

Ne pas ajouter de variables optionnelles vides au `.env` courant. Lorsque la
publication sera explicitement mise en service, ses paramètres supplémentaires
iront dans ce même fichier local ou dans les variables de l'hébergeur :
`ADMIN_PUBLICATION_ENABLED`, `ADMIN_PUBLICATION_SECURITY_REVIEW`,
`ADMIN_PUBLICATION_TARGET_PROJECT_REF`, `ADMIN_PUBLICATION_SOURCE_PG_URL`,
`ADMIN_PUBLICATION_TARGET_PG_URL` et `ADMIN_PUBLICATION_CONFIRMATION_KEY`.
Les CA éventuelles sont `ADMIN_PUBLICATION_SOURCE_PG_CA` et
`ADMIN_PUBLICATION_TARGET_PG_CA`. Ces capacités gardent des identités et secrets
distincts ; les regrouper dans un fichier ne fusionne pas leurs permissions.

Les variables `ADMIN_LOCAL_*` sont réservées aux bancs de développement avec
origines, ports et manifeste SQL attendus. Elles ne permettent pas de transformer
une fixture en accès Production. Les lecteurs statistiques/utilisateurs et de
version cible actuellement présents sont limités à des copies locales.

## Frontière Production et réserves

Lecture analytique, consultation nominative et publication requièrent des
capacités distinctes et minimales. Un nom de variable « readonly » ou une clé
Supabase privilégiée ne garantit pas un accès limité. La publication prévue
utilise des identités PostgreSQL source/journal et cible séparées, avec TLS et
permissions contrôlées ; voir [l’architecture](architecture.md).

Les derniers advisors conservés dans la
[preuve D13](archives/release-vercel-2026-10-21.json) datent du 21 octobre 2026 : zéro
erreur, 31 avertissements et sept informations, dont 30 avertissements definer et
la protection contre les mots de passe divulgués désactivée. Ces résultats ne
sont pas recontrôlés ici. Revoir fonctions, ACL/RLS, confidentialité des réponses,
politique MFA et paramètres Auth avant une ouverture plus large. Les correctifs
SQL locaux ne prouvent pas la sécurité actuelle de tous les consommateurs de
l’application élève ni celle de Production.
