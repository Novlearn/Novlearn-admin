# Reprise locale — 19 octobre 2026

**La connexion locale fonctionne de nouveau.** Ouvrir
[NovLearn Admin](http://127.0.0.1:3150/login) et utiliser les identifiants existants
du fichier privé `.local/local-admin-1792143739689/login.txt`. Aucun mot de
passe n'est changé. Catalogue, brouillons, Creator, aperçu/tests Engine,
relecture et contenus peuvent être essayés progressivement. Les statistiques,
la liste et les fiches utilisent une copie synthétique séparée.

La publication reste désactivée sur 3150. L'instance 3152 est un banc distinct
qui transfère uniquement entre deux copies locales synthétiques. Les
[sept groupes de publication par lot](publication-batch-http-proof.json) passent
avec vrais Auth, Next, PostgREST, TLS et Engine Linux : trois exercices,
perte du corps HTTP au deuxième résultat, arrêt avant le troisième, reprise
sans doublon, annulation puis nouvelle préparation explicite du dernier.
Cela ne simule pas une perte d'acquittement PostgreSQL et ne vaut pas une
réception des interactions dans un navigateur.

Les [contrôles SQL 68](reader-policies.md), la restauration peuplée, 56 assertions
SQL historiques, 19 groupes PG/TLS, 16 Auth/HTTP et huit Engine passent réellement.
Les 18 anciens reçus Engine et les données antérieures comparées sont conservés.
Les treize avertissements visés disparaissent ; 32 avertissements et
65 informations SQL restent ouverts. Les preuves sont datées ; la disponibilité
actuelle des pages est mesurée séparément dans le
[relevé de reprise](local-recovery-2026-10-19-proof.json).

## Ce qui bloquait

Docker Desktop échouait au démarrage sur un fichier socket interne. L'absence
du moteur empêchait Auth, PostgreSQL et Engine de fonctionner ; elle ne venait
pas d'un mauvais mot de passe Admin. L'utilisateur a corrigé et relancé Docker
normalement. Les treize services Admin nécessaires sont redémarrés avec leurs
identités et images conservées ; la pile Supabase utilisateur n'est pas modifiée.

Le premier essai de publication par lot avait aussi envoyé l'epoch en texte à
l'API d'aperçu, qui exige un entier sûr. Le pilote est corrigé avec contrôle de
conversion exacte ; le brouillon synthétique et son événement d'audit restent
conservés. La cible était intacte, sans opération de publication créée. Ce
premier essai reste un échec documenté, distinct du parcours ensuite réussi.

## Avant une utilisation distante

La [matrice de livraison](readiness-current.md) reste la référence : réconcilier
l'historique et les schémas distants, valider restauration/compatibilité élève,
traiter les findings SQL restants, définir/provisionner MFA et révocation,
qualifier les sources Production et terminer les métriques et réceptions
visuelles. Les projets distants, secrets opérationnels, déploiements et
publication réelle ne sont pas activés. Le Lot 1A et le goal restent ouverts.

Aucun contournement des restrictions de navigateur ou Windows, aucune donnée
existante supprimée, aucun reset Docker ni modification distante.
