import type { GameStore } from './state/GameStore';
import type { AssetManifest, GameData } from './types';

export const services: {
  store?: GameStore;
  resumeGame?: boolean;
  assets?: AssetManifest;
  data?: GameData;
} = {};
