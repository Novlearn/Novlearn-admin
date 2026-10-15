# Tableau de bord — indicateurs locaux Staging

La page `/admin` charge maintenant un relevé agrégé du catalogue et du contenu
Staging. Elle remplace le message d'attente du schéma. L'activation Auth reste
fermée avant réception du Lot 1A ; aucune base distante n'a été interrogée ou
modifiée pendant cette implémentation.

Le périmètre couvre la partie Staging du Dashboard du CDC. Les statistiques
réelles de Production, la consultation des utilisateurs et le journal des
publications restent à réaliser. Aucun résultat local ne prouve leur livraison.

## Définitions des indicateurs

| Indicateur                            | Définition                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total d'exercices                     | Identités `exercises`, y compris archives et contenu historique.                                                                                                                              |
| Brouillon, à relire, approuvé, publié | Statut de la révision dont le numéro est le plus élevé ; un exercice compte une seule fois.                                                                                                   |
| Historique                            | Exercice sans révision canonique et non archivé.                                                                                                                                              |
| Archivé                               | Identité dont `admin_archived_at` est renseigné ; ce statut est prioritaire.                                                                                                                  |
| Tests en échec                        | Dernier reçu enregistré correspondant à la dernière révision, à son empreinte et à son `test_epoch`, pour un exercice non archivé, dont `passed` est faux. Ordre `recorded_at DESC, id DESC`. |
| Versions actives                      | Exercice non archivé dont `active_version_id` désigne sa propre version au statut `published`.                                                                                                |
| Versions actives récentes             | Les cinq versions actuellement actives les plus récentes par `published_at DESC, id DESC`. Ce n'est pas un historique de transferts ou retours arrière.                                       |
| Chapitres, compétences, flashcards    | Nombre réel de lignes de chacune des trois tables Staging.                                                                                                                                    |

Les six statuts forment une partition du total et correspondent aux filtres du
catalogue. Un exercice avec un brouillon récent peut toujours avoir une ancienne
version publiée active. Un ancien échec ne compte plus après un succès plus
récent, une modification du contenu ou une modification suivie d'un retour au
contenu initial. Aucun reçu courant ne signifie pas « tests réussis » : le
compteur recense seulement les échecs connus selon cette définition.

L'environnement et l'heure du relevé sont affichés. Les compteurs renvoient
aux listes concernées ; un formulaire GET permet de recharger réellement le
relevé, sans dépendre d'une navigation vers la même URL conservée en mémoire.
Les nombres sont transportés sous forme de chaînes décimales et formatés avec
`BigInt`, pour conserver les valeurs au-delà de la précision entière JavaScript.
Un échec de lecture affiche « indisponible », jamais des zéros fabriqués.

## Accès et minimisation

Migration canonique NovLearn, commit local `882850e` :
`20261015122337_novlearn_admin_dashboard.sql` (59e fichier).

