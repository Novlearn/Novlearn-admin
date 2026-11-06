# État actuel et prochaines étapes

**Mis à jour le 6 novembre 2026.** Le transport Admin–Engine a été fusionné dans
`main` le 5 novembre. Cet état décrit le code du dépôt ; il ne prouve pas le
contenu du dernier déploiement distant.

## État actuel

- **Admin** : le dernier déploiement Vercel documenté date du 30 octobre et
  précède le transport Engine. La réception complète (connexion, édition et
  parcours navigateur) reste à confirmer.
- **Engine** : Admin épingle le package 0.1.8. Les routes serveur peuvent utiliser
  le transport HTTPS vers `https://staging.novlearn.fr/run`, avec contrôle du
  token, de l’empreinte et du contrat. Les tests simulés locaux passent selon le
  relevé de la modification ; l’accès depuis Vercel et l’identité de l’archive
  réellement servie restent à recevoir. Détails :
  [transport Admin–Engine](guides/admin-engine-transport.md).
- **Données** : la dernière réception Staging consignée couvre le catalogue et
  un brouillon. Aucune écriture Production n’est comprise dans l’état du dépôt.
- **Livraison** : l’Admin complet avec Engine n’est pas reçu de bout en bout.

## Travail restant

1. Arrêter la décision d’hébergement à partir de la
   [mesure et des options](engine/engine-host-decision.md). Aucune nouvelle
   infrastructure ni dépense n’est présumée.
2. Avec l’archive exacte confirmée, recevoir un appel authentifié depuis Vercel,
   puis la validation, l’aperçu, la correction et la qualification.
3. Recevoir les parcours navigateur et les pilotes synthétiques en préproduction,
   en vérifiant qu’ils restent exclus des parcours NovLearn existants.
4. Avant d’adapter NovLearn classique, vérifier que les pilotes et le contrat
   Engine sont reçus dans le parcours élève.

## Règles de suivi

- Les décisions fonctionnelles restent dans le
  [CDC](../CDC_reference.md). Toute évolution du CDC doit être explicite et
  traçable.
- Staging et Production restent séparés. Publication, migration, déploiement et
  écriture distante exigent leurs autorisations propres.
- Les anciens résultats ne décrivent pas la disponibilité actuelle des services.
  Consigner chaque nouvelle réception avec sa date, sa révision et ses limites.
- Ne pas commencer automatiquement l’étape suivante lorsqu’une dépendance ou une
  autorisation manque.
