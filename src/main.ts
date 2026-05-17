import Phaser from 'phaser';
import './styles.css';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { MapScene } from './scenes/MapScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';
import { services } from './services';
import { GameStore } from './state/GameStore';
import type { AssetManifest, GameData } from './types';
import { mountHud } from './ui/domHud';

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json() as Promise<T>;
}

async function boot() {
  const data: GameData = {
    floors: await loadJson('/data/floors.json'),
    monsters: await loadJson('/data/monsters.seed.json'),
    items: await loadJson('/data/items.seed.json'),
    shops: await loadJson('/data/shops.seed.json'),
    npcs: await loadJson('/data/npcs.seed.json'),
    playerGrowth: await loadJson('/data/player-growth.json'),
    storyEvents: await loadJson('/data/story-events.json')
  };
  services.data = data;
  services.assets = await loadJson<AssetManifest>('/assets/manifest.json');

  const store = new GameStore(data);
  services.store = store;
  services.resumeGame = store.loadAutosave();
  mountHud(store);

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    width: 640,
    height: 640,
    backgroundColor: '#08070d',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, MapScene, UIScene, BattleScene]
  });
}

boot().catch((error) => {
  const app = document.querySelector('#app');
  if (app) app.innerHTML = `<main class="fatal"><h1>加载失败</h1><p>${String(error)}</p></main>`;
});
