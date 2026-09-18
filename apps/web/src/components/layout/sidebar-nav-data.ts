import type { ComponentType, SVGProps } from 'react';
import {
  GridIcon,
  CalendarIcon,
  AwardIcon,
  StarIcon,
  MusicIcon,
  ClipboardIcon,
  TrendingUpIcon,
  FileTextIcon,
  MailIcon,
  UsersIcon,
  DatabaseIcon,
} from '../ui/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  status: 'active' | 'soon';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visão Geral',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: GridIcon, status: 'active' }],
  },
  {
    label: 'Cadastros',
    items: [
      { label: 'Festivais', href: '/festivals', icon: CalendarIcon, status: 'active' },
      { label: 'Premiações', href: '/premiacoes', icon: AwardIcon, status: 'soon' },
      { label: 'Critérios de Nota', href: '/criterios-de-nota', icon: StarIcon, status: 'soon' },
      { label: 'Instrumentos', href: '/instrumentos', icon: MusicIcon, status: 'soon' },
    ],
  },
  {
    label: 'Inscrições & Avaliação',
    items: [
      { label: 'Inscrições', href: '/inscricoes', icon: ClipboardIcon, status: 'active' },
      { label: 'Classificação', href: '/classificacao', icon: TrendingUpIcon, status: 'soon' },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { label: 'Relatório de Inscrições', href: '/relatorios/inscricoes', icon: FileTextIcon, status: 'soon' },
      {
        label: 'Resultado da Votação Online',
        href: '/relatorios/votacao-online',
        icon: TrendingUpIcon,
        status: 'soon',
      },
      { label: 'Mala Direta', href: '/relatorios/mala-direta', icon: MailIcon, status: 'soon' },
      { label: 'Ficha de Inscrição', href: '/relatorios/ficha-de-inscricao', icon: FileTextIcon, status: 'soon' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários', href: '/usuarios', icon: UsersIcon, status: 'soon' },
      { label: 'Backups', href: '/backups', icon: DatabaseIcon, status: 'soon' },
    ],
  },
];

export const ACTIVE_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items).filter(
  (item) => item.status === 'active',
);
