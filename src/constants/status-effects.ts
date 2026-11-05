import type { StatusEffect } from '@/types/game';

export const STATUS_EFFECT_PRESENTATION: Record<
  StatusEffect,
  { color: string; icon: number; label: string }
> = {
  burn: {
    color: '#f15b38',
    icon: require('../../assets/images/statusicons/Burn.png'),
    label: 'Burn',
  },
  poison: {
    color: '#984bd1',
    icon: require('../../assets/images/statusicons/Poison.png'),
    label: 'Poison',
  },
  freeze: {
    color: '#35cce5',
    icon: require('../../assets/images/statusicons/freeze.png'),
    label: 'Freeze',
  },
  paralysis: {
    color: '#f0ce00',
    icon: require('../../assets/images/statusicons/Paralysis.png'),
    label: 'Paralysis',
  },
  sleep: {
    color: '#f3567d',
    icon: require('../../assets/images/statusicons/Sleep.png'),
    label: 'Sleep',
  },
};
