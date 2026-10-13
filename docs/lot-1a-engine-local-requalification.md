# Lot 1A — Requalification locale Engine, 13–14 octobre 2026

> Observation intermédiaire conservée. La cible retenue et le bilan courant
> figurent dans la [certification locale Linux](lot-1a-engine-linux-certification.md).

**Le Lot 1A reste incomplet.** La suite source Engine est verte, mais le
launcher Windows réellement installé depuis le tarball est bloqué par le
contrôle d'applications Windows. La certification de cet artefact n'est pas
validée. Aucun environnement distant, donnée existante ou paramètre de
protection Windows n'a été modifié.

## Modifications autorisées par D05

Dans `Novlearn-Engine`, le launcher conserve son code de sortie 70 et ajoute
le code d'erreur natif, ou le nom du type d'exception, au diagnostic stderr.
Il ne divulgue ni chemin ni message d'exception. Un test avec exécutable absent
exige le diagnostic natif `2`. Les limites, watchdogs et refus restent inchangés.

Le smoke du package exécute maintenant un vrai parsing isolé depuis le
consommateur Windows installé. Il exige la conservation de la source, une
mémoire engagée entre 0 et 384 MiB et l'arrêt réel du worker. Auparavant,
ce smoke vérifiait seulement l'import de `node-host`. Le nouveau contrôle
reste bloquant : son échec n'est ni ignoré ni remplacé par une vérification
sur les sources du dépôt.

Les définitions mathématiques, le contrat canonique, CortexJS, le CDC et les
originaux historiques sont inchangés. Les polices, couleurs et logos déjà
appliqués dans Admin restent conformes à la référence visuelle D03.

## Vérifications réellement exécutées

| Vérification                              | Résultat                                                                         | Portée                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Suite instrumentée pour diagnostic        | 1 533 PASS, 29 fichiers, 373,63 s                                                | Observation préalable, non substituée à la commande standard                                               |
| `npm.cmd run check`, sans instrumentation | **1 534 PASS**, 29 fichiers, aucun skip, 377,21 s ; build/types/lint/format PASS | Runtime et test natif final ; avant l'ajout du contrôle de package renforcé                                |
| Lint après ajout du smoke renforcé        | PASS                                                                             | Outillage final                                                                                            |
| `npm.cmd pack --dry-run`                  | PASS, 157 fichiers                                                               | Construction de l'archive, pas preuve d'exécution native                                                   |
| `npm.cmd run smoke:package` renforcé      | **FAIL**, `unavailable`                                                          | Vrai tarball installé ; arrêt au contrôle natif avant les vérifications types/bundle suivantes             |
| Banc Python/FastAPI officiel              | **13 PASS**, 65,060 s                                                            | Docker local, réseau désactivé, mémoire 384 MiB, 64 pids                                                   |
| `tools/check-linux.mjs`                   | **12 PASS**                                                                      | Cgroup v2 : mémoire 402 653 184 octets, swap 0, pids 64 ; interruption, pression mémoire, crash et reprise |
| `tools/check-legacy-host.mjs`             | **8 parcours PASS**, recette invalide refusée                                    | Adaptation, instance privée, projection et correction dans des workers Linux neufs                         |

Les deux bancs Linux utilisent l'image déjà installée et épinglée
`node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b`.
Les sources sont montées en lecture seule ; le marqueur de test est dans un
tmpfs neuf. Aucun accès réseau, privilège ajouté ou base réelle utilisée.
Ces bancs qualifient leurs profils ; ils ne constituent pas une adoption
applicative ni une nouvelle session navigateur MathLive.

## Cause prouvée du refus du package Windows

Les deux `job.exe`, source et installé, ont la même empreinte SHA-256 :
`76c85858b1d09686515ad805bfe7895721033858ba8f925deb75e247e52d1695`.
Le binaire installé est `NotSigned`. Le lancement Node échoue synchroniquement
avec `UNKNOWN` ; le lancement PowerShell confirme qu'une stratégie de contrôle
d'applications bloque le fichier.

L'événement Code Integrity **3077**, le 14 octobre à **00:00:24 Europe/Paris**,
identifie exactement le launcher installé, la politique
`VerifiedAndReputableDesktop` et le statut `0xc0e90002`. Des événements 3077
concernent aussi le launcher source pendant les 25 échecs reproduits à
23:40–23:41. Cela établit ces refus ; la causalité des anciens timeouts de
10 secondes n'est pas démontrée par leurs traces seules.

Microsoft documente [3077 comme un refus en mode appliqué](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/event-id-explanations)
et [la signature reconnue pour Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control).
Aucune désactivation, exclusion ou modification de politique n'est effectuée.

Le tarball réellement testé a l'empreinte
`14fb7028875ebceae9ab1bcdfece97521b792f0fcbfea3e072207865fea3b762`.
Les [preuves machine](lot-1a-engine-local-proof.json) conservent les empreintes
des sources et distinguent les contrôles verts du contrôle bloquant.

## Portes restantes et application distante

1. Retenir un runtime : qualifier le tarball et l'hébergement Linux borné,
   ou disposer d'un launcher Windows signé avec un certificat reconnu,
   puis rejouer le smoke natif sans modifier ses critères. Le choix demandé
   à l'utilisateur reste distinct d'une activation applicative.
2. Terminer les lecteurs d'exercices et la correction officielle serveur.
   Les anciens verdicts clients et les lectures de réponses historiques
   empêchent encore de réceptionner localement tout le Lot 1A.
3. Rapprocher l'historique et les schémas distants, vérifier grants/RLS/RPC,
   mapping catalogue et droits du principal de publication. Le rejeu local
   de **51 migrations et 69 assertions après restauration** ne valide pas
   l'état d'une base distante.
4. Revoir un plan de migrations en avant, sauvegarde/PITR et restauration
   sur copie réelle. Ne pas rejouer 010/022/028 modifiées sur une base existante.
5. Obtenir une autorisation séparée pour une application Staging, puis pour
   Production et la mise en service. L'Auth Admin reste désactivée ; aucun
   lot dépendant, déploiement, publication ou push n'est engagé.
