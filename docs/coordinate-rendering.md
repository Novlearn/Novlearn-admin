# Figures et vecteurs — rendu local

Le rendu utilise exclusivement les coordonnées publiques prescrites par
l’Exercise Engine. Il ne calcule aucune formule, racine, variation ou réponse.
Le contrat canonique et le moteur restent inchangés.

## Comportement

Les vecteurs 2D sont maintenant représentés par des flèches depuis l’origine,
avec une échelle commune et leurs étiquettes. Les vecteurs 3D utilisent une
projection orthographique fixe, annoncée comme une vue 2D : deux vecteurs
distincts peuvent se superposer et les longueurs spatiales ne se lisent pas
directement sur cette projection. Une projection confondue avec l’origine est
signalée, sans conclure que le vecteur est nul. Les coordonnées exactes restent
dans MathLive lorsque `showCoordinates` les autorise ; elles restent masquées
dans la légende sinon. Les couleurs ne sont pas le seul moyen d’identification.

Les droites sont découpées à la fenêtre prescrite au lieu d’être prolongées
d’une longueur arbitraire. Une droite définie par deux points très éloignés du
cadre peut ainsi le traverser correctement. Un segment n’est jamais prolongé.
Les fenêtres et coordonnées de dessin non finies sont refusées au rendu,
sans présenter un dessin invalide comme une validation mathématique.

Les bornes des figures utilisent MathLive, y compris pour les fractions.
Les figures possèdent un titre et une description SVG. La géométrie propose
une description dépliable des points, des coordonnées et des objets prescrits,
y compris les points hors cadre. Les cercles, segments et polygones conservent
leurs données publiques ; aucune propriété géométrique n’est déduite.

## Essais et preuves

Le [relevé de qualification](coordinate-rendering-proof.json) distingue le
rendu serveur et les calculs natifs de l’exécution dans un navigateur.
La fixture canonique `tests/fixtures/coordinate-definition.json` est validée
par le véritable moteur Linux borné de l’instance connectée. Les projections
des seeds 0 et 42 sont capturées depuis les routes Next avec une vraie session
locale et conservées dans `tests/fixtures/coordinate-projections.json`.
Elles gardent notamment les fractions exactes et excluent attendus/politiques.
Ce parcours n’enregistre ni ne modifie aucun exercice en base.

Les tests de rendu consomment ces captures réelles. Ils contrôlent le découpage
de la droite dont les points sont hors cadre, le refus de prolonger un segment,
les références uniques des flèches, les limites de la projection 3D, les
coordonnées masquées, les bornes fractionnaires, les libellés accessibles,
l’échappement du texte et l’absence de valeurs SVG non finies.

Le contrôle complet passe : **718 tests dans 41 fichiers**, intégrité de
l’archive Engine, types, lint sans erreur, format, build et smoke standalone.
Le seul avertissement lint préexistant concerne l’image du banc visuel. Les
10 pages du banc manuel compilent. Le contrôle ciblé des 48 bundles clients
du build et des 22 bundles du banc ne trouve aucun des secrets ou noms privés
recherchés ; il ne vaut pas audit exhaustif des fuites.

Pour les essais manuels, ouvrir
`http://127.0.0.1:3140/tests/browser/coordinates.html` avec le banc local déjà
démarré. La page « Figures et vecteurs » est également reliée à son accueil et
à sa navigation. Elle affiche les deux captures publiques ; elle ne prétend
pas relancer l’Engine et n’utilise aucune base. Le rendu modifié est aussi celui
du Creator et des fiches de l’application connectée sur le port 3150.

Un échec initial du test de fractions est conservé : son sélecteur `text`
correspondait également au champ `textarea` de repli de MathLive. Le sélecteur
est corrigé pour viser uniquement la balise SVG ; les fractions restent bien
préservées dans les champs mathématiques. Aucune règle Engine n’est modifiée.

## Limites restantes

**Disponibilité native encore à qualifier :** le premier contrôle après
redémarrage échoue sur la génération avec HTTP 503. Le journal du host confirme
`timeout`, 5 022 ms d’exécution et 1,3 ms d’attente ; le conteneur reste actif,
sans arrêt OOM signalé. L’unique reproduction du même script réussit ses neuf
contrôles, sans changer la définition, les délais, les sources ou le confinement.
Ce résultat établit l’intermittence observée, sans résoudre la cause précise
du dépassement. Les deux résultats et métriques sont conservés dans la preuve,
dont l’état global reste **partiel**. Aucun nouvel essai automatique, hausse
de limite ou repli de calcul n’est introduit. La suite autorisée consiste à
profiler les temps d’instanciation sous le même profil borné, puis à qualifier
toute correction dans son dépôt propriétaire avant de conclure sur la disponibilité.

L’essai complet réussi consomme 4 985 ms pour l’instanciation et 399 ms pour
la projection. Un diagnostic séparé, sans modifier la fixture d’acceptation,
mesure chaque famille avec la question :

| Cas isolé                      | Instanciation | Projection publique |
| ------------------------------ | ------------: | ------------------: |
| Question seule                 |        817 ms |              426 ms |
| Vecteurs 2D + question         |      1 539 ms |              419 ms |
| Vecteurs 3D + question         |      1 943 ms |              465 ms |
| Géométrie + question           |      2 148 ms |              436 ms |
| Plan complexe + question       |      1 355 ms |              470 ms |
| Suite par points + question    |      1 375 ms |              419 ms |
| Formule de fonction + question |      1 270 ms |              426 ms |

Ces mesures ponctuelles localisent la tension pendant l’instanciation de la
charge combinée. Elles ne prouvent pas un coût strictement additif ni le site
de code responsable. La lecture du moteur montre un traitement de chaque
champ mathématique ; une optimisation éventuelle doit conserver son contexte,
ses diagnostics et ses résultats, puis repasser les certifications concernées.
Les cas isolés sont un diagnostic, **pas un remplacement du test complet**.

Le contrat Engine fournit les formules des fonctions et des suites explicites
ou récurrentes avec `formulaDomain: unverified`, sans échantillons calculés.
Leur tracé reste donc explicitement indisponible. Aucun évaluateur concurrent
n’est ajouté pour combler ce manque.

La réception visuelle et l’accessibilité dans un navigateur restent à vérifier
manuellement : l’automatisation reste non exécutée après le refus de la politique
navigateur. La compilation, les contrôles HTTP et le rendu serveur ne valent
pas une réception visuelle. Les tests mathématiques et la suite complète source
Engine ne sont pas réexécutés par une capture de projection. Publication,
environnements distants, données et configurations préexistantes sont conservés.
