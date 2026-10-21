# Publier la version essentielle sur Vercel

Le dépôt est préparé pour Next.js 15.5.28 et Node 24.x, avec les comptes et
contenus du **vrai Supabase Staging**. Aucun déploiement Vercel n’est réalisé par
cette préparation. Le nom « Production » dans Vercel désigne l’environnement
d’hébergement ; il n’autorise jamais à remplacer la base par Supabase Production.

## Configuration dans Vercel

1. Importer le dépôt GitHub `BBuclon/Novlearn-admin`, branche `main`, dossier racine
   du dépôt. Conserver le preset Next.js et sélectionner Node **24.x**. Les
   commandes sont `npm ci` puis `npm run build`, déjà déclarées dans `vercel.json`.
2. Choisir le domaine HTTPS stable de l’Admin. Avant le déploiement utilisable,
   renseigner les variables ci-dessous dans **Settings → Environment Variables**.
   Le fichier `.env.vercel.example` contient seulement des exemples publics.
3. Déployer depuis Vercel, puis réaliser la réception sur ce domaine exact.
   Une modification de variables nécessite un nouveau déploiement. Ne pas
   importer `.env`, `.local/`, les sauvegardes ou des variables PostgreSQL privées.

| Variable                               | Valeur                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `APP_BASE_URL`                         | `https://` suivi du domaine exact choisi, sans chemin                      |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://tksvbkvfusrnxulpahky.supabase.co`                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé **publishable** de ce projet Staging, depuis Supabase Connect/API Keys |
| `ADMIN_STAGING_AUTH_ENABLED`           | `true`                                                                     |
| `ADMIN_STAGING_SECURITY_REVIEW`        | `docs/staging-sql-qualification-2026-10-21.json`                           |
| `ADMIN_ENGINE_ENABLED`                 | `false`                                                                    |
| `ADMIN_STAGING_LOCAL_ENGINE_ENABLED`   | `false`                                                                    |
| `ADMIN_EDITORIAL_REVIEW_ENABLED`       | `false`                                                                    |
| `ADMIN_PUBLICATION_ENABLED`            | `false`                                                                    |

Les autres variables `ADMIN_*` ne sont pas nécessaires pour cette livraison.
Ne renseigner aucune clé `service_role`, `sb_secret_*`, clé de signature, URL
PostgreSQL ou configuration locale Docker. Le rôle administrateur est lu en base
à chaque opération protégée ; posséder une clé publishable ne donne pas ce rôle.

`APP_BASE_URL` protège les mutations par contrôle d’origine. Une URL Preview
différente sera refusée pour les sauvegardes : utiliser le domaine stable ou
configurer explicitement l’origine propre à cet environnement. Ne pas autoriser
un joker. La connexion actuelle par mot de passe ne nécessite pas de nouveau
redirect OAuth ; les réglages Supabase de redirection restent inchangés.

## Périmètre de cette livraison

Connexion Supabase, catalogue, Creator/MathLive, brouillons, chapitres, compétences
et flashcards. Le premier brouillon n°121 a réellement été sauvegardé sur Staging
avant cette préparation, avec lecture de sa fiche ; cette réception antérieure
n’est pas une réception d’un site Vercel encore inexistant.

Les aperçus et tests Engine natifs sont indisponibles : les boutons sont masqués
et les routes refusent leur exécution sur Vercel, même avec un drapeau erroné.
La certification Linux existante n’est pas transférable automatiquement à
Vercel Functions. Leur réactivation demande un service Engine isolé, qualifié et
authentifié séparément. Aucun évaluateur mathématique concurrent n’est ajouté.
Rapports signés, relecture éditoriale, courbes, statistiques/utilisateurs et
publication de contenu vers Supabase Production restent reportés.

## Sécurité vérifiée et réserves

