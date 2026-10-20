# Expiration des sessions — qualification locale

**20 octobre — palier local vérifié :** les [deux compteurs D09](completed-work-local.md)
et la [nouvelle expiration naturelle de 3 600 secondes](auth-expiry-local.md)
passent réellement. Le contrôle complet passe **1 432 tests / 75 fichiers**,
types, lint, format, build, intégrité Engine, onze SQL standalone et smoke.
Huit rapports SQL/TLS/HTTP et 28 mesures sur 100 000 réponses passent ;
données et configurations conservées. Réception visuelle, hôte cible,
politique opérationnelle et portes distantes restent ouverts. Aucun distant,
aucun contournement ni clôture du goal/Lot 1A.

Les relevés suivants sont historiques.

Un premier test réel a attendu l’expiration normale de jetons Auth de **3 600
secondes**, sans modifier l’horloge, les paramètres Auth, les JWT ou les cookies
émis. Il a révélé un défaut : une session expirée dont le renouvellement est
refusé renvoie **503 au lieu de 401**. L’échec et le banc d’origine sont conservés
dans les [preuves](auth-expiry-local-proof.json).

## Correctif et vérifications actuelles

L’adaptateur distingue quatre erreurs terminales de session, uniquement quand
Auth renvoie `AuthApiError`, HTTP 400 et un code connu :
`refresh_token_not_found`, `refresh_token_already_used`, `session_not_found` ou
`session_expired`. Le contrôle serveur refuse alors l’accès comme non connecté.
Les erreurs inconnues, 429, 500 et réseau restent des indisponibilités.

Pour la déconnexion, après un tel refus terminal, Auth-js efface la session
expirée. Une seconde déconnexion **locale à ce client** doit réellement réussir ;
son échec reste signalé. Aucun succès n’est inventé, aucune déconnexion globale
ni modification de rôle ou mot de passe n’est utilisée.

**25 tests unitaires de l’adaptateur passent.** Le contrôle HTTP avec la paire
originale réellement expirée passe cinq observations : API 401, page 307 vers
connexion, déconnexion 303 avec effacement des cookies, reconnexion du même
compte QA et accès API/page 200. Le JWT et les cookies d’origine restent exacts.
Le serveur Auth confirme lui-même le refus du JWT et du renouvellement.

Toutes les réponses observées interdisent le stockage (`no-store`). Les API et
la déconnexion portent aussi `private`. Pour les pages SSR, Next 15 en mode
développement remplace cet en-tête par `no-store, must-revalidate` ; cette valeur
exacte est relevée, sans la présenter comme un en-tête `private`. Le premier
banc de recontrôle supposait à tort ce libellé sur toutes les réponses. Il
supposait aussi l’immobilité de la séquence Auth pendant une vraie reconnexion.
Ses échecs sont conservés : la reconnexion doit créer exactement un nouveau
refresh token, tandis que les lignes et séquences métier restent exactes.

Ces cinq observations corrigées **ne remplacent pas** une nouvelle qualification
complète de l’expiration et du renouvellement sain. Celle-ci est en cours sur
un nouveau compte synthétique distinct, avec la même durée naturelle d’une heure.
Son succès n’est pas annoncé avant son résultat réel. Le processus, l’échéance
et les observations intermédiaires figurent dans la preuve.

## Portée et limites

Les essais utilisent seulement l’Auth locale sur 55431 et l’application 3150.
Les comptes QA sont marqués et conservés ; aucun compte préexistant, aucune
donnée métier ou configuration n’est supprimé ou réinitialisé. Les assertions
portent sur de vrais appels SDK/Auth/HTTP, sans réception navigateur déduite.

La [documentation des sessions](https://supabase.com/docs/guides/auth/sessions)
distingue durée du jeton et durée maximale ou d’inactivité de la session. Ce
banc qualifie l’expiration du jeton, son renouvellement et un ancien client
devenu non renouvelable ; il ne certifie pas une politique maximale/inactivité
non configurée. MFA, révocation immédiate de tous les JWT, exploitation et
réception Staging restent ouverts. Aucun distant n’est activé.

Le premier contrôle Admin complet s’arrête sur deux dépassements réels du délai
de cinq secondes dans `publication-verification.test.ts` : 1 420 tests passent,
deux échouent ; types, lint, build et smoke ne sont pas annoncés exécutés par
cette tentative. Le même fichier passe ensuite ses onze tests en isolation.
L’hôte observé est chargé (74 % CPU et environ 1,7 Gio de RAM libre). La
concurrence des fichiers passe de quatre à deux workers ; délais, assertions,
seeds et limites Engine restent inchangés. Une nouvelle commande complète doit
réussir avant tout bilan positif. Le parseur du relevé compte désormais aussi
les succès présents dans un résumé mixte d’échec ; l’ancien relevé brut reste
conservé.

**Requalification complète réussie : 1 422 tests / 75 fichiers**, intégrité de
l’archive Engine, types, lint sans erreur (un avertissement `<img>` antérieur),
format, build et smoke HTTP. Les onze SQL du standalone sont exacts. Les 567
sources correspondent à la fin du contrôle ; seuls les neuf documents de bilan
listés dans la preuve sont ensuite complétés. Les deux timeouts initiaux restent
conservés ; la concurrence est bornée à deux fichiers, avec les mêmes délais,
assertions, seeds et limites Engine. La réception navigateur et les portes
distantes restent ouvertes.
