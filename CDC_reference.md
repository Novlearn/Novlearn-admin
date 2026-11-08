# NovLearn Admin — Cahier des charges de référence

**Projet :** `novlearn-admin`  
**Statut :** spécification initiale de référence  
**Objectif :** construire une application d'administration indépendante pour gérer NovLearn et son contenu pédagogique.

---

# 1. Vision du projet

NovLearn Admin est l'application privée permettant d'administrer la plateforme NovLearn.

Elle doit permettre de :

- Consulter un tableau de bord.
- Analyser les statistiques de l'application.
- Consulter les utilisateurs et leur activité selon les permissions autorisées.
- Gérer le catalogue d'exercices.
- Créer et modifier des exercices dans un éditeur visuel.
- Tester les exercices avec le moteur mathématique commun.
- Valider et publier les exercices en production.
- Gérer les chapitres.
- Gérer les compétences.
- Créer et modifier les flashcards.
- Consulter et traiter les retours utilisateurs dans une phase ultérieure si retenue.

L'Admin doit être une application professionnelle, ergonomique, sécurisée et maintenable.

Il ne s'agit pas de modifier l'ancien NovLearn Creator : la nouvelle application sera construite depuis zéro.

L'ancien Creator servira uniquement de référence fonctionnelle. Son ancien code métier, ses systèmes de génération et ses mécanismes de correction ne doivent pas être recopiés sans justification.

---

# 2. Architecture générale

## 2.1 Repositories

L'écosystème comportera trois repositories principaux.

### `novlearn`

Application élève :
- Frontend Next.js.
- Backend FastAPI.
- Colyseus pour les duels en temps réel.
- Déploiement staging.
- Déploiement production.
- Utilisation du moteur mathématique partagé.

### `novlearn-admin`

Application d'administration :
- Nouveau projet Next.js full-stack.
- TypeScript strict.
- Interface d'administration.
- API serveur propres à l'Admin.
- Authentification Supabase Staging.
- Opérations de gestion sur Staging.
- Consultation contrôlée des données Production.
- Publication sélective des exercices vers Production.

Aucun nouveau backend FastAPI n'est requis pour l'Admin.

### `novlearn-exercise-engine`

Bibliothèque TypeScript indépendante :
- Contrats canoniques d'exercices.
- Validation.
- Génération des variables.
- Contraintes mathématiques.
- Instanciation.
- Projections publiques/privées.
- Correction des réponses.
- Diagnostics.

L'Admin et NovLearn utilisent le même moteur. Aucune logique mathématique concurrente ne doit être développée dans l'Admin.

## 2.2 Stack technique

Aligner les versions, outils et conventions du nouvel Admin sur celles effectivement utilisées dans NovLearn, après audit.

Stack cible :

- Next.js avec App Router.
- React.
- TypeScript strict.
- Tailwind CSS.
- shadcn/ui si compatible avec le design system existant.
- Supabase Auth et PostgreSQL.
- MathLive pour les champs mathématiques.
- NovLearn Exercise Engine côté serveur.
- Outils de tests et qualité similaires à NovLearn.

Utiliser les Server Components, Server Actions et Route Handlers lorsque leurs responsabilités s'y prêtent.

Les connexions privilégiées aux bases et au moteur ne doivent jamais dépendre d'un composant navigateur.

---

# 3. Environnements et bases Supabase

## 3.1 Projets existants

Deux projets Supabase ont été identifiés :

- `novlearn-prod` : production.
- `novlearn-staging` : staging.

Lors de l'audit initial, les deux projets possèdent 22 tables dans le schéma `public`.

Les tables principales concernées sont :

- `exercises`.
- `exercises_claude`.
- `exercise_attempts`.
- `duels`.
- `duel_attempts`.
- `profiles`.
- `chapters`.
- `competences`.
- `flashcards`.
- `feedbacks`.
- `user_progress`.
- `user_competence_scores`.
- `user_stats`.
- `monthly_scores`.
- Autres tables existantes nécessaires aux fonctionnalités NovLearn.

Les noms et structures réels doivent être pris en compte, sans inventer de colonnes qui n'existent pas encore.

## 3.2 Règle générale d'accès

### Supabase Staging

Base de travail principale de l'Admin.

Elle est utilisée pour :

- Authentifier les administrateurs.
- Créer et modifier les exercices.
- Gérer les brouillons et validations.
- Prévisualiser les exercices.
- Exécuter les tests.
- Gérer les chapitres.
- Gérer les compétences.
- Gérer les flashcards.

