# Authentification, permissions et configuration

Mission Admin-Engine (5 novembre 2026) : le transport HTTPS serveur vers le host
staging est impl�ment� sur la branche de raccordement, derri�re
`ADMIN_ENGINE_ENABLED`. Vercel requiert aussi `ADMIN_ENGINE_URL`,
`ADMIN_ENGINE_TOKEN` et `ADMIN_ENGINE_ARCHIVE_SHA256`; voir la
[configuration et le contrat d�taill�s](admin-engine-transport.md). Aucune de
ces valeurs n'est versionn�e. Le transport reste inactif tant que les variables
ne sont pas configur�es et que la PR n'est pas d�ploy�e.

## Contr�le d'acc�s

L'Admin d�ploy� en **Production Vercel** utilise Supabase Auth de la base de
**pr�production existante**, puis relit le r�le `admin` dans
`profiles` c�t� serveur pour chaque op�ration prot�g�e. Une session invit�e est
refus�e. Les claims du navigateur, `user_metadata` et le masquage des boutons ne
conf�rent aucun droit. Les erreurs Auth ou SQL ferment l'acc�s.

Les contr�les sont dans [authorization.ts](../src/lib/auth/authorization.ts),
[supabase.ts](../src/lib/auth/supabase.ts) et les routes de
[src/app/api/admin](../src/app/api/admin). Les mutations exigent l'origine exacte
de `APP_BASE_URL`, des corps born�s et une session v�rifi�e. Les r�ponses priv�es
utilisent `no-store`. Les cookies sont HttpOnly, SameSite et Secure sous HTTPS.
Les contr�les SQL/RLS restent n�cessaires en compl�ment des gardes Next.

## Une configuration, trois variables

La configuration locale utilise **un seul fichier `.env` � la racine**, priv�
et ignor� par Git. Les quatre fichiers d'exemple dispers�s ont �t� supprim�s
le 30 octobre 2026 � la demande de l'utilisateur. Le mod�le est conserv� ici,
sans cr�er d'autre fichier de configuration.

```dotenv
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://tksvbkvfusrnxulpahky.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

Remplacer la cl� d'exemple par celle du projet de pr�production. Sur Vercel, renseigner
ces m�mes noms dans les variables du projet, avec l'origine HTTPS exacte du site.
Ne pas transf�rer le `.env` priv� ni le versionner. Une seule source de valeurs
par environnement suffit ; pas de fichiers `.env.auth`, `.env.vercel` ou
`.env.production` suppl�mentaires � maintenir.

[config.ts](../src/lib/auth/config.ts) reste l'autorit� sur les valeurs accept�es.
Le 30 octobre, l'utilisateur a explicitement confirm� le retrait des anciens
marqueurs `ADMIN_STAGING_AUTH_ENABLED` et `ADMIN_STAGING_SECURITY_REVIEW` et le
d�ploiement en Production Vercel sur la base de pr�production. Ils ne sont plus
lus ni n�cessaires. Une configuration valide rend la connexion disponible ; elle
n'accorde aucun droit sans session v�rifi�e et r�le Admin.

| Variable                               | Fonction                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| `APP_BASE_URL`                         | Origine exacte de l'Admin, sans chemin ; HTTPS hors localhost        |
| `NEXT_PUBLIC_SUPABASE_URL`             | Pr�production existante : `https://tksvbkvfusrnxulpahky.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cl� publishable de ce m�me projet                                    |

Le projet Supabase conserve son nom historique `novlearn-staging` et sa r�f�rence
technique ; il sert ici de pr�production. Aucun projet ni environnement de base
suppl�mentaire n'est cr��. Le projet Supabase de production �l�ves reste distinct.
Le lanceur historique local v�rifie toujours sa qualification SQL avant de
lancer son banc ; le d�ploiement Vercel n'a pas besoin de ces fichiers priv�s.

Le formulaire signale d�sormais une configuration de connexion incompl�te,
sans pr�tendre qu'une revue de s�curit� a �chou�. Un ancien param�tre
`?error=disabled` ne maintient plus ce message lorsque le serveur est configur�.

La cl� publishable est publique et ne donne pas le r�le Admin. Ne jamais mettre
de cl� `service_role`, `sb_secret_*`, mot de passe PostgreSQL ou cl� de signature
dans `NEXT_PUBLIC_*`, le navigateur ou Git. Conserver `.env`, `.local/`, les
configurations priv�es et les sauvegardes hors publication.

