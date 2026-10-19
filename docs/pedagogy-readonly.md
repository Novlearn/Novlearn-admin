# Statistiques pédagogiques — socle SQL local

**Les requêtes et permissions sont qualifiées sur des copies synthétiques.**
Ce jalon prépare les filtres du CDC §6.3/6.4 et les agrégations du §15.1.
Il ne livre pas encore le lecteur serveur, le login PostgreSQL/TLS, les routes
ou l'interface connectée. Les statistiques générales existantes restent
utilisables sur 3150 ; les nouveaux filtres pédagogiques n'y apparaissent pas.
Les [preuves datées](pedagogy-readonly-proof.json) séparent ces périmètres.

## Définitions et limites

La requête agrège en base une période UTC de 1 à 90 jours, sans timestamp inventé
ni ligne future. Les filtres peuvent combiner chapitre, compétence, difficulté,
type classique/flash et mode exercice/duel. Les regroupements par chapitre,
compétence ou exercice sont paginés par 25. Le tri présente soit le volume de
tentatives décroissant, soit la réussite **enregistrée** croissante.

La réussite est `correct / (correct + incorrect)`, avec abandons exclus du
dénominateur. Sans dénominateur, le taux est non calculable et classé après les
taux calculables. Ce tri ne mesure pas une difficulté intrinsèque et ne certifie
pas les verdicts historiques par l'Engine. Les compteurs sont des chaînes
décimales bigint, y compris les pages ; les comparaisons du contrat utilisent
des entiers exacts. Le tri SQL garde 60 décimales pour distinguer des fractions
int64 presque égales ; un cas réel teste l'expression SQL utilisée, au-delà de
la précision JavaScript. Les ex æquo utilisent les identifiants en collation C.

Une tentative d'exercice suit `attempted_at` ; une tentative de duel suit
`submitted_at`, avec l'exercice du duel. Un duel terminé est compté séparément
par `finished_at` et statut `finished`, même sans tentative datée. Les comptes
actifs sont les identités Auth encore présentes parmi les tentatives retenues,
invités inclus, dédupliquées sur la période. Un abandon prévaut sur le booléen
de réussite. Le schéma actuel interdit les verdicts NULL : les fixtures respectent
cette contrainte et ne prétendent pas exercer un cas SQL positif contraire.

Les dimensions sont les **métadonnées actuellement enregistrées dans exercises**,
pas une reconstitution des références de chaque tentative historique. Le type
vient de `Is_Flash` ; sa valeur NULL reste inconnue. La difficulté absente est
inconnue. Aucun contenu ou définition de version n'est lu pour deviner un type.

Le chapitre est résolu par nom ou alias actuel. Zéro correspondance ou plusieurs
correspondances restent non résolus ; aucun choix arbitraire n'est fait. Les
compétences utilisent le tableau actuel, dédupliqué, avec repli sur l'ancienne
colonne singulière seulement si le tableau est vide. Les références inconnues
et les exercices absents restent signalés.

Une tentative liée à plusieurs compétences figure dans plusieurs groupes,
mais **une seule fois dans les totaux**. Un même lien répété, ou plusieurs liens
inconnus réunis dans le groupe non résolu, ne doublent pas une tentative dans
ce groupe. Des compteurs de qualité distinguent exercice introuvable, chapitre
non résolu, absence de compétence et liens de compétence inconnus.

Les listes de choix sont bornées à 200 avec un indicateur de dépassement ; les
agrégats ne sont pas limités à ces 200 références. Les libellés sont bornés à
200 caractères Unicode avec un drapeau explicite ; aucun ID n'est tronqué.
Le futur formulaire devra permettre de retrouver une référence absente de la
première liste et distinguer vide, indisponibilité et données manquantes.

## Capacité SQL

