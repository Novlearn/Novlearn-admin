# Décision d'hôte restante après la mesure Vercel

Le 30 octobre, le déploiement autorisé `dpl_9JmZiJD94mDNC24Ym9ig3wA5dED7`
a réellement exécuté le banc avec une session Admin. Archive 0.1.1 c7116f93…,
Linux x64, Node **24.22.2** ; `/usr/bin/python3` n'est pas exécutable et le
diagnostic ne lit pas le profil cgroup v2 attendu. `validateDefinition` du host
officiel répond `unavailable`. Les gardes d'édition Vercel sont conservées.

Cela reçoit l'échec du profil Node actuellement déployé, pas une impossibilité
générale de Vercel ni un échec mathématique. Le même artefact exécute les cinq
pilotes dans le conteneur Linux local : 108 appels, trois seeds, quotas inchangés.

## Option minimale exploitable : conserver Admin sur Vercel

Réutiliser un **hôte Linux x64 existant autorisé**, sans toucher au code ni à
la base de NovLearn classique. Un superviseur privé transporte les enveloppes
du host via stdin vers un conteneur Engine isolé ; il n'implémente aucun calcul.
Les scripts `local-engine.mjs`, `local-engine-worker.mjs` et `local-engine-setup.mjs`
fournissent déjà le modèle local reçu. Leur transport loopback actuel ne doit
pas être exposé tel quel sur Internet.

Préparer une unité dédiée et un accès TLS authentifié, une seule instance et
une file bornée. Reprendre l'identité de l'archive à chaque démarrage. Le
conteneur Engine reste sans réseau, sans secret Auth/DB, en lecture seule,
utilisateur non privilégié, capabilities retirées, `no-new-privileges`,
cgroup **384 Mio**, swap nul, **64 pids**, heap **128 Mio**, host **1 actif/4 en
attente**, délai **5 s file comprise**, entrée 1 Mio et sortie 2 Mio. Le
superviseur garde l'accès réseau ; le worker reçoit uniquement les données
de l'opération. Tester annulation, saturation, crash, timeout et arrêt réel.

L'Admin conserve Auth, permissions et orchestration. Les références opaques
d'aperçus résident dans la table privée proposée dans la base de préproduction
existante, avec TTL dix minutes, deux instances par Admin et 32 globales.
Le transport distant demande une URL serveur et un secret partagé dédiés,
dans le seul `.env` privé / les variables Vercel ; aucun `NEXT_PUBLIC_*`.
Ne provisionner aucune valeur avant autorisation et qualification du transport.

Cette option requiert **le choix d'un serveur et l'autorisation d'y installer
l'unité Engine**. Aucun tarif n'est affirmé sans fournisseur ni offre choisis.
Réutiliser un hôte autorisé peut éviter une nouvelle souscription ; les ressources
et l'exploitation restent à accepter. Aucun service n'a été installé à distance.

## Variante à éprouver : Function conteneurisée Vercel

La [documentation actuelle](https://vercel.com/docs/functions/container-images)
décrit les images de conteneur et la
[documentation des limites](https://vercel.com/docs/functions/limitations)
décrit les ressources Functions. Ajouter Python dans une image ne prouve pas
la disponibilité d'un cgroup délégué à 384 Mio, de swap nul et du plafond de
processus nécessaire au host. Cette variante exigerait un banc supplémentaire,
la confirmation de son coût et une autorisation de déploiement distincte.
Ne pas la présenter comme une solution reçue ou retirer les gardes pour l'essayer.

## Retour arrière et porte de réception

Un raccordement futur ne s'active qu'après qualification de l'archive exacte,
du transport et des snapshots privés. Le retour garde l'édition Engine fermée
et rétablit l'ancien déploiement Admin si nécessaire. Aucune promotion de contenu,
mise en production élèves ou modification d'anciennes tentatives n'est incluse.
Les propositions SQL restent soumises à l'autorisation distincte de leur diff.
