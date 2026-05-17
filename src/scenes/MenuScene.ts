import Phaser from 'phaser';
import { services } from '../services';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;
    const [coverWidth, coverHeight] = this.displaySizeFor('cover_tower', [560, 430]);
    const [panelWidth, panelHeight] = this.displaySizeFor('cover_hero_panel', [196, 158]);
    this.add.rectangle(width / 2, height / 2, width, height, 0x08070d);
    this.add.image(width / 2, height / 2 - 28, 'cover_tower').setAlpha(0.38).setDisplaySize(coverWidth, coverHeight);
    this.add.image(width - 138, height - 162, 'cover_hero_panel').setAlpha(0.54).setDisplaySize(panelWidth, panelHeight);

    this.add.text(width / 2, 150, '魔塔：紫焰试炼', {
      fontFamily: 'serif',
      fontSize: '44px',
      color: '#fff7df',
      stroke: '#261521',
      strokeThickness: 8
    }).setOrigin(0.5);

    this.add.text(width / 2, 214, '方向键 / WASD 探索 11x11 塔层，钥匙开门，战斗前预判损耗。', {
      fontFamily: 'system-ui',
      fontSize: '15px',
      color: '#d9cbb3',
      align: 'center',
      wordWrap: { width: 440 }
    }).setOrigin(0.5);

    const button = this.add.rectangle(width / 2, 300, 210, 54, 0xf6c861, 1).setStrokeStyle(2, 0x5b3412);
    const label = this.add.text(width / 2, 300, '开始试炼', {
      fontFamily: 'system-ui',
      fontSize: '20px',
      color: '#1b1208',
      fontStyle: '700'
    }).setOrigin(0.5);

    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.startGame());
    label.setInteractive({ useHandCursor: true });
    label.on('pointerdown', () => this.startGame());

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
  }

  private startGame() {
    this.scene.stop('MenuScene');
    this.scene.launch('UIScene');
    this.scene.launch('BattleScene');
    this.scene.start('MapScene');
  }

  private displaySizeFor(key: string, fallback: [number, number]): [number, number] {
    return services.assets?.images[key]?.displaySize ?? fallback;
  }
}
