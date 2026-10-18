# Lot 1A — rapprochement par empreintes SQL

**Actualisation du 18 octobre :** le [nouveau relevé en lecture seule](lot-1a-remote-reconciliation-current.md)
compare les 64 fichiers qualifiés et distingue Git HEAD de l’arbre contenant
des modifications préexistantes. Les résultats ci-dessous restent ceux du
13 octobre ; aucune équivalence ou application n’est ajoutée rétroactivement.

Relevé du 13 octobre 2026, exclusivement en lecture. Ce complément rapproche
des empreintes des statements archivés avec les fichiers suivis dans NovLearn.
Il ne répare pas l'historique, n'applique rien et ne réceptionne pas le Lot 1A.
Les statements SQL, acteurs, clés d'idempotence et données métier ne sont pas
exportés : seuls versions, noms, nombres de statements et hashes sont recueillis.

## Méthode et sources

- Source NovLearn : commit `07a1764b2225fb72c67c2fa9c6a7937cc0ae4fb6`.
  Les 45 fichiers suivis sous `supabase/migrations/` sont relus ; ce dossier
  reste propre dans Git. Les autres modifications locales du dépôt voisin
  sont préservées et n'appartiennent pas à ce goal.
- La structure de `supabase_migrations.schema_migrations` est vérifiée par
  `information_schema.columns`. Le SELECT livré dans
  [migration-hashes-readonly.sql](lot-1a-migration-hashes-readonly.sql) est exécuté
  séparément dans les deux projets. Les listes résultantes sont identiques dans
  tous les champs sélectionnés, donc conservées une seule fois dans
  [le rapport machine](lot-1a-migration-hashes.json).
- Les statements d'une entrée sont joints par LF et leurs CRLF remplacés par
  LF. Les fichiers locaux suivent la même normalisation de fins de ligne.
  Un deuxième hash retire uniquement les espaces, tabulations et fins de ligne
  aux limites extérieures du texte. Aucun commentaire, séparateur interne,
  identifiant ou littéral SQL n'est réécrit pour fabriquer une correspondance.
- MD5 sert à la comparaison, pas à signer une publication ou à valider un
  changement sensible. Le SHA-256 local conserve l'empreinte des octets du
  fichier de travail avant normalisation.

## Résultats vérifiés

| Mesure                                          | Résultat                                    |
| ----------------------------------------------- | ------------------------------------------- |
| Fichiers locaux suivis                          | 45                                          |
| Entrées déclarées dans chaque base              | 70                                          |
| Listes d'empreintes Staging/Production          | Identiques au moment du relevé              |
| Entrées avec statements NULL                    | 25 dans chaque base                         |
| Entrées avec SQL archivé                        | 45 dans chaque base, 65 statements au total |
| Correspondances LF exactes sans trim extérieur  | 0                                           |
| Correspondances candidates après trim extérieur | 7 fichiers, vers 7 versions horodatées      |
| Fichiers sans correspondance candidate          | 38                                          |

Les 25 entrées sans statements correspondent aux versions locales communes
`001` à `025`. Leur présence dans l'historique ne donne donc aucune preuve de
leur texte exécuté. Les dix autres versions communes ont des hashes différents
du fichier local selon la méthode ci-dessus ; cette différence ne suffit pas
à conclure que leurs effets SQL diffèrent.

## Correspondances candidates

| Fichier local                            | Version distante avec même hash normalisé |
| ---------------------------------------- | ----------------------------------------- |
| `027_signed_streak.sql`                  | `20260401143824`                          |
| `028_claude_exercises.sql`               | `20260401155307`                          |
| `031_notification_preferences.sql`       | `20260404132302`                          |
| `032_fix_feedbacks_foreign_key.sql`      | `20260429140031`                          |
| `033_feedbacks_optional_profile.sql`     | `20260429140417`                          |
| `038_feedbacks_allow_anonymous.sql`      | `20260515100450`                          |
| `039_feedbacks_auto_nullify_user_id.sql` | `20260515100934`                          |

Les cinq premières ont aussi une entrée distante sous leur numéro séquentiel,
dont le hash ne correspond pas au fichier local. Il faut donc préserver les
deux identifiants déclarés et examiner leur origine. Une correspondance de
hash ne permet ni de supprimer une entrée, ni de renommer un fichier appliqué,
ni de rejouer une migration. Les candidats n'ont pas été déclarés « appliqués
identiques » ni approuvés.

## Prochain travail nécessaire

Pour les 25 entrées sans SQL, obtenir une preuve historique auprès du
propriétaire (fichiers originaux, archive de livraison ou journal contrôlé).
Un hash ne reconstitue pas ces statements. Pour les autres entrées, faire un
diff SQL sous revue autorisée, en préservant commentaires/littéraux importants
et en comparant les objets/effets réellement présents. La liste de sept
candidats sert à cibler cette revue, pas à remplacer une baseline approuvée.

Les captures des deux bases ne constituent pas un snapshot transactionnel
global ou un gel de DDL. Les changements manuels, états de séquences, effets de
données, backups, restauration et tests RLS restent hors de ce relevé. Aucun
secret privilégié Production n'est récupéré. La sécurisation du rôle et les
autorisations de modification/application du Lot 1A restent requises.
