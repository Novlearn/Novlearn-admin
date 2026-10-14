# Authentification Admin — préparation locale du Lot 1B

## État réel

Le code Auth serveur, les formulaires, la protection des pages et le layout
Admin sont implémentés. Les tests utilisent des doubles synthétiques. L'accès
Staging est **désactivé** : la sécurisation SQL du Lot 1A est désormais testée
localement, mais sa réconciliation et son application distante restent à valider ;
le relevé du 13 octobre 2026 compte zéro utilisateur Auth Staging. Ce lot n'est
pas réceptionné comme une authentification distante opérationnelle.

## Fonctionnement

Les POST `/auth/login` et `/auth/logout` vérifient l'origine exacte de
`APP_BASE_URL`. La connexion accepte seulement un formulaire encodé, limité à
8 Kio effectivement lus, puis valide les champs. Elle n'accepte pas de
destination de redirection provenant du navigateur. Le compte connecté est
vérifié par `auth.getUser()` ; son rôle est relu dans `profiles`, uniquement
sur son ID. Le code refuse les invités, profils absents, erreurs et rôles autres
que `admin`. Un non-admin est déconnecté après une connexion refusée.

Le layout **et** la page Admin appliquent le contrôle serveur. Le GET
`/api/admin/session` refait ce contrôle lors d'un appel direct ; il renvoie
401 sans session, 403 sans rôle, 503 sur panne ou accès désactivé. Sa projection
ne contient ni identité nominative, ni token, ni secret. Toute future opération
métier devra aussi vérifier l'accès avant de lire ou écrire des données.

Chaque requête crée son client Supabase avec la clé publishable Staging et sa
session utilisateur. Aucun client navigateur, service role, rôle provenant de
`user_metadata`, client Production ni accès mathématique n'est ajouté.
Les cookies sont HttpOnly, SameSite=Lax, Secure en HTTPS. Le middleware renouvelle
la session et transmet les cookies actualisés aux Server Components ; les
réponses Auth/pages privées utilisent `private, no-store`. La déconnexion est
locale à la session courante et reste possible après expiration. Une panne de
déconnexion est signalée ; elle n'est jamais présentée comme un succès.

## Activation par l'opérateur — ne pas exécuter maintenant

1. Faire accepter les preuves du Lot 1A : droits sous `anon`/`authenticated`,
   rôle non modifiable à INSERT/UPDATE/DELETE, pas de policy permissive de
   contournement, projections/RPC revues, compatibilité élèves et procédures
   backup/retour. Les correctifs appartiennent à NovLearn et nécessitent une
   autorisation distincte. Ne pas activer seulement parce que ce code passe ses
   tests avec doubles.
2. Faire provisionner un compte Auth Staging par un opérateur autorisé, puis
   attribuer le rôle via la procédure DB contrôlée, auditée et inaccessible aux
   clients. Aucun signup, bootstrap public ou auto-attribution dans Admin.
3. Définir et tester MFA, récupération, expiration et révocation avec le
   propriétaire d'identité. MFA/TOTP et contrôle strict de `auth.sessions` ne
   sont pas implémentés dans ce volet. `getUser()` ne remplace pas une preuve
   de révocation immédiate de tous les JWT après suppression d'un compte.
4. Configurer l'URL **exacte** du projet Staging identifié et sa clé publishable,
   puis APP_BASE_URL (HTTPS hors localhost). Le validateur refuse toute autre
   URL, notamment Production, et les clés secrètes/legacy JWT.
5. Seulement après accord, configurer côté serveur
   `ADMIN_STAGING_AUTH_ENABLED=true` et `ADMIN_STAGING_SECURITY_REVIEW` avec la
   référence de la revue et de l'accord. `.env.auth.example` fournit les noms
   avec activation false ; `.env.example` préexistant reste intact.
6. Exécuter les vrais parcours : non connecté, non-admin, admin, invité,
   expiration, révocation du rôle, appels directs, mauvaises origines,
   déconnexion et absence de cache. Les essais distants ne sont pas exécutés
   pendant cette mission. Vérifier les limites Auth anti-bruteforce effectives
   et la politique de reverse proxy avant mise en service.

Ces deux variables sont un verrou d'exploitation ; elles ne sécurisent pas
la base et ne constituent pas une preuve de qualification SQL.

## Références vérifiées

[Client SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
et [guide avancé](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
pour les cookies, `getUser()` et l'absence de cache. Le changelog officiel a été
lu ; TLS moderne et les dépréciations des adaptateurs `@supabase/server` ne
changent pas le choix de `@supabase/ssr`. Les versions exactes sont conservées
dans package.json et package-lock.json.

Le socle Next passe de 15.5.12 à 15.5.27 pour corriger les avis de sécurité
publiés, dont [l'exécution distante sous Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36).
PostCSS 8.5.30, sharp 0.35.5 et postcss-selector-parser 7.1.6 sont verrouillés
via les overrides pour les dépendances transitives. Aucun changement dans
NovLearn n'en découle. Le runtime Admin est aligné sur Node 24.19.x ; Vitest
et les clients Supabase installés requièrent un Node récent.
