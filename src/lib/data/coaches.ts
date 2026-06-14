/* Dream Fly — single source of truth for the coaching roster.
 *
 * Consumed by both the homepage Coaches section and the /coaches list page so
 * the roster never drifts between surfaces. Four coaches, one per core
 * discipline (王 also covers 跑酷): 王=競技體操/總教練, 李=競技啦啦隊,
 * 張=成人體操, 陳=幼兒體操.
 *
 * `featuredCoaches` (those with a `photo`) drive the homepage's 3-card teaser;
 * the full list renders every coach with an initial-letter avatar fallback.
 *
 * NOTE: import and use — do not mutate this file from feature work. Missing a
 * field? Add it here in a dedicated change, not inside a section component.
 */

export interface Coach {
  id: number;
  /** route slug → /coaches/{slug} */
  slug: string;
  name: string;
  /** full role line, e.g. used by the list-page CoachCard */
  title: string;
  /** core discipline label */
  discipline: string;
  /** years of experience, formatted for a badge ("15 年") */
  years: string;
  /** two short specialty tags for the homepage card */
  tags: string[];
  /** detailed specialties (list-page CoachCard) */
  specialties: string[];
  /** experience paragraph (list-page CoachCard) */
  experience: string;
  /** certifications (list-page CoachCard) */
  certifications: string[];
  /** portrait for the homepage teaser; coaches without one are not featured */
  photo?: string;
}

export const coaches: Coach[] = [
  {
    id: 1,
    slug: 'wang',
    name: '王教練',
    title: '總教練 / 體操技術指導',
    discipline: '競技體操',
    years: '15 年',
    tags: ['競技體操', '跑酷指導'],
    specialties: ['競技體操訓練', '幼兒體操教學', '跑酷指導'],
    experience: '15年體操教學經驗，曾為國家體操代表隊選手，專精於基礎動作訓練與進階技巧指導',
    certifications: ['體操A級教練證', '兒童體適能指導員', 'Parkour國際教練認證'],
    photo: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=480&q=70'
  },
  {
    id: 2,
    slug: 'li',
    name: '李教練',
    title: '競技啦啦隊總監',
    discipline: '競技啦啦隊',
    years: '10 年',
    tags: ['競技啦啦隊', '特技編排'],
    specialties: ['競技啦啦隊編排', '特技動作指導', '舞蹈律動'],
    experience: '10年啦啦隊教學經驗，曾多次帶領隊伍獲得全國賽冠軍，擅長團隊訓練與比賽策略',
    certifications: ['競技啦啦隊教練證', '特技安全指導員', '舞蹈編排專業認證'],
    photo: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=480&q=70'
  },
  {
    id: 3,
    slug: 'zhang',
    name: '張教練',
    title: '成人體操指導員',
    discipline: '成人體操',
    years: '8 年',
    tags: ['成人體適能', '零基礎友善'],
    specialties: ['成人體適能', '柔軟度訓練', '跳床基礎'],
    experience: '8年成人體操教學經驗，特別擅長零基礎學員教學，耐心引導學員突破心理障礙',
    certifications: ['體操B級教練證', '成人體適能指導員', '運動傷害防護員']
  },
  {
    id: 4,
    slug: 'chen',
    name: '陳教練',
    title: '幼兒體操專任教練',
    discipline: '幼兒體操',
    years: '6 年',
    tags: ['幼兒啟蒙', '感覺統合'],
    specialties: ['幼兒動作發展', '遊戲化教學', '感覺統合訓練'],
    experience: '6年幼兒體操教學經驗，具備幼兒教育背景，深入了解兒童發展階段與學習需求',
    certifications: ['幼兒體操教練證', '幼兒教育學士學位', '感覺統合訓練師認證'],
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=480&q=70'
  }
];

/** Coaches featured on the homepage teaser (those with a portrait photo). */
export const featuredCoaches = coaches.filter((c) => c.photo);
