import type {
  BattlePreview,
  Direction,
  DoorColor,
  FloorDefinition,
  GameData,
  GameSnapshot,
  ItemDefinition,
  LastBattle,
  MonsterBookEntry,
  MonsterDefinition,
  NpcDefinition,
  Position,
  SerializedGame,
  ShopDefinition,
  ShopOptionDefinition,
  StoryRewardView,
  StoryEventDefinition,
  StoryEventTrigger,
  StoryEventView
} from '../types';
import { previewBattle } from '../systems/combat';

type Listener = (snapshot: GameSnapshot) => void;

const AUTOSAVE_KEY = 'mota-purple-trial-autosave';
const SLOT_KEY = (slot: number) => `mota-purple-trial-slot-${slot}`;

const directionDelta: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const tileDoors: Record<string, DoorColor> = {
  Y: 'yellow',
  B: 'blue',
  R: 'red'
};

interface StoryEventContext {
  monsterId?: string;
}

interface AppliedStoryActions {
  followups: StoryEventView['followups'];
  rewards: StoryRewardView[];
}

interface TriggeredStoryEvent {
  message: string;
  rewards: StoryRewardView[];
}

export class GameStore {
  private floors = new Map<string, FloorDefinition>();
  private monsters = new Map<string, MonsterDefinition>();
  private items = new Map<string, ItemDefinition>();
  private shops = new Map<string, ShopDefinition>();
  private npcs = new Map<string, NpcDefinition>();
  private listeners = new Set<Listener>();
  private snapshot: GameSnapshot;
  private battleSequence = 0;

