# Publication HTTP locale — préparation du banc

**Les deux copies et leurs connexions sont qualifiées. Le transfert HTTP complet
n’est pas encore exécuté.** L’application principale reste sur le port 3150,
avec sa connexion disponible et sa publication fermée.

## Ressources distinctes

`create-local-admin.mjs` expose maintenant son bootstrap comme une fonction,
sans effet lors de son import. Le lancement CLI ordinaire conserve son profil
et refuse toujours le port 3150 occupé. Le nouveau lanceur
`create-publication-http-workspace.mjs` prépare un profil fixe séparé : API
locale 55432, origine applicative prévue 3152, référence JWT, comptes, secrets,
conteneurs et dossier propres. Aucun endpoint arbitraire n’est accepté par ce
profil. Le schéma provient du même rejeu qualifié de 64 migrations.

La source de cette expérience est dans le dossier ignoré
`.local/local-admin-publication-1792259029889/`. Le test Auth utilise de vraies
connexions GoTrue et lectures PostgREST. Il vérifie les rôles Admin/non-Admin,
le refus d’auto-promotion, les identités distinctes, la séparation des secrets,
la disponibilité du login principal et le refus de publication sur 3150.
Ses cinq contrôles passent. Sa preuve datée précède la préparation de la cible.

La cible est un autre conteneur PostgreSQL, restauré depuis le dump pristine
SQL 64 et dépourvu de comptes Auth. Source et cible restent sur le réseau
interne de la copie, sans port PostgreSQL directement publié. Un relais de
transport borné transmet les octets TLS, sans terminer TLS ni détenir de mots
de passe. Ses deux ports sont liés uniquement à `127.0.0.1:55433/55434`.
Les réseaux existants et la configuration globale Docker sont conservés.

Les deux certificats locaux distincts sont générés hors ligne et restent privés
dans le dossier de preuve. Ce sont des certificats de fixture valables sept
jours, sans portée de mise en service. Le pilote existant vérifie réellement
TLS et ses identités SQL : comptes de service distincts, non héritables et
sans privilèges élevés, chacun lié à sa seule capacité. Aucun mot de passe,
clé privée ou configuration opérateur n’est livré au navigateur.

## Vérifications exécutées et portée

La [preuve agrégée](publication-http-preparation-proof.json) distingue :

- Le bootstrap réel source et ses cinq contrôles Auth/REST.
- Six contrôles physiques TLS/PG : les deux connexions et identités exactes,
  refus des lectures directes de tables, d’une CA non reconnue, d’un mauvais
  mot de passe source/cible et de l’identité source sur la cible.
- Les snapshots des 62 tables source et des 62 tables cible sont inchangés
  pendant la préparation TLS et les tests du pilote. Les services Auth/REST
  de cette seule fixture sont arrêtés pendant cette comparaison puis redémarrés.
- Les deux registres de publication restent désactivés et épinglent l’archive
  certifiée. Les réseaux/ports sont inspectés. Les configurations privées et la
  clé de signature de l’instance principale sont identiques à celles de sa mise
  à niveau 64. Le créateur ordinaire refuse exactement son port 3150 occupé.
- **74 tests ciblés Auth locale/configuration PG** passent. Le lint et le format
  des scripts passent. Les 735 tests et le build du jalon d’adoption restent des
  preuves antérieures ; ils ne sont pas revendiqués comme une nouvelle exécution.

Ces contrôles n’appellent jamais `apply_exercise_publication`, ne donnent aucune
approbation synthétique et ne démarrent pas une application Next sur 3152.
Le lecteur de configuration actuel refuse encore ce nouveau profil applicatif.
Les critères et portes opérationnelles ne sont pas modifiés par cette préparation.

## Reproduction et reprise

Créer une nouvelle copie nécessite deux /28 privés libres, inspectés avant leur
choix. Les valeurs déjà employées restent occupées ; ne pas réinitialiser une
copie pour les réutiliser. Le lanceur accepte seulement les deux options de
sous-réseaux déjà bornées de l’outil local.

Sur la copie conservée, les étapes réellement exécutées sont :

```powershell
node scripts/test-publication-http-workspace.mjs .local/local-admin-publication-1792259029889
node scripts/prepare-publication-http-pg.mjs .local/local-admin-publication-1792259029889
```

La préparation PG refuse une copie déjà préparée. **Ne pas la réexécuter pour
reprendre les contrôles.** Les connexions physiques peuvent être revérifiées
sans recréer de ressource :

```powershell
node --conditions=react-server scripts/test-publication-http-pg-worker.mjs .local/local-admin-publication-1792259029889/pg-1792259295630
```

Les six services de la fixture sont conservés et actifs. Les pools du test sont
fermés. Le fichier ignoré `publication-pg.json` désigne la configuration PG privée
et ses preuves ; ne pas le publier. L’instance principale n’a pas été arrêtée.

Prochaine étape : autoriser ce seul profil applicatif de fixture, isoler son
cookie et sa configuration, puis exercer la vraie route Next avec Auth, REST,
Engine, confirmation, transfert local et reprise. Cette activation doit refuser
les endpoints distants et les mélanges avec 3150 ou Staging/Production, conserver
les rôles et les vérifications TLS, et étiqueter clairement les résultats locaux.
Les nouvelles preuves devront distinguer les transferts de ces simples tests de
connexion. La réception navigateur reste non exécutée après le refus de politique.

Le goal demeure actif : aucune publication distante, migration distante, push
ou mise en service n’est autorisé ou déduit de ce banc.
