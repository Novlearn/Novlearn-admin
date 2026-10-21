import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalRecoveryNotice } from '@/components/local-recovery-notice';

it('annonce la date réelle de la copie locale et les données manquantes', () => {
  const html = renderToStaticMarkup(
    createElement(LocalRecoveryNotice, { local: true, date: '2026-10-17' }),
  );
  expect(html).toContain('17 octobre 2026');
  expect(html).toContain('données d’essai plus récentes manquent');
  expect(html).toContain('role="status"');
  expect(html).not.toMatch(/\.local|password|token|Docker|Supabase/);
});

it('ne diffuse aucune annonce de copie locale dans un mode opérationnel', () => {
  expect(
    renderToStaticMarkup(
      createElement(LocalRecoveryNotice, { local: false, date: '2026-10-17' }),
    ),
  ).toBe('');
});

it.each([undefined, '', '2026-02-31', '2026-13-10', '<script>secret</script>'])(
  'ne prétend pas une restauration pour une date invalide %s',
  (date) => {
    expect(
      renderToStaticMarkup(
        createElement(LocalRecoveryNotice, { local: true, date }),
      ),
    ).toBe('');
  },
);
