# Publication par lots — implémentation locale

Le catalogue permet de sélectionner jusqu'à **cinq révisions**, une par exercice,
approuvées ou déjà publiées et non archivées. La page
`/admin/publication/batch` présente les diffs, la confirmation de chaque exercice
et son résultat. Elle réutilise le service et l'API unitaires ; aucun second
mécanisme de transfert ou nouvelle migration n'est ajouté.

Le plafond borne le travail séquentiel face aux plans valables quinze minutes
et aux deux minutes prévues par opération. Les délais et quotas Engine restent
inchangés. Les transferts sont **indépendants par exercice** : un lot ne promet
pas une transaction atomique globale, conformément aux résultats partiels du CDC.

## Parcours et décisions

1. Sélectionner les révisions sur la page courante du catalogue. Les éléments
   non admissibles et les sélections devenues invisibles ne sont pas envoyés.
2. Préparer les diffs. Chaque requête relit la source, les permissions, les
   références et les nouveaux tests Engine. Aucun contenu fourni par le
   navigateur ne fait autorité.
3. Relire chaque diff et cocher les exercices à confirmer. Le bouton indique
   exactement leur nombre ; un diff non coché n'est pas transféré.
4. Confirmer les exercices relus. Les envois sont séquentiels. Une erreur, un
   refus ou un résultat incertain arrête les suivants et conserve les faits déjà
   confirmés. Les cases restantes sont retirées pour demander une nouvelle
   confirmation explicite.
5. Vérifier les résultats en attente avant une nouvelle confirmation. Cette
   action observe seulement les opérations existantes ; elle ne réclame ni
   n'applique un nouveau transfert.
6. Un plan encore en attente peut être annulé, avec confirmation de cette
   annulation. Un exercice annulé ou dont l'absence de transfert est établie
   peut ensuite être préparé à nouveau, par une action distincte. Les anciens
   plans et résultats restent dans le journal.

Une expiration est vérifiée avant la série puis avant chaque envoi. Un arrêt
utilisateur ou un démontage du composant annule la requête en cours et empêche
les envois suivants ; il ne prétend pas effacer un COMMIT déjà effectué. Le
service conserve son résultat durable et ses protections source existantes.

La présence uniquement dans Staging, le contenu déjà identique et les nouvelles
révisions sont distingués par le plan réel de chaque exercice. Aucun état cible
n'est déduit du seul statut éditorial source. Un résultat confirmé « inchangé »
est affiché comme un fait constaté ; le compteur ne prétend pas compter les
lignes physiquement modifiées.

## Rechargement et confidentialité

L'adresse de la page conserve uniquement l'identifiant du lot et les paires
révision/opération connues. Elle ne contient ni confirmation, empreinte, epoch,
définition ni clé. Aucun stockage navigateur de ces confirmations n'est ajouté.
Après rechargement, les identifiants permettent seulement de demander une
observation. Un plan encore en attente doit être annulé puis préparé à nouveau
pour obtenir un nouveau diff et une confirmation fraîche.

Une préparation dont la réponse est perdue peut avoir créé un plan dans le
journal sans que son ID soit connu du navigateur. Aucun transfert n'en découle
automatiquement. L'historique complet du compte permet de retrouver ce plan.
Les plans expirés ne sont pas supprimés. Un lot réutilise le `batch_id` déjà
persisté par le service ; les permissions serveur restent vérifiées pour chaque
opération, y compris l'observation et l'annulation.

Les métadonnées des révisions sélectionnées sont relues après autorisation de
la page, sans charger les définitions. Les bigint sont convertis en texte côté
SQL par PostgREST. Le catalogue transmet maintenant une projection explicite à
son composant interactif : les champs inconnus et les valeurs imbriquées
inattendues ne franchissent pas cette frontière navigateur.

## Essayer pendant le développement

L'application connectée conserve ses prérequis de publication fermés. Elle
permet la consultation de la sélection, mais ne contourne ni l'approbation ni
l'activation distante. Les brouillons non approuvés restent non sélectionnables.

