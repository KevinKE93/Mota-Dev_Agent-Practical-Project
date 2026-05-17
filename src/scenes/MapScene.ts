import Phaser from 'phaser';
import { playSfx } from '../audio/sfx';
import { services } from '../services';
import type { Direction, GameSnapshot, LastBattle } from '../types';

const DEFAULT_TILE_SIZE = 48;

export class MapScene extends Phaser.Scene {
  private layer?: Phaser.GameObjects.Container;
  private hero?: Phaser.GameObjects.Sprite;
  private snapshot?: GameSnapshot;
  private previousFloor?: string;
  private previousPosition?: { floor: string; x: number; y: number };
  private previousBattleId?: number;
  private unsubscribe?: () => void;
  private moveHandler = (event: Event) => {
    const detail = (event as CustomEvent<{ direction: Direction }>).detail;
    services.store?.move(detail.direction);
  };

  constructor() {
    super('MapScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08070d');
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    window.addEventListener('mota:move', this.moveHandler);
    this.unsubscribe = services.store?.subscribe((snapshot) => {
      this.snapshot = snapshot;
      this.render();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown, this);
      window.removeEventListener('mota:move', this.moveHandler);
      this.unsubscribe?.();
    });
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const direction = key === 'arrowup' || key === 'w'
      ? 'up'
      : key === 'arrowdown' || key === 's'
        ? 'down'
        : key === 'arrowleft' || key === 'a'
          ? 'left'
          : key === 'arrowright' || key === 'd'
            ? 'right'
            : null;

