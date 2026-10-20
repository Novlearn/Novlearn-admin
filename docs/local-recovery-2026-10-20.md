# Reprise locale du 20 octobre — services et connexion rétablis

**L’application est de nouveau utilisable sur [3150](http://127.0.0.1:3150/login).**
Les identifiants existants restent dans `.local/local-admin-1792143739689/login.txt`.
La connexion Admin réelle, le dashboard, le catalogue et les pages de statistiques
générales et pédagogiques répondent. Le service 3152 reste une instance distincte
de publication synthétique. Les [preuves datées](local-recovery-2026-10-20-proof.json)
consignent les essais réussis et les échecs conservés ; aucun parcours navigateur
n’est annoncé exécuté.

Après le signalement utilisateur « c’est réglé », Docker répond en version 29.7.2.
Aucun autre lancement Desktop depuis l’agent n’est tenté. Les **14 mêmes
conteneurs** sont inspectés puis redémarrés, sans recréation. La cible SQL 64 est
comparée au relevé qualifié du 19 octobre avant et après les essais : **62 tables,
11 séquences, rôles et métadonnées exacts**. Les données des 35 tables métier
préexistantes de la source principale sont conservées ; le nouveau test Engine
ajoute seulement son brouillon synthétique et son rapport. Les sessions Auth
peuvent changer normalement pendant la connexion. Les huit configurations
privées, quatre fichiers Admin protégés et huit modifications NovLearn antérieures
restent exacts ; le dépôt Engine reste inchangé.

## Vérifications réellement reprises

- Login réel avec un compte synthétique conservé, session Admin, pages statistiques
  et pédagogiques, écrans de connexion 3150/3152 : **réussis**. Sept scripts client
  servis sont examinés sans y retrouver les valeurs privées testées ; ce contrôle
  borné ne constitue pas un audit exhaustif. La session d’essai est fermée.
- **Huit contrôles Engine réels réussis**, seeds 0/42, projection publique,
  sauvegarde du nouveau brouillon, rapport signé et conservation des vingt anciens
  reçus. La première tentative a reçu 503 ; son journal reste conservé et sa cause
  n’est pas établie. Un diagnostic réel répond ensuite 200, puis le banc inchangé
  passe intégralement. Aucun quota, délai ou critère n’est modifié. Les **1 540 tests
  source Engine antérieurs ne sont pas relancés**.
- **Lecteur PostgreSQL physique : huit groupes réussis**, SCRAM/TLS vérifié,
  17 refus SQLSTATE 42501, six observations dont le retour arrière et deux connexions
  simultanées, trois dérives de droits refusées. La première tentative Docker
  échoue avant Node : destination de montage imbriquée absente sous un parent
  en lecture seule. Le banc crée désormais ce dossier vide avant les montages ;
  lecture seule, quotas et isolation restent inchangés. L’identité et les
  certificats conservés sont réutilisés, sans rotation ; snapshot final exact.
- **Quinze prérequis SQL négatifs réussis**, chacun rejeté par le garde-fou attendu
  avec P0001, et non par une erreur de préparation. Annulation du DDL réussi,
  COMMIT canonique et refus de réapplication exercés. Une restauration peuplée SQL
  70 conserve les 62 tables, 11 séquences, 14 colonnes du lecteur, six observations,
  rôles personnalisés et empreintes SCRAM. Les deux nouvelles copies restent sans
  réseau ni port, bornées à deux CPU, 1 Gio sans swap et 256 processus.

**Le nouveau contrôle complet réussit : 1 387 tests / 72 fichiers**, intégrité du
package Engine, types, lint sans erreur (un avertissement `<img>` préexistant),
format, compilation, onze fichiers SQL standalone exacts et smoke HTTP. Il
s’exécute sur une copie des 539 sources, incluant les deux bancs nouveaux ou
corrigés, sans interrompre l’application. Toutes les sources restent exactes
à sa fin ; seules les huit preuves documentaires listées sont ensuite mises à
jour. Le précédent contrôle `0a7dfc6` reste daté et distinct.

## Suite locale et portes restantes

SQL 70 **n’est pas appliqué à la cible de l’application**. Le nouvel indicateur
de version active reste fermé : advisors SQL 70, régression de publication sur
copie qualifiée, upgrade/provision de la vraie cible locale puis Auth/HTTP et
confidentialité doivent précéder son activation. La copie de qualification ne
remplace pas cette cible. Les réceptions manuelles de l’interface, de MathLive et
de la récupération restent ouvertes. L’aperçu 3140 reste purement synthétique.

Aucune restriction de sécurité n’est contournée. Aucun socket, ACL, protection,
réglage Docker ou donnée existante n’est supprimé ou réinitialisé. Aucune lecture
distante activée, écriture distante, publication réelle, push ou déploiement.
Le goal et le Lot 1A ne sont pas déclarés terminés. Avant application distante :
réconcilier schéma/historique, qualifier les permissions et l’hôte retenu, préparer
sauvegarde/restauration et obtenir l’autorisation spécifique.

## Diagnostic conservé avant la réparation utilisateur

Le relevé suivant est historique ; ses refus de connexion ne décrivent plus la
disponibilité après la reprise. Le crash sur le socket est confirmé, sa cause
profonde et un éventuel lien avec le contexte de lancement restent non établis.

**La connexion réelle aux applications 3150/3152 reste indisponible.** Le blocage
observé intervient dans Docker Desktop avant la disponibilité du moteur Linux.
Il ne constitue pas un échec d’authentification NovLearn Admin. L’[aperçu 3140](http://127.0.0.1:3140/)
reste distinct : exemples fictifs, sans Auth, base ou Engine. Les [preuves](local-recovery-2026-10-20-proof.json)
séparent les observations courantes des qualifications antérieures.

À 11:49:14 UTC, après vérification qu’aucun processus Desktop/backend n’existait,
un seul lancement normal de l’exécutable installé est effectué. Le journal du
backend enregistre son crash à **11:49:18.618864600 UTC**, pendant l’initialisation
du serveur Ingest. Le renommage de `sailor-ingest.sock` vers `.stale` échoue avec
`The file cannot be accessed by the system.` Le canal `dockerDesktopLinuxEngine`
reste absent. Le journal est figé à 11:49:19 ; les processus de la fenêtre
d’erreur ne prouvent donc pas qu’un moteur ou un test PostgreSQL travaille.

Docker Desktop 4.90.0 est indiqué dans cette erreur. Des signalements de première
main sur le dépôt Docker décrivent la même signature, sur des machines Windows
différentes : [signalement 675](https://github.com/docker/desktop-feedback/issues/675)
et [signalement 676](https://github.com/docker/desktop-feedback/issues/676).
Ils corroborent le symptôme, sans établir sa cause sur ce poste ni fournir une
réparation certifiée ici. Le code Windows 1920 mentionné dans ces signalements
n’a pas été mesuré localement. Le journal local ne démontre pas un nouveau refus
Smart App Control ou une nouvelle restriction de navigateur.

Le rôle éventuel du contexte de lancement depuis l’agent reste une **hypothèse
non confirmée localement**. La
[documentation officielle OpenAI consultée](https://learn.chatgpt.com/docs/windows/windows-app)
décrit l’environnement PowerShell natif et les environnements d’exécution ; elle
n’établit pas la cause de ce crash Docker. Aucun réglage Codex ou Windows n’est
modifié, et aucun autre lancement de Desktop depuis l’agent n’est tenté.

La méthode suivante conserve les protections et les données : fermer la fenêtre
d’erreur par **Quit**, puis lancer Docker Desktop depuis le menu Démarrer de
Windows, hors de cet environnement d’exécution. La fermeture utilisateur est
demandée ; aucune fermeture forcée n’est effectuée. Une fois le moteur prêt,
inspecter les conteneurs et images conservés, puis démarrer ces mêmes conteneurs
sans recréation. Relancer les applications avec les comptes et configurations
existants, et seulement ensuite revérifier connexion, Engine et lectures privées.
Un timeout d’observation ne déclenche pas de second lancement.

Si cette méthode échoue aussi, une maintenance de Docker devra être préparée
séparément. La [procédure officielle de sauvegarde](https://docs.docker.com/desktop/settings-and-maintenance/backup-and-restore/)
exige l’arrêt complet de Desktop avant copie de ses disques. La sauvegarde du
18 octobre est une preuve datée, pas une sauvegarde de toutes les créations
ultérieures. Aucune réinstallation, mise à jour, modification de socket, ACL,
protection, inscription WSL ou paramètre n’est appliquée. Aucun diagnostic n’est
envoyé. Les [options de dépannage Docker](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/)
incluent des remises à zéro ; elles ne sont pas utilisées dans ce périmètre de
préservation des données.

Pendant ce blocage, le banc
`scripts/test-active-version-prerequisites-local.mjs` est préparé pour la suite
de SQL 70. Il réutilise la sauvegarde SQL 64 immuable déjà qualifiée et travaille
uniquement sur deux nouvelles copies Docker, sans réseau ni port publié,
bornées à deux CPU, 1 Gio sans swap et 256 processus.

Le banc prévoit quinze refus de prérequis : rôle déjà existant, baseline de rôle
incompatible, RLS désactivée sur l’une des deux tables, policy PUBLIC, colonne
absente ou de mauvais type, lectures/écritures/créations/séquences accordées via
PUBLIC, fonction privilégiée accessible et dérive de la fonction guest relue.
Chaque refus doit provenir du garde-fou SQL attendu, avec SQLSTATE P0001 ; une
erreur de préparation de fixture ne vaut pas succès. L’annulation doit préserver
les 62 tables, 11 séquences et les métadonnées du relevé. Le corps DDL réussi est
aussi exercé avec ROLLBACK, puis le COMMIT canonique réel et le refus de
réapplication sont prévus. La comparaison n’autorise que le nouveau rôle, ses
ACL minimales et les deux policies ; les droits et objets antérieurs restent
exacts. Enfin, une seconde restauration peuplée doit préserver le pointeur actif,
les rôles et empreintes SCRAM personnalisées et les observations natives.
Les attributs des rôles intégrés sont comparés, à l’exception de leurs empreintes
de mot de passe propres aux nouveaux clusters ; seul l’ordre des ACL est normalisé.

**Exécuté aujourd’hui sur ce nouveau banc : syntaxe Node, format et lint avec
zéro avertissement.** Les scénarios PostgreSQL, la nouvelle restauration, TLS,
HTTP connecté et advisors SQL 70 ne sont pas exécutés. Aucun état de fixture de
ce banc n’est créé. La précédente préparation PG/TLS est conservée à l’état
`provisioned`, sans réensemencement ou remplacement de ses identifiants.

Le contrôle complet de **1 387 tests / 72 fichiers**, types, lint, format,
compilation et smoke reste celui de la préparation applicative committée
`0a7dfc6`. Ce nouveau banc ne fait pas partie de sa copie des 536 sources ; ses
trois contrôles statiques sont une preuve séparée. Les sources applicatives et
tests unitaires de ce contrôle restent exacts. Les 1 540 tests Engine ne sont pas
relancés. Le commit SQL `0808eb7` reste inchangé et n’est pas appliqué à la cible
de l’application. Aucune nouvelle comparaison de données PostgreSQL courantes
n’est annoncée alors que le moteur est inaccessible.

Les deux modifications Admin préexistantes, les huit configurations privées et
les huit fichiers NovLearn précédemment modifiés sont préservés. Engine reste
inchangé. Aucun distant, publication réelle, push ou déploiement n’est activé.
Les réceptions SQL/Engine/connectées et navigateur encore ouvertes restent
obligatoires ; le Lot 1A et le goal ne sont pas terminés.
