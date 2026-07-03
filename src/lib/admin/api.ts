/* 管理後台 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { TICKETS, CLASSES, COACHES, VENUES, ORDERS, REPORT_KPIS } from './data';
import type { Ticket, ClassRow, Coach, Venue, Order, ReportKpi } from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 教練清單單一內部存取點;未來 fetch 只改此處。 */
const coaches = (): Coach[] => COACHES;

export interface VenuesData { venues: Venue[] }
export const getVenues = (): Promise<VenuesData> => reply({ venues: VENUES });

export interface TicketsData { tickets: Ticket[] }
export const getTickets = (): Promise<TicketsData> => reply({ tickets: TICKETS });

export interface OrdersData { orders: Order[] }
export const getOrders = (): Promise<OrdersData> => reply({ orders: ORDERS });

export interface ReportsData { kpis: ReportKpi[] }
export const getReports = (): Promise<ReportsData> => reply({ kpis: REPORT_KPIS });

export interface ClassesData { classes: ClassRow[]; coaches: Coach[] }
export const getClasses = (): Promise<ClassesData> => reply({ classes: CLASSES, coaches: coaches() });

export interface CoachesData { coaches: Coach[] }
export const getCoaches = (): Promise<CoachesData> => reply({ coaches: coaches() });
