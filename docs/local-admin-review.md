# Relecture dans l’application locale connectée

La relecture peut être activée sur l’instance locale avec sa vraie connexion,
ses rapports Engine signés et son historique SQL. L’approbation concerne une
révision enregistrée et ne publie pas l’exercice.

## Essai progressif

Avec les services Docker de l’instance conservée démarrés et sa signature déjà
configurée, lancer :

```powershell
node scripts/run-local-admin.mjs .local/local-admin-1792143739689 --engine --review
```

Ne pas lancer un second serveur sur le même port. Pour changer les options,
arrêter d’abord ce serveur avec `--stop`, attendre sa fermeture, puis relancer.
La base et ses données sont conservées. Sans `--review`, la relecture reste
fermée ; cette option exige `--engine` et le fichier de signature local valide.
Les options inconnues ou contradictoires sont refusées. Aucun `.env` n’est écrit.

Ouvrir exactement `http://127.0.0.1:3150/` et utiliser le compte Admin du fichier
ignoré `.local/local-admin-1792143739689/login.txt`. Le lancement standard sur
le port 3000 reste fermé sans configuration autorisée.

1. Enregistrer un brouillon avec des références valides.
2. Consigner ses tests sur au moins deux seeds, avec les réponses correctes,
   incorrectes et invalides couvertes. Le dernier rapport doit être réussi.
3. Soumettre la révision à la relecture.
4. Effectuer la relecture humaine, cocher les quatre attestations puis confirmer.
5. Consulter l’historique, ou renvoyer la révision à corriger avec un motif.

Un test réussi ne coche aucune attestation. Une édition invalide l’approbation
et les anciens reçus ; un échec récent bloque la relecture même après un succès.
Une archive reste refusée. Une approbation ne change pas le pointeur actif.
La publication reste fermée, y compris pour une révision approuvée.

## Confirmation et erreurs

Le formulaire abandonne ses anciennes attestations lorsque la révision, son
état, son reçu ou ses permissions changent. Une confirmation n’envoie qu’une
requête ; son résultat doit correspondre à la révision, l’empreinte, le compteur
et la transition attendus, avec un identifiant d’événement valide.

Les refus de validation conservent les notes. Une réponse perdue, un conflit
ou un résultat non reconnu impose de recharger la fiche et son historique
avant une nouvelle confirmation. Aucun nouvel envoi automatique n’est tenté.
Le rechargement peut perdre les notes : le formulaire invite à les conserver.

L’API conserve ses contrôles d’origine, de session, de rôle relu et de format.
Elle projette seulement les cinq champs nécessaires du résultat SQL. Les
droits et critères SQL, le moteur et les quotas restent inchangés.

## Portée des preuves

Le [relevé de qualification](local-admin-review-proof.json) distingue les
tests unitaires, les contrôles de lancement et le parcours réellement exécuté
par `scripts/test-local-review.mjs`. Celui-ci utilise de nouveaux comptes
synthétiques, une vraie session GoTrue/SSR, les routes Next, PostgREST et le
worker Linux natif borné. Les attestations automatisées portent un marqueur
explicite et ne valent aucune réception humaine.

Les exercices, comptes et preuves de test sont conservés. Le parcours compare
les empreintes des lignes préexistantes des 35 tables des schémas `public` et
`novlearn_admin_private` (hors tables internes des sessions Auth), conserve les reçus
et événements, et termine son nouveau brouillon sans approbation. Il ne change
le rôle que de son propre nouveau compte. La déconnexion ferme seulement les
sessions du test, avec `scope: 'local'`.

Le contrôle complet passe : **696 tests dans 39 fichiers**, intégrité de
l’archive Engine, types, lint sans erreur, format, build et smoke standalone.
Le seul avertissement lint préexistant concerne l’image du banc visuel.
Les **10 contrôles du lancement local** passent séparément. L’inspection des
**48 bundles clients du build** ne trouve aucun des secrets opérateur, de
signature, mots de passe de test ou noms privés recherchés ; ce contrôle ciblé
ne vaut pas audit exhaustif de fuite.

Après arrêt et redémarrage réels, **huit contrôles supplémentaires** passent :
nouvelle connexion, brouillon et reçus/événements conservés, page protégée,
validation native via le nouveau canal privé, refus d’une requête invalide,
publication fermée et déconnexion de la seule session du test. Ce contrôle
n’effectue aucune mutation métier. Son premier lancement avait échoué avant
tout contrôle HTTP sur un chemin d’import incorrect dans le script de diagnostic ;
ce chemin a été corrigé avant l’exécution réussie.

L’échec intermédiaire est conservé : le nouveau test attendait à tort 400 pour
une archive, alors que SQL renvoie un conflit 409. L’attente est corrigée sur
ce contrat exact ; aucun refus n’est converti en succès. Un rapport dont les
seeds ont toutes été exécutées porte `complete: true` même si sa couverture
insuffisante impose `passed: false` ; ce refus est vérifié séparément.

La réception visuelle automatisée reste non exécutée après le refus de la
politique navigateur. Les essais manuels restent possibles. MFA, expiration,
publication HTTP complète, rendu avancé, statistiques/utilisateurs Production
et mise en service restent ouverts. Aucun accès distant, nouvelle migration,
modification source Engine ou nouvelle certification de sa suite complète
n’est déduit de cette qualification.
