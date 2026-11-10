# Accès Production par API et RLS

**8 novembre 2026 — API activée après confirmation explicite du responsable.**
La migration `20261108133534_novlearn_admin_production_api_read` est appliquée.
Le `.env` utilise les URL et clés publiques des deux projets ; les anciennes
connexions SQL Production ont été retirées de la configuration active.
Le serveur sur `http://localhost:3000` utilise le build API qualifié.

## Identité et autorisation

Une page de connexion ne confère aucun rôle. Le serveur vérifie une session
Supabase Auth valide, permanente, puis `profiles.role = 'admin'` dans chaque
projet. Le rôle est géré par un opérateur autorisé ; ni le formulaire ni
`user_metadata` ne peuvent le choisir. Un compte élève reste refusé.

Le parcours utilise un seul formulaire et deux authentifications,
avec le même e-mail et mot de passe sur des comptes existants dans les deux
projets. Les UUID peuvent différer. Le compte choisi était déjà Admin en Staging ;
son compte Production distinct a été provisionné et son rôle Admin vérifié,
avec l'autorisation explicite du responsable. Aucun autre compte n'a été promu.
Le compte Production a reçu une identité e-mail et les données initiales créées
par les triggers existants. Aucune session ou empreinte de mot de passe Staging
n'a été exportée. L'opérateur a confirmé avoir défini le mot de passe Production.
Le formulaire ne stocke ni ne journalise le mot de passe ; il ne l'envoie à
Production qu'après autorisation Staging.
Si Production refuse la connexion ou le rôle, les deux sessions sont fermées.

Les sessions utilisent les espaces de cookies propres aux projets, `HttpOnly`,
avec renouvellement SSR et déconnexion des deux projets. Une session Staging
seule ne vaut pas session Production. Les pages et routes protégées vérifient
toujours Staging ; chaque lecture Production revérifie son utilisateur et son
rôle, puis appelle une RPC `SECURITY INVOKER` soumise aux RLS Production.
Une révocation du rôle est donc prise en compte sans nouvelle connexion.

## Périmètre des lectures

Décision du responsable du 8 novembre : statistiques générales et pédagogiques,
ainsi que la liste des utilisateurs, portent uniquement sur les comptes Auth
encore présents dont `is_anonymous IS FALSE`. Le filtre est appliqué avant les
agrégations, la recherche et la pagination par les trois RPC concernées ; voir
[le SQL du filtre](../../scripts/production-registered-users.sql).
La migration `20261108145047_novlearn_admin_registered_users_only` est appliquée
et qualifiée en Production ; elle conserve les signatures, les grants et les RLS.
Les tentatives d'invités ou sans compte connu n'alimentent plus les volumes,
les comptes actifs ni les taux de réussite. Un duel terminé exige deux inscrits ;
les tentatives d'un inscrit contre un invité restent comptées. Les comptes Admin
non invités restent dans cette population. Aucun compte ni tentative n'est supprimé.
Le champ technique `accounts.anonymous` reste présent dans le contrat et vaut
zéro ; son ancienne carte a été retirée de l'interface.
La projection Auth et la consultation directe d'une fiche existante restent
inchangées ; les droits RLS ne sont pas élargis.

La synthèse Statistiques effectue aussi des lectures Production `head/count`
sur `public.exercises` et `public.feedbacks`. Elle sépare les indicateurs de la
période des repères cumulés : le stock actuel du catalogue et le total de
comptes inscrits restent hors période, tandis que les exercices créés sont
comptés selon `public.exercises.created_at` dans la période sélectionnée. Les
compteurs de feedbacks sont aussi bornés à cette période et séparés par statut ;
aucune ligne de feedback ni aucun contenu d'exercice n'est transféré au
navigateur. Ces lectures utilisent la session Admin Production existante et
restent soumises aux droits RLS. Elles n'écrivent aucune donnée.

La rétention J+7/J+30 utilise l'agrégat dédié
`public.admin_read_cohort_retention`, défini dans
[`production-cohort-retention.sql`](../../scripts/production-cohort-retention.sql).
Les deux taux couvrent les mêmes comptes inscrits entre 31 et 60 jours avant
le relevé ; ils restent indépendants de la période d’activité choisie.
Le contrat est préparé dans ce dépôt mais n'est pas installé en Production :
la page indique que la rétention n'est pas activée tant que cette fonction
n'a pas été intégrée à la migration canonique du dépôt NovLearn puis déployée
par le processus approuvé. Aucun SQL distant n'a été exécuté depuis l'Admin.

La [qualification dédiée](../../scripts/production-registered-users-qualification.sql)
compare les résultats aux comptes et activités inscrits, en base, sans exporter
de lignes personnelles. Elle vérifie aussi la pagination et la cohérence avec
les statistiques pédagogiques.

## Configuration active

Conserver les variables existantes de connexion Staging :

```dotenv
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://tksvbkvfusrnxulpahky.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

Le même `.env` privé ou environnement serveur contient aussi :

```dotenv
PRODUCTION_SUPABASE_URL=https://abwipnppcrghdhwriyjp.supabase.co
PRODUCTION_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

