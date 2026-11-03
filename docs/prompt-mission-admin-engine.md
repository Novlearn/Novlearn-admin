# Prompt de lancement : Admin, Engine et pilotes de préproduction

À copier dans une nouvelle conversation ouverte sur Novlearn-admin.

---

Réalise la mission 1 décrite dans `docs/mission-admin-engine.md`, dans l'ordre
A1 à A8. Il s'agit d'une mission d'implémentation et de réception, pas d'un
nouvel audit limité à des recommandations.

L'ensemble A1 à A8 constitue la mission autorisée : enchaîne ces lots quand leurs
dépendances sont satisfaites, sans demander une confirmation entre chaque lot.
Les autorisations distantes et d'infrastructure précisées plus bas restent des
portes explicites ; elles ne sont pas déduites du seul ordre des lots.

Lis les AGENTS applicables, `CDC_reference.md`, `docs/roadmap.md`,
`docs/plan-realisation.md`, `docs/plan-simplification.md`, `docs/engine-library.md`,
`docs/auth.md`, `docs/vercel.md` et les preuves pertinentes. Confronte les
affirmations documentaires au code et à l'état réellement accessible.

Périmètre autorisé de cette mission :

- Modifier Novlearn-admin et, explicitement, le dépôt voisin Novlearn-Engine pour
  corriger et qualifier les fonctionnalités Engine nécessaires à la V1.
- Préserver les changements existants dans les deux dépôts. Lire leurs AGENTS
  avant modification. Inspecter Novlearn classique en lecture seule ; ne pas
  modifier son backend, son frontend ni sa base applicative dans cette mission.
- Préparer les mises à jour ciblées et traçables du CDC correspondant aux
  décisions de `docs/mission-admin-engine.md`. Aucun changement produit implicite.
- Corriger le catalogue et le builder, installer une archive Engine immuable et
  reproductible, raccorder validation/génération/projection/correction serveur,
  simplifier vérification, relecture et publication selon le plan.
- Créer quatre ou cinq exercices synthétiques représentatifs, les qualifier
  localement, puis les enregistrer et les relire dans la base de préproduction
  existante `tksvbkvfusrnxulpahky` via les opérations Admin autorisées. Cette
  écriture limitée des pilotes est autorisée après réussite des contrôles et
  garantie qu'ils ne seront pas servis aux anciens parcours NovLearn.

Architecture et contraintes impératives :

- Engine reste la bibliothèque TypeScript commune : contrats, mathématiques,
  contraintes, génération, instances, projections et correction. Ne pas déplacer
  ces responsabilités dans Admin, React, FastAPI ou un client mobile.
- Pas de dépendance au chemin voisin, pas de remplacement silencieux de l'archive
  0.1.0, pas d'adoption de sources 0.2.0 sans qualification. Si changement :
  nouvelle version, artefact distinct, manifeste/lock et compatibilité explicites.
- Admin reste prioritairement sur Vercel, avec un seul `.env` privé et la base
  de préproduction existante. Éviter les drapeaux et couches inutiles. Les
  variables réellement indispensables sont documentées et centralisées.
- Qualifier le lanceur réel sur Vercel, sans retirer une garde pour masquer un
  échec. Conserver délais, mémoire, quotas et files actuels. Un timeout de Promise
  n'interrompt pas un calcul synchrone. Si une infrastructure ou un coût nouveau
  est indispensable, préparer une proposition concrète et demander l'autorisation
  avant installation ; ne pas présumer qu'un microservice est obligatoire.
- Conserver session/rôle serveur, origines, RLS, conflits et réponses privées
  côté serveur. Recevoir propriété, expiration et conservation des instantanés
  entre requêtes/instances. Ne pas afficher les valeurs des secrets ni les
  copier dans les rapports, les fixtures publiques ou Git.
- Chapitre/compétences recherchables dans le référentiel existant ; cases Flash
  et calculatrice ; difficulté Facile/Moyen/Difficile et correspondances explicites.
- Brouillon → publication préproduction → promotion sélective Production.
  Préparer aussi le circuit direct Production des flashcards, mais le tester sur
  copie : aucune écriture, activation ni clé Production dans cette mission.

Limites opérationnelles :

- Pas de suppression, conversion globale des anciens exercices, restauration de
  base, modification de comptes/tentatives/scores ou publication élèves.
- Pour toute migration distante nécessaire, préparer le diff précis, les tests
  sur copie et le retour arrière, puis obtenir l'autorisation avant application.
  Ne jamais élargir la création des pilotes à une migration implicite.
- Les nouveaux déploiements distants et installations d'infrastructure exigent
  leur autorisation sur un résultat préparé et vérifiable. Réutiliser les accès
  disponibles sans extraire ni exposer les secrets. Pas de push automatique.
- Les pilotes restent exclus des anciens parcours tant que NovLearn dev n'est
  pas adapté ; ne pas les annoncer reçus dans l'application élève en mission 1.

Travaille jusqu'à la réception de la mission 1, sans commencer automatiquement
NovLearn développement. Réutilise le travail validé ; tests ciblés par lot puis
contrôles intégrés pertinents. N'abaisse pas les assertions, quotas ou protections
pour obtenir un passage. Distingue preuves historiques, simulations, contrôles
locaux et opérations distantes exécutées. Aucun test réussi sans exécution.

À la fin, livre les changements, les résultats et limites, la liste exacte des
pilotes sauvegardés/relus, l'artefact/contrat Engine retenu et la documentation
mise à jour. Produis ensuite un prompt complet pour la mission 2 dans Novlearn
développement, fondé sur l'état final réel : installation du même artefact,
raccordement FastAPI/React, activation des pilotes, rendu, tentatives et correction,
recommandations/DS/duels, sécurité, tests, réception et retour arrière. Ne lance
pas cette seconde mission toi-même. Si une autorisation ou un accès bloque une
étape, termine les travaux indépendants et demande uniquement l'élément précis
manquant ; ne présente pas la mission comme achevée.
