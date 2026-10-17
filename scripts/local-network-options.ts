import { parseArgs } from 'node:util';

/** Optional operator-selected private /28 networks for a new local fixture. */
export function localNetworkOptions(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      'backend-subnet': { type: 'string' },
      'gateway-subnet': { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });
  const backend = values['backend-subnet'],
    gateway = values['gateway-subnet'];
  if (backend === undefined && gateway === undefined) return {};
  const valid = (subnet: unknown) => {
    if (typeof subnet !== 'string' || !subnet.endsWith('/28')) return false;
    const parts = subnet.slice(0, -3).split('.');
    if (
      parts.length !== 4 ||
      parts.some(
        (part) => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255,
      )
    )
      return false;
    const [a, b, , d] = parts.map(Number);
    return (
      d % 16 === 0 &&
      (a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168))
    );
  };
  if (!valid(backend) || !valid(gateway) || backend === gateway)
    throw Error(
      'Choose two distinct canonical private IPv4 /28 subnets; Docker must also accept them as unoccupied',
    );
  return { backend, gateway };
}
