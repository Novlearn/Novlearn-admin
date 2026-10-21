# Version locale essentielle

L’utilisateur demande de privilégier une application utilisable rapidement,
avec moins de fonctionnalités si nécessaire : [décision D11](decisions.md#d11--livrer-rapidement-une-version-locale-essentielle).

Ouvrir [NovLearn Admin](http://127.0.0.1:3150/login). Les identifiants locaux
restent dans `.local/local-admin-1792143739689/login.txt` ; garder ce fichier
privé. La connexion fonctionne avec le compte administrateur existant.

## Ce que cette version permet

- Consulter le catalogue, créer et modifier des brouillons.
- Utiliser le Creator et MathLive, sauvegarder puis rouvrir les contenus.
- Générer un aperçu, corriger des réponses et enregistrer un rapport de tests
  avec le moteur précédemment certifié sous Linux.
- Gérer les chapitres, compétences et flashcards.
- Se déconnecter et retrouver les contenus après reconnexion.

Les statistiques, utilisateurs, courbes calculées, version de publication cible
et publication ne font pas partie de cette première livraison. Leurs travaux
sont conservés. Les lecteurs absents et la publication restent fermés côté
serveur ; masquer une entrée de navigation ne remplace pas ces permissions.

## Relancer l’application

1. Démarrer Docker Desktop normalement et attendre qu’il soit prêt.
2. Dans le dossier du projet, double-cliquer sur `start-local.cmd`, ou lancer :

   ```powershell
   node scripts/start-local-core.mjs
   ```

3. Ouvrir [la connexion](http://127.0.0.1:3150/login). Si le lanceur démarre le
   serveur, garder sa fenêtre ouverte pendant les essais.

Le lanceur reprend uniquement les quatre services existants et le volume
récupéré attendu. S’ils manquent, il s’arrête et demande une restauration ; il
ne crée ni n’efface de base. Si l’application est déjà disponible, il affiche
son adresse sans lancer un deuxième serveur. Le lancement préserve l’avis de
restauration et garde les fonctions reportées désactivées.

## Limite sur les données récupérées

Le nettoyage Docker a supprimé les bases locales. Le principal est restauré
depuis une sauvegarde du **17 octobre**, avec **6 exercices sur 18** et
**9 rapports sur 23** présents avant nettoyage. Les contenus plus récents
manquants ne sont pas déclarés récupérés. Un nouvel essai de sauvegarde ou
rapport créé pendant la réception est une donnée nouvelle, distincte des
données restaurées. L’[avis et le bilan de récupération](docker-cleanup-recovery-2026-10-21.md)
restent visibles et documentés.

Les réceptions humaines précédentes de MathLive/sauvegarde et de récupération
du titre restent acquises dans leur portée. Aucun nouvel essai navigateur
n’est déduit des contrôles HTTP. L’automatisation navigateur refusée n’est pas
contournée.

## Réception de cette version

Le contrôle général passe **1 514 tests sur 78 fichiers**, intégrité de l’archive
Engine, types stricts, lint (zéro erreur, un avertissement existant du banc
navigateur), format, build et smoke Auth. Les 605 sources copiées sont exactes
à sa fin ; seuls les documents de bilan listés sont complétés ensuite.

Les neuf groupes HTTP du cœur restauré et les cinq groupes de réception
supplémentaires passent : nouveau brouillon sauvegardé et modifié, conflit et
origine étrangère refusés, rapport signé avec seeds 0/42 réellement enregistré,
réouverture après reconnexion et anciennes lignes métier préservées. L’essai
« Essai local — sauvegarde vérifiée » reste dans le catalogue. La base contient
désormais 7 exercices et 10 rapports : 6/9 récupérés, plus ce nouvel essai et son
rapport. Une nouvelle sauvegarde complète et les rôles sont conservés hors
des conteneurs ; cette nouvelle sauvegarde n’a pas été restaurée à son tour.

Le lanceur a été exécuté en contrôle puis sur l’instance déjà active, sans
second serveur. Le démarrage à froid des services arrêtés et le double-clic
Windows ne sont pas présentés comme testés. Le
[bilan structuré](local-mvp-proof.json) conserve ces limites et le premier
contrôle HTTP interrompu par un sélecteur trop large : celui-ci cherchait un
lien dans toute la fiche au lieu de cibler la navigation principale. La reprise
réutilise le même brouillon et le même rapport, sans création en double.

Cette livraison concerne les essais **sur cet ordinateur**. Staging distant,
Production et déploiement restent fermés ; les prérequis SQL et la réception
opérationnelle du Lot 1A ne sont pas validés par cette livraison partielle.
