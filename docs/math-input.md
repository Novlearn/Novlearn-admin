# Saisie MathLive — composant préparé indépendamment

Ce travail prépare la saisie scientifique nécessaire au Creator et aux réponses
de test. Il ne démarre pas les écritures du Lot 3 ni les calculs du Lot 4 :
Auth, schéma SQL et qualification Engine restent bloquants. Aucune route de
démonstration publique n'est ajoutée à Next.js.

## Composant et formats

`src/components/math-input.tsx` expose un champ React contrôlé (label, value,
onChange, readOnly, disabled, description et error). MathLive 0.111.1 est
épinglé, identique à la version du banc documenté dans l'Engine. Le chargement
est client et différé. Les polices sont locales, les sons désactivés, la locale
française et le séparateur décimal virgule. Les menus de calcul sont retirés.
Le mode `smartFence` est désactivé pour éviter une fermeture automatique des
bornes d'intervalles.

Le composant ne demande que `getValue('latex')`. Il conserve la sérialisation
MathLive, les placeholders et la ponctuation ; il ne transforme pas les
réponses, ne les évalue pas et ne décide jamais de leur validité. Les mises à
jour contrôlées utilisent les options publiques `format: 'latex'` et
`silenceNotifications: true`, après comparaison, pour préserver le curseur et
éviter une boucle callback/React. Le menu n'est configuré qu'après l'événement
`mount`, exigence vérifiée dans le navigateur. Les listeners sont détachés à la
sortie et la propriété du clavier partagé est suivie entre les champs.

Le clavier propose un onglet scientifique (nombres, opérations, fraction,
puissance, racine, π et infini), un onglet fonctions (ln/log, exponentielle,
trigonométrie, intervalles avec variantes de bornes, ensembles, union et
parenthèses), ainsi que lettres et grec. Six colonnes limitent la densité sur
mobile ; les touches ont une hauteur de 44 px et une largeur adaptée au viewport.
Un mode lecture seule ferme le clavier appartenant au champ. Ce mode est un
contrôle d'interface, pas une autorisation serveur.

Une zone LaTeX reste disponible pendant le chargement ou si le champ visuel
ne peut pas être monté. Le fallback est annoncé comme tel et ne simule pas un
éditeur scientifique fonctionnel.

## Assets et reproduction

`predev` et `prebuild` préparent `public/mathlive/fonts/` et la licence depuis le
package installé. Ces assets générés sont ignorés par Git et copiés dans le
standalone par `postbuild`. Aucun CDN n'est configuré pour les polices du champ.

```powershell
npm.cmd run test
npm.cmd run test:math-input:browser
```

Le second script démarre un banc Vite **sur loopback uniquement**, au port 3138 :
`http://127.0.0.1:3138/tests/browser/math-input.html`. Il utilise le vrai composant
et des fixtures synthétiques. Il n'accède ni à Supabase, ni à des exercices réels,
ni à l'Engine. Il doit être arrêté après les essais. Vite est une dépendance de
test, pas un second backend applicatif.

## Preuves et limites

Sept tests de liaison couvrent conservation du LaTeX, lecture seule/désactivation,
détachement des listeners et mise à jour sans boucle. Ils emploient un double du
port DOM et ne prouvent pas le renderer à eux seuls.

Le vrai navigateur Brave/Chromium a fourni les observations de
`tests/fixtures/mathlive-observed.json` : douze presets (fraction, puissance,
racine, logarithme, exponentielle, trigonométrie, infini, intervalle français,
ensemble, équation, décimal et saisie incomplète), frappe `1,25` émise comme
`1{,}25`, fraction saisie via une touche virtuelle puis frappe `1`, Tab, `2`,
émise comme `\frac12`. Le callback React reçoit exactement la sortie du champ.
Le contrôle `document.fonts` du banc confirme vingt FontFace KaTeX en état
`loaded`. Le répertoire est configuré comme URL absolue de la même origine,
pour éviter une résolution relative au module MathLive.
Les mises à jour programmatiques n'ajoutent pas d'événement input ; la tentative
de frappe `x` en lecture seule ne change ni la sortie ni le compteur. Un
viewport 390 × 844 est inspecté sans débordement horizontal.

Ces résultats prouvent une saisie locale sur ce navigateur. Ils ne certifient
ni tous les appareils, ni la correction des expressions, ni le Creator complet,
ni l'isolation du moteur. L'admission finale et les diagnostics doivent provenir
du package Engine officiel côté serveur. La certification Windows reste non
qualifiée ; aucune intégration pilote ou mise en Production n'est autorisée
par ce composant.
Le composant n'est pas encore relié à un écran Creator ou de test d'exercices :
le banc Vite vérifie son renderer client, pas son intégration dans un parcours
Next complet. Cette réception sera faite lors du lot fonctionnel concerné.

Sources techniques consultées : [React MathLive](https://mathlive.io/mathfield/guides/react/),
[clavier virtuel](https://mathlive.io/mathfield/guides/virtual-keyboard/) et les
déclarations/API réelles du package 0.111.1 ; la preuve antérieure de formats
reste dans `Novlearn-Engine/docs/mathlive-compatibility.md` (lecture seule).
