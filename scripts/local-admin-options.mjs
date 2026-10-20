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
          '--active-version',
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
    pedagogy = flags.includes('--pedagogy'),
    activeVersion = flags.includes('--active-version');
  if (
    stop &&
    (engine ||
      review ||
      statistics ||
      users ||
      userDetail ||
      pedagogy ||
      activeVersion)
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
    activeVersion,
  };
}

export function localPublicationOptions(args) {
  const [workspace, ...flags] = args;
  if (!workspace || workspace.startsWith('--'))
    throw Error('Local publication workspace required');
  if (
    new Set(flags).size !== flags.length ||
    flags.some((flag) => !['--stop', '--active-version'].includes(flag))
  )
    throw Error('Unknown or duplicate publication option');
  const stop = flags.includes('--stop'),
    activeVersion = flags.includes('--active-version');
  if (stop && activeVersion) throw Error('Stop does not enable local features');
  return { workspace, stop, activeVersion };
}
