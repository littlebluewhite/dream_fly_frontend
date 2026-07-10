import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createReadState, unreadCount } from './read-state';

interface Item {
	id?: string;
	read: boolean;
	title: string;
}

describe('createReadState — seed clone', () => {
	it('does not share references with the external seed array (a push after creation does not affect the store)', () => {
		const seed: Item[] = [{ id: '1', read: false, title: 'a' }];
		const store = createReadState(seed);
		seed.push({ id: '2', read: false, title: 'b' });
		const list = get(store);
		expect(list).toHaveLength(1);
		expect(list[0].title).toBe('a');
	});

	it('markRead never mutates the original seed objects in place', () => {
		const original: Item = { id: '1', read: false, title: 'a' };
		const seed: Item[] = [original];
		const store = createReadState(seed);
		store.markRead('1');
		expect(original.read).toBe(false); // 原物件未被改動
		expect(get(store)[0].read).toBe(true); // store 內部已翻面
	});
});

describe('createReadState — markRead', () => {
	it('flips only the matching item to a new object reference; other items keep their reference', () => {
		const seed: Item[] = [
			{ id: '1', read: false, title: 'a' },
			{ id: '2', read: false, title: 'b' }
		];
		const store = createReadState(seed);
		const before = get(store);
		store.markRead('1');
		const after = get(store);
		expect(after[0]).toEqual({ id: '1', read: true, title: 'a' });
		expect(after[0]).not.toBe(before[0]); // 命中項:新物件參考
		expect(after[1]).toBe(before[1]); // 未命中項:參考不變
	});

	it('an unknown id is a no-op (value deep-equals the previous state)', () => {
		const seed: Item[] = [
			{ id: '1', read: false, title: 'a' },
			{ id: '2', read: false, title: 'b' }
		];
		const store = createReadState(seed);
		const before = get(store);
		store.markRead('does-not-exist');
		expect(get(store)).toEqual(before);
	});

	it('items without an id field can never be targeted (mobile-admin AdminNotif shape)', () => {
		const seed: { read: boolean; title: string }[] = [
			{ read: false, title: 'x' },
			{ read: false, title: 'y' }
		];
		const store = createReadState(seed);
		store.markRead('x'); // 就算字面剛好等於某欄位值,item.id 仍是 undefined,不會命中
		expect(get(store)).toEqual(seed);
	});
});

describe('createReadState — markAllRead', () => {
	it('flips every item to read:true, immutably (new array + new objects; originals untouched)', () => {
		const seed: Item[] = [
			{ id: '1', read: false, title: 'a' },
			{ id: '2', read: true, title: 'b' }
		];
		const store = createReadState(seed);
		const before = get(store);
		store.markAllRead();
		const after = get(store);
		expect(after.every((item) => item.read)).toBe(true);
		expect(after).not.toBe(before);
		after.forEach((item, i) => expect(item).not.toBe(before[i]));
		expect(seed[0].read).toBe(false); // 原始 seed 物件未被改動
	});
});

describe('createReadState — set', () => {
	it('overwrites the whole list (hydration seam)', () => {
		const store = createReadState<Item>([{ id: '1', read: false, title: 'a' }]);
		const next: Item[] = [
			{ id: '9', read: false, title: 'z' },
			{ id: '10', read: true, title: 'y' }
		];
		store.set(next);
		expect(get(store)).toEqual(next);
	});
});

describe('unreadCount', () => {
	it('counts items with read:false in a mixed list', () => {
		expect(unreadCount([{ read: false }, { read: true }, { read: false }])).toBe(2);
	});

	it('returns 0 when everything is read', () => {
		expect(unreadCount([{ read: true }, { read: true }])).toBe(0);
	});
});
