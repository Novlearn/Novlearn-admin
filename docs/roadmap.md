# État actuel et prochaines étapes

**Mis à jour le 8 novembre 2026.** Le responsable confirme que la connexion Admin–Exercise Engine est terminée : validation canonique, aperçu et tests sont disponibles dans l’Admin. Cette réception est basée sur sa confirmation ; aucun nouveau déploiement distant ou état Production n’est attesté ici.

**Décision fonctionnelle explicite du responsable — 8 novembre 2026 :** ajouter
une page Feedbacks à l’Admin, alimentée exclusivement par les feedbacks de
Production. La page filtre et trie les catégories et statuts et permet à un
administrateur de valider ou refuser un feedback en attente. Les décisions sont
contrôlées côté serveur et auditées en Production. Leur activation distante
nécessite l’installation explicite du script de permissions dédié.

## État actuel

- **Périmètre statistique appliqué le 8 novembre :** à la demande du responsable, la migration `20261108145047` exclut les comptes invités des statistiques et de la liste des utilisateurs, avec filtrage SQL avant calcul et pagination. La règle est inscrite au CDC, section 6.3 ; seuls les comptes Auth non invités encore présents et leur activité alimentent les indicateurs. Les duels terminés exigent deux inscrits. Les comparaisons des totaux, volumes, taux et statistiques pédagogiques passent en base, sans export de lignes personnelles. Les 1 643 tests, types, lint, build et smoke tests passent ; le serveur sur le port 3000 a été relancé. Cette évolution ne supprime aucune donnée et ne modifie aucun droit RLS.

- **API Production activée et pages principales reçues le 8 novembre :** la migration `20261108133534` installe cinq RPC de lecture `SECURITY INVOKER`, neuf politiques Admin `SELECT` et les gardes empêchant l'auto-promotion. Le serveur sur le port 3000 utilise ce build API ; le `.env` et son exemple remplacent les connexions PostgreSQL distantes par l'URL et la clé publique Production. Le compte choisi était déjà Admin en Staging ; son compte Production distinct a été provisionné avec autorisation, puis l'opérateur a confirmé avoir défini son mot de passe. Les lectures Admin et les refus élève/anonyme sont qualifiés, ainsi que types, lint, build et smoke tests. Le responsable confirme le chargement des statistiques et de la liste des utilisateurs avec sa session personnelle, après le correctif d'encodage `20261108135732`. Aucun nouvel endpoint métier d'écriture ni mécanisme de publication n'est activé. Voir [le contrat API courant](guides/production-api.md).

- **Admin–Engine : reçu.** Le parcours utilise le format canonique et les routes serveur protégées de l’Admin. La refonte UX en cours clarifie les actions sans remplacer le moteur mathématique. Détails techniques : [transport Admin–Engine](guides/admin-engine-transport.md).
- **Données :** les opérations d’édition restent limitées à Staging. Cette mise à jour ne donne aucune autorisation d’écriture Production.
- **Branche de travail :** `ux/admin-creator-redesign`. La refonte couvre le parcours de création, l’aperçu et la vérification, la navigation et le catalogue.
- **Références pédagogiques :** l’Admin doit permettre de rattacher des compétences de plusieurs chapitres à un exercice. Le contrôle dans ce dépôt ne remplace pas les contraintes SQL ou RPC ; leur compatibilité devra être reçue à partir de leurs définitions avant de présenter ce comportement comme disponible de bout en bout.
- **Statuts éditoriaux :** décision reçue le 7 novembre 2026 — Brouillon, Approuvé, Publié après confirmation en Production, Archivé. Le catalogue lit actuellement le statut et le pointeur de Préproduction ; il ne dispose pas d’un contrat de lecture confirmant l’état Production pour chaque exercice.

## Prochaines étapes

0. Priorité demandée le 8 novembre : accès API/RLS Production activé après autorisation explicite ; statistiques et liste des utilisateurs reçues avec les deux sessions Admin. Ne pas commencer les écritures métier.
1. Terminer et relire la refonte UX de l’Admin dans la branche dédiée.
2. Aligner les validations de l’Admin sur le contrat de références multi-chapitres ; documenter tout point nécessitant une modification dans le dépôt de base de données sans l’effectuer depuis ce dépôt.
3. Définir et recevoir le contrat serveur de lecture de l’état Production nécessaire pour afficher « Publié » uniquement après confirmation. Le statut éditorial Staging et son pointeur actif ne constituent pas cette confirmation.
4. Recevoir une confirmation distincte avant tout déploiement ou toute écriture distante.
5. Ne commencer aucun lot ultérieur du CDC automatiquement.

## État des lots du CDC

- **Lots 0 à 4 — socle, authentification, gestion des exercices, Creator, aperçu et tests :** intégrés dans ce dépôt ; la connexion Engine est confirmée comme reçue par le responsable le 7 novembre 2026.
- **Lots 5 à 9 — publication, référentiel, flashcards, dashboard et fiabilisation :** leur existence dans le CDC ne vaut pas autorisation de commencer un lot ni d’activer ses capacités. Respecter les états et prérequis propres à chaque lot.

## Règles de suivi

- Les décisions fonctionnelles restent dans le [CDC](../CDC_reference.md). Toute évolution du CDC doit être explicite et traçable.
- Staging et Production restent séparés. Publication, migration, déploiement et écriture distante exigent leurs autorisations propres.
- Ne pas modifier NovLearn, l’Exercise Engine, l’ancien Creator ou une base Supabase depuis ce dépôt.
- Ne pas commencer automatiquement l’étape suivante lorsqu’une dépendance ou une autorisation manque.