### Supabase Production

Accès limité à :

- La lecture des statistiques réelles.
- La consultation autorisée des utilisateurs.
- La consultation du catalogue publié.
- Une opération spécifique de publication des exercices validés.

Aucune opération d'édition ordinaire de l'Admin ne doit modifier directement les données de production.

## 3.3 Séparation stricte des environnements

- Les identifiants des projets Supabase sont distincts.
- Les comptes Auth staging et production ne sont pas supposés identiques.
- Les secrets sont séparés.
- Les rôles applicatifs sont vérifiés côté serveur.
- Le staging ne doit pas dépendre des vraies données personnelles de production pour fonctionner.
- Les migrations SQL doivent permettre de conserver des schémas applicatifs cohérents.
- Les données élèves et de test ne sont pas synchronisées entre les environnements.

---

# 4. Authentification et autorisations

## 4.1 Authentification

L'Admin utilise exclusivement Supabase Auth du projet Staging pour les connexions administratives.

L'accès nécessite :

1. Une session valide.
2. Un utilisateur existant dans Staging.
3. Un rôle administratif autorisé.
4. Une vérification côté serveur.

La table `profiles` possède déjà une colonne `role`.

Elle peut servir de base au contrôle des autorisations, sous réserve de vérification des politiques RLS et de la protection contre l'élévation de privilèges.

Un compte administrateur initial devra être créé et autorisé par une procédure sécurisée.

## 4.2 Rôles

V1 :
- `admin` : accès aux fonctionnalités autorisées.

Prévoir une architecture permettant de distinguer ultérieurement :
- Administrateur principal.
- Éditeur pédagogique.
- Relecteur / validateur.
- Administrateur en lecture seule.

Ne pas multiplier les rôles dès la première implémentation si aucun usage réel ne le justifie.

## 4.3 Accès Production

La connexion staging ne donne pas directement accès à Supabase Production.

Le serveur Admin doit vérifier l'identité et les permissions avant d'effectuer une opération autorisée sur Production.

Les opérations de statistiques doivent utiliser un accès en lecture seule à périmètre limité.

La publication des exercices doit utiliser une capacité d'écriture distincte, strictement réservée aux données pédagogiques autorisées.

Les clés privilégiées restent exclusivement côté serveur.

## 4.4 Sécurité existante

L'audit a identifié des points à traiter avant mise en service :

- Lecture actuelle de `exercises.content` par les rôles anonymes et authentifiés.
- Lecture large de `profiles` par les utilisateurs authentifiés.
- Fonctions `SECURITY DEFINER` nécessitant une revue de leurs permissions.
- Nécessité de vérifier la confidentialité des réponses attendues.

Aucun contournement de ces problèmes ne doit être considéré comme une solution définitive.

---

# 5. Interface générale

## 5.1 Structure

Application privée avec :

- Page de connexion.
- Layout d'administration.
- Sidebar.
- Barre supérieure.
- Navigation claire.
- Pages de listes et de détails.
- Formulaires.
- Fenêtres de confirmation.
- Notifications de réussite ou d'erreur.
- États de chargement et d'erreur.

Design cohérent avec l'identité visuelle NovLearn.

Priorité au desktop, avec adaptation aux écrans plus petits lorsque raisonnable.

## 5.2 Navigation cible

Sections principales :

1. Dashboard.
2. Exercices.
3. Creator.
4. Tests et publication.
5. Chapitres.
6. Compétences.
7. Flashcards.
8. Statistiques.
9. Utilisateurs.

Une section Paramètres pourra être ajoutée si des besoins concrets apparaissent.

Ne pas créer de pages vides inutiles uniquement pour remplir la navigation.

---

# 6. Dashboard

## 6.1 Objectif

Fournir une vue d'ensemble de l'activité NovLearn et de la gestion du contenu.

Le Dashboard peut agréger deux sources distinctes :

- Staging pour l'état des exercices et des publications.
- Production pour les données réelles de la plateforme.

Chaque donnée doit indiquer clairement son environnement d'origine.

## 6.2 Indicateurs du catalogue

- Nombre total d'exercices.
- Exercices en brouillon.
- Exercices validés.
- Exercices publiés.
- Exercices à revoir.
- Publications récentes.
- Éventuels tests en échec.

## 6.3 Indicateurs utilisateurs et activité

