import Phaser from 'phaser';
import { services } from '../services';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    Object.entries(services.assets?.images ?? {}).forEach(([key, image]) => this.load.image(key, image.path));
  }

  create() {
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
}
