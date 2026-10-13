# Décisions et arbitrages

Registre mis à jour le 13 octobre 2026 après validation explicite du modèle et préparation du Lot 1A. Les recommandations encore ouvertes sont distinguées des décisions utilisateur confirmées.

## Décisions établies par le CDC / socle

- Admin séparé, Next.js full-stack sans nouveau FastAPI.
- Auth et travail éditorial sur Supabase Staging.
- Données Production accessibles seulement dans le cadre de permissions distinctes et vérifiées.
- `novlearn-exercise-engine` est la source canonique des contrats et calculs ; MathLive sert à la saisie.
- La V1 sélectionne uniquement le contenu métier approuvé de `public.exercises` et `public.exercise_versions`. Aucune réplication intégrale, aucun brouillon et aucune autre table ne sont synchronisés.
- L'identité d'exercice reste stable, les révisions publiées sont immuables, les tentatives historiques ne sont pas écrasées.
- La présente mission est lecture/analyse/documentation. Aucune base, permission, migration ou repository voisin n'a été modifié.

## D01 — Modèle et publication validés, arbitrages clos

**Source : instruction explicite de l'utilisateur du 13 octobre 2026.** `public.exercises` porte l'identité stable ; `public.exercise_versions` porte les révisions. Les versions publiées sont immuables et les nouvelles définitions utilisent le contrat canonique compatible avec `novlearn-exercise-engine`. Une révision peut produire de nombreuses instances par seed. Les nouvelles tentatives devront référencer la version et retrouver l'instance réellement utilisée ; aucune version n'est attribuée arbitrairement aux tentatives historiques.

L'option B précédemment recommandée (R3) est adoptée. L'ancien arbitrage A/B et le conflit « publication d'une seule table ou de deux » sont **clos**. Le contenu métier approuvé des deux tables est autorisé ; toutes les exclusions restent applicables. Une migration de structure peut faire évoluer une table exclue pour la compatibilité sans synchroniser ses données.

L'utilisateur autorise expressément l'exception ciblée à l'immutabilité du CDC. Seules les sections 10 (modèle/versionnement), 11 (publication/synchronisation et distinction structure/données) et 20 (arbitrages concernés) sont ajustées. Cette décision n'autorise ni application de migration ni modification distante de Supabase, ni démarrage d'un lot fonctionnel.

| Date / étape    | Arbitrage                                                                                    | Statut                       |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------------- |
| Lot 0 bis       | Lignes versionnées ou table dédiée ; conflit avec publication limitée à `exercises`          | Historique, remplacé par D01 |
| 13 octobre 2026 | Identité `exercises` + révisions `exercise_versions` ; publication sélective des deux tables | Validé définitivement        |

## Constats confirmés le 13 octobre 2026

- Production et Staging ont chacun 22 tables `public`, mêmes versions/noms de migrations déclarées, colonnes identiques pour `exercises`, `exercise_attempts`, `duels`, `duel_attempts`, `profiles`.
- Les deux projets déclarent PostgreSQL 17 mais des versions mineures différentes.
- Les policies consultées sont identiques : SELECT ouvert sur `exercises` pour anon/authenticated et `profiles_select_others USING (true)` pour authenticated.
- Les définitions actuellement observées de `get_random_exercise`, `get_monthly_leaderboard`, `get_weekly_leaderboard` sont équivalentes entre Staging et Production ; toutes sont `SECURITY DEFINER`. Le premier sérialise toute la ligne `exercises`.
- Les migrations sont rangées dans `Novlearn/supabase/migrations/`. La liste Git diverge dans son nommage/versionnement de la liste distante déclarée ; existence de modifications manuelles à confirmer, non démontrée.
- Le synchroniseur existant copie Production vers Staging plusieurs tables (chapitres, compétences, exercices, flashcards optionnelles), donc ne satisfait pas la publication Admin V1.
- Le package Engine lu est `0.1.0`, schéma 5. Son audit courant signale le transport isolé Windows non qualifié pour pilote.
- Les variables du dépôt Admin ne sont consommées par aucun code à ce jour. `.env.example` avait déjà des changements locaux avant le rapport ; ils ont été préservés.
- La préparation du Lot 1A relève 45 migrations suivies dans Git et 70 versions déclarées dans chaque base ; seulement 35 identifiants de version correspondent. Le rapprochement de leur SQL reste à faire.
- La lecture additionnelle des ACL et de `is_guest()` identifie un risque critique : des policies `ALL PERMISSIVE TO public USING (NOT is_guest())` peuvent autoriser des écritures sur profils, tentatives et duels. La conséquence est déduite du SQL et des grants ; aucun exploit/écriture distante n'est exécuté. Voir [sécurité](security.md).