À partir de Production, selon les données réellement disponibles :

- Nombre de comptes.
- Nombre d'utilisateurs actifs selon une définition explicite.
- Nombre de tentatives.
- Taux de réussite.
- Exercices les plus réalisés.
- Exercices les plus difficiles selon les résultats.
- Activité par période.
- Duels réalisés.
- Progression ou résultats par chapitre et compétence.

Les indicateurs doivent être calculés sur des définitions documentées.

**Décision du responsable — 8 novembre 2026 :** les statistiques et la liste
des utilisateurs excluent les comptes invités. Les comptes comptés sont les
identités Auth encore présentes dont `is_anonymous IS FALSE`. Leurs tentatives
alimentent les volumes, les utilisateurs actifs et les taux de réussite ; les
tentatives d'invités ou sans compte encore présent sont exclues. Un duel terminé
est compté lorsque ses deux participants sont inscrits. Les tentatives d'un
participant inscrit restent comptées même si son adversaire est invité.

Ne pas présenter comme « utilisateurs actifs » un nombre qui correspond seulement aux comptes créés.

## 6.4 Filtres

Selon les données disponibles :

- Période.
- Chapitre.
- Compétence.
- Difficulté.
- Type d'exercice.

Les agrégations doivent éviter de transférer inutilement des données personnelles au navigateur.

---

# 7. Gestion des exercices

## 7.1 Objectif

Permettre d'organiser et de gérer le catalogue des exercices.

## 7.2 Listing

Afficher notamment :

- Identifiant.
- Titre.
- Titre destiné à l'application.
- Chapitre.
- Difficulté.
- Compétences.
- Exercice flash ou classique.
- Calculatrice nécessaire.
- Statut éditorial.
- Numéro ou identifiant de version.
- Date de création ou modification.
- État de publication.

Les statuts et versions nécessiteront une évolution contrôlée du modèle actuel.

## 7.3 Actions

- Rechercher.
- Filtrer.
- Trier.
- Consulter.
- Créer.
- Modifier.
- Dupliquer.
- Archiver.
- Comparer des versions.
- Prévisualiser.
- Accéder aux tests.
- Valider.
- Publier.
- Vérifier la version actuellement publiée.

Les suppressions définitives doivent rester exceptionnelles et nécessiter des permissions adaptées.

## 7.4 Formats des exercices

Les nouvelles définitions doivent utiliser exclusivement le format canonique de `novlearn-exercise-engine`.

L'Admin ne doit pas développer son propre format mathématique concurrent.

Les anciens exercices peuvent nécessiter un adaptateur de migration séparé.

Les exercices non compatibles ne doivent pas être modifiés silencieusement.

---

# 8. Creator — Éditeur visuel

## 8.1 Objectif

Créer et modifier des exercices sans écrire manuellement des structures JSON complexes.

L'éditeur doit rester capable d'exposer les paramètres avancés du moteur.

## 8.2 Structure de l'éditeur

Prévoir :

- Métadonnées générales.
- Définition des variables.
- Contraintes.
- Éléments de l'énoncé.
- Questions.
- Réponses attendues.
- Politiques de correction.
- Indications et explications.
- Prévisualisation.

L'ordre des éléments doit pouvoir être modifié.

## 8.3 Variables

L'éditeur doit représenter les mécanismes du moteur :

- Entier aléatoire.
- Décimal.
- Choix.
- Tuple.
- Variable calculée.
- Exclusions.
- Contraintes.
- Dépendances.

Il doit détecter ou afficher clairement :
- Variables inconnues.
- Dépendances invalides.
- Cycles.
- Contraintes incompatibles.
- Générations impossibles ou épuisées.

La vérification mathématique officielle reste assurée par l'Engine.

## 8.4 Éléments

L'éditeur doit couvrir les types réellement pris en charge par le moteur :

- Texte.
- Expressions mathématiques.
- Sections.
- Questions.
- QCM simple.
- QCM multiple.
- Graphiques.
- Tableaux de signes.
- Tableaux de variations.
- Tableaux de valeurs.
- Autres éléments définis par les contrats.

Les types avancés pourront être réalisés progressivement suivant une roadmap.

