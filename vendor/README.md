# Archive Engine verrouillée

L'Admin embarque l'archive officielle
`novlearn-exercise-engine-0.2.3.tgz`, indépendante du dépôt Engine. Son SHA-256
est `3068549e521d1f643ced8564e94ad645dbccace22a9ec173c912530af3766028`.
`engine-artifact-sha256.txt` conserve le checksum fourni avec la release ; le
manifeste `engine-release.json` décrit l'archive active et sa provenance.

La release est [Engine v0.2.3](https://github.com/Novlearn/Novlearn-Engine/releases/tag/v0.2.3).
Le déploiement du host Engine Staging est rapporté réussi dans le
[workflow 44165765404](https://github.com/Novlearn/Novlearn-Engine/actions/runs/44165765404).
Le SHA-256 du tarball identifie le package ; il ne doit pas être remplacé par le
digest d'une image Docker.

`npm run verify:engine` compare le checksum, l'archive, l'inventaire des fichiers,
les exports, le lockfile et l'identité certifiée. Les anciennes archives et
manifestes restent conservés pour le rejeu et le rollback.
