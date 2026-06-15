import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Topbar from './Topbar.svelte';

afterEach(cleanup);

/* Topbar reads only the admin stores (no $page), so it renders standalone.
 * Assert the two props that the layout feeds it surface as text. */
describe('admin Topbar', () => {
  it('renders the title and sub it is given', () => {
    render(Topbar, { props: { title: '學員管理', sub: '報名與出席' } });
    expect(screen.getByRole('heading', { name: '學員管理' })).toBeInTheDocument();
    expect(screen.getByText('報名與出席')).toBeInTheDocument();
  });

  it('shows the 系統管理員 badge and a link across to the 會員中心', () => {
    render(Topbar, { props: { title: '營運總覽', sub: '全館即時概況' } });
    expect(screen.getByText('系統管理員')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /會員中心/ });
    expect(link).toHaveAttribute('href', '/member');
  });
});
