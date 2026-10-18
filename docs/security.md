# Authentification, autorisations et accès Production

## Lecture analytique SQL locale — 18 octobre

La [migration 65 et la requête analytique](activity-readonly.md) sont qualifiées
sur copies : colonnes minimales, rôle NOLOGIN non privilégié, refus effectifs,
héritage PUBLIC borné, agrégats et restauration. Aucun nouveau definer n’est
ajouté. Le login PG/TLS et le lecteur serveur restent à qualifier ; ni cette
preuve ni le choix nominatif D08 n’activent un client ou secret Production.
Les bases applicatives conservées restent sur leur schéma 64.

## Catalogue Admin local — D07

Le [catalogue](catalogue.md) utilise des RPC invoker, RLS et la session réelle
Admin Staging. Les refus sont vérifiés par les tests de routes et par 47
assertions PostgreSQL, répétées après restauration ; les 69 assertions existantes
restent inchangées. Le banc de concurrence vérifie réellement deux sessions,
leur empreinte et l’absence d’événement d’audit du perdant. Aucun accès distant
n’est activé et aucune suppression définitive n’est exposée.

Les nouveaux brouillons ne sont pas visibles aux rôles élèves/anon via RLS.
Cela ne borne pas les anciens services avec bypass RLS ou RPC definer : leur
compatibilité et la rétention legacy restent des portes de mise en service,
hors développement applicatif NovLearn après D07.

## Relevés antérieurs

**État local courant D04 :** [rôles et profils](lot-1a-local-restore-and-privacy.md),
[RPC privilégiés](lot-1a-local-rpc-review.md) et restauration sur fixtures sont
préparés et testés dans NovLearn : 50 migrations et 53 assertions après
restauration. Les relevés distants ci-dessous restent des constats historiques,
pas la preuve que ces correctifs y sont appliqués. L'Engine et la transition des
lecteurs d'exercices demeurent des portes ouvertes ; l'Auth reste désactivée.

Le [volet Auth local](auth.md) est désormais préparé et testé avec doubles,
mais désactivé. Les risques SQL ci-dessous restent bloquants. Le tableau des
variables décrivant le socle vide est le relevé historique du Lot 0 bis ; voir
Auth pour leurs consommateurs actuels et les verrous d'activation.

État Supabase lu le 13 octobre 2026, complété par les ACL, privilèges effectifs et fonctions d'autorisation pendant la préparation du Lot 1A. Cette revue n'a changé aucune politique.

## Auth Admin

Auth s'appuie sur le projet Staging. Chaque action protégée doit côté serveur : valider la session avec le serveur Auth (pas faire confiance aux valeurs de cookie décodées sans vérification), charger le rôle dans une source protégée, vérifier que le rôle autorise l'action et refuser par défaut. Appliquer le contrôle aussi aux Server Actions, Route Handlers, téléchargements et endpoints d'aperçu ; un layout protégé ne protège pas les appels directs.

`profiles.role` existe et vaut par défaut `user` dans le schéma observé. L'accès administrateur initial doit être accordé hors de tout endpoint public : créer/inviter le compte Auth Staging, puis faire attribuer le rôle par un opérateur DB autorisé via une procédure d'exploitation contrôlée, authentifiée et auditée. Aucun utilisateur ne doit pouvoir écrire son propre rôle. Vérifier la politique RLS, triggers/functions et procédure de révocation avant l'activation ; prévoir MFA et récupération selon la politique d'identité du projet. Le relevé montre une policy `profiles_update_own_no_role_change` et `get_my_role()`, mais celles-ci doivent être testées sur les rôles DB effectifs et ne suffisent pas à l'Admin.

## RLS vivante relevée

Les politiques ci-dessous sont présentes dans les deux bases, avec mêmes expressions au moment de lecture :