## Recommandations de l'audit — à accepter ou modifier

| ID  | Recommandation                                                                                                                               | Dépendances                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| R1  | Garder `Novlearn/supabase/migrations/` comme source unique du schéma partagé ; aucune suite concurrente dans Admin.                          | Accord du propriétaire NovLearn/DB                           |
| R2  | Réconcilier fichiers Git, historique distant et schémas vivants avant toute migration ; baseline seulement après preuve.                     | Export structurel et revue DB                                |
| R4  | Préserver FK/IDs historiques ; liens version/instance ajoutés de façon compatible ; historiques sans version restent explicitement inconnus. | Cartographie consommateurs                                   |
| R5  | Publication atomique/idempotente par identifiant stable, preconditions/hash, audit, sans suppression ni écrasement silencieux.               | Autorisation réelle Publication, contrat de stockage         |
| R6  | Corriger et tester côté NovLearn les policies exercices/profils et les RPC avant d'autoriser lecture Admin.                                  | Propriétaire DB, politique publique produit                  |
| R7  | Auth serveur Staging, rôle Admin vérifié à chaque action, provision initial du rôle par procédure DB contrôlée et auditée.                   | Décisions RLS et provisionnement                             |
| R8  | Lire Production via capacité minimisée séparée et publier via rôle/service techniquement borné ; ne pas se fier au nom de clé.               | Étude des mécanismes Supabase/PG disponibles                 |
| R9  | Intégrer uniquement la version Engine verrouillée et le contrat public serveur ; suspendre pilote jusqu'à qualification Windows/runtime.     | Correctif/certification Engine et version consommateur élève |

## Arbitrages qui requièrent une décision humaine avant développement dépendant

1. Le dépôt `Novlearn` est-il bien propriétaire canonique des migrations partagées, et qui peut valider celles-ci ?
2. Quelles colonnes et contraintes exactes pour `exercise_versions`, sa version active et le stockage privé des instances ? Le choix du modèle à deux tables est déjà validé.
3. Quels champs métier précis sont projetés lors de la publication, quels droits techniques les bornent et comment les effets indirects des triggers sont-ils exclus ? Le périmètre des deux tables est déjà validé.
4. Quelle identité stable relie deux bases et deux historiques `bigint` ? UUID/addition progressive ou autre mapping ? Comment gérer les contenus Staging existants et les IDs réservés ?
5. Quel stockage/version de moteur conserve le rejeu des nouvelles tentatives ? Pour l'historique, seules des preuves d'une définition/instance réellement utilisée peuvent justifier un rattachement ; sinon conserver « version inconnue ».
6. Quels champs Production sont consultables nominativement, qui est autorisé à les voir, et quelles statistiques/agrégations sont réellement utiles ?
7. Quelle capacité PostgreSQL réelle est approuvée pour lecture seulement et publication limitée, et où s'exécute-t-elle ?
8. Qui provisionne le premier Admin Staging et quel mécanisme de MFA, révocation et audit est retenu ?
9. Le transport isolé Engine est-il requis dès V1 ; quel runtime cible, quelles bornes de ressources, et quel seuil de qualification autorise le pilote ?

La préparation du Lot 1A est décrite dans [son dossier technique](lot-1a-preparation.md). Une évolution supplémentaire du CDC requiert toujours une décision explicite et traçable ; D01 ne vaut pas autorisation générale de le modifier.
