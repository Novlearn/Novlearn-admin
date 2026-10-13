import Image from 'next/image';

/** The original SVGs are preserved; UI variants only adjust their artboard. */
export function Brand({ signature = false }: { signature?: boolean }) {
  if (signature) {
    return (
      <Image
        src="/logo/novlearn-principal-ui.svg"
        alt="NovLearn"
        width={132}
        height={140}
        priority
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/logo/novlearn-logo-ui.svg" alt="" width={28} height={32} />
      <span className="font-brand text-xl font-medium tracking-tight text-slate-900">
        NovLearn
      </span>
      <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
        Admin
      </span>
    </span>
  );
}
