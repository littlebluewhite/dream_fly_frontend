import { describe, it, expect } from 'vitest';
import {
	COACHES,
	VENUES,
	TICKETS
} from './data';

describe('dataset counts (guard against transcription truncation)', () => {
	it('has the expected record counts', () => {
		expect(COACHES).toHaveLength(9);
		expect(VENUES).toHaveLength(6);
		expect(TICKETS).toHaveLength(6);
	});
});
