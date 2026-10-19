# Requêtes pédagogiques — performance locale mesurée

La requête pédagogique est optimisée sans migration, index supplémentaire,
nouveau droit ou changement de délai. Sur le jeu synthétique décrit ci-dessous,
les 28 mesures SQL passent avec un maximum de **3,443 s**, contre un dépassement
de la limite de dix secondes auparavant. Quatre lectures du vrai pool TLS,
deux simultanées par série, passent avec un maximum observé de **3,727 s**.
Les [preuves datées](pedagogy-performance-proof.json) séparent ces mesures,
les permissions, les API et la chaîne complète.

## Charge et critères

Une nouvelle restauration SQL 69 est créée avec l’image PostgreSQL épinglée,
sans réseau ni port publié, limitée à deux CPU, 1 Gio de mémoire, sans swap et
256 processus. Elle réutilise une sauvegarde qualifiée et restaure les dix
rôles applicatifs, appartenances et empreintes SCRAM. Les bases utilisées par
l’application ne sont ni migrées ni redémarrées.

Le chargement ajoute 500 comptes fictifs sans mot de passe, 300 chapitres,
600 compétences, 2 000 exercices, 2 000 duels et **100 000 réponses stockées**
(50 000 en pratique, 50 000 en duel). Parmi ces réponses, 99 000 sont datées
dans la période synthétique de 90 jours ; 1 334 duels ajoutés sont terminés.
Les données incluent dates absentes, abandons, références absentes/ambiguës,
compétences répétées et liens inconnus. Aucun timestamp absent n’est inventé.
Les triggers, contraintes, policies, paramètres mémoire et JIT restent actifs.

Quatorze scénarios sont exécutés deux fois : trois regroupements et deux tris,
période courte, filtres combinés, duels, métadonnées inconnues, compétence
inconnue, filtre vide, deuxième page et page bigint supérieure à 2^53.
Le véritable décodeur est utilisé. Un comptage indépendant des données
synthétiques vérifie totaux, qualité, comptes actifs distincts, groupes,
chevauchements, tri et pages. La petite population restaurée est capturée
entièrement avant le chargement, sans liste de groupes tronquée.

Chaque mesure SQL place la session sous l’identité du service puis le rôle restreint,
avec contrôle des permissions et exactement 32 colonnes. Le timeout SQL reste
**10 s**, celui du client du pool **12 s**, et le pool garde deux connexions.
`EXPLAIN ANALYZE` exécute réellement les lectures ; les plans JSON, buffers,
sorts, estimations et réponses restent conservés dans les artefacts locaux.

## Diagnostic et correction

Le plan initial estimait environ 945 réponses et 24 duels dans une jointure
qui traite en réalité près de 50 000 réponses et plus de 2 000 duels. Il
choisissait une boucle imbriquée répétée. Les lectures directes des tables,
mesurées séparément, prennent environ 26 ms, 54 ms et 1 ms ; ces temps ne sont
pas ceux de la requête d’agrégation complète. L’extraction initiale des activités
dépasse déjà les dix secondes.

Matérialiser seulement les duels ne résout pas ce dépassement. La correction
permet au planificateur d’intégrer les constantes des bornes de filtres
(`bounds AS NOT MATERIALIZED`). Le plan de la jointure change, tout en conservant
RLS et les mêmes données autorisées. `statement_timestamp()` garde la même
valeur pendant une instruction ; la date du relevé reste cohérente.

La première variante rapide expose un cas limite de planification : le produit
du numéro de page invalide par 25 peut déborder avant le rejet par les bornes.
Un CTE de **pagination matérialisé séparément** protège ce calcul. Les filtres
de dates restent intégrables. Aucun paramètre invalide n’est borné ou corrigé
silencieusement. Les onze tests négatifs préexistants passent, avec trois cas
ajoutés : page négative et deux extrêmes int64, soit **14 bornes négatives**.

## Vérifications et conservation

La requête finale correspond exactement, octet pour octet, à la variante
mesurée. Les 18 cas SQL natifs, 23 refus SQLSTATE 42501, 14 bornes négatives,
22 groupes PostgreSQL/TLS avec 46 refus, et 14 groupes HTTP/Auth réels passent.
La nouvelle mesure du pool utilise le véritable lecteur serveur avec certificat
vérifié et SCRAM, puis réutilise ses connexions sur une deuxième série.
Les réponses complètes correspondent aux résultats qualifiés, hors heure du relevé.

Les 62 tables restaurées conservent toutes leurs lignes initiales pendant
l’ajout synthétique. Après chargement, chaque mesure conserve exactement les
lignes, les onze séquences, les rôles, ACL et policies. La configuration physique
TLS/HBA du test du pool est ajoutée explicitement à cette seule copie ; elle
n’est pas prétendue restaurée par le dump. Aucun ancien mot de passe ou
certificat n’est changé. Le contrôleur compare les empreintes des sources.

Le premier chargement échoue : le trigger des scores mensuels refuse une
réponse correcte dont la date est NULL. L’absence de backend encore actif,
puis l’annulation exacte des lignes, séquences et droits sont vérifiées avant
reprise. La fixture conserve ses dates NULL avec des verdicts faux pour ces
lignes, conformément au schéma ; aucune contrainte n’est assouplie. L’échec de
chargement, les timeouts initiaux, la variante insuffisante et la régression
de pagination restent documentés et ne sont pas comptés comme réussis.

La chaîne complète Admin est enregistrée séparément dans le JSON, uniquement
après terminaison réelle. L’Engine et son runtime ne changent pas ; leur dernière
qualification connectée reste datée dans le jalon précédent.

## Reproduction et limites

Les scripts refusent toute URL arbitraire ou base applicative. Dans ce workspace,
la copie qualifiée est réutilisable avec :

```text
node scripts/test-pedagogy-performance-local.mjs --resume .local/lot1a/pedagogy-performance-1792432841371
node scripts/test-pedagogy-performance-pool-local.mjs
```

La création initiale exige une sauvegarde locale SQL 69 qualifiée et aucun
marqueur existant. Une reprise de chargement exige l’inspection d’annulation
exacte ; un échec ne doit jamais conduire à un reset, une suppression ou une
relance aveugle. Les variantes sont limitées aux fichiers de l’artefact local,
jamais à une requête envoyée par un utilisateur de l’API.

Ces mesures portent sur un jeu synthétique précis, avec caches déjà sollicités
par le chargement, ANALYZE et les lectures. Deux répétitions ne constituent ni
un percentile fiable ni un SLA. Le réseau externe, les caches froids, une charge
réelle plus élevée et l’hôte de déploiement restent à qualifier. Aucune garantie
de performance Production ou réception visuelle n’en est déduite. Les 33
avertissements des advisors SQL 69, les autres portes du Lot 1A et l’activation
distante restent ouverts. Aucun test navigateur, migration distante, push ou
déploiement n’est exécuté.

Références : [PostgreSQL 17 — EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)
et [matérialisation des CTE](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION).
