import Phaser from 'phaser';
import { services } from '../services';

interface FailedAsset {
  key: string;
  type: string;
  src: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class BootScene extends Phaser.Scene {
  private failedAssets: FailedAsset[] = [];

  constructor() {
    super('BootScene');
  }

  preload() {
    this.failedAssets = [];
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleLoadError);
    Object.entries(services.assets?.images ?? {}).forEach(([key, image]) => this.load.image(key, image.path));
  }

  create() {
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleLoadError);
    if (this.failedAssets.length) {
      this.renderFatalAssetError();
      return;
    }

    Object.entries(services.assets?.animations ?? {}).forEach(([key, animation]) => {
      this.anims.create({
        key,
        frames: animation.frames.map((frame) => ({ key: frame })),
        frameRate: animation.frameRate,
        repeat: animation.repeat
      });
    });
    if (services.resumeGame) {
      this.scene.launch('UIScene');
      this.scene.launch('BattleScene');
      this.scene.start('MapScene');
    } else {
      this.scene.start('MenuScene');
    }
  }

  private handleLoadError = (file: Phaser.Loader.File) => {
    this.failedAssets.push({
      key: file.key,
      type: file.type,
      src: file.src || String(file.url)
    });
  };

  private renderFatalAssetError() {
    const app = document.querySelector('#app');
    const listedAssets = this.failedAssets.slice(0, 8);
    const overflow = this.failedAssets.length - listedAssets.length;
    const assetList = listedAssets
      .map((asset) => `<li><strong>${escapeHtml(asset.key)}</strong><span>${escapeHtml(asset.type)} · ${escapeHtml(asset.src)}</span></li>`)
      .join('');

    if (app) {
      app.innerHTML = `
        <main class="fatal fatal-assets">
          <h1>资源加载失败</h1>
          <p>请检查资源清单和部署包，以下图片未能被 Phaser 加载。</p>
          <ul>${assetList}</ul>
          ${overflow > 0 ? `<p class="muted">另有 ${overflow} 个资源加载失败。</p>` : ''}
        </main>
      `;
    }

    console.error('Mota asset loading failed', this.failedAssets);
  }
}
