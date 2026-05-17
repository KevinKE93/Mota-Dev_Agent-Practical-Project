import Phaser from 'phaser';
import { services } from '../services';

export class UIScene extends Phaser.Scene {
  private floorText?: Phaser.GameObjects.Text;
  private unsubscribe?: () => void;

  constructor() {
    super('UIScene');
  }

  create() {
    this.floorText = this.add.text(18, 18, '', {
      fontFamily: 'system-ui',
      fontSize: '16px',
      color: '#ffd166',
      backgroundColor: 'rgba(8, 7, 13, 0.72)',
      padding: { x: 12, y: 8 }
    }).setDepth(50);

    this.add.text(18, this.scale.height - 46, '移动 / 开门 / 拾取 / 战斗均由 JSON 地图驱动', {
      fontFamily: 'system-ui',
      fontSize: '12px',
      color: '#b8ad9c',
      backgroundColor: 'rgba(8, 7, 13, 0.58)',
      padding: { x: 10, y: 7 }
    }).setDepth(50);

    this.unsubscribe = services.store?.subscribe((snapshot) => {
      this.floorText?.setText(snapshot.activeFloorName);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }
}
