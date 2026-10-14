// Visual harness bridge only; actual Next routing is covered by the standalone smoke.
import React from 'react';
export default function Link(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  return <a {...props} />;
}
