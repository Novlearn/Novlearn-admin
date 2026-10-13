# Consignes pour les agents

Avant tout développement fonctionnel, lire `CDC_reference.md` et le document pertinent de `docs/`. Respecter le périmètre et l'état de la [roadmap](docs/roadmap.md) ; ne pas commencer automatiquement un lot suivant.

- Ne jamais modifier NovLearn, l'Exercise Engine, l'ancien Creator ou une base Supabase depuis ce dépôt sans autorisation explicite.
- Préserver la séparation Staging / Production. Ne jamais écrire directement en Production hors du mécanisme de publication approuvé.
- Vérifier les permissions côté serveur pour chaque opération protégée ; ne jamais exposer de secrets ou de clé privilégiée via `NEXT_PUBLIC_*`.
- Ne pas créer de logique mathématique concurrente à l'Exercise Engine. Utiliser le format canonique des exercices ; isoler toute adaptation historique justifiée hors du cœur.
- Écrire des tests pertinents pour les fonctionnalités et leurs permissions. Documenter les décisions et modifications importantes.
- Garder une architecture simple : ne pas ajouter de couches, dossiers ou dépendances sans besoin réel.
- Ne pas introduire de compatibilité historique inutile dans le cœur.
- Ne jamais modifier silencieusement `CDC_reference.md`. Une évolution fonctionnelle requiert une décision explicite et traçable.
