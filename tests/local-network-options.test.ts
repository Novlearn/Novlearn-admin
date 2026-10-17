import { expect, it } from 'vitest';
import { localNetworkOptions } from '../scripts/local-network-options';

it('keeps Docker automatic allocation unless both private subnets are explicit', () => {
  expect(localNetworkOptions([])).toEqual({});
  expect(
    localNetworkOptions([
      '--backend-subnet',
      '10.241.240.0/28',
      '--gateway-subnet',
      '10.241.240.16/28',
    ]),
  ).toEqual({ backend: '10.241.240.0/28', gateway: '10.241.240.16/28' });
});
it.each([
  ['--backend-subnet', '10.241.240.0/28'],
  ['--gateway-subnet', '10.241.240.16/28'],
  [
    '--backend-subnet',
    '10.241.240.0/28',
    '--gateway-subnet',
    '10.241.240.0/28',
  ],
  ['--backend-subnet', '8.8.8.0/28', '--gateway-subnet', '10.241.240.16/28'],
  [
    '--backend-subnet',
    '10.241.240.1/28',
    '--gateway-subnet',
    '10.241.240.16/28',
  ],
  [
    '--backend-subnet',
    '10.241.240.0/16',
    '--gateway-subnet',
    '10.241.240.16/28',
  ],
  [
    '--backend-subnet',
    '10.241.256.0/28',
    '--gateway-subnet',
    '10.241.240.16/28',
  ],
  [
    '--backend-subnet',
    '10.241.024.0/28',
    '--gateway-subnet',
    '10.241.240.16/28',
  ],
  ['--unknown'],
  ['unexpected-positional'],
])(
  'refuses incomplete, overlapping, public or malformed subnets: %j',
  (...args) => {
    expect(() => localNetworkOptions(args)).toThrow();
  },
);