La migration canonique locale 69 est
`Novlearn/supabase/migrations/20261019111336_novlearn_admin_pedagogy_readonly.sql`.
Elle crée `novlearn_pedagogy_reader`, NOLOGIN/NOINHERIT et sans privilège élevé,
avec exactement **32 colonnes SELECT sur sept tables RLS**. Auth est limité à
l'identifiant nécessaire au décompte ; profils, e-mails, définitions, réponses,
scores individuels et capacités de publication ne sont pas accessibles.

Aucun login, mot de passe, appartenance ou definer n'est ajouté. Les trois
lecteurs précédents gardent leurs droits. Deux policies SELECT propres au
nouveau rôle sont ajoutées ; cinq expressions SELECT publiques ajoutent
seulement une exception pour son identité SQL physique. Les predicates des
autres rôles et toutes les policies de mutation restent inchangés.

Le prérequis épingle les policies SQL 68 et refuse les alternatives inattendues.
Après les grants, il exige exactement les lectures prévues et l'absence de
droits d'écriture, séquences, création et fonctions privilégiées, y compris
par PUBLIC. Les protections ne reposent pas sur une transaction read-only.
La version initiale a été remplacée par ce prérequis plus strict ; ses copies
et preuves sont conservées. Aucune source connectée ou distante n'est migrée.

## Vérifications exécutées

- 44 tests du contrat : filtres combinés, refus des champs privés/source,
  périodes, bigint, pagination, incohérences, chevauchements et ordre Unicode.
- Rejeu neuf des 69 migrations, PostgreSQL sans réseau ni port publié.
- 18 cas SQL avec le véritable décodeur, 23 refus effectifs SQLSTATE 42501,
  11 bornes invalides, faux rôles JWT et refus d'assumer le rôle physique.
- Migration sur restauration peuplée : 22 anciens rôles, huit contextes de
  claims et dix tables, soit 1 760 requêtes par matrice avant/après. Résultats
  identiques, neuf prérequis négatifs, dry-run annulé et réapplication refusée.
- Sauvegarde/restauration : 62 tables, 73 relations, 77 fonctions, 11 séquences,
  neuf rôles applicatifs et empreintes SCRAM exacts ; 48 permissions restaurées,
  trois vues utilisateurs et trois regroupements pédagogiques identiques hors
  heure de relevé. La configuration TLS n'est pas restaurée par cette archive.
- Les lecteurs statistiques, liste et fiche passent leurs critères inchangés,
  ainsi que les 56 assertions SQL historiques. Le relevé JSON référence la
  chaîne complète Admin et son résultat final.

Les premiers essais ont révélé des fixtures non conformes au CHECK de difficulté
puis au NOT NULL des verdicts. Elles sont corrigées, sans modifier les contraintes,
et l'état initial est recomparé exactement. Un contrôle automatique d'autorisation
a expiré avant création du processus de non-régression ; l'unique nouvelle tentative
autorisée a réellement exécuté les quatre suites et réussi. Aucun refus de sécurité
n'a été contourné ; aucune opération distante, suppression ou protection modifiée.

## Raccordement restant

Qualifier un login et un pool serveur avec certificat vérifié, contrôles de
privilèges à chaque lecture et délais bornés ; conserver les anciennes identités.
Brancher page et API avec autorisation Admin fraîche, activation locale explicite,
labels de source et tests HTTP réels. Ajouter les formulaires, tableaux, navigation
et réception navigateur autorisée. Exécuter les advisors SQL 69 et analyser les
plans sur un volume représentatif avant de revendiquer les performances.

Les constats advisors SQL 68 sont des preuves antérieures ; leur résultat ne
vaut pas une exécution des advisors sur SQL 69. MFA, métriques restantes,
version active Production, source Production et portes distantes du Lot 1A
restent ouverts. Ce jalon ne clôture ni le Lot 8 ni le goal global.

Références : [PostgreSQL — row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[agrégations](https://www.postgresql.org/docs/17/functions-aggregate.html) et
[types numériques](https://www.postgresql.org/docs/17/datatype-numeric.html).
