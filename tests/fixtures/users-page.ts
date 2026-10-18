import { statisticsPeriod } from '@/lib/activity-statistics';
import type { UsersPage } from '@/lib/users';
export const usersQueryFixture = {
  period: statisticsPeriod('2026-10-15', '2026-10-17')!,
  query: '',
  after: null,
  before: null,
};
export const usersPageFixture: UsersPage = {
  schemaVersion: 1,
  environment: 'local-copy',
  asOf: '2026-10-18T12:00:00Z',
  period: { from: '2026-10-15', until: '2026-10-18' },
  query: '',
  cursor: { after: null, before: null },
  pageSize: 25,
  total: '1',
  previous: null,
  next: null,
  items: [
    {
      id: 'a8100000-0000-4000-8000-000000000001',
      name: 'LOCAL ACTIVITY A',
      nameTruncated: false,
      email: 'activity-a@example.test',
      anonymous: false,
      exerciseAttempts: '3',
      duelAttempts: '1',
      lastActivity: '2026-10-17T23:59:59Z',
    },
  ],
};
