import Phaser from 'phaser';
import type { LastBattle } from '../types';
import { services } from '../services';

const REWARD_ICON_SLOT = 'battleRewardIcon';

export class BattleScene extends Phaser.Scene {
  private panel?: Phaser.GameObjects.Container;
  private battleHandler = (event: Event) => {
    this.showBattle((event as CustomEvent<LastBattle>).detail);
  };

  constructor() {
    super('BattleScene');
  }

  create() {
    window.addEventListener('mota:battle', this.battleHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('mota:battle', this.battleHandler));
  }

  private showBattle(result: LastBattle) {
    this.panel?.destroy(true);
    const { width } = this.scale;
    const rewardText = result.eventRewards?.length
      ? result.eventRewards.map((reward) => `${reward.label}${reward.value}`).join(' · ')
      : '';
    const panelHeight = rewardText ? 110 : 86;
    const panelWidth = this.hasRewardIcon() ? 392 : 360;
    const textX = this.hasRewardIcon() ? -122 : -160;
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x150c1b, 0.94).setStrokeStyle(2, 0xf6c861, 0.5);
    const title = this.add.text(textX, rewardText ? -42 : -30, `击败 ${result.monsterName}`, {
      fontFamily: 'system-ui',
      fontSize: '16px',
      color: '#fff7df',
      fontStyle: '700'
    });
    const roundsText = result.rounds ? `${result.rounds} 回合 · ` : '';
    const detail = this.add.text(textX, rewardText ? -10 : 2, `${roundsText}损失 ${result.loss} HP · +${result.gold} 金币 · +${result.exp} 经验`, {
      fontFamily: 'system-ui',
      fontSize: '13px',
      color: '#d9cbb3'
    });
    const children: Phaser.GameObjects.GameObject[] = [bg, ...this.createRewardIcon(rewardText ? -10 : 1), title, detail];
    if (rewardText) {
      children.push(this.add.text(textX, 20, `事件奖励：${rewardText}`, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#f6c861',
        wordWrap: { width: this.hasRewardIcon() ? 292 : 320 }
      }));
    }

    this.panel = this.add.container(width / 2, 82, children).setDepth(100).setAlpha(0);
    this.tweens.add({
      targets: this.panel,
      y: 96,
      alpha: 1,
      duration: 160,
      ease: 'Sine.easeOut',
      yoyo: true,
      hold: 1100,
      onComplete: () => this.panel?.destroy(true)
    });
  }

  private hasRewardIcon() {
    const key = this.rewardIconKey();
    return Boolean(services.assets?.images[key] && this.textures.exists(key));
  }

  private createRewardIcon(y: number) {
    const key = this.rewardIconKey();
    const image = services.assets?.images[key];
    if (!image || !this.textures.exists(key)) return [];

    const [width, height] = image.displaySize;
    const glow = this.add.circle(-156, y, 24, 0x3d2710, 0.8).setStrokeStyle(1, 0xf6c861, 0.35);
    const icon = this.add.image(-156, y, key).setDisplaySize(width * 0.72, height * 0.72);
    return [glow, icon];
  }

  private rewardIconKey() {
    return services.assets?.sceneImages?.[REWARD_ICON_SLOT] ?? 'gold-pile';
  }
}
