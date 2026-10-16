# Retour à une révision publiée — intégration locale

Le retour fonctionnel est une nouvelle activation explicite d'une ancienne
révision déjà conservée sur la cible. Il utilise le même service que la
publication : source approuvée, nouveaux tests Engine aux deux étapes, diff,
confirmation signée, droits, journal et vérification après commit. Le mode
« Publier » ne doit pas réactiver implicitement une révision antérieure.

L'essai réel a révélé que le refus métier d'une révision absente était converti
en indisponibilité technique par `PublicationTarget.inspect`. Le pilote conserve
maintenant les conflits du planificateur comme `conflict`, transmis au service
et à la réponse HTTP 409. Une réponse de protocole invalide ou une panne reste
`unavailable` ; aucun texte d'erreur du pilote n'est exposé. Les références SQL
restent libérées par rollback et aucun plan ni transfert n'est créé après refus.

## Scénario et critères

Le contrôle `--functional-rollback` du banc PostgreSQL crée de nouvelles copies
locales. Il publie une première révision, puis crée une seconde via
`admin_save_exercise_draft`. Le véritable Engine produit un nouveau rapport
multi-seeds ; le signataire Node existant et les fonctions SQL enregistrent
son reçu et sa relecture. L'identité et l'attestation humaine sont des fixtures
explicitement synthétiques. Aucun statut approuvé n'est planté directement
dans la table pour éviter ces étapes.

La seconde définition possède un titre, un titre applicatif et une difficulté
différents. Après sa publication, le retour à la première doit restaurer le
pointeur et les champs métier correspondants. Toutes les colonnes des versions
déjà publiées sont comparées par empreinte avant/après ; les définitions,
horodatages et métadonnées restent inchangés. La source conserve ses champs de
brouillon et son propre UUID ; elle ne reçoit jamais l'UUID cible.

Deux tentatives sont ajoutées explicitement comme données de préparation,
chacune liée à la révision cible qu'elle a utilisée. Leur ajout est distingué
des effets du service. Leurs lignes et les tables exclues sont comparées entre
chaque étape de publication/reprise. Les versions restent présentes après le
retour arrière ; aucun backup ni suppression ne sert à changer la version active.
La préparation de chaque tentative incorrecte déclenche les compteurs existants :
le compteur de série du profil est actualisé et `user_stats.total_attempts`
augmente de un.
Le banc calcule les empreintes attendues de leurs lignes complètes dans la même
transaction, y compris l'horodatage ; toutes les autres lignes sont comparées.
Ces effets de préparation ne sont jamais autorisés pendant la publication.

Les dix étapes prévues couvrent première publication, création/validation de la
seconde, refus de retour vers une révision absente, seconde publication, refus
d'activation ancienne par le mode normal, retour avec perte d'acquittement après
commit, observation sans nouvelle application, répétition identique, réactivation
de la seconde en mode publication et retour confirmé à la première.

Commande complète :

```powershell
node --conditions=react-server scripts/test-publication-pg-local.mjs --functional-rollback
```

Le mode `--rollback-workflow` conserve les contrôles pilote/reprise et les dix
étapes ci-dessus, mais ne relance pas les neuf scénarios cible et les sept
scénarios du service. Il sert au rejeu ciblé après une correction du seul banc.
Les preuves doivent alors identifier séparément les scénarios déjà exécutés et
vérifier les empreintes communes du code ; elles ne présentent pas cette
sélection comme un nouveau passage de la suite complète.

## Réception

Les **dix étapes passent**, ainsi que les **13 groupes du contrôle ciblé**,
sur de nouvelles copies locales. Les 36 empreintes du manifeste correspondent
aux sources exécutées. Le contrôle complet Admin passe **584 tests dans
33 fichiers**, types, lint sans erreur (un avertissement préexistant), format,
build standalone et smoke HTTP. Les portes Auth fermées sont effectivement
vérifiées ; aucune connexion distante n'est déduite de ces résultats.

Les neuf scénarios cible et les sept scénarios du service ont terminé avec
leurs snapshots avant l'arrêt de décodage du banc décrit ci-dessous. Leurs
sources applicatives et workers sont vérifiés par empreinte ; les deux
modifications ultérieures du banc sont identifiées séparément. Ce relevé ne
transforme pas ce précédent run interrompu en réussite globale. Les
[preuves datées](publication-rollback-local-proof.json) séparent ces régressions
du rejeu ciblé réellement terminé et de la [finalisation source](publication-source-finalization.md).

Les 62 empreintes SQL sont inchangées depuis le rejeu neuf précédent ; aucune
nouvelle migration ni nouvelle exécution de ce rejeu complet n'est annoncée.
Les contrôles SQL de reprise passent à nouveau : 16 assertions avant et après
restauration et comparaison des snapshots des 62 tables de cette fixture.

Un premier essai s'est arrêté à l'ajout de la tentative de fixture : son attente
omettait les effets normaux des triggers sur `profiles` et `user_stats`.
Le journal `.local/lot1a/.publication-rollback-native.log` et le conteneur de cet
échec restent conservés. Le contrôle corrigé vérifie ces effets exacts plutôt
que de désactiver les triggers ou de permettre des écritures supplémentaires
au service. Une autre tentative a échoué avant SQL parce que Docker Desktop
était arrêté ; son journal `.publication-rollback-native-corrected.log` est
distinct. Le moteur Linux est ensuite redémarré par sa commande officielle.
Le rejeu `.publication-rollback-qualified-native.log` a ensuite détecté le
défaut de classification du refus métier. Son échec est conservé, avec les deux
premières étapes réussies. Les 73 tests ciblés de transaction/service et le
contrôle des types passent après correction ; ces résultats ciblés précèdent
le contrôle complet et le rejeu natif terminés ci-dessus.
Un autre arrêt `.publication-rollback-conflict-native.log` a identifié une
assertion essayant de décoder `t` comme JSON. Son expression attend toujours
`true` ; le résultat SQL est maintenant encodé par `to_jsonb`. Les neuf scénarios
cibles et les sept scénarios du service avaient terminé avant cet arrêt, avec
leurs snapshots conservés. Le rejeu suivant cible les dix étapes de retour,
avec les mêmes critères et sans nouveau changement applicatif.

Les essais ne constituent ni une connexion GoTrue/PostgREST réelle ni une
réception des interactions navigateur. Ils utilisent le même Engine Linux borné
et les rôles PostgreSQL privés, dans un réseau Docker interne sans port publié.
Aucun environnement distant, configuration d'accès ou protection système n'est
modifié. Auth, publication distante et déploiement restent fermés.

Le retour serveur/SQL est donc vérifié localement, avec relecture humaine
synthétique. La réception du parcours complet avec un vrai compte et les
interactions visuelles reste ouverte, ainsi que la publication groupée,
l'historique enrichi et les portes SQL/compatibilité/confinement/exploitation.
Le Lot 1A et le goal global ne sont pas terminés.
