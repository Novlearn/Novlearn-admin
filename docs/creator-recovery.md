# Récupération facultative de la saisie Creator

**Réception humaine du 21 octobre :** le [titre modifié est récupéré après rechargement](recovery-reception-2026-10-21.md), selon le retour explicite de l’utilisateur sur 3150. Ce parcours connecté est accepté dans cette portée ; les autres observations navigateur ci-dessous ne sont pas présumées exécutées. Aucun nouveau test automatisé ni changement du code.

**Complément du 18 octobre :** le [refus de nettoyage](recovery-cleanup.md)
est signalé aussi lorsque l’accès au stockage lui-même est bloqué. Les preuves
ci-dessous restent celles du premier jalon de récupération.

Le Creator propose une copie de récupération **désactivée par défaut**. Après
activation dans le formulaire, les modifications sont copiées dans le
`sessionStorage` de l’onglet. Une sortie SPA non annulable ou un rechargement ne
nécessite donc plus de manipuler artificiellement l’historique pour proposer
la récupération. Les gardes de navigation existants restent actifs.

## Parcours

1. Ouvrir un brouillon ou préparer une nouvelle révision, puis cocher
   « Conserver une copie de récupération dans cet onglet ».
2. Modifier les champs. Le statut distingue copie actualisée et échec de copie.
3. Revenir au même exercice dans cet onglet dans les trente minutes suivant
   l’actualisation. Le formulaire propose la récupération ou l’abandon ; aucune
   saisie n’est restaurée automatiquement. Les champs restent verrouillés pendant
   ce choix pour ne pas écraser une nouvelle saisie.
   Ils restent également verrouillés avant la première lecture du stockage,
   afin qu’une soumission précoce ne précède pas la détection d’une copie.
4. Récupérer puis relire la définition avant de l’enregistrer normalement.
   Aucun diagnostic, rapport Engine ou statut d’approbation n’est récupéré.
5. Une sauvegarde confirmée demande l’effacement de la seule copie de ce formulaire
   et signale un refus connu du navigateur.
   Une réponse d’échec conserve les champs et leur récupération si activée.

Un HTTP 200 avec un résultat absent, un environnement inattendu, un ID invalide
ou des références différentes de celles demandées ne confirme pas la sauvegarde.
Le formulaire garde alors sa saisie et sa copie, sans navigation automatique.
Après une interruption, consulter le catalogue avant de répéter une création.

Si l’empreinte ou l’époque de référence a changé, la récupération prépare une
**nouvelle révision**. Elle ne reprend pas implicitement l’empreinte actuelle pour
écraser la version existante. Ce choix persiste dans la copie afin qu’un deuxième
rechargement ne le perde pas. Les instances de formulaire sont liées à l’ID,
l’empreinte et l’époque de la version lue ; changer de référence remonte le
formulaire et provoque un nouveau choix explicite.

## Confidentialité et limites

La copie inclut la définition privée, donc les attendus. Le texte du formulaire
l’annonce avant activation. Aucun stockage navigateur n’est consulté pendant
le rendu serveur, aucune copie n’est écrite sans activation, aucun serveur
tiers ou stockage `localStorage` n’est utilisé.

La clé distingue l’API Auth, l’identité vérifiée par le layout serveur, l’exercice,
la version et le mode d’édition. Un changement de compte efface seulement les
copies de cet outil appartenant aux autres identités. La déconnexion explicite
arrête les écrivains `pagehide` avant de nettoyer ces copies ; elle ne nettoie
jamais le reste du stockage navigateur. Un refus du départ conserve les copies.
Le bouton de déconnexion de la page « Accès réservé » utilise le même nettoyage,
y compris après une révocation de rôle qui a fermé le layout Admin.
Si le navigateur refuse l’effacement, la déconnexion reste possible et le message
demande de fermer l’onglet. Ce stockage n’est ni chiffré ni une frontière de
permission ; les contrôles Auth, rôle serveur et SQL restent obligatoires pour
chaque sauvegarde et chaque opération protégée.

La durée de récupération est de trente minutes depuis la dernière écriture,
revérifiée au clic de récupération. Une copie expirée ou invalide n’est ni
restaurée ni supprimée silencieusement : un bouton permet de l’effacer. Taille
maximale : 256 Kio en octets UTF-8. Un quota ou un blocage de stockage laisse la
dernière copie intacte et produit un statut d’échec. Les titres vides, champs
incomplets, expressions et attendus ne sont pas corrigés pour rendre une copie
valide. L’Engine reste l’unique autorité mathématique.

Le stockage de session survit aux rechargements et aux restaurations de l’onglet.
Un nouvel onglet ouvert avec un `opener` peut en recevoir une copie initiale ;
les deux zones restent ensuite indépendantes. La restauration de session du
navigateur peut également prolonger sa conservation physique : le délai est
une limite de récupération appliquée à la lecture, pas une promesse d’effacement
automatique du disque. Voir la [spécification Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-sessionstorage-attribute)
et la [documentation de sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

## Vérifications et réception

Les tests du protocole couvrent la conservation exacte, la saisie incomplète,
la séparation des identités et références, l’expiration, les copies altérées,
la limite UTF-8, les quotas, les suppressions ciblées, l’arrêt avant nettoyage
de déconnexion et l’absence d’accès au navigateur en SSR. Le relevé daté figure
dans [creator-recovery-proof.json](creator-recovery-proof.json).

Le contrôle complet inchangé termine avec le code 0 : **802 tests / 44 fichiers**,
intégrité de l’archive Engine, types, lint sans erreur, format, build autonome
et smoke HTTP. Il ajoute 24 contrôles de récupération/SSR et 11 contrôles de
confirmation de sauvegarde. Les 373 fichiers copiés sont identiques au retour
du contrôle. Les dix pages du banc Vite compilent également. L’avertissement
`<img>` préexistant et les avertissements Vite sur `use client`/taille des chunks
restent visibles ; aucune règle, limite ou durée de test n’est assouplie.

Une recherche ciblée de 34 valeurs ou noms privés ne trouve aucune occurrence
dans les 48 bundles clients du build et les 22 bundles du banc manuel.
Elle ne constitue pas un audit exhaustif des fuites. Quatre références protégées,
huit configurations privées, huit fichiers voisins déjà modifiés et les
64 migrations conservent leurs empreintes ; le dépôt Engine est propre.
L’échec intermédiaire du lint du test SSR est conservé dans les preuves.

Le banc manuel existant propose aussi ce parcours sur
`http://127.0.0.1:3140/tests/browser/creator.html`, avec un contexte synthétique
distinct et aucune sauvegarde en base. La réception de clics, le comportement
réel de sessionStorage et les retours avant/arrière restent à exécuter dans les
navigateurs autorisés : les tests Node et la compilation ne les prouvent pas.
Le refus antérieur de pilotage navigateur n’est pas contourné.

Le parcours connecté de récupération du titre après rechargement est depuis
[accepté par l’utilisateur](recovery-reception-2026-10-21.md) ; les autres
interactions restent à réceptionner. Les [services ont été rétablis](local-recovery-2026-10-18.md).
Les comptes, configurations privées, migrations, données existantes
et environnements distants ne sont pas modifiés par ce jalon. Le goal et la
réception complète du Creator restent ouverts.
