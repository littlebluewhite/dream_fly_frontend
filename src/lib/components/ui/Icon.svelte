<script lang="ts">
  /*
   * Central Lucide icon registry (Dream Fly).
   *
   * Data-driven icons reference a kebab-case string name (navigationConfig
   * categories, homepage course/why cards, etc.) and resolve through this map,
   * so this is the single shared registry — add new icon names HERE rather than
   * scattering per-file imports. One-off icons used directly in markup may still
   * be imported straight from '@lucide/svelte/icons/<name>'.
   *
   * Each import is tree-shakable (per-icon module), so the bundle only carries
   * the icons listed below.
   */
  import Activity from '@lucide/svelte/icons/activity';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Award from '@lucide/svelte/icons/award';
  import Baby from '@lucide/svelte/icons/baby';
  import Bell from '@lucide/svelte/icons/bell';
  import Calendar from '@lucide/svelte/icons/calendar';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleX from '@lucide/svelte/icons/circle-x';
  import Clock from '@lucide/svelte/icons/clock';
  import CreditCard from '@lucide/svelte/icons/credit-card';
  import Dumbbell from '@lucide/svelte/icons/dumbbell';
  import Flame from '@lucide/svelte/icons/flame';
  import Footprints from '@lucide/svelte/icons/footprints';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Heart from '@lucide/svelte/icons/heart';
  import House from '@lucide/svelte/icons/house';
  import Info from '@lucide/svelte/icons/info';
  import Layers from '@lucide/svelte/icons/layers';
  import Mail from '@lucide/svelte/icons/mail';
  import MapPin from '@lucide/svelte/icons/map-pin';
  import Medal from '@lucide/svelte/icons/medal';
  import Menu from '@lucide/svelte/icons/menu';
  import Minus from '@lucide/svelte/icons/minus';
  import Music from '@lucide/svelte/icons/music';
  import Phone from '@lucide/svelte/icons/phone';
  import Plus from '@lucide/svelte/icons/plus';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import Search from '@lucide/svelte/icons/search';
  import Send from '@lucide/svelte/icons/send';
  import Settings from '@lucide/svelte/icons/settings';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Star from '@lucide/svelte/icons/star';
  import Target from '@lucide/svelte/icons/target';
  import Ticket from '@lucide/svelte/icons/ticket';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import User from '@lucide/svelte/icons/user';
  import Users from '@lucide/svelte/icons/users';
  import X from '@lucide/svelte/icons/x';
  // ── Member-centre additions ──
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import BadgeCheck from '@lucide/svelte/icons/badge-check';
  import BellOff from '@lucide/svelte/icons/bell-off';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import CalendarOff from '@lucide/svelte/icons/calendar-off';
  import CalendarX from '@lucide/svelte/icons/calendar-x';
  import CheckCheck from '@lucide/svelte/icons/check-check';
  import ClipboardList from '@lucide/svelte/icons/clipboard-list';
  import CloudOff from '@lucide/svelte/icons/cloud-off';
  import Download from '@lucide/svelte/icons/download';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Hourglass from '@lucide/svelte/icons/hourglass';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import Lock from '@lucide/svelte/icons/lock';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Megaphone from '@lucide/svelte/icons/megaphone';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import PencilLine from '@lucide/svelte/icons/pencil-line';
  import SearchX from '@lucide/svelte/icons/search-x';
  import Shirt from '@lucide/svelte/icons/shirt';
  import UserRound from '@lucide/svelte/icons/user-round';

  const ICONS: Record<string, typeof Activity> = {
    'activity': Activity,
    'arrow-right': ArrowRight,
    'arrow-left': ArrowLeft,
    'award': Award,
    'baby': Baby,
    'bell': Bell,
    'calendar': Calendar,
    'calendar-check': CalendarCheck,
    'calendar-days': CalendarDays,
    'check': Check,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'chevron-up': ChevronUp,
    'circle-alert': CircleAlert,
    'circle-check': CircleCheck,
    'circle-x': CircleX,
    'clock': Clock,
    'credit-card': CreditCard,
    'dumbbell': Dumbbell,
    'flame': Flame,
    'footprints': Footprints,
    'graduation-cap': GraduationCap,
    'heart': Heart,
    'house': House,
    'home': House, // alias → house
    'info': Info,
    'layers': Layers,
    'mail': Mail,
    'map-pin': MapPin,
    'medal': Medal,
    'menu': Menu,
    'minus': Minus,
    'music': Music,
    'phone': Phone,
    'plus': Plus,
    'rotate-cw': RotateCw,
    'search': Search,
    'send': Send,
    'settings': Settings,
    'shield-check': ShieldCheck,
    'shopping-cart': ShoppingCart,
    'sparkles': Sparkles,
    'star': Star,
    'target': Target,
    'ticket': Ticket,
    'trash-2': Trash2,
    'triangle-alert': TriangleAlert,
    'user': User,
    'users': Users,
    'x': X,
    // ── Member-centre additions ──
    'arrow-up-right': ArrowUpRight,
    'badge-check': BadgeCheck,
    'bell-off': BellOff,
    'book-open': BookOpen,
    'calendar-clock': CalendarClock,
    'calendar-off': CalendarOff,
    'calendar-x': CalendarX,
    'check-check': CheckCheck,
    'clipboard-list': ClipboardList,
    'cloud-off': CloudOff,
    'download': Download,
    'eye': Eye,
    'eye-off': EyeOff,
    'hourglass': Hourglass,
    'layout-dashboard': LayoutDashboard,
    'lock': Lock,
    'log-out': LogOut,
    'megaphone': Megaphone,
    'message-circle': MessageCircle,
    'pencil-line': PencilLine,
    'search-x': SearchX,
    'shirt': Shirt,
    'user-round': UserRound
  };

  export let name: string;
  export let size: number | string = 20;
  export let color: string = 'currentColor';
  export let strokeWidth: number | string = 2;
  export let style = '';
  let className = '';
  export { className as class };

  $: Cmp = ICONS[name];
</script>

{#if Cmp}
  <svelte:component this={Cmp} {size} {color} {strokeWidth} {style} class={className} />
{/if}