## Capacit�s s�par�es

Mission Admin/Engine : le banc synth�tique `/api/admin/engine/qualification`
v�rifie session, r�le et origine avant le host et n'accepte qu'un objet vide.
Il ne d�pend pas du drapeau d'�dition Engine, qui conserve sa garde Vercel.
Sa page `/admin/engine-qualification` permet la r�ception avec la session Admin.
Les instantan�s partag�s pr�vus utilisent deux RPC et une table priv�e sur la
base existante : [proposition et limites](mission-admin-engine-reception.md).
Aucune migration distante ni nouvelle cl� n'est implicite dans le d�ploiement.

| Porte serveur                        | R�le et limite                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_ENGINE_ENABLED`               | Active le moteur : local avec son profil qualifi�, Vercel seulement avec les trois param�tres HTTPS valides ci-dessous |
| `ADMIN_STAGING_LOCAL_ENGINE_ENABLED` | Transport de d�veloppement Staging vers le worker local ; n�cessite les autres pr�requis, limit� � loopback            |
| `ADMIN_EDITORIAL_REVIEW_ENABLED`     | Relecture, soumise aux re�us courants et aux gardes SQL                                                                |
| `ADMIN_PUBLICATION_ENABLED`          | Publication, soumise aux identit�s SQL d�di�es, � Engine et aux v�rifications source/cible                             |

Le [profil courant et les d�sactivations](roadmap.md) sont d�crits � un seul
endroit. Aucun de ces drapeaux ne remplace les pr�requis, la qualification de
l'h�te ou l'autorisation d'une op�ration. La signature des rapports demande une
cl� priv�e explicitement provisionn�e ; aucune cl� n'a �t� install�e dans le
profil Staging document�. Le refus de consignation reste normal dans ce profil.

Ne pas ajouter de variables optionnelles vides au `.env` courant. Lorsque la
publication sera explicitement mise en service, ses param�tres suppl�mentaires
iront dans ce m�me fichier local ou dans les variables de l'h�bergeur :
`ADMIN_PUBLICATION_ENABLED`, `ADMIN_PUBLICATION_SECURITY_REVIEW`,
`ADMIN_PUBLICATION_TARGET_PROJECT_REF`, `ADMIN_PUBLICATION_SOURCE_PG_URL`,
`ADMIN_PUBLICATION_TARGET_PG_URL` et `ADMIN_PUBLICATION_CONFIRMATION_KEY`.
Les CA �ventuelles sont `ADMIN_PUBLICATION_SOURCE_PG_CA` et
`ADMIN_PUBLICATION_TARGET_PG_CA`. Ces capacit�s gardent des identit�s et secrets
distincts ; les regrouper dans un fichier ne fusionne pas leurs permissions.

Les variables `ADMIN_LOCAL_*` sont r�serv�es aux bancs de d�veloppement avec
origines, ports et manifeste SQL attendus. Elles ne permettent pas de transformer
une fixture en acc�s Production. Les lecteurs statistiques/utilisateurs et de
version cible actuellement pr�sents sont limit�s � des copies locales.

## Fronti�re Production et r�serves

Lecture analytique, consultation nominative et publication requi�rent des
capacit�s distinctes et minimales. Un nom de variable � readonly � ou une cl�
Supabase privil�gi�e ne garantit pas un acc�s limit�. La publication pr�vue
utilise des identit�s PostgreSQL source/journal et cible s�par�es, avec TLS et
permissions contr�l�es ; voir [l'architecture](architecture.md).

Les derniers advisors conserv�s dans la
[preuve D13](archives/release-vercel-2026-10-21.json) datent du 21 octobre 2026 : z�ro
erreur, 31 avertissements et sept informations, dont 30 avertissements definer et
la protection contre les mots de passe divulgu�s d�sactiv�e. Ces r�sultats ne
sont pas recontr�l�s ici. Revoir fonctions, ACL/RLS, confidentialit� des r�ponses,
politique MFA et param�tres Auth avant une ouverture plus large. Les correctifs
SQL locaux ne prouvent pas la s�curit� actuelle de tous les consommateurs de
l'application �l�ve ni celle de Production.

