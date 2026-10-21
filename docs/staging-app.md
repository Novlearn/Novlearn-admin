# NovLearn Admin avec Supabase Staging

**État courant D13 : [préparation Vercel](vercel.md).** Les instances Docker
Admin ont été retirées après archivage. Le frontend local peut être lancé par
`start-staging.cmd` **sans Docker**, avec les vrais comptes et contenus Staging.
Les aperçus et tests Engine sont désactivés dans cette livraison. Les résultats
de réception D12 ci-dessous sont conservés comme historique ; les mentions de
moteur actif et de banc local disponible ne décrivent plus l’état courant.
Le [bilan D13](release-vercel-2026-10-21.json) porte les vérifications nouvelles.

Ouvrir [l’application](http://127.0.0.1:3150/login). Pour la relancer : démarrer
Docker Desktop puis ouvrir `start-staging.cmd` à la racine du dépôt. Le frontend
et le moteur tournent sur cet ordinateur. Les comptes et contenus sont ceux du
vrai projet `novlearn-staging` ; les brouillons y restent après déconnexion.

Utiliser le compte choisi et créé dans Supabase par l’utilisateur, avec son propre
mot de passe. Ce compte confirmé a été promu administrateur après vérification de
son identité exacte. Le mot de passe Auth n’est pas demandé dans le chat ni placé
dans le code. Le frontend utilise une clé publishable ; aucun secret Supabase
privilégié n’est exposé.

## Ce qui a réellement été vérifié

- Métadonnées vivantes de 50 tables et 447 colonnes comparées aux copies locales,
  avec fonctions, contraintes, index, policies, triggers, propriétaires et droits.
- Sauvegarde ciblée des 111 exercices, 8 chapitres et 28 compétences ; restauration
  locale, dump natif puis restauration contrôlée avec complément des droits et
  dépendances. Les données sensibles Auth et les anciens SQL d’historique ne sont
  pas exportés. Ce n’est pas une sauvegarde intégrale du projet ou de Storage.
- 286 assertions SQL existantes exécutées sans changement après le delta ; dernière
  installation locale faite sous `postgres` non superutilisateur, comme le MCP.
- Migration Staging `20261021120707`, puis vérification des 22 anciennes tables
  publiques et de l’empreinte des 70 anciennes entrées d’historique : valeurs conservées.
  Les 11 séquences sont conservées pendant la transaction. Aucune ancienne ligne
  n’est supprimée ni convertie artificiellement en exercice canonique.
- Compte créé par l’utilisateur, rôle administrateur attribué seulement à l’identité
  confirmée choisie. Page de connexion HTTP 200, en-tête d’environnement `staging`.
- Réception humaine : « connexion et sauvegarde OK », puis « Brouillon enregistré
  dans Staging. » après une action complémentaire demandée parce que le premier
  retour n’était pas encore étayé par la base. Les traces montrent le POST de
  sauvegarde 200 puis les GET 200 de la fiche. Staging contient réellement la
  révision 1 du brouillon n°121, créée par le compte choisi. Ce parcours est manuel,
  pas un test de navigateur automatisé ; aucune reconnexion ultérieure n’est déduite.
- 61 tests ciblés passent pour le transport Engine et l’affichage de sa capacité.
  Le contrôle général final passe **1 525 tests / 79 fichiers**, types, lint
  sans erreur, format, build, intégrité Engine et smoke. Une erreur d’arrêt du petit
  processus Windows qui détecte un serveur déjà actif a été corrigée par un retour
  naturel ; la relance détecte maintenant l’instance et termine avec le code 0.
  Le dernier contrôle passe sur 612 sources exactes à sa fin ; seules les preuves
  documentaires sont complétées ensuite.

[Qualification SQL datée](staging-sql-qualification-2026-10-21.json).
Les preuves privées et sauvegardes restent dans
`.local/lot1a/staging-reconnection-1792582071318/` ; elles ne sont pas versionnées.
Le delta reproductible est conservé dans le dépôt propriétaire Novlearn, sous
`supabase/rollouts/20261021115604_novlearn_admin_staging_core.sql`. C’est un bundle
de raccordement à cette baseline vivante, **pas** une migration à ajouter au rejeu
neuf des 71 anciens fichiers canoniques. Leur ancien contenu est inchangé.

## Périmètre disponible

Connexion Supabase, catalogue historique, création et modification de brouillons,
Creator/MathLive, sauvegarde et réouverture, chapitres, compétences et flashcards.
Le moteur officiel 0.1.0 reste verrouillé à son archive certifiée et exécuté sous
Linux avec 384 Mio, zéro swap, 64 processus, réseau désactivé, utilisateur non
privilégié, système de fichiers en lecture seule et quotas inchangés. Le transport
de développement Staging nécessite sa porte explicite et reste limité à loopback.

L’utilisateur choisit de continuer **sans enregistrer les rapports Engine**.
Aucune clé privée de signature n’a été installée ; le lanceur ne charge pas de
secret de signature. Les tests et aperçus temporaires restent possibles. Le bouton
de consignation n’est proposé que lorsque le serveur possède réellement cette
capacité ; l’API conserve son refus en absence de clé. La relecture éditoriale
reste désactivée dans ce profil.

## Limites et opérations reportées

Courbes D10, statistiques/utilisateurs, lecture de version cible, publication,
Production et déploiement restent hors de cette livraison essentielle. Aucune
modification Production, aucun push ni déploiement n’est effectué. Le CDC complet
et le Lot 1A ne sont pas déclarés terminés par cette mise en service.

Le premier essai de migration distante a été annulé intégralement : le rôle
`postgres` n’avait pas le droit de changement de propriétaire. L’adaptation a été
testée localement sous ce même rôle : appartenance temporaire au rôle propriétaire,
retirée avant commit. Les contrôles distants confirment l’absence de droit SET ou
d’héritage conservé. Les deux adaptations fonctionnelles corrigent la référence
optionnelle à la compétence historique et retirent les privilèges élevés inutiles
du trigger de date, sans modifier son corps, son propriétaire ou ses ACL.

Le contrôle automatique a aussi refusé un export global Auth et la création d’une
nouvelle clé de signature sans accord spécifique. L’export a été réduit aux contenus
et métadonnées nécessaires ; la clé n’a pas été provisionnée. Les protections
Windows et le refus de pilotage du navigateur restent respectés.

Les advisors Staging après installation signalent zéro erreur, 30 avertissements
de fonctions definer et sept informations de RLS sans policy. Certaines fonctions
Admin gardent volontairement un droit EXECUTE assorti de leur contrôle d’identité
côté serveur ; aucun statut « zéro avertissement » n’est annoncé. Les avertissements
restants sont à revoir avant toute extension de portée ou mise en Production.

L’ancien banc entièrement local, ses données et ses sauvegardes restent conservés.
Il peut être relancé séparément après arrêt du profil Staging avec
`node scripts/run-staging-admin.mjs --stop` ; ne pas lancer deux serveurs sur 3150.

## Dépôts et suite

Admin reste sur `main`, à la révision `e8305ea23981f35ec5bbda745a0e20177cc7a714` :
les nouveaux changements de raccordement sont non committés et aucun push n’est
effectué. Le nouveau bundle SQL est également non committé dans Novlearn. Les
empreintes confirment la conservation des huit modifications préexistantes de
Novlearn, des vingt sources Engine en cours et des huit configurations privées.
Le CDC, le document de design, `.env.example` et l’audit utilisateur restent identiques.

Le diff des changements de cette reprise ne présente pas d’erreur d’espacement.
Le contrôle global du diff signale toujours la ligne vide finale préexistante de
`.env.example` ; elle est conservée conformément à la préservation des fichiers
utilisateur. Le lint garde un avertissement préexistant sur une image du banc de
test navigateur, avec zéro erreur.

Avant un déploiement ou toute application Production : obtenir l’autorisation
correspondante, préparer une sauvegarde adaptée à ces données réelles, qualifier
le delta propre à cette cible et son mécanisme de publication, choisir l’hôte du
moteur et la politique opérationnelle Auth/MFA. Le bundle Staging ne doit pas être
rejoué aveuglément. L’enregistrement de rapports demanderait un nouvel accord
spécifique de provisionnement ; ce n’est pas un prérequis à l’usage actuel retenu.