- Next.js **15.5.28** et `eslint-config-next` aligné, selon le
  [correctif officiel du 14 octobre](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
  `sharp` reste verrouillé à 0.35.5.
- Audit npm après mise à jour : **zéro vulnérabilité de production** ; **sept
  alertes élevées dans les dépendances de développement**, issues de `braces`.
  L’[avis officiel](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ne propose
  aucun correctif publié à cette date. Aucune mise à jour majeure forcée,
  suppression de tests ou déclaration de sécurité globale n’est effectuée.
- Contrôle serveur de session vérifiée et rôle, contrôle d’origine, corps bornés,
  réponses privées sans cache, cookies HttpOnly/SameSite et Secure sous HTTPS.
  En-têtes anti-inclusion, anti-détection de type et permissions navigateur
  limitées. Les tests incluent les refus anon/non-admin et la désactivation
  Engine/publication sur Vercel.
- Scan ciblé du worktree et de **tous les nouveaux objets Git sortants** : aucun
  secret privilégié détecté par les règles exécutées. Ce scan n’est pas une
  garantie exhaustive ; les fichiers privés et sauvegardes sont ignorés par Git.
- Advisors Staging consultés en lecture seule : **zéro erreur, 31 avertissements,
  sept informations**. Trente avertissements concernent les fonctions definer
  existantes ; le dernier indique la protection contre les mots de passe divulgués
  désactivée. Les sept informations concernent des tables RLS sans policy,
  notamment privées. Aucun réglage distant n’est modifié pendant ce nettoyage.

Avant une ouverture large, revoir les fonctions signalées, la politique MFA et
les paramètres Auth ; activer la protection contre les mots de passe compromis
si le plan Supabase le permet, via la procédure officielle
[Password security](https://supabase.com/docs/guides/auth/password-security).
Cette réserve ne permet pas d’annoncer « zéro risque » ni le CDC complet terminé.

## Réception après déploiement

Avec le compte administrateur existant et son mot de passe privé : connexion,
catalogue, création d’un brouillon d’essai, sauvegarde, réouverture, déconnexion
puis reconnexion et nouvelle lecture. Vérifier MathLive et la récupération de
saisie. Vérifier également qu’une fenêtre privée non connectée ne lit pas les
pages/API Admin. Aucun de ces tests Vercel n’est annoncé réussi avant exécution.

En cas de problème d’origine, vérifier le domaine et `APP_BASE_URL`, puis
redéployer. En cas de refus de rôle, vérifier le profil dans le projet **Staging**
sans élargir une policy ou utiliser une clé privilégiée dans le navigateur.
Un retour à un déploiement précédent ne restaure pas les données Supabase ; ne
pas rejouer le bundle SQL Staging déjà appliqué.

## Retrait de Docker et conservation

Les 33 conteneurs Admin et deux volumes exclusifs sont retirés ; zéro conteneur
Admin reste. Les 17 conteneurs et quatre volumes des autres projets sont
conservés. L’image Node exclusive est retirée, les images partagées et le cache
global conservés. Docker indique environ **1,99 Go d’utilisation en moins** : ce
compteur ne prouve pas une réduction immédiate du fichier disque virtuel Windows.

La dernière base locale est conservée sous forme de dump natif : sept exercices,
sept versions, dix rapports et six comptes d’essai locaux. Les deux volumes sont
également archivés après arrêt normal, avec empreintes, décompression et tables
des matières vérifiées. **Aucune nouvelle restauration de ces archives n’a été
exécutée.** Les sauvegardes privées restent dans
`.local/release-cleanup-20261021/backups/`, hors Git et hors Docker. Ne pas les
publier ni les importer dans Vercel.

Les anciens guides entièrement locaux sont historiques ; leurs conteneurs ne
sont plus disponibles. `start-staging.cmd` peut lancer le frontend local sur 3150
avec Supabase réel, **sans Docker**, si une vérification locale est nécessaire.
Les sources, données distantes et sauvegardes sont conservées.

Sources d’hébergement : [Node.js disponible sur Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
et [contraintes Functions](https://vercel.com/docs/functions/limitations).
