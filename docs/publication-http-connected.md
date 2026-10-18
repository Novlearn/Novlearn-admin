# Publication HTTP connectée — qualification locale

**Le parcours réel de publication et de retour à une révision précédente passe
sur les deux copies locales.** Le 17 octobre, treize contrôles ont exercé Next,
GoTrue, PostgREST, le vrai Engine Linux et les connexions PostgreSQL TLS.
Le contrôle complet passe 767 tests dans 43 fichiers, types, lint, format,
build et smoke standalone. Les [preuves](publication-http-connected-proof.json)
restent distinctes des anciennes simulations et de la préparation du banc.

**Reprise exécutée le 18 octobre :** après arrêt complet et sauvegarde à froid
vérifiée, Docker et les services conservés redémarrent normalement. Les ports
3150/3152 sont disponibles ; huit contrôles après redémarrage passent contre
le relevé d’origine. Le [bilan distinct](local-recovery-2026-10-18.md) conserve
les preuves, la nouvelle observation annulée sans transfert et les limites.

L’aperçu sans Docker a été relancé le 18 octobre sur `http://127.0.0.1:3140/`.
L’accueil et son endpoint d’état répondent HTTP 200 ; ce dernier annonce
explicitement exemples synthétiques, absence de base et absence d’Engine.
Ce service permet les essais manuels d’interface pendant la réparation, sans
prouver le rendu navigateur, la connexion ou la sauvegarde de l’application.

## Profil applicatif séparé

Le nouveau profil exige le développement, son activation explicite, le manifeste
SQL 64, l’API locale 55432, l’origine applicative 3152 et sa propre référence JWT.
Son cookie est distinct de celui de l’espace ordinaire. Le serveur vérifie
toujours l’utilisateur auprès d’Auth puis relit son rôle SQL ; les métadonnées
du compte ne donnent aucun droit Admin.

Les connexions PG sont bornées à `127.0.0.1:55433/55434`, à la base de fixture,
aux deux identités limitées et aux CA explicites. Les secrets source/cible doivent
différer. Aucun paramètre SSL dans l’URL, endpoint distant ou mélange avec
Staging/Production n’est accepté. Le pilote vérifie toujours TLS, les attributs
des rôles, leur unique appartenance et le contrat de finalisation source.

La confirmation possède une clé serveur locale distincte. Les paramètres
opérationnels sont effacés du seul processus de lancement, sans écrire de `.env`.
Le lanceur ordinaire efface aussi les paramètres du banc : l’espace 3150 reste
fermé à la publication. Les contrôles SQL et mathématiques, délais, quotas,
signatures et attestations de relecture ne sont pas assouplis.

Le banc utilise son propre canal Engine sur 3153 et une copie des sources dans
son dossier ignoré. Chaque fichier source copié est comparé et empreinté. Son
serveur et ses compilations n’écrivent pas dans le `.next` de l’espace principal.
Un redémarrage du banc prend une nouvelle copie ; il ne recrée pas ses bases.

Les pages, confirmations, résultats individuels et lots identifient la copie
source/cible. Le protocole HTTP renvoie `local-source`/`local-target`. Le client
n’accepte cette paire que lorsqu’il attend explicitement le profil local ; les
réponses opérationnelles et locales ne sont jamais interprétées implicitement
comme équivalentes. Les historiques conservent les mêmes contrôles.

## Parcours réellement exécuté

`scripts/test-publication-http-local.mjs` crée deux nouveaux comptes synthétiques
marqués, sans changer le rôle d’un compte préexistant. Toutes ses attestations
automatiques indiquent qu’elles ne valent pas réception humaine.

1. Connexion par le vrai formulaire Next et cookie de session dédié.
2. Refus des requêtes sans session, du non-Admin dont les métadonnées prétendent
   être Admin, d’une origine étrangère et d’un endpoint cible injecté.
3. Une vraie session de l’espace principal ne permet pas d’accéder au banc,
   même en renommant son cookie. La session principale reste utilisable.
4. Création canonique, rapport natif complet pour les seeds 0/42, signature
   persistée, demande de relecture puis attestation synthétique explicitement marquée.
5. Préparation réelle : nouveaux tests Engine et diff signé, sans changement
   d’aucune ligne cible.
6. Refus d’une confirmation altérée, avec cible strictement inchangée.
7. Confirmation et COMMIT cible réels, puis fermeture de la socket cliente
   après réception des en-têtes sans lecture du corps. La récupération HTTP
   retrouve le fait durablement enregistré.
8. La répétition de la confirmation ne réapplique aucun transfert.
9. La révocation du seul nouvel Admin refuse la confirmation d’un second plan.
   La cible reste inchangée ; après restauration de ce compte de fixture,
   le plan est explicitement annulé et un nouveau diff est demandé.
10. Publication d’une seconde révision et finalisation du statut/pointeur source.
11. Retour HTTP à la première révision dans les deux copies, avec conservation
    de la seconde. Les identifiants cibles sont alloués indépendamment ; les
    compétences sont résolues vers leurs identifiants cibles et aucun acteur
    source n’est copié dans la version transférée.
