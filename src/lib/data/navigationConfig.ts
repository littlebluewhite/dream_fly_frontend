import type { IconName } from '$lib/icon-registry';

export interface NavItem {
  label: string;
  href?: string;
  icon?: IconName;
  hasDropdown?: boolean;
  categories?: NavCategory[];
}

export interface NavCategory {
  title: string;
  icon: IconName;
  items: NavLink[];
}

export interface NavLink {
  label: string;
  href: string;
}

export const navigationConfig: NavItem[] = [
  {
    label: '首頁',
    href: '/'
  },
  {
    label: '場館介紹',
    hasDropdown: true,
    categories: [
      {
        title: '訓練設施',
        icon: 'activity',
        items: [
          { label: '大跳床', href: '/venues/training/trampoline-large' },
          { label: '小跳床', href: '/venues/training/trampoline-small' },
          { label: '長跳床', href: '/venues/training/trampoline-tumbling' },
          { label: '體操墊', href: '/venues/training/mat-gymnastics' },
          { label: '組合墊', href: '/venues/training/mat-combination' }
        ]
      },
      {
        title: '安全設施',
        icon: 'shield-check',
        items: [
          { label: '氣墊', href: '/venues/safety/air-cushion' },
          { label: '海綿池', href: '/venues/safety/foam-pit' }
        ]
      },
      {
        title: '輔助訓練',
        icon: 'dumbbell',
        items: [
          { label: '小型健身房', href: '/venues/supporting/gym' },
          { label: '攀岩場', href: '/venues/supporting/climbing' },
          { label: '韻律教室', href: '/venues/supporting/rhythm-room' }
        ]
      },
      {
        title: '配套設施',
        icon: 'house',
        items: [
          { label: '休息區', href: '/venues/amenities/lounge' },
          { label: '小教室', href: '/venues/amenities/classroom' }
        ]
      }
    ]
  },
  {
    label: '教練介紹',
    hasDropdown: true,
    categories: [
      {
        title: '專業教練團隊',
        icon: 'graduation-cap',
        items: [
          { label: '王教練', href: '/coaches/wang' },
          { label: '李教練', href: '/coaches/li' },
          { label: '張教練', href: '/coaches/zhang' },
          { label: '陳教練', href: '/coaches/chen' }
        ]
      }
    ]
  },
  {
    label: '課程介紹',
    hasDropdown: true,
    categories: [
      {
        title: '四大核心課程',
        icon: 'target',
        items: [
          { label: '幼兒體操', href: '/courses/children' },
          { label: '競技啦啦隊', href: '/courses/cheerleading' },
          { label: '成人體操', href: '/courses/adult' },
          { label: '跑酷', href: '/courses/parkour' }
        ]
      }
    ]
  },
  {
    label: '日程表',
    href: '/schedule'
  },
  {
    label: '購票資訊',
    href: '/tickets'
  },
  {
    label: '聯絡資訊',
    href: '/contact'
  }
];
