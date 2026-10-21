# Archive Engine verrouillée

`novlearn-exercise-engine-0.1.0.tgz` est l’archive privée consommée par l’Admin,
indépendante d’un chemin vers le dépôt voisin. Son SHA256 est :

```text
d4d3abc408ab37f2f8a5faa512964b48947828bae9209cb1460b47111ca582f9
```

L’identité de référence est dans
[engine-identity.ts](../src/lib/engine-identity.ts).
`npm.cmd run verify:engine` contrôle l’archive, le fichier installé, l’intégrité
SHA512 du lockfile et Cortex 0.151.0. Ne pas substituer un autre build portant le
même numéro de version.

Les [preuves de qualification](../docs/verification.md) distinguent l’ancien
artefact `650128cd…9190290`, l’adoption de cette archive et le travail 0.2.0 non
adopté. La qualification porte sur le profil Linux borné ; elle ne rend pas Engine
actif dans le profil Staging/Vercel actuel.