Décision mission Admin/Engine du 30 octobre 2026, confirmée par l'utilisateur :
Flash et calculatrice sont deux cases indépendantes. Chapitre et compétences
sont recherchés dans le référentiel existant ; le serveur contrôle leur existence
et leur association. Le chapitre garde sa représentation textuelle canonique,
les compétences leurs identifiants. Difficulté : Facile/Moyen/Difficile,
ordinals Engine 1/2/3, indices NovLearn 0/1/2. Une valeur historique inconnue
reste signalée et conservée jusqu'à une décision explicite.

Décision fonctionnelle explicite — 7 novembre 2026 : le titre administratif de
l'exercice sert également de nom dans l'application. L'éditeur ne propose pas
de titre d'application distinct ; il synchronise le champ canonique `title`
vers la métadonnée de titre destinée à l'application.

Décision fonctionnelle explicite — 7 novembre 2026 : le titre administratif de
l'exercice sert également de nom dans l'application. L'éditeur ne propose pas
de titre d'application distinct ; il synchronise le champ canonique `title`
vers la métadonnée de titre destinée à l'application.

## 8.5 MathLive

Utiliser MathLive pour :

- Saisir des expressions mathématiques.
- Saisir les réponses attendues.
- Tester les réponses élèves.
- Afficher un clavier scientifique adapté.
- Saisir fractions, racines, puissances, fonctions, intervalles et autres notations supportées.

Le LaTeX doit être traité selon les contrats du moteur.

MathLive ne doit jamais devenir la source de vérité des calculs ou des corrections.

## 8.6 Expérience d'édition

- Ajout d'éléments.
- Modification.
- Réordonnancement.
- Duplication.
- Validation des champs.
- Diagnostics clairs.
- Sauvegarde des brouillons.
- Confirmation en cas de sortie avec modifications non enregistrées.
- Prévisualisation de la version en cours.

La création doit être possible sans modifier directement le JSONB dans Supabase.

---

# 9. Tests, prévisualisation et validation

## 9.1 Objectif

Vérifier un exercice avant publication.

## 9.2 Prévisualisation

Fonctionnalités :

- Générer une instance.
- Choisir une seed.
- Regénérer une instance avec une autre seed.
- Afficher les variables obtenues.
- Afficher l'énoncé réel.
- Afficher les questions.
- Afficher les réponses attendues uniquement dans le mode administrateur autorisé.
- Voir les diagnostics du moteur.

La prévisualisation doit utiliser les mêmes composants d'affichage que l'application élève, lorsque ceux-ci seront disponibles.

## 9.3 Tests automatiques

Permettre :

- Générations sur plusieurs seeds.
- Vérification des contraintes.
- Détection d'échecs de génération.
- Validation des éléments.
- Vérification des réponses attendues.
- Tests de bonnes réponses.
- Tests de réponses volontairement incorrectes.
- Tests de formats invalides.
- Tests de projections publiques.
- Vérification de la reproductibilité.

Les résultats doivent présenter les seeds, questions et erreurs concernées.

Une vérification automatique ne remplace pas systématiquement la validation mathématique humaine.

La mission du 30 octobre regroupe les contrôles derrière une action, avec seeds
reproductibles 0, 1 et 42 par défaut et détails avancés accessibles. Les bornes,
la couverture et l'approbation humaine d'une révision précise restent requises.

## 9.4 Tests manuels

L'administrateur doit pouvoir :

- Voir l'exercice comme un élève.
- Saisir une réponse avec MathLive.
- Soumettre une réponse.
- Observer le résultat de correction.
- Tester des écritures mathématiques équivalentes.
- Tester plusieurs générations.

## 9.5 Validation éditoriale

Les statuts visibles du catalogue sont :

`Brouillon → Approuvé → Publié`

`Archivé` est un état terminal de classement qui peut s'appliquer à un exercice
quel que soit son statut antérieur.

Un nouvel exercice commence en brouillon. Il devient approuvé après validation
éditoriale de sa révision. Il devient publié uniquement après confirmation de sa
publication en Production. Un pointeur actif en Préproduction ou dans une copie
locale ne suffit pas à établir le statut publié. La validation Engine et les
rapports de test restent des contrôles requis, mais ne sont pas des statuts.

Une demande de relecture est une étape de travail, pas un statut visible distinct
du brouillon. L'historique de relecture et l'approbation humaine restent
attachés à une version précise. Une modification d'une version approuvée doit
invalider son approbation ou créer une nouvelle révision.

L'archivage dans l'Admin classe l'exercice comme archivé et ne déclenche aucune
écriture ni suppression en Production.

---

# 10. Versionnement des exercices

## 10.1 Principe

