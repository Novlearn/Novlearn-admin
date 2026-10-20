# Export de structure Staging — outil opérateur préparé

Le connecteur actuel permet les SELECT, pas un export standard `pg_dump`.
L’utilisateur ne dispose pas d’export de structure existant. L’outil local
`scripts/export-staging-schema.ts` prépare cette prochaine étape ; **l’export
réel et sa restauration ne sont pas encore exécutés**.

## Configuration privée nécessaire

Le fichier ignoré `.local/staging-schema-export/source.json` est réservé à la
connexion PostgreSQL du projet **novlearn-staging**, ref
`tksvbkvfusrnxulpahky`. Il est distinct des configurations de l’application et
n’active ni Auth distante, ni publication. Utiliser les identifiants PostgreSQL
existants, pas une clé API Supabase, et ne rien coller dans la conversation.

```json
{
  "host": "db.tksvbkvfusrnxulpahky.supabase.co",
  "port": 5432,
  "database": "postgres",
  "user": "postgres",
  "password": ""
}
```

Le mot de passe vide est volontairement refusé. Si un rôle de lecture approprié
existe déjà, renseigner son nom ; cet outil ne crée pas de rôle et ne prétend
pas limiter les droits généraux du compte opérateur. Les instructions SQL de
ses connexions sont imposées en lecture seule. Aucun identifiant Production
n’est accepté et aucune configuration existante n’est écrasée.

La connexion directe et le certificat sont vérifiés. Si une CA spécifique est
nécessaire, placer son certificat public dans le même dossier sous le nom
`supabase-ca.crt` et ajouter `"caFile": "supabase-ca.crt"` au JSON. Il n’existe
aucun mode sans vérification TLS. Sans CA explicite, Node utilise sa configuration de confiance active et
`pg_dump` le magasin système (`sslrootcert=system`) ; un certificat non reconnu
produit un échec.
[Connexion Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres),
[vérification TLS PostgreSQL](https://www.postgresql.org/docs/17/libpq-ssl.html).

## Exécution explicite

La vérification de forme ne contacte aucun serveur :

```powershell
node scripts/export-staging-schema.ts --check
```

Après configuration correcte, l’export utilise la connexion Staging en lecture
seule et l’image PostgreSQL déjà épinglée, avec Docker Desktop Linux disponible :

```powershell
node scripts/export-staging-schema.ts
```

L’image doit déjà être présente ; aucun téléchargement ou mise à jour implicite.
Le conteneur temporaire est borné à un CPU, 256 Mio, aucun swap et 64 processus,
sans capacités supplémentaires ni ports publiés. Le secret est transmis par un
fichier ignoré, pas par la ligne de commande. Ce fichier reste confidentiel dans
l’artefact, comme la configuration et l’export de code SQL.

Le dossier neuf `.local/staging-schema-export/export-<date>/` contient :

- `schema.sql` : structure applicative, propriétaires, ACL et policies ;
- `auth-user-triggers.sql` : définition et mode d’activation des triggers non
  internes de `auth.users` qui appellent les fonctions publiques ; les quatre
  modes PostgreSQL sont conservés, sans réactivation implicite ;
- `proof.json` : empreintes et portée du succès, uniquement si l’export réussit ;
- diagnostics et artefacts partiels conservés en cas d’échec.

Les deux lectures partagent un snapshot exporté sous transaction REPEATABLE READ
READ ONLY. Le dump est limité à `public` et, s’il existe,
`novlearn_admin_private`. Les schémas gérés, rôles globaux, publications,
abonnements, lignes, grands objets et valeurs courantes de séquences ne sont
pas exportés. Ces dépendances restent à traiter dans la future restauration
isolée. Aucune restauration ou migration n’est lancée automatiquement.
[Portée de pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

Un `schema.sql` sans preuve de réussite reste un artefact partiel. Le SQL devra
être relu avant toute restauration dans une nouvelle copie isolée ; aucune
instruction de cet export n’est exécutée contre Staging ou Production.

## Vérifications

Les options réelles de `pg_dump` ont été consultées dans l’image épinglée, sans
réseau ou connexion. Les refus sans configuration puis avec le mot de passe
vide sont observés. Les **62 tests** du contrat contrôlent les cibles interdites,
les champs obligatoires, les injections de lignes d’environnement, les schémas
autorisés, les flags, l’expurgation des erreurs et les quatre modes des triggers.
[Modes PostgreSQL](https://www.postgresql.org/docs/17/catalog-pg-trigger.html).

Sur la copie synthétique SQL71 conservée, un vrai dump utilise le snapshot
partagé ; un snapshot invalide est réellement refusé. La liste de l’archive ne
contient ni TABLE DATA, SEQUENCE SET ni BLOB. Un faux mot de passe contenant
espaces et caractères spéciaux est transmis exactement par Docker. Les 62
tables, 11 séquences et métadonnées restent exactes, puis la copie retrouve son
état arrêté. Les deux triggers Auth locaux sont capturés avec leur mode, sans
exécuter leur SQL de restauration. Ces observations ne qualifient pas la connexion TLS Staging ni
ses identifiants. Les [preuves](staging-schema-export-proof.json) gardent cette
distinction et les échecs initiaux du test et du contrôle de types.

Le contrôle général final reste en échec : 1 493 tests passent et un test dépasse sa limite de cinq secondes. Aucun succès global n’est annoncé.
Les étapes suivantes sont exécutées séparément après cet arrêt : typecheck PASS, lint PASS, format:check PASS, build PASS, test:smoke PASS. Ces résultats ne transforment pas le contrôle complet en réussite. Le timeout touche un test qui appelle directement le SDK officiel sous Windows ; la cause précise reste non établie. L’archive et la certification Linux antérieure sont inchangées. Aucun délai, nombre de cas ou assertion n’est modifié.

L’export Staging et sa restauration restent non exécutés, faute de connexion
opérateur configurée.
