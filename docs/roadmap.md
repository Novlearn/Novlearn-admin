# État actuel et roadmap

**Prochaine mission arrêtée :** [terminer Admin, Engine et quatre/cinq pilotes](mission-admin-engine.md),
avec le [prompt de lancement](prompt-mission-admin-engine.md). NovLearn reste en
lecture seule pendant cette mission ; son adaptation développement fera l'objet
d'une seconde conversation et d'un prompt fondé sur la réception réelle du pilote.
La mission est engagée : [dossier de réception](mission-admin-engine-reception.md).
Le banc connecté a constaté le refus du host sur le profil Vercel actuel.
L'utilisateur demande une [explication avant de décider de l'hébergement](prompt-explication-hebergement-engine.md) ;
aucune nouvelle infrastructure ou Function conteneurisée n'est autorisée à ce stade.
Archive 0.1.1, correctif numérique, builder et contrôles locaux préparés ;
déploiement de qualification Vercel autorisé. La réception distante et les
pilotes restent à faire. Aucun démarrage de NovLearn classique ni écriture Production.

**3 novembre — identité Engine Admin :** `package.json`, le lockfile, l'identité
et le manifeste Admin désignent l'archive 0.1.8 (SHA256
`82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea`). Le
contrat/pipeline reste schema 5 / Engine 0.1.0. La capacité optionnelle de
sampling des courbes n'est pas activée dans l'adaptateur d'aperçu Admin ; le
travail Engine 0.2.0 reste non adopté. Cette mise à jour statique ne prouve pas
la disponibilité d'un host ni la réception NovLearn.

**30 octobre — simplification proposée :** le [plan catalogue, builder et publication](plan-simplification.md)
décrit les sélecteurs de références, les cases Flash/calculatrice, la difficulté,
la reprise des exercices historiques et un parcours de publication plus court.
Précision utilisateur : exercices publiés d'abord en préproduction, promotion
sélective vers production ; flashcards publiées directement en production via
un circuit distinct. Adapter NovLearn avec quatre/cinq exercices pilotes avant
la conversion générale. Décision tracée dans le plan ; CDC à aligner explicitement
avant réalisation du nouveau périmètre flashcards.
Analyse et documentation uniquement ; aucun de ces nouveaux lots n'est implémenté.

