# Proposition : calcul officiel des courbes pour l’aperçu Admin

**Statut : proposition à autoriser, aucune implémentation ni certification.**
Cette proposition ne modifie pas le CDC, l’Engine, son archive installée ou une
base. D05 autorise les corrections et certifications précédentes ; l’ajout
d’une capacité mathématique publique nécessite un accord distinct conformément
à `AGENTS.md` et aux [décisions existantes](decisions.md).

## Besoin et constat actuel

Le Creator permet de définir des fonctions et des suites explicites ou
récurrentes. L’aperçu affiche leurs formules, mais pas leurs courbes calculées.
Les suites à points prescrits sont déjà dessinées et doivent le rester.

Les [sources et empreintes observées](engine-graph-proposal.json) montrent :

- `DisplayElementData` exclut explicitement l’échantillonnage ; les projections
  portent `formulaDomain: unverified`.
- `instantiateDisplayMath` substitue les paramètres sans preuve de domaine ou
  de valeur pour la formule affichée.
- Le host expose huit opérations ; aucune ne calcule les points d’un graphe.
- L’Admin affiche cette limite et effectue seulement les transformations de
  coordonnées nécessaires au dessin.

Le dépôt Engine observé est au commit `baa48c4`, sans modification. CortexJS
est verrouillé à `0.151.0`. La documentation actuelle distingue évaluation
exacte et approximation numérique ; elle ne prouve pas les capacités de cette
version installée. Toute API utilisée devra être vérifiée dans cette version
et exercée par les tests. [Documentation numérique officielle](https://mathlive.io/compute-engine/guides/numeric-evaluation/).

## Périmètre proposé

Ajouter dans **Novlearn-Engine**, puis consommer dans **Novlearn-admin**, une
capacité d’échantillonnage d’affichage pour `function-graph` et les deux modes
calculés de `sequence-graph`. Réutiliser CortexJS, l’admission du langage, les
contextes et diagnostics du moteur. Aucun évaluateur dans Admin, nouveau
parseur LaTeX, `eval`, génération de JavaScript ou dépendance mathématique.

La définition canonique et les snapshots existants restent lisibles avec leur
version d’origine. Le calcul proposé est une opération séparée ; son contrat
de résultat doit être versionné, sans ajout silencieux aux anciens snapshots.
Un éventuel changement du format canonique ou du protocole doit être présenté
explicitement et testé avant adoption, sans réécriture des données existantes.

### Échange serveur proposé

Nom de travail de l’opération : `sampleDisplayGraph`. Ce nom et les champs
ci-dessous ne sont pas des API déjà disponibles.

| Entrée du canal privé                        | Autorité                                                         |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Instance officielle et identifiant d’élément | Snapshot détenu par le serveur ; jamais fourni par le navigateur |
| Profil d’échantillonnage versionné           | Fixé et borné par le serveur, pas de limites libres du client    |
| Fenêtre, formules et paramètres              | Relus dans cet élément de l’instance ; aucun nouveau tirage      |

Le résultat contiendrait la version du contrat d’échantillonnage, l’ID de
l’instance et de l’élément, une empreinte du contenu source, les IDs publics
des séries, les points finis, les segments admis, les lacunes diagnostiquées
et un état explicite `complete`, `partial` ou `unsupported`. Le nom de ces
états est proposé, sans modifier les états actuels de correction.

Les traces de parsing, substitutions privées, paramètres non publics et
attendus restent absents du résultat public. Les coordonnées approximatives
ne deviennent ni des `RenderNumber` prétendument exacts, ni une preuve globale
de domaine. `formulaDomain: unverified` ne devient pas `verified` par sampling.

### Règles mathématiques et visuelles

1. Examiner la source avant réduction et substitution. Conserver ses
   exclusions : une simplification ne doit pas combler un trou de domaine.
2. Distinguer paramètres générés, variable de fonction, indice de suite et
   variable de terme. Interdire les symboles ou constructions non admis.
3. N’émettre que des coordonnées réelles finies. Une valeur complexe,
   indéterminée ou hors domaine produit une lacune explicite, jamais zéro.
4. Déterminer les abscisses et raffinements de manière reproductible et
   bornée. Le tirage des paramètres de l’instance ne change pas entre points.
5. Ne relier des points que dans un intervalle où le profil peut justifier
   l’admissibilité et la continuité. Une simple proximité numérique ne prouve
   pas cette propriété. Sinon conserver les points isolés ou signaler un
   résultat partiel ; ne pas tracer de pont à travers une singularité inconnue.
6. Pour une suite explicite, respecter `start` et `count`. Pour une récurrence,
   conserver l’initiale et l’ordre des termes ; un terme indéfini arrête la
   chaîne dépendante et reste visible dans les diagnostics. Aucun remplacement
   par un autre terme ou une nouvelle valeur initiale.
7. Conserver les 1–64 termes et jusqu’à 16 fonctions du contrat actuel. Un
   budget insuffisant doit être signalé ; il ne réduit pas silencieusement
   la définition pour obtenir un succès.

La stratégie précise de justification des intervalles doit être revue à
partir des profils mathématiques existants. La proposition n’annonce pas un
solveur universel de domaines ou de continuité. Un résultat partiel reste
partiel et ne permet pas de déclarer tous les graphes réceptionnés.

### Ressources et erreurs

Conserver le runtime Linux cgroup v2 qualifié : 384 Mio, zéro swap, 64 processus,
utilisateur non privilégié, aucun réseau et système de fichiers en lecture
seule. Conserver le délai natif de cinq secondes, les bornes d’entrée/sortie,
l’annulation et l’arrêt effectif du worker. Aucun fallback Windows ou client.

Proposer un plafond supplémentaire de 2 048 évaluations par élément, incluant
les raffinements et contrôles intermédiaires. Ce plafond est une proposition
à mesurer ; il ne remplace pas les quotas existants. Si les cas requis ne
passent pas sous ces quotas, corriger l’implémentation ou rendre son refus
explicite ; ne pas augmenter les délais pour faire passer la certification.

### Intégration Admin et adoption

Le service d’aperçu vérifierait à nouveau la session et le propriétaire de
l’instance, puis sélectionnerait l’élément côté serveur. L’API n’accepterait
ni instance officielle, ni formule libre, ni coordonnées annoncées comme
officielles par le navigateur. Les données publiques seraient validées avant
de parvenir au renderer ; l’Admin ne ferait que dessiner les points/segments.

Les messages distingueraient approximation, résultat partiel, domaine non
pris en charge et panne du runtime. Le texte de limite actuel resterait tant
qu’aucun résultat officiel qualifié n’est disponible. La réception au clavier,
au lecteur d’écran et en mobile resterait une vérification réelle distincte.

Toute nouvelle archive serait identifiée par version et SHA-256 et certifiée
avant adoption. Conserver l’archive actuelle, les anciens reçus et les versions
publiées. Vérifier l’incidence sur l’identité Engine, les tests signés et la
publication ; ne jamais réécrire leurs empreintes pour simuler une adoption.
Si un changement SQL local est nécessaire, le documenter séparément dans la
source canonique autorisée. Aucun changement distant n’est inclus.

## Critères de réception à exécuter après autorisation

| Famille         | Résultat exigé                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fonctions       | Constante, affine, polynôme et familles admises par les profils ; coordonnées vérifiées contre des oracles indépendants, approximation annoncée        |
| Domaine source  | `1/x`, `1/(x-1/3)` avec pôle entre échantillons, `(x²-1)/(x-1)`, racine et logarithme aux frontières ; aucun trou effacé ni segment interdit           |
| Suites          | Explicite et récurrente, indice initial non nul, un terme et 64 termes, dépendance au terme précédent, échec d’un terme propagé explicitement          |
| Contrat complet | Plusieurs éléments et 16 fonctions ; aucune sélection des seuls cas faciles pour remplacer le scénario combiné                                         |
| Limites         | Budget atteint, fenêtre invalide, débordement numérique, valeurs complexes, syntaxe ou symboles refusés ; diagnostic précis, aucun faux succès         |
| Rejeu           | Même instance, archive et profil donnent les mêmes résultats sérialisés ; absence de contamination entre deux calculs                                  |
| Confidentialité | Tests positifs et négatifs de projection, champs privés et instance forgée ; permissions serveur et isolation propriétaire                             |
| Runtime         | Terminaison réelle pour dépassement, annulation, quota mémoire et charge combinée sous les délais/protections inchangés                                |
| Régressions     | Suite Engine complète sans retrait de cas ni skip opportuniste, tarball réel, intégrité d’archive, puis contrôles Admin pertinents et contrôle complet |
| Parcours        | Vraie génération, graphe et correction via Next/Auth/Engine locaux ; réception navigateur distincte, sans contournement du refus d’automatisation      |

Aucun de ces tests nouveaux n’a encore été exécuté. Les 1 540 tests Engine et
1 505 tests Admin précédemment réussis certifient leurs artefacts antérieurs,
pas la capacité proposée. Les 286 assertions SQL gardent leur portée propre.

## Accord nécessaire

Autoriser explicitement les modifications **locales** de Novlearn-Engine pour
cette capacité, sa certification puis son intégration locale dans Admin.
Cet accord n’autoriserait ni modification de l’application élève NovLearn,
ni migration distante, publication réelle, push, déploiement ou changement de
protection. Le refus ou le report conserve l’aperçu actuel et sa limite visible.

La qualification SQL sur restauration fidèle de Staging reste un autre
prérequis ; cette extension ne la remplace pas et ne clôture pas le Lot 1A.
