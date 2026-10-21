# Authentification, permissions et configuration

## Contrôle d’accès

L’Admin utilise Supabase Auth **Staging**, puis relit le rôle `admin` dans
`profiles` côté serveur pour chaque opération protégée. Une session invitée est
refusée. Les claims du navigateur, `user_metadata` et le masquage des boutons ne
confèrent aucun droit. Les erreurs Auth ou SQL ferment l’accès.

Les contrôles sont dans [authorization.ts](../src/lib/auth/authorization.ts),
[supabase.ts](../src/lib/auth/supabase.ts) et les routes de
[src/app/api/admin](../src/app/api/admin). Les mutations exigent l’origine exacte
de `APP_BASE_URL`, des corps bornés et une session vérifiée. Les réponses privées
utilisent `no-store`. Les cookies sont HttpOnly, SameSite et Secure sous HTTPS.
Les contrôles SQL/RLS restent nécessaires en complément des gardes Next.

## Variables opérationnelles Staging

Les exemples versionnés sont [`.env.example`](../.env.example),
[`.env.auth.example`](../.env.auth.example) et, pour l’hébergement,
[`.env.vercel.example`](../.env.vercel.example). Ils ne sont pas des secrets ni
des preuves d’activation. [config.ts](../src/lib/auth/config.ts) est l’autorité
sur les valeurs réellement acceptées.

| Variable                               | Fonction                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `APP_BASE_URL`                         | Origine exacte de l’Admin, sans chemin ; HTTPS hors localhost                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`             | Projet Staging épinglé : `https://tksvbkvfusrnxulpahky.supabase.co`                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publishable de ce même projet                                                                                               |
| `ADMIN_STAGING_AUTH_ENABLED`           | `true` pour ouvrir la porte Auth opérationnelle                                                                                 |
| `ADMIN_STAGING_SECURITY_REVIEW`        | Référence explicite de qualification SQL ; le profil existant utilise `docs/archives/staging-sql-qualification-2026-10-21.json` |

Le lecteur de configuration exige une référence de revue non vide ; il n’en
vérifie pas lui-même le contenu. Le **lanceur Staging local**, lui, contrôle les
octets et les assertions de cette preuve contre sa configuration privée.
Renseigner un nom de fichier dans Vercel ne réalise donc aucun audit.

La clé publishable est publique et ne donne pas le rôle Admin. Ne jamais mettre
de clé `service_role`, `sb_secret_*`, mot de passe PostgreSQL ou clé de signature
dans `NEXT_PUBLIC_*`, le navigateur ou Git. Conserver `.env`, `.local/`, les
configurations privées et les sauvegardes hors publication.

## Capacités séparées

| Porte serveur                        | Rôle et limite                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `ADMIN_ENGINE_ENABLED`               | Demande l’exécution Engine ; refusée sur Vercel même à `true`                                               |
| `ADMIN_STAGING_LOCAL_ENGINE_ENABLED` | Transport de développement Staging vers le worker local ; nécessite les autres prérequis, limité à loopback |
| `ADMIN_EDITORIAL_REVIEW_ENABLED`     | Relecture, soumise aux reçus courants et aux gardes SQL                                                     |
| `ADMIN_PUBLICATION_ENABLED`          | Publication, soumise aux identités SQL dédiées, à Engine et aux vérifications source/cible                  |

Le [profil courant et les désactivations](roadmap.md) sont décrits à un seul
endroit. Aucun de ces drapeaux ne remplace les prérequis, la qualification de
l’hôte ou l’autorisation d’une opération. La signature des rapports demande une
clé privée explicitement provisionnée ; aucune clé n’a été installée dans le
profil Staging documenté. Le refus de consignation reste normal dans ce profil.

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