**30 octobre — configuration regroupée :** un seul `.env` privé à la racine ;
les quatre exemples sont remplacés par le modèle de [configuration](auth.md).
Le message de connexion décrit désormais une configuration incomplète.
Après confirmation explicite de l'utilisateur, les marqueurs d'activation Auth
sont retirés. Cible retenue : Production Vercel, trois variables et base de
préproduction existante. Session/rôle, permissions et séparation avec la base
de production élèves restent contrôlés. Engine reste fermé sur Vercel.
Déploiement Production réalisé et formulaire actif vérifié sur le domaine réel ;
refus des visiteurs non connectés confirmés. Connexion réelle et parcours connecté
restent à recevoir : voir la [preuve et ses limites](vercel.md#vérification-du-30-octobre-2026).

**22 octobre — lot 2, distribution Engine :** le [contrat de bibliothèque](engine-library.md)
formalise l'archive qualifiée 0.1.0, ses exports, diagnostics et compatibilité.
Manifeste/inventaire complet et consommateurs minimaux Admin/NovLearn ajoutés ;
installation reproductible et contrats testés. Ni adoption 0.2.0, ni raccordement
élève, ni qualification d'un nouvel hôte. L'état D13 ci-dessous reste inchangé.

Relecture documentaire du **21 octobre 2026**, à partir du code au commit
`c2064bf13c0c20b094e30a9eb834869ff4420f3f` et des preuves conservées. Le dépôt
était propre au démarrage de cette mission. Aucun service, compte ou
environnement distant n’a été requalifié pendant ce nettoyage.

## État retenu

Le dernier profil préparé (D13) conserve Supabase Staging réel et retire les
instances Docker Admin après sauvegarde. Le frontend local se lance sans Docker.
Au moment de D13, **aucun déploiement ni réception Vercel n'était prouvé** ;
le déploiement et les contrôles HTTP du 30 octobre sont consignés ci-dessus.
Une ancienne URL locale répondant correctement n’établit pas sa disponibilité
actuelle.

**L’utilisation d’Engine est centrale dans le CDC. Le profil Vercel qui le
désactive est une préparation incomplète, pas une livraison acceptable de
l’Admin attendu.** La réduction antérieure du périmètre ne permet pas de
présenter un éditeur sans moteur comme achevé.

| Domaine                                    | Implémenté dans le dépôt                                                      | Vérifications disponibles                                                           | État du profil D13 / reste                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Auth Staging                               | Connexion, rôle serveur, refus invités, expiration                            | Connexion réelle D12 ; tests et refus HTTP D13                                      | Configurable, sans nouvelle réception navigateur ici                                                   |
| Catalogue et versions                      | Recherche, filtres, brouillons, révisions, duplication, archivage et conflits | SQL/HTTP locaux ; catalogue et brouillon n°121 sauvegardé puis relu sur Staging D12 | Raccordé à Staging ; ne pas déduire une réception de toutes les actions                                |
| Creator / MathLive                         | Éditeur canonique, champs avancés, gardes de sortie, récupération facultative | Tests unitaires/serveur ; parcours humain local limité                              | Raccordé ; réception complète du clavier, focus, navigation et types avancés restante                  |
| Engine / aperçu / correction               | Adaptateur officiel, worker borné, tests multi-seeds et projection publique   | Archive 0.1.0 exacte qualifiée Linux ; parcours connectés locaux historiques        | **Désactivé** par le lanceur Staging actuel et sur Vercel ; hôte opérationnel à qualifier et raccorder |
| Rapports et relecture                      | Reçus signés liés à une révision, historique, approbation humaine             | SQL/Engine/HTTP sur bancs locaux                                                    | **Désactivés**, aucune clé Staging provisionnée ; décision de signature et réception requises          |
| Chapitres, compétences, flashcards         | Gestion Staging et contrôles de références                                    | Tests SQL/API locaux                                                                | Raccordés dans le périmètre Staging ; pas de preuve de réception complète de chaque CRUD distant       |
| Dashboard catalogue                        | Agrégats du catalogue et référentiel Staging                                  | Tests et SQL locaux                                                                 | Code présent ; réception sur le profil actuel à compléter                                              |
| Statistiques / utilisateurs                | Agrégats, filtres pédagogiques, liste et fiche utilisateur                    | Copies synthétiques, PostgreSQL/TLS et Auth/HTTP locaux                             | Lecteurs locaux non remis en service ; aucune lecture Production opérationnelle prouvée                |
| Version active cible                       | Lecture du pointeur actif, différente de la dernière révision                 | Cible locale SQL70, refus et rollback                                               | Lecteur local non réactivé ; accès opérationnel restant                                                |
| Publication individuelle, lots et rollback | Diff, confirmation, journal, transfert et reprise après issue incertaine      | SQL/HTTP sur **copies locales**, simulations UI distinctes                          | **Désactivée** ; aucune publication Supabase Production livrée                                         |
| Courbes Engine 0.2.0 (D10)                 | Travail propriétaire décrit par une preuve datée                              | Phases package Linux réussies, contrôle source complet non réussi                   | Reporté ; archive non adoptée dans Admin                                                               |
| Hébergement / exploitation                 | Configuration Vercel, build autonome et en-têtes                              | Contrôle local D13 ; pas de réception sur domaine hébergé                           | Déploiement restant, sous autorisation distincte ; dépendance Engine non résolue                       |

## Portée des preuves récentes

- **D12, Staging :** la preuve SQL atteste l’application du bundle
  `20261021120707`, 286 assertions inchangées sur restauration ciblée, 147 lignes
  pédagogiques initiales et 70 anciennes entrées de migration préservées.
  La réception applicative distincte confirme connexion, catalogue, sauvegarde
  du brouillon n°121 et lectures de sa fiche. Elle ne prouve pas une reconnexion
  ultérieure ni tous les parcours du CDC.
- **D13, préparation Vercel :** la preuve conserve 1 531 tests / 80 fichiers,
  intégrité Engine, types, lint, format, build et smoke réussis à cette date.
  Les sept observations HTTP sans Docker incluent les refus Engine/aperçu 503.
  Ce résultat ne démontre pas un moteur utilisable dans cette préparation.
- Le banc D11 a subi une **restauration partielle** : six des 18 exercices et
  neuf des 23 rapports antérieurs au nettoyage ont été récupérés à cette étape.
  La sauvegarde finale D13 contient ensuite sept exercices et dix rapports.
  Ces chiffres décrivent des étapes différentes ; ils ne prouvent pas que les
  données récentes manquantes ont été retrouvées.

Les liens vers ces preuves et leurs limites sont dans
[Vérifications](verification.md). Les comptes rendus et anciens états Git sont
consultables dans l’historique, sans maintenir une seconde chronologie active.

## Travail restant et portes de réception

Le [plan de réalisation](plan-realisation.md) détaille les lots, dépendances et
critères d'acceptation d'Admin, d'Engine comme bibliothèque et de NovLearn
classique. L'application native est une extension hors chemin critique.

La sauvegarde actuelle contrôle l’enveloppe du brouillon (`draftEnvelope`), sans
validation mathématique Engine complète. C’est un écart à l’exigence de validation
avant sauvegarde du CDC (§16), à résoudre explicitement : ne pas présenter
l’acceptation d’un brouillon incomplet comme conforme à cette exigence ni modifier
le CDC sans décision tracée.

1. Choisir et qualifier l’hôte Engine officiel, puis raccorder le parcours
   authentifié : validation, génération par seed, projection et correction.
   Conserver délais, quotas et protections. Aucune substitution par MathLive ou
   un évaluateur Admin, ni activation par simple drapeau sur Vercel.
2. Compléter la réception sur Staging et l’hôte retenu : sauvegarde, réouverture,
   reconnexion, conflits, récupération et interactions MathLive. Les éventuels
   rapports persistés et la relecture demandent leur capacité de signature.
3. Avant toute extension distante, reprendre la réconciliation SQL de la cible,
   les consommateurs historiques, les ACL/RLS et les sauvegardes/restaurations
   adaptées. Le **Lot 1A reste incomplet** ; le bundle Staging n’est pas un delta
   universel ni une autorisation Production.
4. Reprendre uniquement les fonctions reportées explicitement retenues : courbes,
   lecteurs Production minimaux, version cible et publication sélective. Chacune
   exige ses prérequis, permissions et preuves sur la bonne cible.
5. Autoriser séparément déploiement et mise en service, puis exécuter la réception
   sur le domaine réel. Le **CDC complet n’est pas réceptionné**.

Cet ordre décrit les dépendances ; il ne démarre aucun lot ni n’autorise de
modification de code, de dépôt voisin, de secret ou d’environnement distant.