Les clés proviennent de **Project Settings → API Keys** dans chaque projet
Supabase. Staging utilise une clé `sb_publishable_*`. Le connecteur ne retourne
actuellement qu'une clé publique `anon` JWT pour Production : elle est utilisée
avec les mêmes contrôles RLS. L'adaptateur accepte cette clé existante uniquement
si elle porte `role = anon`, la référence Production, une expiration future et
un en-tête HS256 ; Supabase vérifie ensuite sa signature. Une clé privilégiée
reste refusée. Une future clé `sb_publishable_*` peut la remplacer dans la même
variable, sans modifier le parcours.
La clé publique identifie le projet ; le jeton de session
identifie l'utilisateur et permet aux RLS de décider de ses droits. Aucune clé
`service_role` ou `sb_secret_*`, chaîne PostgreSQL ou clé de signature JWT
n'est nécessaire pour ces lectures. `ADMIN_PRODUCTION_READ_ENABLED=false`
les désactive. Les modes locaux et Production ne peuvent pas être mélangés.

Les adaptateurs PostgreSQL encore présents dans les sources servent uniquement
aux fixtures locales isolées ; les lectures Production utilisent cette API.

## Migration appliquée et vérifications

[production-api-read-access.sql](../../scripts/production-api-read-access.sql)
installe :

- Une projection privée minimale des comptes Auth, filtrée sur le rôle Admin.
- Cinq RPC de lecture, à paramètres bornés, sans SQL dynamique ni élévation de rôle.
- Neuf politiques `SELECT` pour les administrateurs authentifiés.
- La conversion de cinq anciennes politiques « No guest access » en politiques
  restrictives. Leur mode permissif actuel peut neutraliser les autres conditions
  de propriété ou de rôle ; ce verrouillage est nécessaire avant de se fier à
  `profiles.role`.
- Une garde restrictive imposant `id = auth.uid()` et `role = 'user'` lors d'une
  insertion directe de profil, pour empêcher de s'attribuer le rôle Admin.

Les politiques du site et celles de l'Admin portent des noms distincts. Elles
s'appliquent aux mêmes rôles API `anon`/`authenticated` : les droits dépendent
de l'identité, pas de l'URL ou du site d'origine. Un administrateur Production
conserve donc ses droits de lecture même avec un autre client API.

La migration touche les permissions Production et a été approuvée explicitement.
Elle n'ajoute aucune opération métier d'écriture, ne change aucun compte et ne
met pas en service la publication. Les conditions des anciens garde-fous sont
conservées ; leur composition devient restrictive. Vérifier après installation
les parcours élève, Admin et les refus de promotion/lecture avant la bascule.
L'historique canonique des migrations demeure dans le dépôt NovLearn.

Le [script de qualification](../../scripts/production-api-read-qualification.sql)
exerce les cinq RPC avec une identité Admin, les refuse avec une identité
ordinaire, vérifie l'accès de l'élève à son propre profil et refuse les tentatives
d'auto-promotion par insertion ou mise à jour. Toutes ses écritures sont annulées.
L'API HTTP réelle accepte la clé publique et refuse la RPC sans session (`42501`).
Les cinq fonctions sont `SECURITY INVOKER`, sans droit `EXECUTE` pour `anon`.
Les neuf RLS Admin et les cinq gardes invité restrictives sont vérifiées.
La migration `20261108135732_novlearn_admin_production_api_read_utf8` corrige
l'encodage des libellés SQL introduit lors du premier transfert Windows :
« Compte invité » et les ellipses doivent conserver leur UTF-8 pour passer les
décodeurs stricts. Le [correctif borné aux cinq définitions](../../scripts/production-api-read-utf8-fix.sql)
ne change aucune permission. La qualification inclut désormais une liste réelle
et une fiche invité, avec contrôle de leur libellé et de l'absence d'e-mail.
Toujours lire les fichiers SQL avec un encodage explicite, par exemple
`fs.readFileSync(path, 'utf8')` ou `Get-Content -Encoding UTF8` ; ne pas faire
transiter leur contenu par une lecture ANSI implicite de Windows PowerShell.
Les droits métier préexistants du rôle applicatif Admin restent ceux du projet ;
ce parcours ajoute seulement des lectures. Il ne définit pas un nouveau rôle
Production universellement limité à `SELECT`.
Les avis de sécurité Supabase préexistants n'ont pas changé ; cela ne constitue
pas un audit global de sécurité du projet.

Les 1 643 tests, types, lint, build autonome et smoke tests sont reçus. Le serveur sur
le port 3000 affiche le formulaire à double session et refuse les cinq API privées
sans connexion. L'opérateur confirme le chargement des statistiques et, après
le correctif d'encodage, l'affichage de la liste des utilisateurs avec son compte.
Cette réception couvre ces deux pages ; les autres vues gardent leur qualification
automatique distincte. Une connexion Auth Production du compte choisi est observée ;
aucune connexion personnelle n'a été simulée avec un secret.
