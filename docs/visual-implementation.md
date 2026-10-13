# Application de l'identité visuelle

La demande du 13 octobre 2026 désigne [system-design.md](system-design.md) comme
référence de style et fournit les SVG dans `public/logo/`. Elle autorise
l'utilisation de ces éléments dans Admin ; elle ne valide pas les autres
arbitrages fonctionnels ou le déploiement. Le document et les SVG originaux
restent intacts.

Inter variable est hébergée localement via `next/font/local` pour le corps,
les titres administratifs, formulaires, navigation et tableaux futurs. Fredoka
variable porte le nom de marque et le titre pédagogique de la connexion.
Les sources latines WOFF2 proviennent de `@fontsource-variable/inter@5.3.0` et
`@fontsource-variable/fredoka@5.3.0`, verrouillés dans le lockfile, sous licence
SIL OFL conservée dans les packages. Aucun appel Google Fonts dans le navigateur
ou téléchargement de police pendant le build.

Les tokens reproduisent le bleu primaire `#2563EB`, indigo `#6366F1`, violet
`#A855F7`, vert `#16A34A`, rouge `#EF4444` et ambre `#F59E0B` du document. L'Admin
reste clair (`#F8FAFC`, surfaces blanches, texte `#0F172A`, secondaire `#64748B`,
bordures `#E2E8F0`). La zone de marque de la connexion utilise `#F0F7FF`. Les
couleurs de statut fortes sont utilisées avec des surfaces pâles et du texte
sombre pour conserver la lisibilité ; le bouton actif utilise le bleu primaire.

Les SVG fournis ont une zone A4 `0 0 210 297` qui laisse beaucoup de vide autour
du dessin. Les variantes `novlearn-principal-ui.svg` et `novlearn-logo-ui.svg`
conservent tous leurs tracés/couleurs et ajustent seulement width, height et
viewBox selon les contours mesurés dans le navigateur, avec un padding de 1
unité de chaque côté. Les originaux ne sont pas rasterisés ni remplacés.

La signature complète apparaît sur desktop à la connexion. Le symbole sans
texte sert aux emplacements compacts, accompagné du nom en Fredoka et du badge
Admin. Sur mobile, la zone de marque se réduit pour laisser le formulaire
visible rapidement. Les images utilisent des dimensions fixes ; le nom de
marque possède une alternative accessible et le symbole accompagné de texte
est décoratif.

Empreintes SHA-256 des fichiers utilisateur préservés :

- `system-design.md` : `59e40e03702a673632213c354268b11334836fe4b46a1c69a1d7be127d84b2d9`.
- `novlearn-principal.svg` : `ea4be84645023f82c20aebacf4bfedf2feee927be491f343304d7e284027a4e2`.
- `novlearn-logo.svg` : `934f6ef734c9a8394b9c7b5c450c66cc947554aac474500f306ff27574c80083`.

Les SVG Inkscape et le document fourni sont exclus de Prettier afin de préserver
leurs octets ; les composants et la documentation d'implémentation restent
formatés. Le smoke du standalone contrôle les réponses CSS, fonts et logos.
Le rendu réel est vérifié sur desktop et sur viewport 390 × 844 : Inter
effective, logo compact, formulaire désactivé, largeur 375 px avec scrollbar
et aucun débordement horizontal. La zone de marque mobile prend environ 115 px.
