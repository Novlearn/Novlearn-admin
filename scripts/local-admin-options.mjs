// Pure CLI policy. It never reads credentials or enables operational services.
export function localAdminOptions(args) {
  const [workspace, ...flags] = args;
  if (!workspace || workspace.startsWith('--'))
    throw Error('Local workspace path required');
  if (
    new Set(flags).size !== flags.length ||
    flags.some(
      (flag) =>
        !['--stop', '--engine', '--review', '--statistics', '--users'].includes(
          flag,
        ),
    )
  )
    throw Error('Unknown or duplicate local option');
  const stop = flags.includes('--stop'),
    engine = flags.includes('--engine'),
    review = flags.includes('--review'),
    statistics = flags.includes('--statistics'),
    users = flags.includes('--users');
  if (stop && (engine || review || statistics || users))
    throw Error('Stop does not enable local features');
  if (review && !engine)
    throw Error(
      'Local review requires the qualified Engine and signed reports',
    );
  return { workspace, stop, engine, review, statistics, users };
}
