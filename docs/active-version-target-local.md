# Cible locale SQL 70 — upgrade et régression de publication

**Suite qualifiée :** le [lecteur de version active est maintenant connecté](active-version-connected.md).
Le présent bilan décrit l’upgrade antérieur à son provisionnement et son activation.

**La cible synthétique utilisée par l’instance 3152 est maintenant SQL 70.**
L’application principale [3150](http://127.0.0.1:3150/login) reste disponible.
Le nouvel indicateur de version active demeure désactivé : son LOGIN dédié,
son raccordement aux lanceurs et son parcours Auth/HTTP restent à qualifier.
Les [preuves datées](active-version-target-local-proof.json) séparent ces étapes.

## Audit et copies

La CLI Supabase Linux [2.98.2](https://github.com/supabase/cli/releases/tag/v2.98.2)
est téléchargée depuis sa release officielle et vérifiée contre son
[checksum publié](https://github.com/supabase/cli/releases/download/v2.98.2/supabase_2.98.2_checksums.txt). Elle s’exécute uniquement
dans le namespace réseau de la copie SQL 70 conservée, sans réseau externe,
socket Docker ou port publié, sous UID 65534, racine en lecture seule et quotas.
TLS est vérifié et les connexions d’audit sont READ ONLY. Le résultat est
**0 erreur, 33 avertissements et 67 informations** ; les règles et nombres
correspondent au relevé SQL 69. Les avertissements demeurent ouverts, notamment
policies multiples, initplans Auth et deux fonctions à search_path mutable.
Ce passage n’est pas une certification SQL globale ou une correction de ces points.

La régression du pilote cible utilise une nouvelle base peuplée, créée depuis
la copie qualifiée ; ses ACL de base sont recopiées explicitement. Treize groupes
passent : vrai pool TLS et identité limitée, refus du mauvais mot de passe SCRAM,
publication de révisions 1/2, répétitions sans nouvel epoch, retour arrière vers 1
alors que MAX reste 2, annulation avant COMMIT, conflit de révision immuable,
digest invalide et confirmation perdue résolue par observation. Le vrai SQL minimal
et son décodeur suivent le pointeur actif. Ce lecteur est exercé par autorisation
de session native ; son LOGIN sur la cible réelle n’est pas testé par ce banc.
L’opération source et le callback avant COMMIT y sont synthétiques ; ils ne valent
ni Auth source, ni journal durable, ni validation pédagogique humaine.

Seules les nouvelles lignes d’exercices de cette base changent ; la séquence
d’exercice peut avancer sans être remise à zéro, les dix autres restent exactes.
Le fichier HBA est durci uniquement pour son nouveau nom de base pendant l’essai,
puis son contenu et son mode sont restaurés exactement. La base SQL 70 d’origine,
les identités et la cible applicative sont exactes après le banc. L’échec initial
42702 de préparation SQL reste conservé ; sa correction ne modifie aucun critère.

## Upgrade de la vraie cible synthétique conservée

Les prérequis, restauration peuplée, login/TLS lecteur, advisors et régression
sur copies sont vérifiés avant intervention. Seule l’instance 3152 est arrêtée
normalement par son mécanisme signé ; 3150 reste disponible. La même cible Docker
est sauvegardée intégralement avec ses rôles, puis reçoit les migrations canoniques
65 à 70, dont les six empreintes sont vérifiées. Il n’y a ni recréation, ni restore,
ni reset. Après chaque migration : **62 tables et 11 séquences exactes**.
Le schéma final est comparé à la copie qualifiée ; seuls l’ordre des ACL et les
mots de passe intégrés propres aux clusters sont normalisés pour cette comparaison.
Tous les rôles et mots de passe préexistants de la vraie cible restent exacts.
La version SQL 64 des configurations Auth/source reste correcte et n’est pas
remplacée par celle de la cible. Aucun des huit fichiers privés n’est réécrit.

L’instance 3152 est relancée avec ses paramètres existants. **Treize groupes
Auth/HTTP réels passent ensuite** : GoTrue, PostgREST, Next, Engine Linux borné,
test et reçu signé, revue, confirmation de publication, seconde version et retour
arrière, révocation du rôle, historique et confidentialité. Le banc ajoute seulement
ses nouveaux comptes et exercices synthétiques. Toutes les anciennes lignes sont
conservées, et les 60 tables cible hors publication restent exactes. La publication
ordinaire de 3150 reste désactivée. Le parcours par lot n’est pas relancé ici.

## Suite et limites

**Le contrôle complet courant réussit : 1 387 tests / 72 fichiers**, types, lint
sans erreur (un avertissement `<img>` antérieur), format, build et smoke HTTP,
sur une copie séparée des 544 sources, incluant les cinq nouveaux scripts. Les
onze fichiers SQL standalone sont exacts. Seuls les neuf documents de bilan
explicitement listés sont ensuite créés ou mis à jour, puis vérifiés séparément.
L’application reste disponible. Le contrôle antérieur c762c77 est conservé distinct.
Les 1 540 tests source Engine ne sont pas relancés : la même archive verrouillée
est utilisée par les vrais essais HTTP, sans changement de quota ou d’exigence.

Avant activation de l’indicateur : créer son identité minimale sur cette vraie
cible locale, qualifier connexion physique, permissions et API/fiche, puis
activer les lanceurs explicitement. Aucun accès Production, publication réelle,
push, déploiement ou navigateur automatisé. Les 33 avertissements, expiration
réelle/MFA, hôte cible et réception manuelle restent ouverts ; le Lot 1A et le
goal ne sont pas déclarés terminés. Toute application distante nécessite
réconciliation schéma/historique, sauvegarde/restauration qualifiée, contrôles
des permissions et autorisation distincte.