| Table                    | Observation                                                                                   | Conséquence                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercises`              | `SELECT USING (true)` accordé aux rôles anon et authenticated                                 | Tout client correspondant peut lire toute colonne que les grants exposent, y compris le JSON `content` et les attendus potentiels. RLS est activée mais pas restrictive ici.       |
| `profiles`               | `profiles_select_others` pour authenticated avec `USING (true)`, en plus de sa lecture propre | Les colonnes sélectionnables de profils d'autres comptes sont potentiellement visibles. Les colonnes comprennent email, birth_date, noms, préférences, rôle et données d'activité. |
| `exercise_attempts`      | politiques propres à l'utilisateur et policy supplémentaire `ALL PERMISSIVE NOT is_guest()`   | La policy permissive peut neutraliser la restriction de propriétaire ; voir le risque ci-dessous.                                                                                  |
| `duels`, `duel_attempts` | policies de participants ; `duels` ajoute `ALL PERMISSIVE NOT is_guest()`                     | Ne pas considérer les duels comme limités aux participants tant que cette composition n'est pas corrigée/testée.                                                                   |

Les policies sont permissives et s'additionnent. Il faut examiner les grants SQL, vues, RPC, fonctions `SECURITY DEFINER`, propriétaires et rôles API en plus des policies. Les données personnelles de Production ne doivent pas être chargées dans le navigateur en bloc.

### Priorité critique du Lot 1A : policies guest permissives

Les deux projets accordent effectivement SELECT/INSERT/UPDATE/DELETE à `anon` et `authenticated` sur `profiles`, `exercise_attempts` et `duels`. Sur ces trois tables, les policies nommées `No guest access ...` sont `ALL`, `PERMISSIVE`, destinées à `public`, avec `USING (NOT is_guest())` et sans `WITH CHECK` explicite. Les politiques permissives se combinent par **OR**, et une policy ALL sans CHECK reprend sa condition USING pour les nouvelles lignes. Elle n'ajoute donc pas une barrière à la policy de propriétaire. [Règles PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

La définition relevée de `is_guest()` retourne `COALESCE((auth.jwt() -> 'is_anonymous')::boolean, false)`. Une absence de claim donne `false`, donc `NOT is_guest()` donne `true`. Cette combinaison ouvre statiquement un chemin de lecture/écriture sur les lignes des trois tables pour les appels concernés, y compris sans session lorsque le claim manque. La règle `profiles_update_own_no_role_change` peut alors être contournée par l'autre branche permissive. Le seul trigger utilisateur relevé sur `profiles` est celui d'horodatage ; aucun garde de modification de rôle n'y est observé.

Il s'agit d'un **risque d'élévation de privilèges et de modification de données déduit des définitions et grants**, et non d'un exploit exécuté : aucun appel d'écriture via API ou SQL n'a été tenté. Le périmètre HTTP/Data API réellement exposé doit être contrôlé par le propriétaire. La stratégie corrective et les tests locaux nécessaires sont préparés dans [Lot 1A](lot-1a-preparation.md).

### Fonctions à revue prioritaire

Les trois fonctions examinées dans chaque projet sont `SECURITY DEFINER` :

- `get_random_exercise` retourne `row_to_json(e)` de la ligne entière ; avec la policy de lecture publique et accès RPC, le contenu JSON peut inclure les attendus de correction.
- `get_monthly_leaderboard` joint `monthly_scores` et `profiles` et renvoie `user_id`, `first_name`, `last_name`, score/streak et rang.
- `get_weekly_leaderboard` agrège les tentatives et renvoie identifiants, noms, score/rang et compteurs de récompenses. Sa définition n'impose pas de `search_path` fixe dans le corps lu.

Les définitions actuelles sont équivalentes dans les deux environnements pour ces fonctions. Cela ne confirme pas les différences historiques signalées par le CDC et ne blanchit pas leur risque. Vérifier `EXECUTE` grants pour `anon`/`authenticated`, comportement sous le propriétaire, `search_path`, validation des paramètres, colonnes renvoyées et nécessité d'exposition. Aucun changement à ces fonctions n'est autorisé dans ce lot.

La collecte Lot 1A confirme `EXECUTE` effectif pour `anon` et `authenticated` sur les trois RPC, `get_my_role`, `is_guest`, `get_public_profile` et `admin_get_profile`. Ces fonctions appartiennent à `postgres` et sont `SECURITY DEFINER`. `admin_get_profile` vérifie un rôle stocké dans `profiles`, donc dépend directement de la protection de cette colonne. Son grant à PUBLIC rend son exécution possible pour `anon` même sans grant direct à ce rôle ; cela ne prouve pas à lui seul que son contrôle interne autorise la lecture. Un `search_path` fixe, des noms qualifiés et des EXECUTE bornés doivent être revus ensemble. [Fonctions Supabase](https://supabase.com/docs/guides/database/functions).

### Anciennes routes NovLearn observées

`Novlearn/frontend/app/api/exercises/route.ts` crée un client `service_role`. Son GET n'effectue pas de vérification de session ou rôle dans le handler et, pour un ID, renvoie toutes les propriétés de `content`; la liste masque davantage de colonnes. Ses méthodes POST/DELETE vérifient un en-tête `x-admin-secret`. Ce constat justifie de ne pas recopier ce modèle dans le nouvel Admin et de revoir route, grants et exposition avec le propriétaire NovLearn ; ce lot ne change pas l'autre dépôt.

Le frontend élève lit directement les exercices, et le serveur Colyseus lit la définition et génère les variables par une logique locale différente de l'Engine documenté. Le backend FastAPI lit le catalogue pour recommandation et tests. C'est un risque de divergences de contrat/versions, pas une autorisation de modifier NovLearn depuis ce dépôt. Les futures migrations doivent garder une transition coordonnée.

## Accès Production : principe de moindre privilège

1. Client navigateur : aucun accès privilégié Production.
2. Lecture analytique : requêtes serveur minimisées, vues/agrégats définis et permissions réellement en lecture seulement ; identifiants séparés de Staging et de publication. Limiter colonnes et rétention; ne retourner au navigateur que l'agrégat ou la fiche spécifiquement permise.
3. Consultation utilisateur : flux séparé, accès nominatif au besoin, champs autorisés explicites, journal d'audit et recherche limitée. Pas de `select *` sur `profiles`.
4. Publication : capacité distincte de l'accès lecture, limitée techniquement au contenu métier approuvé de `exercises` et `exercise_versions`, avec protection des révisions publiées et des tables exclues. Les clés secrètes Supabase contournant RLS ne doivent pas être présentées comme naturellement limitées à une table. Une variable `READONLY_KEY` ou `PUBLISH_KEY` est seulement un nom.

Évaluer des rôles SQL distincts ou un service isolé avec identité DB dédiée et droits testés. Les clés Supabase usuelles avec service role donnent des privilèges élevés ; une façade serveur et des checks applicatifs ne limitent pas à eux seuls les dégâts d'une fuite. Si Supabase Data API ne peut pas faire respecter le confinement attendu pour une identité de lecture/écriture, choisir une connexion PostgreSQL/service dédié approuvé et vérifier réseau, TLS, secrets, rotation et audits. Pas de clients Production ni de secrets dans ce dépôt avant validation de cette architecture.

## Variables d'environnement observées

| Variable                                  | Présente dans `.env.example`                    | Référence de code trouvée     | État                                                                                                           |
| ----------------------------------------- | ----------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `APP_BASE_URL`                            | Oui, URL locale                                 | Aucune dans le socle inspecté | Future variable applicative, pas utilisée aujourd'hui                                                          |
| `NEXT_PUBLIC_SUPABASE_URL`                | Oui, projet fictif Staging                      | Aucune                        | Future variable publique Auth Staging                                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`    | Oui, valeur fictive `sb_publishable_replace_me` | Aucune                        | Future clé publishable publique Staging ; elle n'est pas un secret et ses permissions dépendent des grants/RLS |
| URLs/keys Production, Engine, déploiement | Non après diff préexistant                      | Aucune                        | Aucun client/secret fonctionnel Production ou Engine ne doit être créé à ce stade                              |

