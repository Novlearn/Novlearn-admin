# Publication et historique — interface locale

Le détail d'une révision canonique contient désormais un panneau de publication.
L'entrée « Publications » ouvre l'historique du compte courant sur
`/admin/publication`. Ces pages utilisent les composants et les couleurs Inter,
bleu, blanc et slate déjà établis dans le design system. **L'accès réel et la
publication restent désactivés** ; aucune configuration distante n'est changée.

## Parcours individuel

Une révision approuvée ou déjà publiée, non archivée, peut demander un diff
au serveur lorsque les prérequis sont activés. Le mode permet de publier ou
de réactiver une révision précédente ; la disponibilité effective de cette
réactivation reste vérifiée par le service et la cible.

Le panneau présente l'action, les révisions, les métadonnées et la définition
avant/après, puis demande une confirmation explicite. Tous les changements du
diff restent accessibles dans des zones défilantes ; ils ne sont pas tronqués
silencieusement à cinquante champs. Le plan expiré refuse la confirmation.
La signature reste en mémoire dans le composant ; elle n'est pas enregistrée
dans un stockage navigateur ni dans l'URL.

Le client valide les projections reçues : identité du plan et de la version,
lot, mode, environnement, état et résultat doivent correspondre. Un record
privé complet, des résultats contradictoires ou des IDs bigint arrondis sont
refusés. Chaque action utilisateur envoie un seul POST. Il n'existe ni retry
automatique ni publication déduite d'un simple statut HTTP 200/202.

Une réponse perdue après confirmation retire l'autorisation locale de confirmer
à nouveau et propose « Vérifier le résultat ». Cette action observe le plan
existant ; elle n'en crée ni n'en applique un autre. Les états `executing` et
`uncertain` restent explicitement non confirmés. Un nouvel envoi éventuel
nécessite une nouvelle action humaine après vérification du plan en attente.
Les boutons sont bloqués pendant la requête et les réponses d'un composant
démonté sont ignorées. Le démontage annule la requête navigateur ; la conservation
d'un commit déjà établi relève toujours du service serveur.

## Historique et interruption

La page serveur vérifie de nouveau la session et le rôle avant l'appel fixe
`admin_list_publication_operations`. La fonction SQL existante filtre sur le
compte courant ; aucune table privée n'est exposée. La pagination respecte les
25 éléments et l'offset maximal de cette fonction. L'interface accepte uniquement
la projection minimale attendue et signale une indisponibilité, plutôt que de
présenter un historique vide après erreur.

L'historique permet de vérifier une opération ou de confirmer l'annulation
d'un plan encore en attente, y compris après rechargement. Il ne propose aucun
bouton de nouvelle publication : celle-ci nécessite le diff du détail de
révision. Les identifiants de suivi sont consultables dans un volet repliable.
Les titres et liens vers les exercices ne sont pas encore enrichis dans cette
projection ; aucune association bigint approximative n'est inventée.

## Essai progressif sans compte

Le banc existant propose maintenant
`http://127.0.0.1:3140/tests/browser/publication.html`. Il utilise les véritables
composants avec un transport de démonstration strictement propre à cette page.
Toutes ses réponses de publication sont **simulées** : aucun test Engine,
compte Auth, enregistrement ou transfert SQL n'est exécuté par ce parcours.
La bannière le rappelle en permanence. Le backend du banc continue de refuser
la publication avec HTTP 503 ; l'application Next conserve sa route protégée.

Scénarios à essayer manuellement :

1. Préparer un diff, relire les deux parties, cocher puis confirmer.
2. Vérifier que le plan expiré ne permet pas de confirmer.
3. Choisir « Réponse perdue après confirmation », puis vérifier son résultat.
4. Choisir l'issue incertaine : deux observations simulées établissent le fait,
   sans nouvelle action `confirm` dans la liste des requêtes de l'interface.
5. Essayer le conflit, l'échec connu, l'annulation et l'accès désactivé.
6. Ouvrir l'historique simulé et vérifier/annuler le plan conservé dans cet essai.

Les contrôles automatisés couvrent le décodage, l'intention de requête, les
refus d'accès de la page serveur, le rendu React serveur, HTTP et la compilation.
Le contrôle SQL local en transactions `READ ONLY` fournit une projection réelle
de onze opérations, acceptée par le nouveau codec. Les profils absent et révoqué
et l'identité invitée sont refusés avec `42501` ; l'offset hors borne avec `22023`.
Ces claims de session restent synthétiques : il ne s'agit ni d'un login GoTrue
ni d'un appel PostgREST réel. Aucun enregistrement permanent n'est effectué.
**Ils ne constituent pas une réception des interactions ou de l'apparence dans
un navigateur.** La restriction de politique navigateur reste respectée ;
aucune capture indirecte ni autre navigateur piloté n'est utilisé.

Le contrôle complet final passe **575 tests dans 33 fichiers**, types, lint
sans erreur (un avertissement préexistant), format, compilation et smoke. Les
huit pages du banc compilent et six vérifications HTTP passent ; le backend
de publication du banc reste fermé. Les noms de configuration privée de
publication sont absents des 45 bundles JavaScript clients inspectés.

## Limites et suite nécessaire

Le [service et ses preuves natives](publication-service.md) restent le jalon
précédent. Aucun nouveau transfert réel ni nouvelle certification Engine n'est
déduit des réponses de cette simulation. Les nouvelles vérifications figurent
dans [publication-ui-local-proof.json](publication-ui-local-proof.json).

La [finalisation source](publication-source-finalization.md) est réalisée dans
le jalon suivant : migration 62, reprise après blocage et révocation, vérifications
de conservation des lignes complètes. Le résultat affiché décrit un fait
historique confirmé ; il n'affirme pas que cette révision est toujours active.
Les preuves UI datées ci-dessus restent celles du premier raccordement.

Le [retour serveur/SQL entre deux révisions](publication-rollback.md) est vérifié
dans le jalon suivant. Restent les lots par exercice, l'enrichissement de
l'historique, les parcours Auth réels et la réception visuelle du parcours complet.
Les portes SQL/compatibilité/exploitation avant application distante restent
ouvertes. Le goal et le Lot 1A ne sont pas terminés.