Le banc propose un parcours manuel sur
`http://127.0.0.1:3140/tests/browser/publication-batch.html` : trois exercices,
résultat incertain, réponse perdue, refus connu ou trois succès. **Toutes les
réponses de cette page sont simulées**, sans Auth, Engine ni écriture SQL.
Une bannière le rappelle et la liste des requêtes permet de voir l'arrêt avant
la troisième confirmation. Le rechargement efface cette simulation. Son backend
continue de refuser une véritable publication.

## Preuves et limites

Le [relevé détaillé](publication-batch-proof.json) sépare les périmètres :

Le contrôle complet passe **676 tests dans 38 fichiers**, intégrité Engine,
types, lint sans erreur, format, build et smoke. Un avertissement image
préexistant subsiste. Les **13 contrôles HTTP** finaux et les compilations
ci-dessous sont distincts des transferts natifs.

Le nettoyage du banc HTTP est limité à sa session courante. Le contrôle final
vérifie qu'une seconde session réelle reste renouvelable après cette fermeture ;
les relevés HTTP antérieurs sont conservés séparément.

- Unités du contrôleur, URL, perte de réponse, expiration entre transferts,
  double action, démontage, reprise, éligibilité et identité des résultats ;
  refus d'accès de la page et projection minimale du catalogue.
- Cinq phases natives, après création de trois fixtures munies de vrais rapports
  Engine signés : préparation, deux COMMIT dont une perte d'acquittement est injectée après le second,
  reprise après reconstruction sans jetons, annulation du dernier plan puis
  nouvelle préparation/confirmation du troisième exercice. **Sept nouvelles
  vérifications Engine** et **trois appels d'application cible** sont observés.
- TLS/PostgreSQL réels, worker Linux x64 à 384 Mio, swap nul, 64 processus,
  utilisateur non privilégié, racine en lecture seule et réseau Docker interne
  sans port publié. Les deux bases d'origine restent inchangées ; les nouvelles
  bases et artefacts sont conservés. Les tables cibles exclues, anciennes
  tentatives et lignes préexistantes vérifiées restent identiques.
- Vraie session GoTrue, PostgREST et page Next sur l'instance 63 : lectures
  sélectionnées avec casts texte, refus non-Admin, URL invalide, absence de
  résultat inventé depuis un ID et journal inchangé. Publication toujours 503.
- Neuf pages du banc compilées ; HTML et module de simulation servis par HTTP.
  Ces résultats ne prouvent pas l'exécution des interactions dans un navigateur.

Le banc de transferts réutilise des **copies d'une fixture qualifiée au schéma
62** ; il ne rejoue pas les 63 migrations. L'instance connectée reste au schéma 63. L'identité Auth, le transport REST et les attestations de relecture sont
**synthétiques dans ce banc natif** ; les véritables comptes et REST ne sont
exercés que par les contrôles HTTP séparés. Aucun transfert distant ou parcours
de publication HTTP activé n'est certifié par ces preuves.

Le premier contrôle complet échoue uniquement sur le format après les tests,
types et lint. Les deux fichiers sont reformattés. Le programme parsé du worker
reformaté est comparé à celui exécuté pendant la qualification native : il est
identique, parenthèses redondantes mises à part. Les deux empreintes et la preuve
AST sont conservées ; aucun critère Native/Engine n'est changé. Le premier essai
unitaire avait aussi une fixture de diff incohérente : sa construction est
corrigée sans assouplir le codec réel.

Réception visuelle, qualification complète du confinement, MFA/expiration,
réconciliation/application SQL distantes, compatibilité élève et exploitation
restent ouvertes. Aucune protection Windows ni politique navigateur n'est
modifiée. La suite complète source Engine n'est pas relancée dans ce jalon.

Références : [CDC, publication](../CDC_reference.md),
[service unitaire](publication-service.md),
[transactions et reprise](publication-target.md),
[projections/casts PostgREST](https://docs.postgrest.org/en/v14/references/api/tables_views.html#casting-columns)
et [sélections Supabase](https://supabase.com/docs/reference/javascript/select).
