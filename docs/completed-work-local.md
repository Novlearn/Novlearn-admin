# Deux compteurs d’exercices réalisés — 20 octobre 2026

La décision [D09](decisions.md) est intégrée dans les statistiques pédagogiques.
« Exercices différents traités » compte les ID d’exercices ayant au moins une
réponse correcte ou incorrecte, hors abandons. « Réponses terminées » compte ces
réponses avec répétitions ; une réponse sans ID contribue uniquement au second.
La période UTC, les filtres et les modes s’appliquent aux deux. La pagination et
la multiplicité des compétences ne multiplient pas les compteurs.

Le contrat pédagogique passe au schéma 2, contrôlé strictement côté serveur.
Les 32 colonnes de lecture et les permissions SQL restent identiques : aucune
migration, aucun droit supplémentaire et aucune opération distante.

Les [preuves locales](completed-work-local-proof.json) distinguent :

- 151 tests ciblés, dont dix nouveaux contrôles des compteurs et de leur contrat ;
- huit rapports TLS et HTTP réels comparés intégralement, avec oracle indépendant
  sur les lignes brutes pour les trois modes ; 4 exercices / 14 réponses sur
  la copie synthétique conservée, 3 / 9 en exercices et 2 / 5 en duels ;
- filtres combinés : 1 / 2 ; filtre vide : 0 / 0 ; changement de regroupement et
  pages éloignées sans modification des totaux ;
- refus anonyme 401, non-Admin 403 malgré métadonnée éditable « admin », et
  substitution de source 400 ; API privée sans cache ;
- rendu serveur réel des deux libellés ; aucun test navigateur revendiqué ;
- conservation exacte des 62 tables, 11 séquences et métadonnées de la source,
  ainsi que des 35 tables métier de l’application ; seules les nouvelles
  sessions de test sont ouvertes puis déconnectées ;
- 28 mesures sur les 100 000 réponses de la même copie conservée : maximum
  8,278 secondes, sous le seuil inchangé de dix secondes, avec deux CPU,
  1 Gio et aucun swap. L’oracle de cette campagne vérifie les métriques
  préexistantes ; l’oracle indépendant des nouveaux compteurs est celui du
  petit jeu contrôlé ci-dessus.

La vérification générale passe **1 432 tests / 75 fichiers**, intégrité Engine,
types, lint, format, build, onze SQL standalone et smoke. La réception visuelle,
les performances sur l’hôte cible et l’activation distante restent à effectuer.
Les verdicts historiques ne constituent pas une certification Engine.
