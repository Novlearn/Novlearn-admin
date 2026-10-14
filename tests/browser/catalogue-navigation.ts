// Only used by the isolated Vite harness, never by Next.js or production routes.
export function useRouter() {
  return { push() {}, refresh() {} };
}
