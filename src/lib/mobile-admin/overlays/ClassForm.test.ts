import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ClassForm from './ClassForm.svelte';
import { COACHES } from '$lib/testing/seed-fixtures';

/* R13 Task 4(C2)：ClassForm 與桌面 ClassEditDialog 共用 course-request.ts 的
 * draft/check。驗證規則的逐欄測試住 course-request.test.ts，這裡只驗接線：
 * onSave(ValidCourse, isNew)、主按鈕 disabled 依驗證結果、拿掉的輸入不再出現。
 * (取代舊的「新增時 ClassRow 形狀完整」回歸——表單不再送出 ClassRow。) */
describe('ClassForm', () => {
	it('新增：填名稱後建立 → onSave(ValidCourse, true)，教練解成清單內的 id', async () => {
		const onSave = vi.fn();
		render(ClassForm, { props: { onClose: () => {}, onSave, coaches: COACHES } });

		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '  測試班  ' } });
		await fireEvent.click(screen.getByText(/建立班級/).closest('button')!);

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toMatchObject({ name: '測試班', coachId: COACHES[0].id, durationMinutes: 90 });
		expect(onSave.mock.calls[0][1]).toBe(true);
	});

	it('驗證不過(名稱空白 / 人數 0)時主按鈕 disabled', async () => {
		const k = { id: 'k1', name: '既有班', level: '基礎' as const, cat: '兒童基礎', coach: COACHES[0].name, day: '', time: '', enrolled: 0, cap: 10, age: '', price: 3200, status: '招生中' as const, wait: 0, durationMinutes: 60 };
		render(ClassForm, { props: { onClose: () => {}, onSave: vi.fn(), coaches: COACHES, k } });
		const btn = () => screen.getByText(/儲存課程/).closest('button')!;

		expect(btn()).not.toBeDisabled();
		await fireEvent.input(screen.getByLabelText('人數上限'), { target: { value: '0' } });
		expect(btn()).toBeDisabled();
		await fireEvent.input(screen.getByLabelText('人數上限'), { target: { value: '10' } });
		await fireEvent.input(screen.getByLabelText('班級名稱'), { target: { value: '  ' } });
		expect(btn()).toBeDisabled();
	});

	it('不再有 教室 / 場地 與 招生狀態 輸入(D2)', () => {
		render(ClassForm, { props: { onClose: () => {}, coaches: COACHES } });
		expect(screen.queryByLabelText('教室 / 場地')).toBeNull();
		expect(screen.queryByLabelText('招生狀態')).toBeNull();
	});
});