Un exercice possède une identité pédagogique stable et plusieurs révisions possibles.

Le modèle validé sépare cette identité dans `public.exercises` et ses révisions dans une nouvelle table `public.exercise_versions`.

Une version publiée doit être immuable.

Les modifications futures créent une nouvelle révision.

Les nouvelles définitions des révisions utilisent le contrat canonique compatible avec `novlearn-exercise-engine`.

## 10.2 Génération pour les élèves

Le versionnement ne fige pas les valeurs des variables.

Une même version publiée peut générer de nombreuses instances différentes.

Les nouvelles tentatives doivent pouvoir référencer leur version et retrouver l'instance réellement utilisée, notamment grâce à :
- Une seed.
- Des valeurs générées différentes.
- Un snapshot privé.
- Une référence à la version publiée.

Une tentative reprise doit retrouver son instance initiale.

Les tentatives historiques dépourvues de référence de version restent explicitement sans version connue. Aucune version ne leur est attribuée arbitrairement à partir du contenu courant.

Les duels peuvent partager une instance commune entre participants.

## 10.3 Stockage

La table historique `exercises` possède actuellement une clé primaire `bigint` et une colonne `content JSONB`.

Les tentatives et duels référencent les exercices existants.

La conception du nouveau stockage devra préserver ces relations.

Il faudra étudier précisément :

- Identité logique stable de l'exercice.
- Identifiant de chaque révision.
- Version active.
- Historique des versions publiées.
- Snapshots des tentatives.
- Compatibilité du format canonique.

Le choix du modèle est définitif : `public.exercises` porte l'identité stable et `public.exercise_versions` porte ses révisions. L'ancien arbitrage entre des lignes versionnées dans `exercises` et une table dédiée est clos.

La structure SQL détaillée, les contraintes d'immuabilité, la référence de version active, la correspondance des identifiants entre bases et le stockage des instances restent à préparer avant une migration autorisée. La création de `exercise_versions` n'est pas réputée déjà réalisée.

---

# 11. Publication Staging vers Production

Décision mission Admin/Engine du 30 octobre 2026 : brouillon en préproduction,
puis approbation de la révision, puis promotion sélective vers Production. Les
pilotes de mission 1 restent exclus des anciens parcours élèves jusqu'à
réception du lecteur canonique lors de la mission 2. Enregistrer un pilote
n'établit pas sa publication ni sa réception dans NovLearn.

## 11.1 Règle fondamentale

**La publication Staging → Production peut transférer uniquement le contenu métier approuvé de `public.exercises` et `public.exercise_versions` dans la V1.**

Ce périmètre ne constitue pas une réplication intégrale des lignes de ces tables. Seuls les exercices et révisions approuvés sont sélectionnés ; les brouillons, états éditoriaux internes, données de test et champs non autorisés ne sont pas copiés.

Les autres tables ne sont pas copiées.

En particulier, exclure :

- `exercise_attempts`.
- `duels`.
- `duel_attempts`.
- `profiles`.
- Les comptes `auth.users`.
- `user_progress`.
- `user_stats`.
- `monthly_scores`.
- `chapters`.
- `competences`.
- `flashcards`.
- `feedbacks`.
- `exercises_claude`.
- Toute donnée personnelle ou de test.

Toute autre table non explicitement autorisée reste exclue. La table `public.exercise_versions` est expressément autorisée par la décision validée du 13 octobre 2026 ; l'ancien arbitrage de publication sur une ou deux tables est clos.

## 11.2 Publication d'un exercice

Processus cible :

1. Sélectionner une version validée dans Staging.
2. Vérifier les permissions de l'administrateur.
3. Vérifier que la définition n'a pas changé depuis sa validation.
4. Vérifier sa compatibilité avec le moteur de Production.
5. Vérifier ses références pédagogiques et ressources.
6. Afficher un récapitulatif des changements.
7. Demander confirmation.
8. Publier uniquement les données autorisées de l'exercice.
9. Vérifier le résultat.
10. Conserver un journal d'audit.

## 11.3 Synchronisation groupée

Prévoir la possibilité de :

- Voir les exercices présents uniquement dans Staging.
- Voir ceux déjà publiés.
- Identifier les versions différentes.
- Sélectionner plusieurs exercices.
- Publier les versions validées en lot.
- Obtenir un résultat par exercice.

Ne pas confondre « synchronisation » et « remplacement de la base ».

