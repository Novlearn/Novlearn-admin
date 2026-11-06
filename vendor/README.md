# Archive Engine verrouillée

`novlearn-exercise-engine-0.1.8.tgz` est l’archive privée consommée par l’Admin,
indépendante d’un chemin vers le dépôt voisin. Son SHA256 est :

```text
82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea
```

L’identité de référence est dans
[engine-identity.ts](../src/lib/engine-identity.ts).
`npm.cmd run verify:engine` contrôle l’archive, tous les fichiers installés, l’intégrité
SHA512 du lockfile et Cortex 0.151.0. Ne pas substituer un autre build portant le
même numéro de version.

Le [manifeste](engine-release.json) fixe l'inventaire complet des 169 fichiers,
les exports et les identités du package/pipeline. Le vérificateur compare
désormais tous les fichiers installés. Le [contrat de distribution](../docs/engine/engine-library.md)
décrit l'API et le consommateur autonome, sans reconstruire l'archive existante.

L’archive 0.1.8 poursuit les releases 0.1.x et ajoute un échantillonnage de
courbes optionnel dans la projection publique. Le contrat de schéma 5 et le
pipeline 0.1.0 restent identifiés séparément ; le travail Engine 0.2.0 demeure
hors de l’archive consommée. Conserver l'archive exacte pour le rejeu. Les
releases 0.1.0 et 0.1.1 et leurs manifestes historiques restent disponibles :
[0.1.0](engine-release-0.1.0.json) et [0.1.1](engine-release-0.1.1.json).
Le [manifeste 0.1.1](engine-release-0.1.1.json) fixe la provenance du correctif.

Les [preuves de qualification](../docs/guides/verification.md) distinguent l’ancien
artefact `650128cd…9190290`, l’adoption de cette archive et le travail 0.2.0 non
adopté. La qualification porte sur le profil Linux borné ; elle ne rend pas Engine
actif dans le profil Staging/Vercel actuel.
