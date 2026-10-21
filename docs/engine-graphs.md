# Courbes officielles — réalisation locale autorisée D10

**Reporté par D11, pas livré dans l’Admin installé.** L’utilisateur autorise
explicitement l’extension locale et sa certification le 21 octobre. La
[décision D10](decisions.md#d10--extension-locale-engine-pour-les-courbes)
complète le [plan approuvé](engine-graph-proposal.md).

Le nouveau code Engine fournit une opération séparée `sampleDisplayGraph`,
profil `display-graph-v1`, avec résultat d’affichage versionné 1. L’instance
officielle reste détenue par le serveur. Les points sont approximatifs ; les
lacunes, limites et domaines non prouvés restent explicites. Le moteur de
correction et les anciennes projections ne sont pas remplacés par ce calcul.

Le package de développement devient 0.2.0. Les snapshots conservent leur
schéma 5 et l’identifiant du pipeline de correction/instanciation 0.1.0 ; le
nouveau profil de graphe a sa propre version. L’adoption devra distinguer
version du package, identité de ce pipeline et empreinte de l’archive.
L’Admin installé garde actuellement son archive certifiée d4d3abc4…582f9.

## Résultats obtenus et échecs conservés

Le dernier contrôle ciblé, terminé le 21 octobre à 09:24 UTC, passe **109 tests
sur quatre fichiers**, dont **28 tests de sampling**. Build et types stricts
passent aussi. Les deux scénarios rationnels à seize fonctions valent 2 165 ms
et 2 087 ms. Un nouveau test exige que les contrôles d’intervalle restent
comptés dans les 2 048 opérations, y compris lors d’une réutilisation de preuve.
Une fonction dessinée ne recalcule plus une valeur exacte inutilisée ; les
termes récurrents conservent leur chaîne de valeurs exactes.

Le premier contrôle complet a terminé : **1 555 succès, dix échecs**, 31
fichiers, 837,73 secondes. Neuf assertions supposaient encore l’ancienne liste
d’exports ou liaient la version du package au pipeline ; les assertions
complètes et les vecteurs historiques restent conservés, avec un pipeline
explicitement épinglé à 0.1.0 et un package 0.2.0. Le dixième échec dépassait
le délai de cinq secondes dans le cas à seize numérateurs distincts. Une
passe ciblée à 108 succès avait ensuite une marge de seulement 34 ms ; elle
n’a pas suffi à certifier ce scénario. Ces échecs et les optimisations suivantes
restent tracés. Une exécution interrompue sans rapport n’est pas un succès.

Le deuxième contrôle complet termine avec **1 566 succès et trois échecs** :
les cas historiques de collections, variables calculées et adaptation legacy
excèdent cinq secondes sous faible mémoire disponible. Une vérification
séparée de ces trois cas passe ensuite ; elle ne vaut pas succès global.

Le troisième contrôle Windows termine avec **1 543 succès et 26 échecs** sur
1 569 tests. Les tests portables et les 28 cas de graphe passent. Les 24 tests
de job Windows et deux tests natifs de transport échouent : les événements
Code Integrity 3077/3033 refusent le lanceur généré `job.exe` au titre de
l’exigence de signature Enterprise (policy
`0283ac0f-fff1-49ae-ada1-8a933130cad6`). Ce blocage de sécurité n’est pas un
verdict mathématique. Aucune protection n’est désactivée, aucun déplacement de
l’exécutable ni nouvel essai Windows n’est entrepris pour obtenir une exception.
La cible Linux cgroup v2 était déjà choisie et autorisée par l’utilisateur.

Le smoke de package externe termine avec succès sur l’archive 0.2.0
`0fb9f619a95f82065dba5562ffd82e952cb3351846a39606ee8ef96e2c8c605d` :
exports, types, génération/correction, graphe et bundle portable. Le contrôle
du bundle s’exécute dans Node et ne constitue pas une réception navigateur.
Le smoke natif Windows antérieur au troisième build a passé ; ce résultat
historique ne lève pas le refus de signature constaté ensuite.

Le **package réellement installé sous Linux** passe quatre phases séparées :
API/replay/projection, huit graphes sur chacune des seeds0/42 avec correction,
huit lignes legacy et recette invalide, puis douze contrôles OS. Les 26 appels
du scénario combiné restent sous cinq secondes, maximum **4 828,772 ms**, pic
cgroup **204,313 Mio**. Cette marge est faible et ne vaut pas garantie de
charge. Le test de pression mémoire frappe réellement le plafond et le worker
suivant fonctionne ; arrêt/annulation et processus orphelins sont contrôlés.
Profil inchangé : 384 Mio, zéro swap, 64 processus, UID 65534, réseau absent,
racine en lecture seule, capacités retirées, absence de nouveaux privilèges.
Le contrôle source complet Linux passe build, types, lint et format, puis échoue
au démarrage des workers Vitest : spawn EAGAIN sous la limite conservée de 64
processus. **Aucun test de cette passe n’a été exécuté** ; 28 fichiers échouent
à la collecte et trois erreurs de workers sont conservées. Le conteneur n’a
pas été tué par manque de mémoire. Aucun quota ou critère n’est modifié. D11
reporte désormais la suite de certification et l’adoption ; les tests Windows
gardent leurs gardes de plateforme existantes.
Preuves privées : `.local/engine-graph-work/linux-installed-1792579442729/`
et `.local/engine-graph-work/linux-source-1792579624287/`.

Après cette reprise, l’utilisateur a confirmé un nettoyage Docker. Les bases
locales ont disparu. La [restauration partielle du principal](docker-cleanup-recovery-2026-10-21.md)
rétablit la vraie connexion et l’ancien Engine sur 3150, avec 6 exercices sur 18
et 9 rapports sur 23. Les autres services restent fermés. Les anciens relevés
de conservation des quatorze services décrivent l’état **avant nettoyage** et
ne prouvent pas leur conservation actuelle. Aucun distant modifié.

Le service d’aperçu, le contrôle strict du résultat public, le renderer et leurs
nouveaux tests sont préparés séparément dans le dossier privé de travail. Ils
ne sont pas encore appliqués aux sources Admin, exécutés ou annoncés comme
livrés. Les relevés ci-dessous décrivent les étapes initiales.

- La compilation et les types stricts passent ; lint complet passé avant les
  derniers compléments de smokes/documents. Le contrôle complet restait alors en cours.
- Première suite sampling : 22 tests réussis, un timeout à 13,8 secondes.
  Le diagnostic séparé mesure 15,3 secondes de sampling, principalement dans
  la préparation répétée des domaines. Ce diagnostic n’est pas une réception.
- Avec cache local des seules preuves identiques : 23 tests réussis et deux
  timeouts sur 25. Les cas et le délai de cinq secondes restent inchangés.
- L’extraction de la préparation algébrique réutilise son corps et ses gardes
  sur l’AST déjà admis ; elle supprime la sérialisation/relecture LaTeX des
  contraintes dérivées. Les **25 nouveaux tests passent** ensuite. Le cas le
  plus lent vaut 4 801 ms : marge faible, aucune garantie de charge déduite.
- Les suites comprennent seize fonctions, 64 termes, une singularité entre
  points et un trou supprimable, les frontières logarithme/racine, les
  refus de budget et l’isolation entre paramètres/instances.

Les rapports JSON et profils sont conservés dans
`.local/engine-graph-work/`, notamment `units-cache-1.json`, `units-ast-1.json`
et `profile-budget.json`. Les smokes de package ont ensuite été exécutés avec les résultats et la portée
précisés plus haut. Ces premiers tests concernent le code avant
la qualification complète du package 0.2.0 ; ils ne certifient pas son tarball.

## Étapes encore obligatoires

1. Achever le contrôle source complet, notamment les régressions algébriques
   existantes, sans retirer de cas ni augmenter les délais.
2. Qualifier le nouveau worker et le package réellement installé sous Linux
   cgroup v2, 384 Mio, zéro swap, 64 processus, réseau absent et protections
   inchangées ; vérifier le replay, les domaines, l’arrêt et les limites réels.
3. Vérifier les cas de langage encore partiels, les erreurs techniques et les
   limites de projection ; aucun résultat partiel ne devient complet.
4. Adopter seulement l’archive qualifiée et son empreinte, préserver l’ancienne
   et les reçus existants, puis raccorder permissions, aperçu et renderer Admin.
5. Exécuter les contrôles Admin et le vrai parcours local, en gardant distincte
   la réception navigateur. L’automatisation refusée n’est pas contournée.

Aucun changement de l’application élève, distant, push, publication réelle ou
déploiement. La qualification SQL sur restauration fidèle de Staging reste
indépendante ; ni le Lot 1A ni le goal ne sont terminés par cette étape.
