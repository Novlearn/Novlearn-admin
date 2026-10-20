# Chemin de recherche des fonctions historiques — SQL 71 local

La migration canonique `20261020135725_novlearn_admin_legacy_function_search_path.sql`
fixe `search_path = ''` sur `public.handle_updated_at()` et
`public.generate_random_code(integer)`. Elle appartient au dépôt NovLearn.
Son SHA-256 est `345ec0bc24d7b1a339606841eb36d0b074c3eab620b690fd33878d73585e830f`.
Les [preuves](legacy-search-path-proof.json) ne constituent pas une validation
globale du Lot 1A ni une autorisation distante.

Les deux fonctions restent **SECURITY INVOKER**. Corps, valeurs par défaut,
propriétaires, ACL et autres attributs restent exacts. Les gardes vérifient
les signatures, le langage, les contrats et les empreintes des corps avant
toute modification. Seuls les retours CRLF/LF sont normalisés pour cette
empreinte ; aucune normalisation du contenu métier n’est admise. La migration
refuse une réapplication et un contrat inattendu.

Ce correctif suit la [recommandation officielle de l’advisor 0011](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0011_function_search_path_mutable)
et le [guide des fonctions](https://supabase.com/docs/guides/database/functions).
Aucune fonction ne devient privilégiée et aucune permission n’est élargie.

## Vérifications exécutées

- Onze prérequis négatifs produisent réellement P0001 : fonctions absentes,
  mode definer, configuration existante, strict, volatilité, corps et défaut
  inattendus. Les changements et DDL sont annulés ; le relevé initial revient
  exactement. Une exécution positive avec ROLLBACK et le refus de réapplication
  sont également exercés.
- Application canonique sur une **nouvelle copie peuplée SQL 70**, puis
  sauvegarde et restauration SQL 71 dans une autre copie. Les 62 tables,
  onze séquences et métadonnées restent exactes, hormis les deux réglages visés.
  Les mots de passe SCRAM des rôles personnalisés sont conservés. Seuls les
  mots de passe des rôles intégrés, propres à chaque cluster neuf, et l’ordre
  des tableaux ACL sont exclus des comparaisons interclusters.
- Comportement natif sous `anon`, `authenticated` et `service_role` : codes
  de longueurs 1/8/32, alphabet et défaut 8 ; mise à jour du timestamp par le
  vrai trigger sur une table temporaire de test, ensuite annulée. Aucun trigger
  ni objet de test n’est implanté dans une base applicative.
- Advisors officiels CLI 2.98.2 sur deux inventaires de rôles identiques :
  **32 WARN / 67 INFO avant, 30 WARN / 67 INFO après, zéro erreur**. Seuls les
  deux constats de chemin de recherche disparaissent ; tous les autres constats
  sont comparés intégralement. Connexions TLS vérifiées et transactions par
  défaut en lecture seule ; workers bornés et sans réseau externe.

Les bases applicatives restent inchangées : source Auth SQL 64 et cible de
publication SQL 70. Leur précédent relevé de **33 WARN** inclut un rôle physique
supplémentaire et ne devient pas artificiellement « 30 » par cette qualification.
Le correctif n’y est pas activé.

## Incidents du banc conservés

Le premier scénario de dérive de corps échoue sur un délimiteur dollar réduit
par le remplacement JavaScript ; une fonction de remplacement préserve ensuite
les octets SQL. Aucun P0001 ni succès n’est attribué à cet échec de syntaxe.

Après les assertions natives, le worker advisors ne démarre pas : son point de
montage `node_modules` manque dans un répertoire monté en lecture seule. Le
répertoire vide est créé dans le seul banc neuf ; les protections Docker restent
inchangées. La comparaison avec un ancien banc ayant un rôle de plus est refusée.
Une référence SQL 70 distincte permet la comparaison exacte décrite ci-dessus.

La première restauration de cette référence a démarré contre le serveur Unix
temporaire d’initialisation. Son arrêt normal interne interrompt pg_restore.
Cette copie partielle est conservée. Une autre copie neuve attend le serveur TCP
final ; sa restauration et les advisors passent. Aucun reset, suppression ou
réparation improvisée de la copie partielle.

Le rejeu neuf des **71 migrations** passe sur un nouveau PostgreSQL borné et sans
réseau. Les deux suites canoniques inchangées passent **30 assertions
d’intégration et 26 de sécurité**, puis six contrôles ACL/parcours Auth et amis.
Le banc de relevé avait initialement attendu un total historique erroné de 69 :
son échec est conservé et les 56 assertions effectivement exécutées sont relevées
avec leurs journaux et sources exactes, sans les relancer ni modifier leurs tests.

La réconciliation distante, les autres avertissements, les vérifications sur
l’hôte cible et l’accord d’application restent ouverts. Aucun distant, push ou
déploiement n’a lieu.

Le premier contrôle Admin complet s’arrête sur deux dépassements réels du délai
de cinq secondes dans `publication-verification.test.ts` : 1 420 tests passent,
deux échouent ; types, lint, build et smoke ne sont pas annoncés exécutés par
cette tentative. Le même fichier passe ensuite ses onze tests en isolation.
L’hôte observé est chargé (74 % CPU et environ 1,7 Gio de RAM libre). La
concurrence des fichiers passe de quatre à deux workers ; délais, assertions,
seeds et limites Engine restent inchangés. Une nouvelle commande complète doit
réussir avant tout bilan positif. Le parseur du relevé compte désormais aussi
les succès présents dans un résumé mixte d’échec ; l’ancien relevé brut reste
conservé.

**Requalification complète réussie : 1 422 tests / 75 fichiers**, intégrité de
l’archive Engine, types, lint sans erreur (un avertissement `<img>` antérieur),
format, build et smoke HTTP. Les onze SQL du standalone sont exacts. Les 567
sources correspondent à la fin du contrôle ; seuls les neuf documents de bilan
listés dans la preuve sont ensuite complétés. Les deux timeouts initiaux restent
conservés ; la concurrence est bornée à deux fichiers, avec les mêmes délais,
assertions, seeds et limites Engine. La réception navigateur et les portes
distantes restent ouvertes.