Aucune suppression massive en production à partir des absences constatées dans Staging.

## 11.4 Sécurité et robustesse

- Publication côté serveur uniquement.
- Droits d'écriture Production très limités.
- Validation du schéma et du moteur.
- Idempotence.
- Protection contre les doublons.
- Préservation des anciennes tentatives.
- Aucune écriture dans les autres tables métier.
- Gestion des erreurs et des publications partielles.
- Vérification des références et des versions.
- Traçabilité.
- Possibilité de revenir à une ancienne version publiée.

L'ID `bigint` historique ne doit pas être copié aveuglément entre deux bases en supposant qu'il est toujours libre ou identique.

Une stratégie stable de correspondance entre exercices doit être définie.

## 11.5 Déploiement du code

La synchronisation d'exercices est indépendante du déploiement du code.

Le code NovLearn suit son processus GitHub staging → main → production.

Les évolutions SQL suivent des migrations versionnées.

Les migrations de structure peuvent faire évoluer d'autres tables, notamment les tentatives et les duels, lorsque leur compatibilité l'exige. Ces évolutions ne constituent pas une synchronisation de leurs données entre Staging et Production et nécessitent leur propre procédure de validation et d'application. L'autorisation de publier le contenu des deux tables n'autorise pas implicitement une migration.

La publication d'un exercice ne doit pas déclencher implicitement une migration SQL ou un déploiement de code.

---

# 12. Gestion des chapitres

Utiliser la table existante `chapters` de Staging.

Fonctionnalités :

- Liste.
- Recherche.
- Création.
- Modification.
- Ordre d'affichage.
- Nom.
- Alias.
- Emoji.
- Consultation des compétences associées.
- Contrôle avant suppression.

La suppression ne doit pas casser silencieusement les compétences ou exercices associés.

Ces modifications concernent Staging.

Leur propagation en production est hors du mécanisme de publication d'exercices.

---

# 13. Gestion des compétences

Utiliser la table existante `competences` de Staging.

Fonctionnalités :

- Liste.
- Recherche.
- Filtrage par chapitre.
- Création.
- Modification.
- Association à un chapitre.
- Gestion du nom et de l'identifiant.
- Gestion du nombre maximal de points si pertinent.
- Consultation des exercices associés.
- Contrôle avant suppression.

Les identifiants de compétences peuvent être utilisés par les exercices et les scores élèves.

Ils doivent être traités comme des références stables.

---

# 14. Gestion des flashcards

Utiliser la table existante `flashcards` de Staging.

Le modèle actuel contient notamment :
- `id`.
- `chapter`.
- `question`.
- `answer`.
- `created_at`.

Fonctionnalités V1 :

- Liste.
- Recherche.
- Filtrage par chapitre.
- Création.
- Modification.
- Suppression contrôlée.
- Prévisualisation.
- Validation des champs.
- Saisie mathématique lorsque nécessaire.

MathLive peut être utilisé pour les contenus mathématiques compatibles.

Les flashcards restent distinctes des définitions d'exercices du moteur, sauf décision fonctionnelle future.

Aucune synchronisation automatique des flashcards vers Production dans cette V1.

Exception fonctionnelle explicitement décidée pour la mission du 30 octobre :
préparer un circuit dédié d'aperçu, confirmation et publication directe des
flashcards vers Production. Il reste distinct du transfert des deux tables
d'exercices. Mission 1 : code et essais sur copie seulement ; aucune activation,
clé ou écriture distante Production. Les autorisations de mise en service et
les permissions minimales doivent être reçues séparément.

---

# 15. Statistiques et utilisateurs

## 15.1 Statistiques Production

Lire uniquement les données nécessaires aux indicateurs.

Sources envisageables :

- `profiles`.
- `user_stats`.
- `exercise_attempts`.
- `user_progress`.
- `user_competence_scores`.
- `monthly_scores`.
- `duels`.
- `duel_attempts`.

Privilégier les agrégations côté serveur.

## 15.2 Consultation des utilisateurs

Fonctionnalités cibles :

- Recherche autorisée.
- Liste paginée.
- Consultation d'un profil administratif.
- Statistiques d'activité.
- Progression.
- Historique synthétique des exercices et duels.

Aucune modification directe des utilisateurs Production dans la V1.

La consultation des données personnelles doit respecter les permissions et la minimisation des données.

## 15.3 Différenciation des sources

L'interface doit toujours distinguer clairement :

