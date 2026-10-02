import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import ClassForm from './ClassForm.svelte';
import { COACHES } from '$lib/testing/seed-fixtures';
import { COURSE_NAME_ERROR, COURSE_CAP_ERROR } from '$lib/admin/components/course-request';

/* R13 Task 4(C2)：ClassForm 與桌面 ClassEditDialog 共用 course-request.ts 的
 * draft/check。驗證規則的逐欄測試住 course-request.test.ts，這裡只驗接線：
 * onCreate/onUpdate(ValidCourse)（回 true 才關閉）、送出時驗證並顯示 module 常數（不 disable）、
 * 拿掉的輸入不再出現。
 * (取代舊的「新增時 ClassRow 形狀完整」回歸——表單不再送出 ClassRow。) */
const K = { id: 'k1', name: '既有班', level: '基礎' as const, cat: '兒童基礎', coach: COACHES[0].name, day: '', time: '', enrolled: 0, cap: 10, age: '', price: 3200, status: '招生中' as const, wait: 0, durationMinutes: 60 };

describe('ClassForm', () => {
	it('新增：填名稱後建立 → onCreate(ValidCourse)，教練解成清單內的 id，resolve true 後關閉', async () => {
		const onCreate = vi.fn().mockResolvedValue(true);
		const onClose = vi.fn();
		render(ClassForm, { props: { onClose, onCreate, coaches: COACHES } });

		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '  測試班  ' } });
		await fireEvent.click(screen.getByText(/建立班級/).closest('button')!);

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onCreate.mock.calls[0][0]).toMatchObject({ name: '測試班', coachId: COACHES[0].id, durationMinutes: 90 });
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it('新增：onCreate resolve false → 留著不關閉', async () => {
		const onCreate = vi.fn().mockResolvedValue(false);
		const onClose = vi.fn();
		render(ClassForm, { props: { onClose, onCreate, coaches: COACHES } });
		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '測試班' } });
		await fireEvent.click(screen.getByText(/建立班級/).closest('button')!);

		await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
		await Promise.resolve();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('存檔中按鈕停用，結束後恢復', async () => {
		let resolve!: (v: boolean) => void;
		const onCreate = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
		render(ClassForm, { props: { onClose: () => {}, onCreate, coaches: COACHES } });
		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '測試班' } });
		await fireEvent.click(screen.getByText(/建立班級/).closest('button')!);

		await waitFor(() => expect(screen.getByText(/建立班級/).closest('button')).toBeDisabled());
		resolve(false);
		await waitFor(() => expect(screen.getByText(/建立班級/).closest('button')).not.toBeDisabled());
	});

	it('編輯：驗證不過時送出顯示 module 常數且不呼叫 onUpdate；修正後呼叫', async () => {
		const onUpdate = vi.fn().mockResolvedValue(true);
		render(ClassForm, { props: { onClose: () => {}, onUpdate, coaches: COACHES, k: K } });
		const btn = () => screen.getByText(/儲存課程/).closest('button')!;

		await fireEvent.input(screen.getByLabelText('人數上限'), { target: { value: '0' } });
		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '  ' } });
		expect(btn()).not.toBeDisabled();
		await fireEvent.click(btn());

		expect(screen.getByText(COURSE_CAP_ERROR)).toBeInTheDocument();
		expect(screen.getByText(COURSE_NAME_ERROR)).toBeInTheDocument();
		expect(onUpdate).not.toHaveBeenCalled();

		await fireEvent.input(screen.getByLabelText('人數上限'), { target: { value: '10' } });
		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '改名班' } });
		await fireEvent.click(btn());
		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(onUpdate.mock.calls[0][0]).toMatchObject({ name: '改名班' });
	});

	it('不再有 教室 / 場地 與 招生狀態 輸入(D2)', () => {
		render(ClassForm, { props: { onClose: () => {}, coaches: COACHES } });
		expect(screen.queryByLabelText('教室 / 場地')).toBeNull();
		expect(screen.queryByLabelText('招生狀態')).toBeNull();
	});
});
