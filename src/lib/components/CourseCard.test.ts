import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import CourseCard from './CourseCard.svelte';
import type { CatalogCourse } from '$lib/public/adapters';

/* CourseCard — level badge tone (FE#17 複審後補完). public/adapters.ts 改走
 * $lib/domain/course-level 的 5 級共用常數後，foundation/elite 兩個新標籤
 * 「啟蒙」「選手」原本會在這裡的 levelTones 找不到對應 key、silently 落回
 * 'primary' —— 這裡驗證兩者拿到專屬 tone，且既有 3 級（入門/基礎/進階）標籤
 * 仍正常渲染。 */
function makeCourse(overrides: Partial<CatalogCourse> = {}): CatalogCourse {
	return {
		id: 'course-uuid-1',
		name: '測試課程',
		level: '入門',
		cat: '幼兒體操',
		age: '3–6 歲',
		days: '週六 10:00',
		price: 2800,
		hot: false,
		coach: '',
		desc: '描述',
		spots: 3,
		...overrides
	};
}

describe('CourseCard — 5 級課程分級 badge tone', () => {
	it('renders 啟蒙 (foundation) with its own info tone — no silent fallback to primary', () => {
		const { getByText } = render(CourseCard, { course: makeCourse({ level: '啟蒙' }) });
		expect(getByText('啟蒙').className).toContain('info');
	});

	it('renders 選手 (elite) with its own accent tone — no silent fallback to primary', () => {
		const { getByText } = render(CourseCard, { course: makeCourse({ level: '選手' }) });
		expect(getByText('選手').className).toContain('accent');
	});

	it('still renders the existing 3 levels (入門/基礎/進階) labels unchanged', () => {
		for (const level of ['入門', '基礎', '進階']) {
			const { getByText } = render(CourseCard, { course: makeCourse({ level }) });
			expect(getByText(level)).toBeInTheDocument();
		}
	});
});
