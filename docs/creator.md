# Creator canonique — état local du 14 octobre 2026

**Complément :** l’[aperçu et les tests Engine](preview.md) ajoutent maintenant
génération, projection élève, inspection privée et correction natives, ainsi que
les tests multi-seeds. Les preuves ci-dessous conservent le checkpoint initial
du Creator ; les nouveaux résultats et critères restants sont documentés séparément.

L’éditeur Staging ajoute les champs canoniques au formulaire de brouillon du
catalogue. Il utilise Inter, Fredoka et les couleurs du design existant. Aucun
accès distant n’est activé, aucune donnée existante n’est supprimée. Le périmètre
NovLearn reste limité aux migrations locales déjà documentées dans le
[catalogue](catalogue.md), conformément à D07.

## Fonctionnement disponible

- Métadonnées générales, cinq familles de paramètres : entier, décimal, choix,
  tuple et variable calculée. Exclusions, contraintes, variables formelles et
  budgets s’éditent dans des contrôles dédiés.
- Les 20 types d’éléments du contrat schema 5 sont proposés : texte, section,
  expression, question, QCM, texte enrichi, équation, système, indication,
  explication, graphes de fonction et de suite, tableaux de signes, variations,
  valeurs et statistiques, arbre de probabilités, vecteurs, géométrie et plan
  complexe. Les structures imbriquées se composent sans saisie manuelle de JSON.
- Ajout, modification, déplacement, duplication et retrait d’éléments. Une
  duplication attribue un nouvel ID et conserve le contenu et le LaTeX. Le
  retrait concerne le brouillon affiché, jamais une donnée historique.
- Réponse mathématique ou texte, domaines et politiques de correction,
  expressions attendues, variantes facultatives. Changer le format de réponse
  réinitialise explicitement l’attendu et la politique incompatibles.
- MathLive pour les expressions : clavier scientifique, fractions, racines,
  puissances, fonctions, ensembles et intervalles. Aucune correction ou
  génération mathématique n’est réalisée par cet éditeur.
- Sauvegarde par le contrat du catalogue : statut brouillon, empreinte courante,
  transaction et audit SQL. Un conflit HTTP 409 conserve les champs affichés.
  La sauvegarde ne constitue pas un verdict Engine ni une approbation.

Les modèles à compléter gardent leurs champs mathématiques vides : aucun
attendu, intervalle ou échantillonnage n’est inventé pour rendre un exercice
valide. Le validateur officiel décide de la validité. Les dépendances inconnues,
cycles et problèmes de schéma sont affichés par ses diagnostics. Les échecs de
génération nécessitent encore le parcours d’aperçu et de tests du Lot 4.

## Validation serveur

`POST /api/admin/engine` reste fermé sans Auth Staging configurée et sans
`ADMIN_ENGINE_ENABLED=true`. Ce drapeau est serveur uniquement ; `.env.example`
préexistant est conservé. Chaque appel vérifie origine exacte, identité Auth
réelle, rôle serveur frais et absence de compte invité, avant lecture du corps
et démarrage du worker. Le corps JSON est borné à 256 Kio.

Le navigateur fournit seulement une définition. Il ne choisit aucune opération
native, ne fournit pas d’instance officielle et ne choisit pas Production.
La route appelle `validateDefinition` et retourne uniquement le verdict de
structure et les diagnostics ; elle n’échoe pas la définition privée retournée
par l’Engine. Les réponses sont `no-store`. Tout résultat de protocole invalide
ou worker indisponible produit HTTP 503, jamais une réussite artificielle.
Modifier la définition invalide les diagnostics affichés ; une réponse tardive
concernant l’ancien contenu est écartée.

L’adaptateur charge l’archive exacte déjà certifiée, via son host natif, dans un
processus enfant. Il exige Linux et laisse l’Engine exiger un cgroup v2 borné.
Une opération active, quatre en attente ; limites natives conservées : 5 s,
mémoire de conteneur maximale 384 Mio, heap worker 128 Mio, entrée 1 Mio,
sortie 2 Mio. Aucun repli sur le thread Next ou sur Windows n’est introduit.
Le build standalone embarque le worker et ses dépendances transitives.

## Sorties de l’éditeur

Les liens, fermeture/rechargement et actions catalogue qui mutent ou rafraîchissent
la page demandent confirmation lorsque le brouillon est modifié. Après une
sauvegarde réussie, la navigation ne demande pas d’abandon du contenu sauvé.
Les traversées internes utilisent l’événement Navigation lorsque le navigateur
le rend annulable. Le code respecte les traversées non annulables, sans manipuler
artificiellement l’historique ; la spécification prévoit ces exceptions, notamment
après un retour annulé. Voir la
[spécification HTML](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-navigate-event).

**Limite restante :** les anciens navigateurs sans Navigation API et certaines
traversées non annulables ne garantissent pas cette confirmation SPA. Une solution
de récupération du brouillon et sa validation multi-navigateurs restent nécessaires
avant réception complète de l’expérience d’édition du CDC 8.6. Aucune persistance
de définitions privées en stockage navigateur n’est ajoutée silencieusement.

## Vérifications

- **146 tests Admin passent**, dont modèles des 20 éléments vérifiés par le vrai
  validateur canonique, variables, duplication, réordonnancement, changements de
  réponse, contrôle des permissions et refus des résultats Engine invalides.
- Adaptateur serveur réel dans Docker Linux local sans réseau : définition
  valide acceptée, schema invalide refusé, requête annulée refusée. Les fichiers
  cgroup réels indiquent mémoire 402653184 octets, swap 0 et 64 processus.
- Worker issu du vrai build standalone : validation et instanciation natives
  passent avec ses dépendances embarquées. Ce test ne certifie pas encore la
  capacité mémoire de Next + Auth + calculs simultanés sur l’hôte de déploiement.
- Banc Brave synthétique : saisie `a+1`, duplication conservant l’expression et
  changeant l’ID, clavier scientifique ajoutant `7`, retour interne annulé
  conservant le titre et la question, échecs 503/409 explicites conservant la
  saisie. À 390 px, aucun débordement horizontal global ; aucune erreur console.
  Aucun compte ou Supabase distant n’est utilisé.

Les relevés détaillés et empreintes sont dans [creator-local-proof.json](creator-local-proof.json).
Les scripts `test-engine-runtime-local.ps1` et
`test-engine-standalone-local.ps1` utilisent seulement le pipe Docker local,
l’image Node épinglée, réseau désactivé, montage source en lecture seule,
utilisateur non privilégié et protections de conteneur conservées.

## Travail restant et activation

L’édition et la validation structurelle sont construites localement. Le Creator
n’est pas déclaré intégralement réceptionné : aperçu réel, tests multi-seeds,
simulation de correction, diagnostics de génération et récupération des sorties
non annulables restent à réaliser. Les données avancées de graphiques et tableaux
doivent encore être rendues dans l’aperçu ; leur édition ne prouve pas leur rendu.
Relecture, approbation et publication restent des parcours distincts.

Avant activation distante : réconcilier l’historique SQL, valider sauvegarde et
restauration réelles, compatibilité/rétention des consommateurs élèves, compte
Admin Staging et révocation, qualification du runtime avec le serveur complet.
L’application distante des migrations, la publication et le déploiement exigent
une autorisation séparée. L’objectif global reste actif et incomplet.
