# Résultats pédagogiques — raccordement local

**Suivi du 19 octobre :** les [requêtes sont mesurées et optimisées](pedagogy-performance.md)
sur 100 000 réponses synthétiques. Le timeout reste inchangé, les droits et les
bornes de pagination sont revalidés, puis le vrai pool TLS et les API repassent.
Les preuves du raccordement initial ci-dessous conservent leur date ; le suivi
possède ses propres empreintes et sa propre qualification.

La page `/admin/statistics/pedagogy` et les deux API protégées sont raccordées
sur l’instance locale 3150. Depuis **Statistiques**, le lien **Explorer les
résultats pédagogiques** ouvre les filtres et les regroupements. La connexion
utilise les comptes locaux existants. Les [preuves datées](pedagogy-connected-proof.json)
distinguent SQL natif, PostgreSQL/TLS, HTTP réel, chaîne complète et réception visuelle.

## Fonctionnement

Les filtres combinent période UTC, chapitre, compétence, difficulté, type et mode.
Les résultats se regroupent par chapitre, compétence ou exercice, par pages de
25, avec tri par tentatives ou réussite enregistrée. Les définitions, grains de
comptage, bigint, inconnues et limites historiques restent celles du
[socle SQL 69](pedagogy-readonly.md). Aucun calcul mathématique concurrent ni
certification des verdicts historiques n’est ajouté.

Les listes de références sont bornées à 200 ; une recherche serveur retrouve
les références au-delà de la liste initiale. Les alias de chapitres sont cherchés
et `%`, `_`, `\` restent littéraux. Un identifiant exact est prioritaire parmi
plus de 200 correspondances. La recherche porte sur le libellé entier avant
troncature à 200 caractères Unicode. Une sélection hors liste est relue et
conservée. Les filtres sont soumis par formulaire GET, avec retour à la page 1.

La page distingue un résultat vide d’une lecture indisponible, sans transformer
une erreur en compteurs nuls. Le tableau rend les références manquantes visibles
et explique le chevauchement des compétences. Le rendu réutilise Inter, le bleu
et les composants visuels de l’Admin ; les libellés sont échappés par React.
Ces contrôles SSR ne prouvent pas les interactions dans un navigateur.

## Isolation et permissions

La source pédagogique est une **nouvelle copie synthétique SQL 69**, distincte
de la source d’activité générale SQL 68 et des bases Auth/catalogue conservées.
Ses chiffres ne décrivent pas les utilisateurs Production. Une sauvegarde
logique précède la restauration ; les 62 tables, 11 séquences, ACL/RLS et dix
rôles applicatifs, appartenances et empreintes SCRAM sont comparés. Les mots de
passe existants et le certificat de la qualification native sont conservés.
La configuration TLS/HBA de la nouvelle copie est explicitement provisionnée ;
elle n’est pas prétendue restaurée par le dump SQL.

La base n’expose aucun port. Un proxy sans privilèges, borné en mémoire et
processus, publie seulement `127.0.0.1:55436`. Elle utilise le réseau interne
local existant, dont la capacité est contrôlée, sans changer les réseaux de la
copie native isolée ni les réglages globaux de Docker.

Le pool serveur utilise TLS vérifié, deux connexions au maximum et des délais
bornés. Chaque lecture remet la session à zéro, vérifie l’identité SQL physique
et ses permissions, puis assume le lecteur et revérifie ses 32 colonnes. Toute
dérive ferme la connexion. La transaction read-only s’ajoute aux véritables
refus de privilèges ; elle ne les remplace pas. Aucune connexion brute ne sort
du lecteur, et seuls les agrégats ou métadonnées décodés sont retournés.

Les API et la page réautorisent l’identité et le rôle Admin côté serveur.
Les métadonnées éditables du JWT ne donnent aucun droit. Les réponses API sont
privées, non mises en cache, et conservent les cookies rafraîchis. L’activation
requiert `--statistics --pedagogy` et une copie physique qualifiée ; elle reste
fermée par défaut et dans le profil de publication indépendant. Les neuf
sources SQL statistiques/utilisateurs sont vérifiées dans le build standalone ;
les nouvelles sources SQL ne sont pas servies comme fichiers publics.

## Vérifications et incident conservé

- Le lecteur PostgreSQL réel passe 22 groupes et 46 refus SQLSTATE 42501,
  connexion SCRAM/TLS, mauvais certificat/mot de passe/hôte, refus de connexion
  en clair et à une autre base, timeout serveur et deux dérives de privilèges.
- Une transaction annulée ajoute plus de 200 références pour vérifier recherche,
  identifiant exact, alias, caractères littéraux et libellés Unicode tronqués.
  Toutes les lignes, séquences et permissions restent identiques après annulation.
- Les tests ciblés couvrent contrats, pool, cache de connexions, permissions API,
  requêtes invalides et rendu serveur ; les 24 tests du lanceur local passent.
- Quatorze groupes HTTP réels passent : comptes existants, faux rôle dans les
  métadonnées, filtres combinés, vide, grande page bigint, recherche, SSR,
  révocation du rôle, dérive du lecteur, panne/reconnexion et anciens lecteurs.
  Les seules sessions ouvertes par ces essais sont fermées. Les 62 tables
  pédagogiques sont exactes ; dans les 35 tables métier principales, seul
  `updated_at` du compte Admin synthétique peut changer lors du test de révocation.

La première tentative de redémarrage échoue avant disponibilité : Node ne résout
pas un import TypeScript sans extension dans la nouvelle branche du lanceur.
Le contrôle explicite de l’URL/certificat local remplace cet import. Après
vérification de l’absence des deux anciens processus et des ports libres, le
lancement normal réussit. Les 35 tables métier sont identiques avant/après.
Les logs de l’échec restent conservés ; aucun arrêt forcé, critère de test
assoupli ou restriction de sécurité contournée.

Les résultats Engine après redémarrage et de la chaîne complète sont consignés
séparément dans le relevé JSON. Ils ne sont réussis que si leur exécution s’y
termine réellement avec PASS.

## Limites ouvertes

Les advisors exécutés sur SQL 69 signalent **0 erreur, 33 avertissements et
67 informations** : 17 policies permissives multiples, 14 initplans Auth et
deux fonctions à search path mutable restent à analyser. Le résultat SQL 68
(32 WARN) n’est pas réutilisé comme preuve SQL 69. Ces constats empêchent de
revendiquer une certification SQL globale ; les critères restent inchangés.

La réception visuelle/accessibilité, MathLive et navigation dans une session
navigateur autorisée, les mesures sur la volumétrie réelle et l’hôte cible, les métriques
restantes, la source Production et la version active cible restent ouverts.
MFA/provisionnement, réconciliation de l’historique SQL distant, compatibilité
élève, première application/publication distante et déploiement exigent leurs
portes propres. Ce jalon ne clôture ni le Lot 1A, ni le Lot 8, ni le goal.

Référence Auth : [clients Supabase SSR et réponses privées](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