    if (direction) {
      event.preventDefault();
      services.store?.move(direction);
    }
  }

  private handlePointer(pointer: Phaser.Input.Pointer) {
    if (!this.snapshot) return;
    const position = this.pointerToTile(pointer.x, pointer.y);
    if (!position) return;
    const dx = position.x - this.snapshot.player.x;
    const dy = position.y - this.snapshot.player.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const direction: Direction = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
    services.store?.move(direction);
  }

  private render() {
    if (!this.snapshot) return;
    const currentPosition = {
      floor: this.snapshot.player.floor,
      x: this.snapshot.player.x,
      y: this.snapshot.player.y
    };
    const floorChanged = Boolean(this.previousFloor && this.previousFloor !== this.snapshot.player.floor);
    const moved = Boolean(
      this.previousPosition
      && this.previousPosition.floor === currentPosition.floor
      && (this.previousPosition.x !== currentPosition.x || this.previousPosition.y !== currentPosition.y)
    );

    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);

    const grid = this.snapshot.floors[this.snapshot.player.floor];
    const tileSize = this.tileSize();
    const { originX, originY, mapWidth, mapHeight } = this.mapOrigin(grid);

    this.addPanel(originX - 12, originY - 12, mapWidth + 24, mapHeight + 24);

    grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        this.drawTile(tile, originX + x * tileSize, originY + y * tileSize);
      });
    });

    const heroX = originX + this.snapshot.player.x * tileSize + tileSize / 2;
    const heroY = originY + this.snapshot.player.y * tileSize + tileSize / 2 + 2;
    const heroGlow = this.add.ellipse(heroX, heroY + 18, 36, 12, 0x6bb8ff, 0.28)
      .setStrokeStyle(1, 0xf6c861, 0.48)
      .setDepth(19);
    const currentBattleId = this.snapshot.lastBattle?.id;
    const attacked = moved && currentBattleId !== undefined && currentBattleId !== this.previousBattleId;
    const heroAction = attacked ? 'attack' : moved ? 'walk' : 'idle';
    this.hero = this.add.sprite(heroX, heroY, 'hero_down_1').setDisplaySize(42, 50).setDepth(20);
    this.applyHeroDirection(this.hero);
    this.playHeroAnimation(this.hero, this.snapshot.player.direction, heroAction);
    this.layer.add([heroGlow, this.hero]);

    if (attacked) {
      const battlePosition = this.snapshot.lastBattle?.position ?? this.snapshot.player;
      const battleX = originX + battlePosition.x * tileSize + tileSize / 2;
      const battleY = originY + battlePosition.y * tileSize + tileSize / 2 + 2;
      this.playDefeatedMonsterEcho(this.snapshot.lastBattle?.monsterId, battleX, battleY);
      this.playImpactEffect(battleX, battleY - 10);
      this.playDefeatEffect(this.snapshot.lastBattle?.monsterId, battleX, battleY - 2, 95);
      this.playBattleFloaters(this.snapshot.lastBattle, battleX, battleY);
      playSfx('battleHit');
      this.time.delayedCall(180, () => playSfx('reward'));
    }

    if (floorChanged) {
      this.playFloorTransition(this.snapshot.activeFloorName);
    } else if (moved) {
      this.playMoveFeedback(heroGlow);
    }

    this.previousFloor = currentPosition.floor;
    this.previousPosition = currentPosition;
    this.previousBattleId = currentBattleId;
  }

  private applyHeroDirection(hero: Phaser.GameObjects.Sprite) {
    hero.setFlipX(false);
    hero.setAngle(0);
  }

  private playHeroAnimation(hero: Phaser.GameObjects.Sprite, direction: Direction, action: 'idle' | 'walk' | 'attack') {
    const idleKey = `hero-idle-${direction}`;
    const actionKey = `hero-${action}-${direction}`;
    const key = this.anims.exists(actionKey)
      ? actionKey
      : this.anims.exists(idleKey)
        ? idleKey
        : 'hero-idle-down';

    if (!this.anims.exists(key)) return;
    hero.play(key);

    if (action !== 'idle') {
      hero.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (hero.active && this.anims.exists(idleKey)) hero.play(idleKey);
      });
    }
  }

  private playMoveFeedback(glow: Phaser.GameObjects.Ellipse) {
    this.tweens.add({
      targets: glow,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0.46,
      duration: 95,
      yoyo: true,
      ease: 'Sine.easeOut'
    });

    if (!this.hero) return;
    this.tweens.add({
      targets: this.hero,
      y: this.hero.y - 3,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
  }

  private playBattleFloaters(result: LastBattle | null | undefined, x: number, y: number) {
    if (!this.layer || !result) return;
    const lines = [
      { text: `-${result.loss} HP`, color: '#ff7a8f', offsetX: -36, delay: 20 },
      { text: `+${result.gold} 金币`, color: '#f6c861', offsetX: 30, delay: 120 }
    ];

    lines.forEach((line) => {
      const label = this.add.text(0, 0, line.text, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: line.color,
        fontStyle: '700',
        stroke: '#150c1b',
        strokeThickness: 4
      }).setOrigin(0.5);
      const bg = this.add.rectangle(0, 0, label.width + 14, 22, 0x120b18, 0.78)
        .setStrokeStyle(1, 0xf6c861, 0.28);
      const floater = this.add.container(x + line.offsetX, y - 28, [bg, label])
        .setDepth(38)
        .setAlpha(0);
      this.layer?.add(floater);
      this.tweens.add({
        targets: floater,
        y: y - 58,
        alpha: 1,
        delay: line.delay,
        duration: 180,
        hold: 360,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => floater.destroy(true)
      });
    });
  }

  private playDefeatedMonsterEcho(monsterId: string | undefined, x: number, y: number) {
    if (!this.layer || !monsterId) return;
    const imageKey = services.assets?.entitySprites[monsterId];
    const imageDefinition = imageKey ? services.assets?.images[imageKey] : undefined;
    if (!imageKey || !imageDefinition || !this.textures.exists(imageKey)) return;

    const [width, height] = imageDefinition.displaySize;
    const echo = this.add.image(x, y + (imageDefinition.anchor === 'bottom-center' ? 4 : 0), imageKey)
      .setDisplaySize(width, height)
      .setDepth(31)
      .setAlpha(0.88)
      .setTint(0xd8b9ff)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add(echo);
    this.tweens.add({
      targets: echo,
      y: echo.y - 8,
      scaleX: 1.16,
      scaleY: 1.16,
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => echo.destroy()
    });
  }

  private playImpactEffect(x: number, y: number) {
    if (!this.layer) return;

    if (!this.textures.exists('battle_hit_1') || !this.anims.exists('battle-hit-burst')) {
      const ring = this.add.ellipse(x, y, 18, 18, 0xf6c861, 0.36)
        .setStrokeStyle(2, 0xffffff, 0.82)
        .setDepth(34);
      this.layer.add(ring);
      this.tweens.add({
        targets: ring,
        scaleX: 2.2,
        scaleY: 2.2,
        alpha: 0,
        duration: 180,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy()
      });
      return;
    }

    const impact = this.add.sprite(x, y, 'battle_hit_1')
      .setDisplaySize(88, 88)
      .setDepth(34)
      .setAlpha(0.96)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add(impact);
    impact.play('battle-hit-burst');
    impact.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => impact.destroy());
    this.cameras.main.shake(80, 0.0025);
  }

  private getDefeatAnimation(monsterId: string | undefined) {
    const mappedAnimation = monsterId ? services.assets?.monsterDefeatAnimations?.[monsterId] : undefined;
    if (mappedAnimation && this.anims.exists(mappedAnimation)) {
      const firstFrame = `${monsterId}_defeat_1`;
      if (this.textures.exists(firstFrame)) return { animation: mappedAnimation, firstFrame };
    }
    if (this.textures.exists('monster_defeat_1') && this.anims.exists('monster-defeat-burst')) {
      return { animation: 'monster-defeat-burst', firstFrame: 'monster_defeat_1' };
    }
    return null;
  }

  private playDefeatEffect(monsterId: string | undefined, x: number, y: number, delay = 0) {
    const launch = () => {
      if (!this.layer) return;

      const defeatAnimation = this.getDefeatAnimation(monsterId);
      if (!defeatAnimation) {
        const burst = this.add.ellipse(x, y + 6, 20, 12, 0x8a4fff, 0.36)
          .setStrokeStyle(1, 0xf6c861, 0.68)
          .setDepth(33);
        this.layer.add(burst);
        this.tweens.add({
          targets: burst,
          y: y - 10,
          scaleX: 2,
          scaleY: 1.4,
          alpha: 0,
          duration: 260,
          ease: 'Sine.easeOut',
          onComplete: () => burst.destroy()
        });
        return;
      }

      const defeat = this.add.sprite(x, y + 4, defeatAnimation.firstFrame)
        .setDisplaySize(82, 82)
        .setDepth(33)
        .setAlpha(0.92)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.layer.add(defeat);
      defeat.play(defeatAnimation.animation);
      defeat.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => defeat.destroy());
    };

    if (delay > 0) {
      this.time.delayedCall(delay, launch);
      return;
    }
    launch();
  }

  private playFloorTransition(floorName: string) {
    if (!this.layer) return;
    playSfx('floorTransition');
    this.layer.setAlpha(0);
    this.cameras.main.flash(220, 246, 200, 97, false);
    this.tweens.add({
      targets: this.layer,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut'
    });
    this.showFloorToast(floorName);
  }

  private showFloorToast(floorName: string) {
    const { width } = this.scale;
    const bg = this.add.rectangle(0, 0, 260, 52, 0x150c1b, 0.94)
      .setStrokeStyle(2, 0xf6c861, 0.48);
    const text = this.add.text(0, 0, floorName, {
      fontFamily: 'system-ui',
      fontSize: '18px',
      color: '#fff7df',
      fontStyle: '700'
    }).setOrigin(0.5);
    const toast = this.add.container(width / 2, 94, [bg, text]).setDepth(110).setAlpha(0);
    this.tweens.add({
      targets: toast,
      y: 108,
      alpha: 1,
      duration: 150,
      ease: 'Sine.easeOut',
      yoyo: true,
      hold: 900,
      onComplete: () => toast.destroy(true)
    });
  }

  private addPanel(x: number, y: number, width: number, height: number) {
    const panel = this.add.rectangle(x, y, width, height, 0x0c1018, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x6a4b23, 0.8);
    this.layer?.add(panel);
  }

  private drawTile(tile: string, x: number, y: number) {
    const tileSize = this.tileSize();
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;
    const base = this.add.rectangle(x + 1, y + 1, tileSize - 2, tileSize - 2, this.tileColor(tile), 1)
      .setOrigin(0)
      .setStrokeStyle(1, this.tileStroke(tile), 0.78);
    this.layer?.add(base);

    if (tile === '#') {
      if (!this.addManifestImage(tile, centerX, centerY)) this.addStoneDetail(x, y);
      return;
    }

    if (this.addManifestImage(tile, centerX, centerY)) {
      return;
    }

    const label = this.tileLabel(tile);
    if (label) {
      const text = this.add.text(centerX, centerY, label, {
        fontFamily: 'system-ui',
        fontSize: '22px',
        color: this.tileTextColor(tile),
        fontStyle: '700'
      }).setOrigin(0.5);
      this.layer?.add(text);
    }
  }

  private addStoneDetail(x: number, y: number) {
    const tileSize = this.tileSize();
    const line = this.add.rectangle(x + 7, y + 12, tileSize - 14, 2, 0x59606d, 0.25).setOrigin(0);
    const chip = this.add.rectangle(x + 12, y + 30, tileSize - 24, 2, 0x000000, 0.28).setOrigin(0);
    this.layer?.add([line, chip]);
  }

  private addManifestImage(tile: string, centerX: number, centerY: number) {
    const presentation = services.assets?.tilePresentation[tile];
    const imageKey = presentation?.kind === 'image'
      ? presentation.imageKey
      : presentation?.kind === 'entity'
        ? services.assets?.entitySprites[presentation.entityId]
        : undefined;
    if (!imageKey) return false;

    const imageDefinition = services.assets?.images[imageKey];
    if (!imageDefinition) return false;

    const [width, height] = imageDefinition.displaySize;
    const image = this.add.image(centerX, centerY + (imageDefinition.anchor === 'bottom-center' ? 4 : 0), imageKey)
      .setDisplaySize(width, height);
    this.layer?.add(image);
    return true;
  }

  private pointerToTile(pointerX: number, pointerY: number) {
    if (!this.snapshot) return null;
    const grid = this.snapshot.floors[this.snapshot.player.floor];
    const tileSize = this.tileSize();
    const { originX, originY } = this.mapOrigin(grid);
    const x = Math.floor((pointerX - originX) / tileSize);
    const y = Math.floor((pointerY - originY) / tileSize);
    if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return null;
    return { x, y };
  }

  private tileSize() {
    return services.assets?.tileSize ?? DEFAULT_TILE_SIZE;
  }

  private mapOrigin(grid: string[][]) {
    const tileSize = this.tileSize();
    const mapWidth = grid[0].length * tileSize;
    const mapHeight = grid.length * tileSize;
    return {
      originX: Math.round((this.scale.width - mapWidth) / 2),
      originY: Math.round((this.scale.height - mapHeight) / 2 + 14),
      mapWidth,
      mapHeight
    };
  }

  private tileColor(tile: string) {
    if (tile === '#') return 0x2a2e38;
    if (tile === 'Y') return 0x6d4b18;
    if (tile === 'B') return 0x173f66;
    if (tile === 'R') return 0x682035;
    if (tile === 'U' || tile === 'N') return 0x181329;
    const presentation = services.assets?.tilePresentation[tile];
    if (presentation?.kind === 'entity') return 0x15131f;
    if (['K', 'Q', 'P', 'G', 'D', 'C', 'V'].includes(tile)) return 0x151b25;
    return 0x111722;
  }

  private tileStroke(tile: string) {
    if (tile === '#') return 0x444a58;
    if (tile === 'Y' || tile === 'K') return 0xf6c861;
    if (tile === 'B') return 0x6bb8ff;
    if (tile === 'R' || tile === 'Q') return 0xf06a84;
    const presentation = services.assets?.tilePresentation[tile];
    if (presentation?.kind === 'entity') return 0x7a49ff;
    return 0x2b3444;
  }

  private tileTextColor(tile: string) {
    const presentation = services.assets?.tilePresentation[tile];
    if (presentation?.kind === 'glyph') return presentation.color;
    return '#ffd166';
  }

  private tileLabel(tile: string) {
    const presentation = services.assets?.tilePresentation[tile];
    return presentation?.kind === 'glyph' ? presentation.glyph : '';
  }
}
