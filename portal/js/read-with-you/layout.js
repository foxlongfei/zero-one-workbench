// Layout factory: keeps the reader shell free of layout details.
import { ScrolledLayout } from './layout-scrolled.js';
import { PagedLayout } from './layout-paged.js';

export function createLayout(kind, root) {
  return kind === 'paged' ? new PagedLayout({ root }) : new ScrolledLayout({ root });
}
