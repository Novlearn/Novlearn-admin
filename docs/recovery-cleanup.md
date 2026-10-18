# Refus de nettoyage des copies — correctif local

Le test Node reproduit un cas où le getter `window.sessionStorage` lève une
erreur de politique navigateur : la déconnexion reste possible, mais aucun
message ne signalait que l’effacement des copies n’avait pas été confirmé.
Le premier test de régression échoue avec 24 succès et un échec ; ce résultat
est conservé comme échec, pas transformé en une réception navigateur.

Le contrôle complet final passe **805 tests / 44 fichiers**, types, lint sans
erreur, format, build et smoke HTTP. Les trois nouveaux tests portent sur les
refus d’accès/suppression et le chemin de déconnexion commun. Les dix pages du
banc manuel compilent. L’intégrité de l’archive Engine est vérifiée ; aucun
nouveau calcul natif Linux ou test SQL local n’est revendiqué pendant la panne.
Le contrôle intermédiaire qui a passé 805 tests mais échoué au typage du nouveau
test SSR reste conservé comme échec ; la construction du test est corrigée,
sans modifier la règle ou le contrat de rendu.

Le correctif traite de la même manière le refus d’accès au stockage et le refus
d’effacement après accès réussi : message générique, sans détail privé, puis
déconnexion normale. Les écrivains `pagehide` restent arrêtés avant la tentative
de nettoyage. Après une sauvegarde serveur confirmée, un refus d’effacement d’une
copie connue est également signalé sans présenter l’enregistrement comme échoué.
Une copie devenue périmée/illisible pendant le choix de récupération conserve
un bouton d’abandon explicite.

Les tests du protocole et le rendu serveur ne prouvent toujours pas les effets
dans un navigateur réel. Le [relevé](recovery-cleanup-proof.json) distingue les
contrôles exécutés et l’intégration connectée non exécutée à ce jalon. Les
[services sont depuis rétablis](local-recovery-2026-10-18.md), sans réception
navigateur de cette récupération. Aucune permission navigateur, configuration
globale, donnée, migration ou source Engine n’est modifiée.
