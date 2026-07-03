/* 行動管理端 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { PROFILES, COACHES, VENUES, TICKETS, type Profile, type Coach, type Venue, type Ticket } from './data';

const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

export interface MoreData {
	profiles: Record<'admin' | 'coach', Profile>;
	coaches: Coach[];
	venues: Venue[];
	tickets: Ticket[];
}
export const getMore = (): Promise<MoreData> =>
	reply({ profiles: PROFILES, coaches: COACHES, venues: VENUES, tickets: TICKETS });