12. Les 60 tables cible hors exercices/révisions restent exactement identiques.
    Les historiques préexistants non vides de tentatives, replay, duels et Auth
    sont conservés, ainsi que chaque ligne préexistante des 35 tables métier et
    privées de la source. Les effets normaux des sessions Auth source ne sont
    pas présentés comme une absence de mutation des tables internes Auth.
13. Les vraies pages protégées affichent l’historique local et conservent les
    reçus signés d’origine. Aucun test de clic ou rendu navigateur n’est déduit
    de ces réponses HTTP/SSR.

La fermeture cliente se produit **après les en-têtes**, donc après le résultat
serveur enregistré. Elle ne simule pas une perte d’acquittement PostgreSQL COMMIT.
Les anciens tests natifs de cette autre panne gardent leur preuve et leur portée
propres. Les lots utilisent la même route, mais leur réception navigateur et
une qualification HTTP multi-exercices complète restent distinctes de ce parcours
sur un catalogue et deux révisions.

## Contrôles de code et confidentialité

Les 32 tests supplémentaires portent sur le profil local, les mélanges refusés,
les rôles/ports/CA, le canal Engine, la clé de confirmation, le cookie et les
paires d’environnements HTTP. Le contrôle complet inchangé est exécuté par
`scripts/check-isolated-local.mjs` sur des sources et dépendances copiées dans un
projet temporaire indépendant. Les 365 fichiers sources copiés sont identiques
au dépôt à la fin du contrôle ; aucun environnement privé ni `.git` n’est copié.

Le premier essai de suite complète a dépassé le délai inchangé de cinq secondes
pendant le démarrage simultané de Next. Le résultat est conservé comme échec.
Un contrôle dans une copie imbriquée a ensuite passé les tests et compilé, mais
échoué sur l’assemblage standalone : Next avait déduit une racine de monorepo.
La copie temporaire indépendante corrige ce contexte, sans changer Next,
les délais ou les critères. Le contrôle final termine avec le code de sortie 0.

Une recherche ciblée de 24 valeurs privées et identifiants internes ne trouve
aucune occurrence dans les 48 bundles clients du build de production ni les
30 bundles de l’application effectivement testée. Ce n’est pas un audit exhaustif
des fuites. Les huit fichiers privés de configuration/signature comparés restent
identiques au relevé précédant le redémarrage.

La revalidation du 18 octobre compare les 365 fichiers du manifeste de ce
contrôle : 360 sont identiques et cinq documents ont été complétés depuis.
Tous les fichiers d’implémentation vérifiés restent identiques. Les 64 migrations,
les huit fichiers voisins préalablement modifiés, les huit configurations privées
et les références protégées sont inchangés ; le dépôt Engine est propre.

## Incident de démarrage et reprise exécutée

Les instances conservées restent dans `.local/local-admin-publication-1792259029889/`
et `.local/local-admin-1792143739689/`. Aucun bootstrap ou préparateur PG n’est
relancé : les bases, historiques, clés et comptes existants sont réutilisés.

Le premier relevé du 18 octobre observait un défaut de renommage de
`sailor-ingest.sock` vers `.stale`, puis un arrêt normal encore incomplet.
Ce relevé ne prouvait pas une nouvelle interdiction Smart App Control.
Une inspection ultérieure confirme tous les processus Docker absents et WSL2
arrêté. La sauvegarde à froid des deux disques et deux paramètres est alors
copiée et vérifiée par taille/SHA-256, avant un seul nouveau démarrage normal.
Le moteur devient prêt après une observation expirée puis une réponse positive.

Les [preuves de reprise](local-recovery-2026-10-18-proof.json) conservent huit
contrôles du banc : vraie session, quatre opérations originales retrouvées,
plan « inchangé » calculé par le nouveau worker puis annulé sans transfert,
données conservées, clés identiques, limites Linux et publication principale
fermée. Les 62 tables cible restent exactes, toutes les anciennes lignes des
35 tables métier source sont préservées ; un plan et deux événements sont ajoutés.

La proposition de mise à jour officielle reste distincte : aucune version
n’est installée pendant cette reprise. Docker annonce un correctif à partir
de 4.92 dans la [discussion du mainteneur](https://github.com/docker/desktop-feedback/issues/460),
sans que le démarrage courant de 4.90 démontre une correction définitive.
Aucun socket n’est déplacé, aucune protection désactivée et aucun arrêt forcé
ou réinitialisation n’est effectué. La sauvegarde reste conservée ; sa restauration
n’est pas exécutée. Les instructions officielles exigent un arrêt complet avant
la [copie du disque Docker](https://docs.docker.com/desktop/settings-and-maintenance/backup-and-restore/).
Les références Auth/SSR utilisées restent les
[clients serveur Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
Aucune nouvelle migration n’est ajoutée, aucune application élève ou source
Engine n’est modifiée et aucun projet distant, push ou déploiement n’est touché.
Graphiques de formules, récupération d’édition, statistiques/utilisateurs
Production, MFA/expiration, réception visuelle et mise en service restent ouverts.
Le goal reste actif et incomplet.
