// Pure CLI policy. It never reads credentials or enables operational services.
export function localAdminOptions(args) {
  const [workspace, ...flags] = args;
  if (!workspace || workspace.startsWith('--'))
    throw Error('Local workspace path required');
  if (
    new Set(flags).size !== flags.length ||
    flags.some(
      (flag) =>
        ![
          '--stop',
          '--engine',
          '--review',
          '--statistics',
          '--users',
          '--user-detail',
          '--pedagogy',
        ].includes(flag),
    )
  )
    throw Error('Unknown or duplicate local option');
  const stop = flags.includes('--stop'),
    engine = flags.includes('--engine'),
    review = flags.includes('--review'),
    statistics = flags.includes('--statistics'),
    users = flags.includes('--users'),
    userDetail = flags.includes('--user-detail'),
    pedagogy = flags.includes('--pedagogy');
  if (
    stop &&
    (engine || review || statistics || users || userDetail || pedagogy)
  )
    throw Error('Stop does not enable local features');
  if (review && !engine)
    throw Error(
      'Local review requires the qualified Engine and signed reports',
    );
  if (userDetail && !users)
    throw Error('Local user detail requires the explicit users capability');
  if (pedagogy && !statistics)
    throw Error('Local pedagogy requires the explicit statistics capability');
  return {
    workspace,
    stop,
    engine,
    review,
    statistics,
    users,
    userDetail,
    pedagogy,
  };
}
