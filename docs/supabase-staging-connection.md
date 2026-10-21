# Raccordement au vrai Supabase Staging

**État courant : Staging installé, connexion et première écriture confirmées.**
Après accord explicite Staging, restauration ciblée et 286 assertions SQL inchangées,
le delta est installé en une transaction. Les 147 contenus et les 70 anciennes
migrations sont conservés. Le compte choisi par l’utilisateur est administrateur.
Le serveur utilise les vrais comptes et données ; les traces confirment connexion
et catalogue, puis le POST réussi et la lecture du brouillon n°121. La base confirme
la nouvelle version après l’action complémentaire de l’utilisateur. [Guide et bilan](staging-app.md),
[qualification SQL](staging-sql-qualification-2026-10-21.json).
La demande de clé de signature a été refusée automatiquement puis non retenue
par l’utilisateur ; aucun secret de signature n’est installé, aucun rapport Engine
n’est enregistré. Production, publication et déploiement restent fermés.

Le constat initial et la proposition ci-dessous décrivent l’état avant cet accord
et cette installation ; leurs mentions d’absence d’objets ou d’écriture ne sont
pas le statut courant.

La demande de livraison rapide réduit les fonctionnalités, pas la connexion
aux vrais comptes et données Supabase. Le banc entièrement local livré sous
D11 ne répond pas à cette attente. L’application Next peut tourner sur cet
ordinateur tout en utilisant le projet distant `novlearn-staging` pour Auth
et les contenus. Production reste séparée et la publication désactivée.

## Constat réellement vérifié le 21 octobre

- Le MCP dédié cible bien `novlearn-staging`, référence
  `tksvbkvfusrnxulpahky`, actif et accessible.
- Le fichier `.env` contient déjà la bonne URL et une clé publishable.
  Le GET `/auth/v1/settings` retourne **200** avec cette configuration.
  Aucun mot de passe utilisateur ou clé privilégiée n’est demandé ou lu.
- Le code serveur utilise déjà Supabase SSR, la vérification utilisateur
  via `getUser()` et le rôle stocké dans `profiles`. Il n’est pas nécessaire
  de remplacer ce code par un autre système d’authentification.
- Le SELECT de catalogues confirme l’absence de `exercise_versions` et de
  `novlearn_admin_private`. La seule fonction `admin_*` existante est
  `admin_get_profile` ; les fonctions du catalogue/Creator manquent.
- La policy permissive `No guest access to profiles`, pour toutes les
  opérations et le rôle PUBLIC, est toujours présente. Elle s’ajoute aux
  droits de mise à jour de la colonne `role` pour les rôles API. La protection
  du rôle doit être corrigée et qualifiée avant d’ouvrir l’espace Admin.

[Preuve de métadonnées](supabase-staging-connection-2026-10-21.json).
Le contrôle de l’endpoint public prouve la connectivité et l’acceptation de la
clé ; **aucune connexion avec un vrai compte ni sauvegarde distante n’est
annoncée comme réussie**. Aucune ligne métier/Auth n’est lue et aucun objet,
compte, privilège, historique ou donnée distante n’est modifié.

## Proposition concrète

1. Garder le frontend local, le moteur déjà certifié et le périmètre essentiel.
   Utiliser les vrais comptes et contenus du projet Supabase Staging existant.
2. Partir des **19 migrations canoniques du socle SQL 46–64**, dans le dépôt
   Novlearn, pour préparer le delta applicable à cette base. Leurs empreintes
   correspondent à celles de l’instance locale qualifiée. Ce sont des sources
   de proposition ; elles ne sont pas un lot à rejouer aveuglément.
3. Préserver les données, identités, index, extensions et l’historique distant.
   Qualifier sauvegarde/restauration, compatibilité élève et permissions avant
   application. Les 286 assertions sur forme synthétique restent acquises dans
   leur portée ; elles ne deviennent pas une restauration fidèle de Staging.
   L’export PostgreSQL précédemment arrêté n’est pas relancé ni sa garde TLS
   contournée par cette demande.
4. Après validation de ce delta et accord explicite d’écriture Staging,
   installer les objets Admin et corriger les accès, autoriser un compte
   administrateur choisi, puis activer le serveur sur ce projet. Ne pas poser
   une fausse référence de revue pour faire disparaître la garde existante.
5. Tester la vraie connexion, les refus de permissions, la lecture des contenus
   et un nouveau brouillon d’essai sauvegardé dans Staging ; conserver
   Production, publication réelle et déploiement fermés.

La préparation et les lectures ci-dessus sont exécutées sans changement des
configurations existantes. L’application distante et les changements SQL
attendent l’accord qui remplace la précédente interdiction explicite de
modifier les environnements distants. La réussite des essais locaux ne vaut
pas mise en service Supabase réelle.
