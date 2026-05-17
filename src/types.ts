export type DoorColor = 'yellow' | 'blue' | 'red';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export interface FloorDecorationDefinition {
  id: string;
  imageKey: string;
  position: Position;
  alpha?: number;
}

export interface KeysState {
  yellow: number;
  blue: number;
  red: number;
}

export interface PlayerState {
  floor: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  gold: number;
  exp: number;
  keys: KeysState;
  direction: Direction;
  equipment: {
    weapon: string;
    shield: string;
  };
  unlocks: string[];
}

export interface FloorDefinition {
  id: string;
  name: string;
  up: string | null;
  down: string | null;
  heroStart: Position;
  grid: string[];
  decorations?: FloorDecorationDefinition[];
}

export interface FloorsPayload {
  schemaVersion: string;
  tileSize: number;
  mapSize: {
    cols: number;
    rows: number;
  };
  tileLegend: Record<string, string>;
  entityMap: Record<string, string>;
  floors: FloorDefinition[];
}

export interface MonsterDefinition {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  money: number;
  img: string;
  tier: string;
  boss?: boolean;
}

export interface MonstersPayload {
  monsters: MonsterDefinition[];
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: 'key' | 'consumable' | 'stat' | 'equipment' | 'system' | 'special';
  slot?: 'weapon' | 'shield';
  effect: Partial<Record<'hp' | 'attack' | 'defense' | 'openDoor' | 'unlock' | 'goldMultiplier', number | string>>;
}

export interface ItemsPayload {
  items: ItemDefinition[];
}

export interface PlayerGrowthPayload {
  initial: {
    floor: string;
    hp: number;
    attack: number;
    defense: number;
    gold: number;
    exp: number;
    keys: KeysState;
  };
}

export interface GameData {
  floors: FloorsPayload;
  monsters: MonstersPayload;
  items: ItemsPayload;
  shops: ShopsPayload;
  npcs: NpcsPayload;
  playerGrowth: PlayerGrowthPayload;
  storyEvents: StoryEventsPayload;
}

export interface ShopOptionDefinition {
  id: string;
  label: string;
  cost: number;
  effect: Partial<Record<'hp' | 'attack' | 'defense', number>>;
}

export interface ShopDefinition {
  id: string;
  name: string;
  speaker: string;
  description: string;
  options: ShopOptionDefinition[];
}

export interface ShopsPayload {
  meta: {
    status: string;
    note: string;
  };
  shops: ShopDefinition[];
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  speaker: string;
  dialogue: string;
}

export interface NpcsPayload {
  meta: {
    status: string;
    note: string;
  };
  npcs: NpcDefinition[];
}

export type StoryEventTrigger = 'floorEnter' | 'position' | 'battleWin';

export type StoryEventAction =
  | { kind: 'replaceTile'; floor?: string; position: Position; tile: string }
  | { kind: 'unlock'; id: string }
  | { kind: 'grantStat'; stat: 'hp' | 'maxHp' | 'attack' | 'defense' | 'gold' | 'exp'; amount: number }
  | { kind: 'grantKey'; color: DoorColor; amount: number }
  | { kind: 'queueDialogue'; entries: StoryDialogueLine[] };

export interface StoryDialogueLine {
  title?: string;
  speaker?: string;
  body: string;
}

export interface StoryEventDefinition {
  id: string;
  floor: string;
  trigger: StoryEventTrigger;
  position?: Position;
  monsterId?: string;
  once?: boolean;
  title: string;
  speaker?: string;
  body: string;
  actions?: StoryEventAction[];
}

export interface StoryBeatDefinition {
  id: string;
  floor: string;
  title: string;
  summary: string;
}

export interface StoryEventsPayload {
  meta: {
    status: string;
    note: string;
  };
  beats: StoryBeatDefinition[];
  runtimeEvents: StoryEventDefinition[];
}

export type TilePresentation =
  | { kind: 'procedural'; label: string }
  | { kind: 'glyph'; glyph: string; color: string }
  | { kind: 'entity'; entityId: string }
  | { kind: 'image'; imageKey: string };

export interface AssetImageDefinition {
  path: string;
  category: string;
  role: string;
  anchor: string;
  displaySize: [number, number];
}

export interface AssetAudioDefinition {
  category: string;
  role: string;
  synth: 'hit' | 'reward' | 'floor';
  volume: number;
}

export interface ReservedAssetDefinition {
  reason: string;
  images: string[];
}

export interface AssetManifest {
  schemaVersion: string;
  tileSize: number;
  audio?: Record<string, AssetAudioDefinition>;
  images: Record<string, AssetImageDefinition>;
  animations: Record<string, {
    frames: string[];
    frameRate: number;
    repeat: number;
  }>;
  monsterDefeatAnimations?: Record<string, string>;
  entitySprites: Record<string, string>;
  tilePresentation: Record<string, TilePresentation>;
  sceneImages?: Record<string, string>;
  reservedImages?: Record<string, ReservedAssetDefinition>;
  generatedSources?: Record<string, {
    tool: string;
    sourcePath: string;
  }>;
}

export interface BattlePreview {
  monster: MonsterDefinition;
  rounds: number;
  loss: number;
  canWin: boolean;
  heroDamage: number;
  monsterDamage: number;
}

export interface MonsterBookEntry {
  id: string;
  tile: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  money: number;
  tier: string;
  loss: number;
  rounds: number;
  canWin: boolean;
}

export interface LastBattle {
  id?: number;
  position?: Position;
  monsterId?: string;
  monsterName: string;
  rounds?: number;
  loss: number;
  gold: number;
  exp: number;
  eventRewards?: StoryRewardView[];
}

export interface StoryRewardView {
  kind: 'map' | 'unlock' | 'stat' | 'key';
  label: string;
  value: string;
}

export interface StoryEventView {
  id: string;
  title: string;
  speaker?: string;
  body: string;
  followups?: StoryDialogueLine[];
  rewards?: StoryRewardView[];
}

export interface ActiveShopView {
  id: string;
  name: string;
  speaker: string;
  description: string;
  options: ShopOptionDefinition[];
}

export interface ActiveNpcView {
  id: string;
  name: string;
  role: string;
  speaker: string;
  dialogue: string;
}

export interface GameSnapshot {
  player: PlayerState;
  floors: Record<string, string[][]>;
  message: string;
  activeFloorName: string;
  targetPreview: BattlePreview | null;
  monsterBook: MonsterBookEntry[];
  activeStoryEvent: StoryEventView | null;
  activeShop: ActiveShopView | null;
  activeNpc: ActiveNpcView | null;
  storyLog: StoryEventView[];
  seenEvents: string[];
  lastBattle: LastBattle | null;
  version: number;
}

export interface SerializedGame {
  player: PlayerState;
  floors: Record<string, string[]>;
  message: string;
  seenEvents: string[];
  storyLog: StoryEventView[];
  lastBattle: LastBattle | null;
}
