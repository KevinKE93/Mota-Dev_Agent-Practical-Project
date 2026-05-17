import Phaser from 'phaser';
import type { LastBattle } from '../types';

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
    const bg = this.add.rectangle(0, 0, 360, panelHeight, 0x150c1b, 0.94).setStrokeStyle(2, 0xf6c861, 0.5);
    const title = this.add.text(-160, rewardText ? -42 : -30, `击败 ${result.monsterName}`, {
      fontFamily: 'system-ui',
      fontSize: '16px',
      color: '#fff7df',
      fontStyle: '700'
    });
    const roundsText = result.rounds ? `${result.rounds} 回合 · ` : '';
    const detail = this.add.text(-160, rewardText ? -10 : 2, `${roundsText}损失 ${result.loss} HP · +${result.gold} 金币 · +${result.exp} 经验`, {
      fontFamily: 'system-ui',
      fontSize: '13px',
      color: '#d9cbb3'
    });
    const children: Phaser.GameObjects.GameObject[] = [bg, title, detail];
    if (rewardText) {
      children.push(this.add.text(-160, 20, `事件奖励：${rewardText}`, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#f6c861',
        wordWrap: { width: 320 }
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
}
