# Application locale connectée — 16 octobre 2026

L'application Next complète est accessible sur `http://127.0.0.1:3150/` avec
une vraie authentification GoTrue, les autorisations serveur et une base locale
persistante. Elle permet les essais progressifs du catalogue, des brouillons,
du Creator, des chapitres, des compétences et des flashcards. Les données sont
des données d'essai ; aucun projet distant n'est contacté.

**Complément :** le [raccordement Engine Linux](local-admin-engine.md) est
maintenant vérifié avec la session réelle et les rapports signés persistés.
Le lancement `--engine` active ce parcours ; le lancement simple décrit
ci-dessous conserve les calculs désactivés.

## Instance conservée

Le dossier ignoré `.local/local-admin-1792143739689/` contient `login.txt`
(identifiants d'essai), `app-config.json` (configuration applicative sans clé
privilégiée) et `private.json` (configuration opérateur, à ne jamais publier).
Les brouillons et comptes sont conservés après déconnexion ou arrêt du serveur.

Avec Docker Desktop Linux et les quatre services de cette instance démarrés :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689
```

Ce lancement est distinct de `npm run dev`, dont la configuration par défaut
reste fermée. Il n'écrit aucun fichier `.env`. Pour arrêter uniquement le
serveur applicatif et conserver la base :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --stop
```

`scripts/create-local-admin.mjs` prépare une nouvelle instance à partir du
rejeu SQL qualifié, sans réutiliser ni effacer les données de celle-ci. Il refuse
les ports occupés. Les images sont épinglées, le réseau des services est interne
et seule la passerelle est publiée sur `127.0.0.1:55431`. Les ressources sont
bornées. L'application ne lit pas les secrets opérateur de `private.json`.

## Frontières maintenues

Le mode local exige le développement, les deux origines loopback exactes et
l'empreinte qualifiée des 63 migrations. Les variables d'activation Staging,
de publication ou une configuration Supabase publique incompatible le font
refuser. Les cookies locaux ont leur propre nom. Chaque opération protégée
vérifie réellement l'utilisateur et son rôle dans `profiles` ; modifier les
métadonnées utilisateur ne donne aucun droit Admin.

La publication reste désactivée. Sans l'option Engine, un calcul indisponible
est refusé. Avec cette option, le calcul reste dans le worker Linux borné et
les routes Next conservent leurs contrôles de session et de rôle.
Le [banc Engine séparé](local-workspace.md), sur le port 3140, conserve ses
exemples sans sauvegarde en base.

## Vérifications et limites

Le premier jalon sans Engine a validé **621 tests dans 34 fichiers**, l'intégrité de l'archive
Engine, les types, le lint, le format, le build et le smoke avec accès distant
désactivé. Le rejeu neuf de 63 migrations et un bootstrap neuf avec Auth et
PostgREST réels passent. L'instance conservée, initialement créée avec 62 SQL,
a été mise à niveau avec comparaison des lignes des 62 tables.

`scripts/test-local-admin.mjs` exerce les vraies routes Next avec GoTrue,
PostgREST et SQL : connexion, refus non-Admin, cookies isolés, sauvegarde,
rechargement, conflit d'édition, révocation du rôle, mauvaise origine,
déconnexion et persistance après reconnexion. Les artefacts datés restent
dans le dossier de l'instance ; consulter la [preuve](local-admin-proof.json)
pour le dernier résultat exécuté.

La réception visuelle automatisée reste non exécutée après le refus de la
politique navigateur ; aucun navigateur alternatif ou capture indirecte n'est
utilisé. L'ouverture manuelle par l'utilisateur permet les retours d'interface.
L'expiration des sessions, MFA et l'activation distante ne sont pas certifiées
par ce parcours. La suite complète source Engine n'est pas relancée ici.

Les échecs intermédiaires sont conservés : premier lancement Kong dépassant
sa limite de ressources, commande Auth et réseau corrigés, première sauvegarde
obsolète bloquée par les retries PostgREST, et erreur de lecture des notices du
test SQL. Les protections et critères de succès n'ont pas été assouplis.

## Suite

Réceptionner l'interface, terminer le rendu avancé et la publication par lots. Les lectures
Production, la réconciliation distante, les comptes opérationnels et la mise
en service restent soumis aux portes de la roadmap et à une autorisation
distincte. Le goal reste actif et incomplet.
