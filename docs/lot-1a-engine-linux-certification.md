# Lot 1A — Certification locale du profil Engine Linux

**Le profil Engine Linux choisi est validé localement. Le Lot 1A reste
incomplet.** L'utilisateur retient Linux avec cgroup v2 borné, testé dans
Docker local ([D06](decisions.md#d06--cible-engine-linux-bornee)). Aucun
environnement distant ni paramètre de protection Windows n'est modifié.

## Modifications

- Diagnostic Windows limité au code natif ou au type d'exception, avec test
  d'absence de divulgation. Aucun délai, quota ou verdict assoupli.
- Smoke du package renforcé : vrai worker du package installé, mémoire sous
  quota et arrêt vérifié. Les preuves portables sont enregistrées même si le
  contrôle natif final échoue ; la commande conserve alors son code d'échec.
- Banc permanent `tools/check-installed-package.ps1` dans Engine : installation
  npm hors ligne de l'archive exacte et de ses dépendances déjà présentes,
  puis consommation des exports depuis un conteneur neuf sans réseau.
- Aucun changement du cœur mathématique, du schéma 5 ou de CortexJS 0.151.0.
  Le CDC, le corpus original et les modifications préexistantes sont conservés.

## Preuves

| Contrôle exécuté                                  | Résultat                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Suite source standard Windows `npm.cmd run check` | **1 534 PASS**, 29 fichiers, aucun skip, 377,21 s ; build/types/lint/format PASS                                       |
| Lint après ajout des bancs de distribution        | PASS                                                                                                                   |
| `npm.cmd pack --dry-run`                          | PASS, 157 fichiers                                                                                                     |
| Dernier smoke du tarball installé                 | **PASS** : exports ESM, correction, types stricts, bundle browser sans builtin Node et worker Windows de cette archive |
| Archive installée sur Linux                       | **PASS** : sept opérations publiques, rejeu privé, projection sans attendus, workers réellement arrêtés                |
| Banc OS Linux officiel                            | **12 PASS** : interruption, pression mémoire réelle, refus de sous-processus, crash et reprise                         |
| Parcours historiques isolés Linux                 | **8 PASS**, recette invalide refusée                                                                                   |
| Banc Python/FastAPI officiel                      | **13 PASS**, 65,060 s                                                                                                  |

La suite source précède les derniers compléments de bancs ; le runtime et les
tests natifs sont inchangés depuis son passage. Les nouveaux bancs sont exécutés,
et leur lint et format sont vérifiés. Aucune CI distante, nouvelle session
navigateur MathLive ou suite complète Vitest Linux n'est annoncée.

Archive qualifiée :
`650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290`.
Les [preuves machine](lot-1a-engine-local-proof.json) enregistrent l'archive,
les dépendances, les sources et les résultats distincts.

Le runtime est **Node 24.19.0**, npm **11.17.0**, image déjà installée et épinglée
`node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b`.
Le conteneur applicatif de test a **384 MiB**, **swap 0**, **64 pids**, réseau
désactivé, aucun privilège ajouté et des entrées en lecture seule. Cette
qualification vaut pour ce profil et cet artefact, pas pour un hébergement
encore inconnu.

Le [refus Windows précédent](lot-1a-engine-local-requalification.md) reste
documenté : Code Integrity 3077 / `VerifiedAndReputableDesktop` bloquait une
autre archive non signée, pourtant identique à son binaire source. Le dernier
smoke Windows passe pour son archive exacte ; cela ne démontre ni une correction
de la politique ni l'acceptation de futurs binaires reconstruits. Aucune
désactivation, exclusion ou signature fictive n'est utilisée. La cible retenue
reste Linux.

## Reproduction du runtime choisi

Dans `Novlearn-Engine`, avec l'image Docker épinglée déjà installée :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/check-installed-package.ps1 -EngineArchive .cache/package-smoke-1791930086804/archive/novlearn-exercise-engine-0.1.0.tgz
```

L'option PowerShell s'applique à ce processus uniquement. Le banc utilise
explicitement le daemon Docker Desktop local, refuse les échecs d'installation
ou de test, vérifie que l'archive n'a pas changé et conserve une preuve JSON
dans un nouveau dossier `.cache/installed-package-*`.

## Reste avant réception du Lot 1A et application distante

La porte de qualification Engine locale Linux est franchie. Il reste à fermer
les lectures historiques de réponses et les verdicts clients après adaptation
des consommateurs, puis à rapprocher l'historique et les schémas distants,
vérifier les droits du principal de publication, le mapping catalogue et la
sauvegarde/PITR réelle. Les **51 migrations et 69 assertions après restauration**
prouvent les fixtures locales ; elles ne valident pas une base distante.

Préparer un plan de migrations en avant, sans rejouer 010/022/028 modifiées sur
une base existante. Toute application Staging, puis Production et mise en
service, nécessite une autorisation séparée. L'Auth Admin reste désactivée ;
aucun lot dépendant, déploiement, publication ou push n'est engagé.
