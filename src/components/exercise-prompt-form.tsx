'use client';

import { useMemo, useState } from 'react';

type ExerciseContext = {
  title: string;
  difficulty: string;
  status: string;
  skills: string[];
};
type ChapterOption = {
  id: string;
  name: string;
  aliases: string[];
  coverage: {
    total: number;
    byDifficulty: Record<string, number>;
    examples: ExerciseContext[];
    skills: { id: string; count: number }[];
  };
};

const difficultyLabels = ['Facile', 'Moyen', 'Difficile'] as const;

export function ExercisePromptForm({
  chapters,
}: {
  chapters: ChapterOption[];
}) {
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>(
    chapters[0] ? [chapters[0].id] : [],
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    Facile: 2,
    Moyen: 2,
    Difficile: 1,
  });
  const [exerciseTypes, setExerciseTypes] = useState<('classic' | 'flash')[]>([
    'classic',
  ]);
  const [calculatorPolicy, setCalculatorPolicy] = useState<
    'no_preference' | 'forbidden' | 'required'
  >('no_preference');
  const [instructions, setInstructions] = useState('');
  const [notice, setNotice] = useState('');

  const selectedChapters = useMemo(
    () => chapters.filter((item) => selectedChapterIds.includes(item.id)),
    [chapters, selectedChapterIds],
  );
  const skillCounts = useMemo(() => {
    const countsBySkill = new Map<string, number>();
    for (const chapter of selectedChapters)
      for (const skill of chapter.coverage.skills)
        countsBySkill.set(
          skill.id,
          (countsBySkill.get(skill.id) ?? 0) + skill.count,
        );
    return [...countsBySkill.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((left, right) => left.id.localeCompare(right.id, 'fr'));
  }, [selectedChapters]);

  const totalRequested = difficultyLabels.reduce(
    (total, difficulty) => total + (counts[difficulty] ?? 0),
    0,
  );
  const chapterDistribution = selectedChapters.map((chapter, index) => ({
    chapter,
    count:
      Math.floor(totalRequested / selectedChapters.length) +
      (index < totalRequested % selectedChapters.length ? 1 : 0),
  }));
  const chapterAllocationValid =
    selectedChapters.length > 0 && totalRequested >= selectedChapters.length;
  const selectedSkillIds = new Set(skillCounts.map(({ id }) => id));
  const requestedSkills = selectedSkills.filter((skill) =>
    selectedSkillIds.has(skill),
  );
  const formatAllocation =
    exerciseTypes.length === 2
      ? `Classique : ${Math.ceil(totalRequested / 2)} ; Flash : ${Math.floor(totalRequested / 2)}`
      : exerciseTypes.length === 1
        ? `${exerciseTypes[0] === 'classic' ? 'Classique' : 'Flash'} : ${totalRequested}`
        : 'Aucun format imposé : choisis le format adapté pour chaque exercice.';
  const calculatorInstruction = {
    no_preference:
      'Aucune contrainte : choisis si chaque exercice nécessite ou autorise la calculatrice.',
    forbidden:
      'Calculatrice interdite pour tous les exercices ; catalogue.needsCalculator=false.',
    required:
      'La calculatrice est requise pour tous les exercices ; catalogue.needsCalculator=true.',
  }[calculatorPolicy];
  const prompt = useMemo(() => {
    if (!selectedChapters.length) return '';
    const chapterLines = chapterDistribution
      .map(
        ({ chapter, count }) =>
          `- ${chapter.name} : ${count} exercice${count === 1 ? '' : 's'} (id : ${chapter.id})`,
      )
      .join('\n');
    const coverage = chapterDistribution
      .map(
        ({ chapter }) =>
          `### ${chapter.name}\n- Exercices non archivés : ${chapter.coverage.total}\n- Facile : ${chapter.coverage.byDifficulty.Facile ?? 0}\n- Moyen : ${chapter.coverage.byDifficulty.Moyen ?? 0}\n- Difficile : ${chapter.coverage.byDifficulty.Difficile ?? 0}\n- Difficulté inconnue : ${chapter.coverage.byDifficulty.Inconnue ?? 0}`,
      )
      .join('\n\n');
    const examples = chapterDistribution
      .map(({ chapter }) => {
        const entries = [...chapter.coverage.examples]
          .sort(
            (left, right) =>
              right.skills.filter((skill) => requestedSkills.includes(skill))
                .length -
              left.skills.filter((skill) => requestedSkills.includes(skill))
                .length,
          )
          .slice(0, 8)
          .map(
            (item) =>
              `- [${item.difficulty}] ${item.title} — compétences : ${item.skills.join(', ') || 'non renseignées'}`,
          );
        return `### ${chapter.name}\n${entries.length ? entries.join('\n') : '- Aucun exercice existant chargé pour ce chapitre.'}`;
      })
      .join('\n\n');
    const skillIdsByChapter = chapterDistribution
      .map(({ chapter }) => {
        const skills = chapter.coverage.skills
          .filter(({ id }) => requestedSkills.includes(id))
          .map(({ id }) => id);
        return `- ${chapter.name} : ${skills.length ? skills.join(', ') : 'aucune'}`;
      })
      .join('\n');
    return `Tu es un concepteur pédagogique de mathématiques pour des élèves de Terminale.

Objectif
Produis ${totalRequested} modèles d’exercices inédits répartis entre les chapitres sélectionnés. Chaque modèle doit donner des variantes pédagogiquement distinctes à partir de valeurs tirées par Engine à chaque nouvelle instanciation.

Génération aléatoire obligatoire pour chaque exercice
- Définis dans generation.definitions au moins une variable réellement tirée parmi plusieurs valeurs admissibles. Choisis des plages ou des ensembles assez larges et combine plusieurs paramètres indépendants lorsque le sujet s’y prête. Une définition vide, une plage réduite à une seule valeur ou un tirage qui ne change aucune question de l’élève sont à reprendre.
- Fais varier des données qui comptent pour la résolution, par exemple des coefficients, un point de calcul ou les bornes d’un intervalle. Réutilise les mêmes tirages dans les questions, les graphiques, les choix de QCM, les réponses attendues et les explications qui en dépendent. Une réponse peut rester constante si elle est mathématiquement juste pour toutes les variantes.
- Dans le texte à afficher, écris @a pour insérer la valeur tirée de a. Dans les formules évaluées par Engine (expectedLatex, latex d’une variable computed, etc.), utilise \\mathrm{a}. Dans le JSON, échappe la barre oblique inverse en écrivant \\\\mathrm{a}. Une variable computed sert à dériver une valeur à partir des tirages.
- Exemple de mécanique pour une dérivation : tire a avec {"name":"a","kind":"integer","min":-8,"max":12,"exclusions":[0]} et déclare le symbole libre x dans variables avec {"name":"x","domain":"real"}. Affiche la fonction dans un bloc expression, {"id":"formule","type":"expression","label":"Expression de f","latex":"x^{2}+(\\\\mathrm{a})x"}. Pose la question en prose (« Calcule la dérivée de f au point d’abscisse 2. ») et utilise "expectedLatex":"4+\\\\mathrm{a}". Les valeurs tirées de a modifient la fonction et le résultat numérique.
- Choisis les domaines, exclusions et contraintes pour que les tirages conservent les hypothèses du sujet : dénominateurs non nuls, domaines valides, cas dégénérés écartés et choix de QCM distincts. Préfère des plages bien construites à des contraintes qui rejettent presque tous les tirages.

Rendu LaTeX obligatoire
- Écris chaque formule affichée dans un champ latex prévu par Engine. Utilise un bloc expression ou equation, ou un fragment math dans un bloc rich-text. Pour les choix mathématiques d’un QCM, utilise content.format="latex".
- Les champs text sont affichés en texte brut dans le Creator. Garde-y la prose et place les formules dans des blocs mathématiques juste avant la question. Dans les champs latex et expectedLatex, écris le LaTeX brut, sans délimiteurs $ ou $$ ni Markdown. Par exemple, une fraction s’écrit "\\\\frac{1}{x^{2}}" dans le JSON.
- Vérifie dans l’aperçu que les fractions, racines, puissances, indices et limites apparaissent sous leur forme mathématique et que les signes restent lisibles après substitution des valeurs tirées.

Formats demandés
${formatAllocation}
${exerciseTypes.length === 2 ? 'Respecte ces quotas de format aussi exactement que les quotas de difficulté.' : ''}

Répartition demandée
${difficultyLabels.map((difficulty) => `- ${difficulty} : ${counts[difficulty] ?? 0}`).join('\n')}

Répartition par chapitre
${chapterLines}
Respecte exactement cette répartition. Pour chaque exercice, renseigne catalogue.chapter avec le nom du chapitre attribué et catalogue.skills avec les compétences pertinentes de ce chapitre.

Références pédagogiques
- Chapitres canoniques et identifiants Staging :
${chapterDistribution.map(({ chapter }) => `  - ${chapter.name} : ${chapter.id}`).join('\n')}
- Compétences sélectionnées par chapitre :
${skillIdsByChapter}
- Calculatrice : ${calculatorInstruction}
- Difficulté Engine : Facile=1, Moyen=2, Difficile=3.

Couverture actuelle de Staging
${coverage}

Titres et compétences déjà présents à éviter de reproduire
${examples}

Consignes complémentaires
${instructions.trim() || 'Aucune.'}

Contrat technique obligatoire
- Réponds avec un bloc de code \`\`\`json contenant exactement le lot {"schemaVersion":5,"batchId":"<nouvel UUID v4>","items":[{"sourceKey":"item-001","definition":{...}}]}. Garde le même batchId et les mêmes sourceKey lors des reprises. Crée un nouvel UUID uniquement pour un nouveau lot. N'écris aucun fichier local.
- Avant de générer, consulte le contrat installé dans node_modules/novlearn-exercise-engine/README.md, node_modules/novlearn-exercise-engine/dist/contracts/types.d.ts (ExerciseDefinition, GenerationDefinition, éléments, questions et politiques de correction) et node_modules/novlearn-exercise-engine/dist/index.d.ts. Utilise uniquement les types et propriétés définis par ce package ; n'invente aucune propriété.
- Consulte aussi docs/engine/engine-library.md et docs/guides/architecture.md pour comprendre les capacités et limites du moteur ainsi que la relation entre réponses attendues, génération et correction.
- Une définition utilise kind="composed", un id stable tel que "item-001", revision="1", catalogue.chapter égal au chapitre attribué à l'exercice, catalogue.skills contenant uniquement des identifiants connus et pertinents${requestedSkills.length ? ` parmi ${requestedSkills.join(', ')}` : ''}, catalogue.difficulty entier 1, 2 ou 3, catalogue.exerciseType selon les quotas de format ci-dessus, et catalogue.needsCalculator selon la consigne calculatrice ci-dessus.
- Les paramètres de génération, éléments, questions, formats de réponse et politiques de correction doivent suivre les types Engine. Prends examples/engine-consumer/definition.json comme référence de structure pour generation.definitions, generation.constraints, maxAttempts et maxDraws.
- Les identifiants des éléments et questions sont des chaînes stables uniques dans chaque exercice. Les références @nom doivent correspondre à des variables réellement définies.
- Respecte la sémantique mathématique : domaine de définition, hypothèses, contraintes de génération, calcul des attendus et cohérence des explications. N'utilise que les familles de réponses et profils de correction définis par Engine. Ne présente pas le parseur ou validateDefinition comme une preuve générale qu'une proposition mathématique est vraie.
- Si Engine est disponible, instancie chaque modèle avec plusieurs seeds avant de rendre le lot. Vérifie que les données visibles de la question varient et que chaque réponse correspond au tirage. Sinon, vérifie manuellement deux tirages admissibles distincts par modèle. L'import dans Admin exécute validateDefinition et instantiateExercise avec plusieurs seeds. Cette validation technique ne remplace pas la vérification mathématique et pédagogique humaine.
- N'utilise aucun exercice de la liste comme modèle à recopier. Crée des contextes, valeurs et raisonnements distincts. N'inclus aucune donnée personnelle.
- Dans ta réponse, renvoie le lot JSON complet dans un unique bloc de code \`\`\`json, sans créer de fichier local ni ajouter de texte dans ce bloc. L'admin copiera le bloc et le collera dans la page Admin web, puis cliquera sur « Importer les brouillons dans Staging ». Pour corriger un élément refusé, conserve le batchId et les sourceKey afin de reprendre le même lot.`;
  }, [
    chapterDistribution,
    counts,
    exerciseTypes,
    formatAllocation,
    instructions,
    calculatorInstruction,
    requestedSkills,
    selectedChapters,
    totalRequested,
  ]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice('Prompt copié.');
    } catch {
      setNotice(
        'La copie automatique a échoué. Sélectionne le texte du prompt pour le copier.',
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Objectif de génération</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <fieldset className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            <legend>Chapitres</legend>
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
              {chapters.map((option) => (
                <label
                  key={option.id}
                  className="flex items-start gap-2 font-normal"
                >
                  <input
                    type="checkbox"
                    checked={selectedChapterIds.includes(option.id)}
                    onChange={(event) =>
                      setSelectedChapterIds((current) =>
                        event.target.checked
                          ? [...current, option.id]
                          : current.filter((id) => id !== option.id),
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    {option.name}{' '}
                    <span className="text-slate-500">
                      ({option.coverage.total} exercices)
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
            <legend className="px-1 font-medium">Format (facultatif)</legend>
            {(
              [
                ['classic', 'Classique'],
                ['flash', 'Flash'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exerciseTypes.includes(value)}
                  onChange={(event) =>
                    setExerciseTypes((current) =>
                      event.target.checked
                        ? [...current, value]
                        : current.filter((item) => item !== value),
                    )
                  }
                />
                {label}
              </label>
            ))}
            <p className="text-xs text-slate-500">
              Choisis un format, les deux, ou aucun pour laisser le choix libre.
            </p>
          </fieldset>
          <label className="grid content-start gap-2 text-sm font-medium text-slate-700">
            Calculatrice
            <select
              value={calculatorPolicy}
              onChange={(event) =>
                setCalculatorPolicy(
                  event.target.value as
                    | 'no_preference'
                    | 'forbidden'
                    | 'required',
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5"
            >
              <option value="no_preference">Aucune préférence</option>
              <option value="forbidden">Interdite</option>
              <option value="required">Requise</option>
            </select>
            <span className="text-xs font-normal text-slate-500">
              Cette règle s’applique indépendamment du format.
            </span>
          </label>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="py-2 font-medium">Difficulté</th>
                <th className="py-2 font-medium">Déjà présents</th>
                <th className="py-2 font-medium">À générer</th>
              </tr>
            </thead>
            <tbody>
              {difficultyLabels.map((difficulty) => (
                <tr key={difficulty} className="border-b last:border-0">
                  <th className="py-3 font-medium text-slate-800">
                    {difficulty}
                  </th>
                  <td className="py-3 text-slate-600">
                    {selectedChapters.reduce(
                      (sum, chapter) =>
                        sum + (chapter.coverage.byDifficulty[difficulty] ?? 0),
                      0,
                    )}
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={counts[difficulty] ?? 0}
                      onChange={(event) =>
                        setCounts((current) => {
                          const otherCounts = difficultyLabels
                            .filter((item) => item !== difficulty)
                            .reduce(
                              (sum, item) => sum + (current[item] ?? 0),
                              0,
                            );
                          return {
                            ...current,
                            [difficulty]: Math.max(
                              0,
                              Math.min(
                                20 - otherCounts,
                                Number(event.target.value) || 0,
                              ),
                            ),
                          };
                        })
                      }
                      aria-label={`Nombre d’exercices ${difficulty}`}
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Maximum 20 exercices par demande. Les exercices sont répartis aussi
            uniformément que possible entre les chapitres sélectionnés.
          </p>
        </div>

        {!chapterAllocationValid && (
          <p role="alert" className="mt-3 text-sm text-amber-800">
            Sélectionne au moins un chapitre et demande au minimum un exercice
            par chapitre.
          </p>
        )}

        {selectedChapters.length > 0 && skillCounts.length > 0 && (
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-slate-800">
              Compétences observées dans les chapitres sélectionnés
            </legend>
            <p className="mt-1 text-xs text-slate-500">
              Coche celles à cibler parmi les compétences des chapitres
              sélectionnés.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {skillCounts.map(({ id: skill, count }) => (
                <label
                  key={skill}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes(skill)}
                    onChange={(event) =>
                      setSelectedSkills((current) =>
                        event.target.checked
                          ? [...current, skill]
                          : current.filter((item) => item !== skill),
                      )
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0 break-words">
                    {skill} <span className="text-slate-400">({count})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="mt-6 grid gap-2 text-sm font-medium text-slate-700">
          Consignes complémentaires
          <textarea
            value={instructions}
            onChange={(event) =>
              setInstructions(event.target.value.slice(0, 2000))
            }
            maxLength={2000}
            rows={4}
            placeholder="Ex. varier les contextes, privilégier les questions en plusieurs étapes…"
            className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Prompt prêt à envoyer</h2>
            <p className="mt-1 text-sm text-slate-600">
              La sélection demande {totalRequested} exercice
              {totalRequested === 1 ? '' : 's'}.
            </p>
          </div>
          <button
            type="button"
            onClick={copyPrompt}
            disabled={!chapterAllocationValid || totalRequested < 1}
            className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copier le prompt
          </button>
        </div>
        {notice && (
          <p role="status" className="mt-3 text-sm text-blue-900">
            {notice}
          </p>
        )}
        <pre className="mt-5 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-700">
          {prompt}
        </pre>
      </section>
    </div>
  );
}