  constructor(private data: GameData) {
    data.floors.floors.forEach((floor) => this.floors.set(floor.id, floor));
    data.monsters.monsters.forEach((monster) => this.monsters.set(monster.id, monster));
    data.items.items.forEach((item) => this.items.set(item.id, item));
    data.shops.shops.forEach((shop) => this.shops.set(shop.id, shop));
    data.npcs.npcs.forEach((npc) => this.npcs.set(npc.id, npc));
    this.snapshot = this.createInitialSnapshot();
    this.triggerStoryEvents('floorEnter');
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  startNewRun() {
    this.snapshot = this.createInitialSnapshot();
    const event = this.triggerStoryEvents('floorEnter');
    this.emit(event?.message ?? '新的试炼已经开始。');
  }

  loadAutosave() {
    return this.loadRaw(localStorage.getItem(AUTOSAVE_KEY), '读取自动存档。');
  }

  saveSlot(slot: number) {
    localStorage.setItem(SLOT_KEY(slot), JSON.stringify(this.serialize()));
    this.emit(`已保存到存档 ${slot}。`);
  }

  loadSlot(slot: number) {
    const ok = this.loadRaw(localStorage.getItem(SLOT_KEY(slot)), `已读取存档 ${slot}。`);
    if (!ok) this.emit(`存档 ${slot} 为空。`);
  }

  deleteSlot(slot: number) {
    localStorage.removeItem(SLOT_KEY(slot));
    this.emit(`已清空存档 ${slot}。`);
  }

  dismissVictory() {
    if (!this.snapshot.victory.visible) return;
    this.snapshot.victory.visible = false;
    this.emit('星镜塔台仍有未探索的回声。');
  }

  buyShopOption(optionId: string) {
    const shop = this.snapshot.activeShop ? this.shops.get(this.snapshot.activeShop.id) : null;
    const option = shop?.options.find((candidate) => candidate.id === optionId);
    if (!shop || !option) {
      this.emit('当前没有可用商店。');
      return;
    }

    if (this.snapshot.player.gold < option.cost) {
      this.emit(`金币不足，需要 ${option.cost} 金币。`);
      return;
    }

    this.snapshot.player.gold -= option.cost;
    this.applyShopEffect(option);
    this.snapshot.activeShop = this.toActiveShop(shop);
    this.emit(`${shop.speaker}：成交，${option.label}。`);
  }

  move(direction: Direction) {
    const delta = directionDelta[direction];
    const next = {
      x: this.snapshot.player.x + delta.x,
      y: this.snapshot.player.y + delta.y
    };
    this.snapshot.player.direction = direction;
    const tile = this.tileAt(next);

    if (!tile || tile === '#') {
      this.emit('石墙挡住了道路。');
      return;
    }

    if (tileDoors[tile]) {
      this.openDoor(next, tileDoors[tile]);
      return;
    }

    if (this.isMonster(tile)) {
      this.fight(next, tile);
      return;
    }

    if (this.isItem(tile)) {
      this.pickItem(next, tile);
      return;
    }

    if (this.isShop(tile)) {
      this.visitShop(next, tile);
      return;
    }

    if (this.isNpc(tile)) {
      this.visitNpc(next, tile);
      return;
    }

    if (tile === 'U' || tile === 'N') {
      this.useStair(tile);
      return;
    }

    this.setPlayerPosition(next);
    const event = this.triggerStoryEvents('position', next);
    this.emit(event?.message ?? '脚步声在塔内回响。');
  }

  face(direction: Direction) {
    this.snapshot.player.direction = direction;
    this.emit(this.snapshot.message, false);
  }

  private createInitialSnapshot(): GameSnapshot {
    const firstFloor = this.floors.get('F02_PRISON') ?? this.data.floors.floors[0];
    const initial = this.data.playerGrowth.initial;
    const grids = Object.fromEntries(
      this.data.floors.floors.map((floor) => [floor.id, floor.grid.map((row) => row.replace('@', '.').split(''))])
    );

    return {
      player: {
        floor: firstFloor.id,
        x: firstFloor.heroStart.x,
        y: firstFloor.heroStart.y,
        hp: initial.hp,
        maxHp: initial.hp,
        attack: initial.attack,
        defense: initial.defense,
        gold: initial.gold,
        exp: initial.exp,
        keys: { ...initial.keys },
        direction: 'up',
        equipment: {
          weapon: '木剑',
          shield: '皮盾'
        },
        unlocks: []
      },
      floors: grids,
      message: '方向键 / WASD 或点击相邻格移动。面对怪物时会预判战斗损耗。',
      activeFloorName: firstFloor.name,
      targetPreview: null,
      monsterBook: [],
      activeStoryEvent: null,
      activeShop: null,
      activeNpc: null,
      storyLog: [],
      seenEvents: [],
      lastBattle: null,
      victory: {
        completed: false,
        visible: false
      },
      version: 0
    };
  }

  private emit(message?: string, shouldAutosave = true) {
    if (message) this.snapshot.message = message;
    this.snapshot.activeFloorName = this.getCurrentFloor().name;
    this.snapshot.targetPreview = this.getFacingBattlePreview();
    this.snapshot.monsterBook = this.buildMonsterBook();
    this.snapshot.version += 1;
    if (shouldAutosave) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.serialize()));
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
    window.dispatchEvent(new CustomEvent('mota:state', { detail: snapshot }));
  }

  private serialize(): SerializedGame {
    return {
      player: structuredClone(this.snapshot.player),
      floors: Object.fromEntries(Object.entries(this.snapshot.floors).map(([id, grid]) => [id, grid.map((row) => row.join(''))])),
      message: this.snapshot.message,
      seenEvents: [...this.snapshot.seenEvents],
      storyLog: structuredClone(this.snapshot.storyLog),
      lastBattle: this.snapshot.lastBattle,
      victory: structuredClone(this.snapshot.victory)
    };
  }

  private loadRaw(raw: string | null, message: string) {
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as SerializedGame;
      this.snapshot = {
        player: parsed.player,
        floors: Object.fromEntries(Object.entries(parsed.floors).map(([id, grid]) => [id, grid.map((row) => row.split(''))])),
        message,
        activeFloorName: this.floors.get(parsed.player.floor)?.name ?? parsed.player.floor,
        targetPreview: null,
        monsterBook: [],
        activeStoryEvent: parsed.storyLog?.[0] ?? null,
        activeShop: null,
        activeNpc: null,
        storyLog: parsed.storyLog ?? [],
        seenEvents: parsed.seenEvents ?? [],
        lastBattle: parsed.lastBattle,
        victory: parsed.victory ?? {
          completed: parsed.player.unlocks?.includes('dragonHeadDefeated') ?? false,
          visible: false
        },
        version: this.snapshot.version + 1
      };
      this.emit(message, false);
      return true;
    } catch {
      return false;
    }
  }

  private getCurrentFloor() {
    const floor = this.floors.get(this.snapshot.player.floor);
    if (!floor) throw new Error(`Missing floor ${this.snapshot.player.floor}`);
    return floor;
  }

  private getCurrentGrid() {
    return this.snapshot.floors[this.snapshot.player.floor];
  }

  private tileAt(position: Position) {
    return this.getCurrentGrid()[position.y]?.[position.x];
  }

  private setTile(position: Position, tile: string) {
    this.getCurrentGrid()[position.y][position.x] = tile;
  }

  private setPlayerPosition(position: Position) {
    this.snapshot.player.x = position.x;
    this.snapshot.player.y = position.y;
    this.snapshot.activeShop = null;
    this.snapshot.activeNpc = null;
  }

  private openDoor(position: Position, color: DoorColor) {
    if (this.snapshot.player.keys[color] <= 0) {
      this.emit(`需要${this.colorLabel(color)}钥匙。`);
      return;
    }

    this.snapshot.player.keys[color] -= 1;
    this.setTile(position, '.');
    this.setPlayerPosition(position);
    this.emit(`消耗 1 把${this.colorLabel(color)}钥匙，门开启。`);
  }

  private fight(position: Position, tile: string) {
    const monster = this.monsterFromTile(tile);
    if (!monster) {
      this.emit('这个怪物数据缺失，无法战斗。');
      return;
    }

    const preview = previewBattle(this.snapshot.player, monster);
    if (!preview.canWin) {
      this.emit(`暂时无法击败 ${monster.name}，预计损失 ${preview.loss} 生命。`);
      return;
    }

    this.snapshot.player.hp -= preview.loss;
    this.snapshot.player.gold += monster.money;
    this.snapshot.player.exp += monster.money;
    this.setTile(position, '.');
    this.setPlayerPosition(position);
    const event = this.triggerStoryEvents('battleWin', position, { monsterId: monster.id });
    this.snapshot.lastBattle = {
      id: ++this.battleSequence,
      position: { ...position },
      monsterId: monster.id,
      monsterName: monster.name,
      rounds: preview.rounds,
      loss: preview.loss,
      gold: monster.money,
      exp: monster.money,
      eventRewards: event?.rewards ?? []
    };
    window.dispatchEvent(new CustomEvent<LastBattle>('mota:battle', { detail: this.snapshot.lastBattle }));
    this.emit(event?.message ?? `击败 ${monster.name}，损失 ${preview.loss} 生命，获得 ${monster.money} 金币。`);
  }

  private pickItem(position: Position, tile: string) {
    const item = this.itemFromTile(tile);
    if (!item) {
      this.emit('这个物品数据缺失。');
      return;
    }

    const effect = item.effect;
    if (item.type === 'key' && typeof effect.openDoor === 'string') {
      this.snapshot.player.keys[effect.openDoor as DoorColor] += 1;
    }
    if (typeof effect.hp === 'number') this.snapshot.player.hp = Math.min(this.snapshot.player.maxHp, this.snapshot.player.hp + effect.hp);
    if (typeof effect.attack === 'number') this.snapshot.player.attack += effect.attack;
    if (typeof effect.defense === 'number') this.snapshot.player.defense += effect.defense;
    if (typeof effect.unlock === 'string' && !this.snapshot.player.unlocks.includes(effect.unlock)) {
      this.snapshot.player.unlocks.push(effect.unlock);
    }
    if (item.type === 'equipment' && item.slot) {
      this.snapshot.player.equipment[item.slot] = item.name;
    }

    this.setTile(position, '.');
    this.setPlayerPosition(position);
    this.emit(`获得 ${item.name}。`);
  }

  private visitShop(position: Position, tile: string) {
    const shop = this.shopFromTile(tile);
    if (!shop) {
      this.emit('这个商店数据缺失。');
      return;
    }

    this.snapshot.player.x = position.x;
    this.snapshot.player.y = position.y;
    this.snapshot.activeShop = this.toActiveShop(shop);
    this.snapshot.activeNpc = null;
    this.emit(`${shop.speaker}：${shop.description}`);
  }

  private visitNpc(position: Position, tile: string) {
    const npc = this.npcFromTile(tile);
    if (!npc) {
      this.emit('这个 NPC 数据缺失。');
      return;
    }

    this.snapshot.player.x = position.x;
    this.snapshot.player.y = position.y;
    this.snapshot.activeShop = null;
    this.snapshot.activeNpc = {
      id: npc.id,
      name: npc.name,
      role: npc.role,
      speaker: npc.speaker,
      dialogue: npc.dialogue
    };
    this.emit(`${npc.speaker}：${npc.dialogue}`);
  }

  private applyShopEffect(option: ShopOptionDefinition) {
    if (typeof option.effect.hp === 'number') {
      this.snapshot.player.maxHp += option.effect.hp;
      this.snapshot.player.hp += option.effect.hp;
    }
    if (typeof option.effect.attack === 'number') this.snapshot.player.attack += option.effect.attack;
    if (typeof option.effect.defense === 'number') this.snapshot.player.defense += option.effect.defense;
  }

  private toActiveShop(shop: ShopDefinition) {
    return {
      id: shop.id,
      name: shop.name,
      speaker: shop.speaker,
      description: shop.description,
      options: shop.options
    };
  }

  private useStair(tile: string) {
    const currentFloor = this.getCurrentFloor();
    const targetId = tile === 'U' ? currentFloor.up : currentFloor.down;
    if (!targetId) {
      this.emit('楼梯尽头被封印了。');
      return;
    }

    const targetFloor = this.floors.get(targetId);
    if (!targetFloor) {
      this.emit('目标楼层数据缺失。');
      return;
    }

    this.snapshot.player.floor = targetFloor.id;
    this.snapshot.activeShop = null;
    this.snapshot.activeNpc = null;
    const opposite = tile === 'U' ? 'N' : 'U';
    const landing = this.findTile(targetFloor.id, opposite) ?? targetFloor.heroStart;
    this.setPlayerPosition(landing);
    const event = this.triggerStoryEvents('floorEnter');
    this.emit(event?.message ?? `进入 ${targetFloor.name}。`);
  }

  private triggerStoryEvents(trigger: StoryEventTrigger, position?: Position, context: StoryEventContext = {}): TriggeredStoryEvent | null {
    const event = this.data.storyEvents.runtimeEvents.find((candidate) => this.matchesStoryEvent(candidate, trigger, position, context));
    if (!event) return null;

    if (event.once !== false) this.snapshot.seenEvents.push(event.id);
    const applied = this.applyStoryActions(event);

    const view: StoryEventView = {
      id: event.id,
      title: event.title,
      speaker: event.speaker,
      body: event.body,
      followups: applied.followups,
      rewards: applied.rewards
    };
    this.snapshot.activeStoryEvent = view;
    this.snapshot.storyLog = [view, ...this.snapshot.storyLog.filter((entry) => entry.id !== event.id)].slice(0, 5);
    return {
      message: event.speaker ? `${event.speaker}：${event.body}` : `${event.title}：${event.body}`,
      rewards: applied.rewards
    };
  }

  private matchesStoryEvent(event: StoryEventDefinition, trigger: StoryEventTrigger, position?: Position, context: StoryEventContext = {}) {
    if (event.trigger !== trigger || event.floor !== this.snapshot.player.floor) return false;
    if (event.once !== false && this.snapshot.seenEvents.includes(event.id)) return false;
    if (event.trigger === 'position') {
      return Boolean(position && event.position && event.position.x === position.x && event.position.y === position.y);
    }
    if (event.trigger === 'battleWin') {
      return Boolean(event.monsterId && event.monsterId === context.monsterId);
    }
    return true;
  }

  private applyStoryActions(event: StoryEventDefinition): AppliedStoryActions {
    const followups: StoryEventView['followups'] = [];
    const rewards: StoryRewardView[] = [];
    event.actions?.forEach((action) => {
      if (action.kind === 'replaceTile') {
        const floorId = action.floor ?? event.floor;
        const grid = this.snapshot.floors[floorId];
        if (grid?.[action.position.y]?.[action.position.x] !== undefined) {
          grid[action.position.y][action.position.x] = action.tile;
          rewards.push({ kind: 'map', label: '地图', value: '开路' });
        }
      }

      if (action.kind === 'unlock' && !this.snapshot.player.unlocks.includes(action.id)) {
        this.snapshot.player.unlocks.push(action.id);
        rewards.push({ kind: 'unlock', label: '解锁', value: this.unlockLabel(action.id) });
        if (action.id === 'dragonHeadDefeated') {
          this.snapshot.victory = {
            completed: true,
            visible: true
          };
        }
      }

      if (action.kind === 'grantStat') {
        this.applyStoryStatReward(action.stat, action.amount);
        rewards.push({ kind: 'stat', label: this.statLabel(action.stat), value: `+${action.amount}` });
      }

      if (action.kind === 'grantKey') {
        this.snapshot.player.keys[action.color] += action.amount;
        rewards.push({ kind: 'key', label: `${this.colorLabel(action.color)}钥匙`, value: `+${action.amount}` });
      }

      if (action.kind === 'queueDialogue') {
        followups.push(...action.entries);
      }
    });
    return { followups, rewards };
  }

  private applyStoryStatReward(stat: 'hp' | 'maxHp' | 'attack' | 'defense' | 'gold' | 'exp', amount: number) {
    if (stat === 'maxHp') {
      this.snapshot.player.maxHp += amount;
      this.snapshot.player.hp += amount;
      return;
    }
    if (stat === 'hp') {
      this.snapshot.player.hp = Math.min(this.snapshot.player.maxHp, this.snapshot.player.hp + amount);
      return;
    }
    this.snapshot.player[stat] += amount;
  }

  private findTile(floorId: string, tile: string): Position | null {
    const grid = this.snapshot.floors[floorId];
    for (let y = 0; y < grid.length; y += 1) {
      const x = grid[y].indexOf(tile);
      if (x >= 0) return { x, y };
    }
    return null;
  }

  private getFacingBattlePreview(): BattlePreview | null {
    const delta = directionDelta[this.snapshot.player.direction];
    const tile = this.tileAt({
      x: this.snapshot.player.x + delta.x,
      y: this.snapshot.player.y + delta.y
    });
    const monster = tile ? this.monsterFromTile(tile) : null;
    return monster ? previewBattle(this.snapshot.player, monster) : null;
  }

  private buildMonsterBook(): MonsterBookEntry[] {
    const entries = new Map<string, MonsterBookEntry>();

    this.getCurrentGrid().forEach((row) => {
      row.forEach((tile) => {
        const monster = this.monsterFromTile(tile);
        if (!monster || entries.has(monster.id)) return;
        const preview = previewBattle(this.snapshot.player, monster);
        entries.set(monster.id, {
          id: monster.id,
          tile,
          name: monster.name,
          hp: monster.hp,
          attack: monster.attack,
          defense: monster.defense,
          money: monster.money,
          tier: monster.tier,
          loss: preview.loss,
          rounds: preview.rounds,
          canWin: preview.canWin
        });
      });
    });

    return [...entries.values()].sort((a, b) => {
      if (a.canWin !== b.canWin) return a.canWin ? -1 : 1;
      return a.loss - b.loss;
    });
  }

  private isMonster(tile: string) {
    return Boolean(this.monsterFromTile(tile));
  }

  private isItem(tile: string) {
    return Boolean(this.itemFromTile(tile));
  }

  private isShop(tile: string) {
    return Boolean(this.shopFromTile(tile));
  }

  private isNpc(tile: string) {
    return Boolean(this.npcFromTile(tile));
  }

  private monsterFromTile(tile: string) {
    const id = this.data.floors.entityMap[tile];
    return id ? this.monsters.get(id) ?? null : null;
  }

  private itemFromTile(tile: string) {
    const id = this.data.floors.entityMap[tile];
    return id ? this.items.get(id) ?? null : null;
  }

  private shopFromTile(tile: string) {
    const id = this.data.floors.entityMap[tile];
    return id ? this.shops.get(id) ?? null : null;
  }

  private npcFromTile(tile: string) {
    const id = this.data.floors.entityMap[tile];
    return id ? this.npcs.get(id) ?? null : null;
  }

  private colorLabel(color: DoorColor) {
    return color === 'yellow' ? '黄' : color === 'blue' ? '蓝' : '红';
  }

  private statLabel(stat: 'hp' | 'maxHp' | 'attack' | 'defense' | 'gold' | 'exp') {
    const labels = {
      hp: '生命',
      maxHp: '生命上限',
      attack: '攻击',
      defense: '防御',
      gold: '金币',
      exp: '经验'
    };
    return labels[stat];
  }

  private unlockLabel(id: string) {
    const labels: Record<string, string> = {
      monsterBook: '怪物手册',
      floorTeleport: '楼层传送',
      forgeBossDefeated: '熔炉闸门'
    };
    return labels[id] ?? id;
  }
}