- Staging.
- Production.

Une statistique de test ne doit jamais être présentée comme une statistique réelle.

## 15.4 Feedbacks Production

**Décision fonctionnelle explicite du responsable — 8 novembre 2026 :**
l’Admin possède une page dédiée qui consulte uniquement `public.feedbacks` en
Production. L’administrateur filtre par catégorie (`difficulty`,
`content_error`, `suggestion`, `other`), statut et ordre ; les retours sont
présentés par pages. Il peut valider ou refuser un feedback en attente. Chaque
décision est vérifiée par le serveur, conditionnée à son statut encore en attente
et inscrite dans un historique d’audit en Production. Ces décisions sont
distinctes de la publication pédagogique ; elles ne transfèrent ni ne modifient
les feedbacks en Staging.

L’accès de lecture conserve les sessions et le rôle Admin Production distincts
de Staging, et les permissions RLS Production. La capacité de décision est
installée séparément et strictement limitée à cette transition ; aucun secret
privilégié n’est exposé à l’application.

---

# 16. Sécurité et exigences transversales

## Authentification

- Sessions sécurisées.
- Vérification des rôles côté serveur.
- Routes et opérations protégées.
- Protection contre l'élévation de privilèges.

## Données

- Secrets côté serveur.
- Connexions Supabase séparées.
- Accès Production restreint.
- Aucune exposition des clés privilégiées.
- Aucune fuite des réponses attendues vers les élèves.
- Journalisation des opérations sensibles.
- Protection des données personnelles.

## Moteur

- Utilisation du moteur officiel partagé.
- Pas de calcul mathématique concurrent dans l'Admin.
- Isolation des calculs exposés à des entrées complexes.
- Sauvegarde explicite d'un brouillon incomplet autorisée (décision mission du
  30 octobre 2026), après contrôle de son enveloppe et des références fournies,
  sans statut vérifié, approbation ou publication implicite. Validation Engine,
  tests, références et compatibilité courants obligatoires avant publication.
- Diagnostics explicites.

## Qualité

- TypeScript strict.
- Contrats typés.
- Validation runtime.
- Gestion claire des erreurs.
- Tests unitaires.
- Tests d'intégration.
- Tests des permissions.
- Tests du pipeline de publication.
- Accessibilité.
- Performance raisonnable des listings et dashboards.

---

# 17. Roadmap de développement cible

## Lot 0 — Initialisation et documentation

- Audit en lecture seule des projets existants.
- Création du nouveau repository Admin.
- Initialisation de Next.js.
- Alignement de la stack.
- Configuration TypeScript et outils de qualité.
- Documentation.
- Architecture cible.
- Roadmap.
- Variables d'environnement documentées.

**Aucune fonctionnalité métier dans ce lot.**

## Lot 1 — Authentification et socle Admin

- Auth Staging.
- Vérification du rôle admin.
- Sessions.
- Routes protégées.
- Layout et navigation.

## Lot 2 — Gestion des exercices

- Listing.
- Filtres.
- Détails.
- Brouillons.
- CRUD.
- Versions.
- Métadonnées.

## Lot 3 — Creator

- Éditeur visuel.
- Variables.
- Contraintes.
- Éléments.
- Questions.
- Réponses attendues.
- MathLive.
- Sauvegarde.

## Lot 4 — Prévisualisation et tests

- Intégration Exercise Engine.
- Seeds.
- Prévisualisation.
- Simulation des réponses.
- Tests automatiques.
- Validation éditoriale.

## Lot 5 — Publication

- Correspondance des exercices entre bases.
- Validation des versions.
- Publication sélective.
- Synchronisation groupée.
- Audit.
- Rollback.
- Tests de sécurité.

## Lot 6 — Chapitres et compétences

- Gestion des chapitres.
- Gestion des compétences.
- Validation des références.

## Lot 7 — Flashcards

- Liste.
- Création.
- Modification.
- Suppression contrôlée.
- Prévisualisation.

## Lot 8 — Dashboard, statistiques et utilisateurs

- Agrégations Production.
- Dashboard.
- Filtres.
- Consultation autorisée des utilisateurs.
- Indicateurs du catalogue Staging.

## Lot 9 — Fiabilisation et déploiement

- Audit sécurité.
- Tests complets.
- Accessibilité.
- Performances.
- Documentation d'exploitation.
- Mise en service contrôlée.

