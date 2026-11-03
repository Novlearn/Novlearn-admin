# Prompt : comprendre le choix d'hébergement avant de décider

Tu reprends le projet Novlearn-admin. Je veux comprendre le problème
d'hébergement d'Engine et les solutions possibles **avant de prendre une
décision**. Explique-moi les choses simplement, avec peu de jargon.

Lis `docs/mission-admin-engine-reception.md`, `docs/engine-host-decision.md`
et `docs/archives/mission-engine-vercel-2026-10-30.json`. Consulte le code
nécessaire en lecture seule pour vérifier un point précis, sans refaire toute
la mission.

Contexte établi :

- Admin est déjà déployé sur Vercel et utilise la base Supabase de
  préproduction existante. La connexion Admin fonctionne.
- Engine est la bibliothèque TypeScript commune pour les mathématiques,
  la génération et la correction. Sa version retenue est l'archive 0.1.1,
  distincte des travaux 0.2.0 non adoptés.
- Les 1 571 tests Admin passent. Les cinq exercices pilotes fonctionnent
  localement avec Engine : 108 appels réels dans Linux isolé, avec les limites
  de sécurité conservées.
- Le test connecté sur Vercel a réellement lancé le host officiel : il répond
  `unavailable`. Sur le profil observé, le lanceur Python attendu n'est pas
  exécutable et le profil cgroup requis n'est pas lisible. Ce résultat ne
  démontre pas que toutes les solutions Vercel sont impossibles.
- Aucun pilote n'a encore été enregistré en préproduction. Les corrections
  SQL nécessaires ont été préparées et testées sur copie uniquement.
- Aucun hôte Linux distant supplémentaire n'a été installé. L'édition avec
  Engine reste fermée sur Vercel. La mission 1 est donc incomplète.

Explique d'abord, avec un petit schéma si utile, où se trouvent actuellement
l'interface Admin, la bibliothèque Engine, le programme qui l'exécute et la
base. Clarifie pourquoi une bibliothèque TypeScript peut fonctionner dans
les tests locaux tout en ayant besoin d'autres conditions pour s'exécuter
sur le serveur. Explique ce que protègent les limites actuelles sans proposer
de les retirer.

Compare ensuite ces deux pistes :

1. Garder Admin sur Vercel et faire exécuter Engine par un petit service privé
   sur un serveur Linux autorisé, en réutilisant un serveur existant si possible.
2. Essayer une Function conteneurisée Vercel pour réunir les prérequis sur
   Vercel, en reconnaissant que ses possibilités d'isolation restent à prouver.

Pour chacune, indique clairement : ce qui changerait pour moi, ce qui resterait
sur Vercel, ce qu'il faudrait installer ou configurer, l'entretien nécessaire,
les coûts connus ou encore inconnus, les risques et le test qui permettrait
de confirmer que cela fonctionne. N'invente ni serveur disponible ni tarif.
Explique si un service séparé est réellement nécessaire ou seulement une option.

Termine par une recommandation argumentée, puis les quelques informations
indispensables à la décision. **N'installe rien, ne déploie rien, n'applique
aucune migration et ne crée aucun nouveau coût pendant cette explication.**
Préserve les modifications existantes, ne commence pas l'adaptation de
NovLearn classique et n'effectue aucune écriture en production. Nous
prendrons la décision après l'explication.