`admin_content_overview()` est une fonction **STABLE, SECURITY INVOKER**, avec
namespace vide, relations qualifiées et vérification fraîche de
`is_novlearn_admin()`. Seul `authenticated` reçoit EXECUTE ; les grants de
tables et les policies RLS existants sont conservés. Aucun nouveau privilège
de lecture personnelle ou d'écriture n'est ajouté. Ce choix suit la
[documentation des fonctions Supabase](https://supabase.com/docs/guides/database/functions).

L'agrégation s'effectue dans une seule requête SQL cohérente. La réponse contient
des compteurs, cinq métadonnées de versions au maximum et l'heure du relevé.
Elle ne renvoie ni définitions, attendus, reçus complets, clés, profils ni
identités d'acteurs. Il n'y a aucune lecture de comptes ou tentatives.

La page utilise le client Staging existant et refait le contrôle de session
vérifiée, profil Admin et session non invitée avant la requête. Le layout reste
dynamique. Aucun endpoint de mutation ou client privilégié n'est créé.
Le décodeur serveur valide les compteurs, totaux, références et bornes, puis
projette explicitement les seuls champs prévus. Les erreurs détaillées ne sont
pas affichées. Inter, couleurs et logo restent ceux du socle existant.

## Vérifications exécutées

Voir les [preuves et empreintes](dashboard-local-proof.json).

- **35 nouveaux tests Admin** : autorisations, révocation entre requêtes,
  indisponibilité Auth/SQL, agrégats invalides, précision entière, minimisation,
  liens de filtres, états vides et échappement HTML en rendu serveur.
- Contrôle complet `npm.cmd run check` : **337 tests / 24 fichiers**, intégrité
  de l'archive Engine, types, format, build et smoke standalone réussis. Lint :
  aucune erreur, un avertissement `<img>` préexistant dans le banc catalogue.
- **35 assertions SQL** avant/après restauration incrémentale : refus des rôles
  non autorisés, absence d'identité/invité, révocation, statuts concordant avec
  le catalogue, absence de double comptage, pointeur actif distinct du brouillon,
  reçus périmés/remplacés, archives et cinq métadonnées bornées.
- Les **60 tables** conservent leurs lignes après cette migration sans colonne
  nouvelle, après annulation des fixtures et après restauration. La source est
  conservée. Ce contrôle incrémental ne compare pas les séquences.
- **Rejeu neuf des 59 migrations** dans un nouveau conteneur isolé sans réseau,
  avec empreintes stables. Il porte sur l'arbre local, y compris les anciens
  changements SQL préexistants, et non sur un clone Git propre ou un historique
  distant réconcilié.
- Sauvegarde/restauration complète dans un autre conteneur : données, schéma,
  droits et séquences correspondent selon le comparateur existant inchangé.
  **Comparaison brute différente**, avec les normalisations déjà documentées
  d'ordre des ACL et de trous de colonnes supprimées. **69 assertions
  historiques de sécurité** passent.
- Après cette restauration des 59 migrations, les suites **48 catalogue,
  21 reçus, 43 relecture, 39 référentiel, 38 flashcards et 35 Dashboard** passent.

Les statuts publiés et reçus du nouveau test d'agrégation sont des fixtures
synthétiques insérées par le propriétaire dans la transaction de test. Ils
isolent les règles de comptage et ne constituent ni une certification de
signature, ni une validation pédagogique, ni une publication réelle. Les
triggers et droits ne sont pas désactivés. Le parcours natif Engine/HMAC/SQL
réel précédemment vérifié sur 58 migrations reste une preuve datée distincte ;
aucune nouvelle exécution complète des tests source Engine n'est annoncée.

Les échecs intermédiaires sont conservés : littéraux BigInt incompatibles avec
la cible TypeScript existante (remplacés par le constructeur, sans changer la
cible), copie par template refusée à cause de sessions sources (copie logique,
sans interrompre ces sessions), et fixture essayant d'éditer en relecture
(retour explicite au brouillon par le workflow existant). Aucune assertion
n'a été retirée ; la couverture SQL a été complétée jusqu'à 35 contrôles.

## Limites et étapes restantes

Le [refus de politique navigateur](flashcards.md) reste respecté : aucun nouveau
pilotage, capture ou test visuel Dashboard n'a été exécuté. Le rendu serveur
testé n'est pas une réception visuelle ou une certification d'accessibilité
interactive. La session Auth réelle n'est pas activée.

Les chiffres Production exigent une capacité de lecture distincte et réellement
limitée, des définitions de métriques et des champs utilisateurs autorisés.
La publication complète demande encore service, protection de la source,
journal durable et confirmations. Avant une application distante : historique
SQL réconcilié, sauvegarde/PITR réel, compatibilité du lecteur élève, comptes,
secrets et hébergement qualifiés, puis autorisation explicite. Le goal global
et le Lot 1A restent incomplets ; aucun push ni déploiement n'a été effectué.
