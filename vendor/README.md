# Archive Engine verrouillée

`novlearn-exercise-engine-0.1.0.tgz` est l’archive privée locale certifiée après
D06, conservée pour rendre l’installation Admin indépendante des chemins du
dépôt voisin. SHA256 :
`650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290`.

Le lockfile vérifie aussi l’intégrité SHA512 et fixe Cortex à 0.151.0.
`npm run verify:engine` contrôle ces deux empreintes. La certification du
runtime Linux avec cgroup v2 est documentée dans
[le bilan Engine](../docs/lot-1a-engine-linux-certification.md).
Cette archive n’est ni publiée sur npm ni reconstruite depuis des sources
modifiées. Les contrats TypeScript sont utilisés par les brouillons ; les
opérations mathématiques serveur seront intégrées dans le lot Creator/tests.
