import type { GameStore } from './state/GameStore';
import type { AssetManifest } from './types';

export const services: {
  store?: GameStore;
  resumeGame?: boolean;
  assets?: AssetManifest;
} = {};
