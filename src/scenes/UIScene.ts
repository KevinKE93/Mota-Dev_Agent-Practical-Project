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

    this.unsubscribe = services.store?.subscribe((snapshot) => {
      this.floorText?.setText(snapshot.activeFloorName);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }
}