L'ordre peut être affiné suivant les dépendances techniques, sans modifier le périmètre sans validation.

---

# 18. Critères de réussite de l'application

NovLearn Admin sera prêt à être utilisé lorsque :

- L'authentification staging fonctionne.
- Les permissions admin sont réellement contrôlées.
- Le Dashboard présente des données correctes.
- Les statistiques Production sont consultables en lecture contrôlée.
- Les exercices peuvent être créés, modifiés et versionnés.
- Le Creator utilise le contrat canonique du moteur.
- MathLive permet la saisie scientifique.
- Les exercices peuvent être testés et validés.
- Une version approuvée peut être publiée en Production.
- Aucune table exclue n'est synchronisée.
- Les anciennes tentatives ne sont pas corrompues.
- Les chapitres et compétences peuvent être gérés dans Staging.
- Les flashcards peuvent être créées et modifiées.
- Les opérations sensibles sont tracées.
- Les tests de sécurité et de publication réussissent.
- La documentation décrit fidèlement le code.

---

# 19. Périmètre du lot d'initialisation

La première mission Codex doit uniquement :

- Initialiser le nouveau projet.
- Mettre en place la stack et l'outillage.
- Rédiger et organiser la documentation.
- Préparer les conventions et l'architecture.
- Définir la roadmap.
- Préparer un `.env.example` sans secrets.
- Vérifier que le projet compile et démarre.

Elle ne doit PAS :

- Implémenter l'authentification.
- Créer le Dashboard fonctionnel.
- Créer le Creator.
- Connecter les bases.
- Installer ou intégrer fonctionnellement le moteur.
- Implémenter MathLive.
- Créer les API métier.
- Modifier les tables.
- Exécuter des migrations.
- Copier les exercices.
- Publier des données.
- Modifier NovLearn ou l'Engine.
- Déployer en production.

---

# 20. Décisions à valider avant les lots concernés

Le 13 octobre 2026, l'utilisateur a explicitement validé le modèle `public.exercises` (identité stable) + `public.exercise_versions` (révisions) et la publication sélective du contenu métier approuvé de ces deux tables uniquement. Cette modification ciblée du CDC est expressément autorisée et clôt les deux anciens arbitrages ; toutes les autres exigences restent applicables.

Les détails techniques suivants restent à résoudre avant leur implémentation :

1. Structure SQL détaillée du modèle à deux tables validé, contraintes et transitions compatibles.
2. Stockage/rejeu des nouvelles tentatives et conservation des anciennes sans attribution arbitraire de version.
3. Règles d'identification des exercices entre Staging et Production.
4. Gestion des références aux chapitres et compétences non synchronisés.
5. Référencement des ressources externes éventuelles des exercices.
6. Capacité de publication Production à privilèges minimaux.
7. Stratégie de lecture des statistiques Production.
8. Hébergement du nouvel Admin.
9. Compatibilité des versions de l'Engine utilisées par les applications.
10. Processus séparé de propagation des chapitres, compétences et flashcards si nécessaire.

Ces points doivent être documentés comme décisions ouvertes, jamais résolus par des suppositions cachées.

**Principe directeur : un Admin indépendant, un moteur mathématique commun, Staging comme environnement d'édition, Production comme environnement de données réelles et une publication limitée aux exercices.**

**Décision fonctionnelle explicite — 7 novembre 2026 :** un exercice conserve au plus un chapitre principal dans son classement, et peut référencer des compétences appartenant à plusieurs chapitres.

Le changement du chapitre principal ne retire pas silencieusement les compétences déjà choisies. L’Admin vérifie que le chapitre et toutes les compétences référencées existent ; il ne valide pas une correspondance compétence–chapitre principal.

Les règles de synchronisation des référentiels et leur compatibilité avec les contraintes SQL/RPC restent ouvertes au point 4 ci-dessus et doivent être reçues avant de considérer l’enregistrement de bout en bout comme pris en charge. Cette décision ne modifie ni base de données, ni moteur, ni NovLearn.

**Décision fonctionnelle explicite — 7 novembre 2026 :** les statuts visibles
sont Brouillon, Approuvé, Publié et Archivé. Un exercice reste Brouillon pendant
la demande de relecture ; l'approbation porte sur une révision précise. Publié
signifie que la publication de cette révision en Production a été confirmée,
jamais seulement qu'un pointeur est actif en Préproduction ou dans une copie
locale. Archivé est un classement Admin qui n'écrit pas en Production.