Le tableau décrit la copie de travail : `.env.example` était déjà modifié à l'arrivée de l'audit, avec retrait de plusieurs variables documentaires (`SUPABASE_PRODUCTION_*`, `EXERCISE_ENGINE_PACKAGE`, etc.) et choix des deux noms Staging ci-dessus. Ce changement a été conservé, non réécrit et laissé hors du commit documentaire. Les anciens placeholders encore versionnés ne constituent ni un accès Production fonctionnel ni des permissions réelles. Dans le code présent, aucune variable n'est encore consommée. Toute variable d'accès privilégié future reste sans `NEXT_PUBLIC_` et est configurée au moment où l'intégration correspondante est autorisée.

## Risques bloquants

- Lecture de `exercises.content` accessible publiquement si la table/RPC est exposée, avec risque de fuite des réponses.
- Policies guest permissives et grants d'écriture : risque de modification de profils/rôles, tentatives et duels, déduit de la composition SQL actuelle.
- Lecture transversale de `profiles` trop large pour l'Admin et potentiellement les clients actuels.
- RPC `SECURITY DEFINER` exécutables par anon/authenticated et dépendantes des protections de rôle ; exposition/projections à revoir avant mise en service.
- Droits réels d'une clé de publication/lecture non établis ; pas de capacité Production sûre conçue ou testée.
- Aucun utilisateur Auth Staging déclaré dans le contexte du CDC ; présence actuelle non vérifiée. Il faut vérifier/provisionner avant Lot 1.
- Schéma source et permissions des deux projets n'ont pas été comparés intégralement.

La correction des policies et fonctions existantes est une tâche distincte au sein du dépôt NovLearn, menée par le propriétaire DB et livrée via son historique canonique. Ce document ne change aucun privilège ni code de l'autre dépôt.
