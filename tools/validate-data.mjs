import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dataDir = join(root, 'public', 'data');
const assetDir = join(root, 'public');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const floors = readJson(join(dataDir, 'floors.json'));
const monsters = readJson(join(dataDir, 'monsters.seed.json'));
const items = readJson(join(dataDir, 'items.seed.json'));
const shops = readJson(join(dataDir, 'shops.seed.json'));
const npcs = readJson(join(dataDir, 'npcs.seed.json'));
const storyEvents = readJson(join(dataDir, 'story-events.json'));
const routeSmoke = readJson(join(root, 'tools', 'fixtures', 'routes.smoke.json'));
const manifest = readJson(join(root, 'public', 'assets', 'manifest.json'));

const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const floorIds = new Set(floors.floors.map((floor) => floor.id));
const floorById = new Map(floors.floors.map((floor) => [floor.id, floor]));
const monsterIds = new Set(monsters.monsters.map((monster) => monster.id));
const monsterById = new Map(monsters.monsters.map((monster) => [monster.id, monster]));
const itemIds = new Set(items.items.map((item) => item.id));
const itemById = new Map(items.items.map((item) => [item.id, item]));
const shopIds = new Set(shops.shops.map((shop) => shop.id));
const shopById = new Map(shops.shops.map((shop) => [shop.id, shop]));
const npcIds = new Set(npcs.npcs.map((npc) => npc.id));
const npcById = new Map(npcs.npcs.map((npc) => [npc.id, npc]));
const imageIds = new Set(Object.keys(manifest.images));
const audioIds = new Set(Object.keys(manifest.audio ?? {}));
const structuralTiles = new Set(['#', '.', '@', 'Y', 'B', 'R', 'U', 'N']);
const usedEntityIds = new Set();
const usedMonsterIds = new Set();
const usedShopIds = new Set();
const usedNpcIds = new Set();

const directionDelta = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const tileDoors = {
  Y: 'yellow',
  B: 'blue',
  R: 'red'
};

const storyRewardStats = new Set(['hp', 'maxHp', 'attack', 'defense', 'gold', 'exp']);
const storyKeyColors = new Set(['yellow', 'blue', 'red']);
const audioSynths = new Set(['hit', 'reward', 'floor']);
const imageCategories = new Set(['hero', 'tile', 'item', 'monster', 'npc', 'fx', 'menu']);
const imageAnchors = new Set(['center', 'bottom-center']);

function tileAt(grid, x, y) {
  return grid[y]?.[x];
}

function findTile(grid, tile) {
  for (let y = 0; y < grid.length; y += 1) {
    const x = grid[y].indexOf(tile);
    if (x >= 0) return { x, y };
  }
  return null;
}

function eventWritesTile(floorId, tile) {
  return (storyEvents.runtimeEvents ?? []).some((event) =>
    (event.actions ?? []).some((action) =>
      action.kind === 'replaceTile' && (action.floor ?? event.floor) === floorId && action.tile === tile
    )
  );
}

function walkable(tile) {
  return tile && tile !== '#';
}

function reachableFloorTiles(floor) {
  const start = floor.heroStart;
  const seen = new Set();
  const queue = [start];
  const grid = floor.grid;

  while (queue.length) {
    const pos = queue.shift();
    const key = `${pos.x},${pos.y}`;
    if (seen.has(key)) continue;
    seen.add(key);

    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const next = { x: pos.x + dx, y: pos.y + dy };
      const tile = tileAt(grid, next.x, next.y);
      if (walkable(tile)) queue.push(next);
    }
  }

  return seen;
}

for (const floor of floors.floors) {
  const context = `floor ${floor.id}`;
  if (floor.grid.length !== floors.mapSize.rows) {
    fail(`${context}: expected ${floors.mapSize.rows} rows, got ${floor.grid.length}`);
  }

  floor.grid.forEach((row, rowIndex) => {
    if (row.length !== floors.mapSize.cols) {
      fail(`${context}: row ${rowIndex} expected ${floors.mapSize.cols} cols, got ${row.length}`);
    }

    [...row].forEach((tile) => {
      if (!floors.tileLegend[tile]) fail(`${context}: tile "${tile}" is missing from tileLegend`);
      if (!manifest.tilePresentation[tile]) fail(`${context}: tile "${tile}" is missing from asset manifest tilePresentation`);

      if (!structuralTiles.has(tile)) {
        const entityId = floors.entityMap[tile];
        if (!entityId) {
          fail(`${context}: tile "${tile}" is missing from entityMap`);
          return;
        }
        usedEntityIds.add(entityId);
        if (monsterIds.has(entityId)) usedMonsterIds.add(entityId);
        if (shopIds.has(entityId)) usedShopIds.add(entityId);
        if (npcIds.has(entityId)) usedNpcIds.add(entityId);
        if (!monsterIds.has(entityId) && !itemIds.has(entityId) && !shopIds.has(entityId) && !npcIds.has(entityId)) {
          fail(`${context}: entity "${entityId}" for tile "${tile}" is not in monsters, items, shops, or npcs`);
        }
      }
    });
  });

  if (floor.up && !floorIds.has(floor.up)) fail(`${context}: up link points to missing floor ${floor.up}`);
  if (floor.down && !floorIds.has(floor.down)) fail(`${context}: down link points to missing floor ${floor.down}`);

  const startTile = tileAt(floor.grid, floor.heroStart.x, floor.heroStart.y);
  if (!startTile) fail(`${context}: heroStart is outside map`);
  if (startTile === '#') fail(`${context}: heroStart is inside a wall`);

  if (floor.up) {
    const target = floors.floors.find((candidate) => candidate.id === floor.up);
    if (target && !findTile(target.grid, 'N') && !eventWritesTile(target.id, 'N')) {
      warn(`${context}: linked up floor ${floor.up} has no down stair tile`);
    }
  }
  if (floor.down) {
    const target = floors.floors.find((candidate) => candidate.id === floor.down);
    if (target && !findTile(target.grid, 'U') && !eventWritesTile(target.id, 'U')) {
      warn(`${context}: linked down floor ${floor.down} has no up stair tile`);
    }
  }

  if (floor.id === floors.floors[0]?.id) {
    const reachable = reachableFloorTiles(floor);
    const reachableKey = [...floor.grid.join('')].includes('K');
    const reachableYellowKey = floor.grid.some((row, y) => [...row].some((tile, x) => tile === 'K' && reachable.has(`${x},${y}`)));
    if (reachableKey && !reachableYellowKey) fail(`${context}: first floor has no reachable yellow key before doors`);
  }
}

for (const [key, image] of Object.entries(manifest.images)) {
  if (!image.path) {
    fail(`asset ${key}: path is required`);
  } else {
    if (!image.path.startsWith('/assets/')) fail(`asset ${key}: path must stay under /assets/`);
    if (image.path.includes('..')) fail(`asset ${key}: path cannot contain path traversal`);
    const localPath = join(assetDir, image.path.replace(/^\//, ''));
    if (!existsSync(localPath)) fail(`asset ${key}: missing file ${image.path}`);
  }
  if (!imageCategories.has(image.category)) fail(`asset ${key}: category ${image.category} is unsupported`);
  if (!image.role) fail(`asset ${key}: role is required`);
  if (!imageAnchors.has(image.anchor)) fail(`asset ${key}: anchor ${image.anchor} is unsupported`);
  if (!Array.isArray(image.displaySize) || image.displaySize.length !== 2) {
    fail(`asset ${key}: displaySize must be a [width, height] pair`);
  } else {
    const [width, height] = image.displaySize;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      fail(`asset ${key}: displaySize values must be positive numbers`);
    }
  }
}

for (const [sourceKey, source] of Object.entries(manifest.generatedSources ?? {})) {
  if (!source.tool) fail(`generated source ${sourceKey}: tool is required`);
  if (!source.sourcePath) {
    fail(`generated source ${sourceKey}: sourcePath is required`);
    continue;
  }
  if (!source.sourcePath.startsWith('/assets/generated/')) {
    fail(`generated source ${sourceKey}: sourcePath must stay under /assets/generated/`);
  }
  if (source.sourcePath.includes('..')) {
    fail(`generated source ${sourceKey}: sourcePath cannot contain path traversal`);
  }
  if (Object.hasOwn(source, 'promptSummary')) {
    fail(`generated source ${sourceKey}: promptSummary should stay out of the public manifest`);
  }

  const localPath = join(assetDir, source.sourcePath.replace(/^\//, ''));
  if (!existsSync(localPath)) fail(`generated source ${sourceKey}: missing source file ${source.sourcePath}`);
}

for (const [animationKey, animation] of Object.entries(manifest.animations)) {
  for (const frame of animation.frames) {
    if (!imageIds.has(frame)) fail(`animation ${animationKey}: missing frame image ${frame}`);
  }
}

for (const [monsterId, animationKey] of Object.entries(manifest.monsterDefeatAnimations ?? {})) {
  if (!monsterIds.has(monsterId)) fail(`monster defeat animation ${monsterId}: monster does not exist`);
  if (!manifest.animations[animationKey]) fail(`monster defeat animation ${monsterId}: animation ${animationKey} does not exist`);
}

for (const [audioKey, audio] of Object.entries(manifest.audio ?? {})) {
  if (!audio.category) fail(`audio ${audioKey}: category is required`);
  if (!audio.role) fail(`audio ${audioKey}: role is required`);
  if (!audioSynths.has(audio.synth)) fail(`audio ${audioKey}: synth ${audio.synth} is unsupported`);
  if (!Number.isFinite(audio.volume) || audio.volume < 0 || audio.volume > 1) {
    fail(`audio ${audioKey}: volume must be between 0 and 1`);
  }
}

for (const [tile, presentation] of Object.entries(manifest.tilePresentation)) {
  if (!floors.tileLegend[tile]) fail(`manifest tilePresentation "${tile}": tile is not in floor tileLegend`);

  if (presentation.kind === 'image' && !imageIds.has(presentation.imageKey)) {
    fail(`manifest tilePresentation "${tile}": image key ${presentation.imageKey} missing from manifest.images`);
  }

  if (presentation.kind === 'entity') {
    if (!monsterIds.has(presentation.entityId) && !itemIds.has(presentation.entityId) && !shopIds.has(presentation.entityId) && !npcIds.has(presentation.entityId)) {
      fail(`manifest tilePresentation "${tile}": entity ${presentation.entityId} missing from data`);
    }
    const spriteKey = manifest.entitySprites[presentation.entityId];
    if (monsterIds.has(presentation.entityId) && !spriteKey) {
      fail(`manifest tilePresentation "${tile}": monster entity ${presentation.entityId} missing sprite mapping`);
    } else if (spriteKey && !imageIds.has(spriteKey)) {
      fail(`manifest tilePresentation "${tile}": sprite key ${spriteKey} missing from manifest.images`);
    }
  }
}

for (const monsterId of usedMonsterIds) {
  const spriteKey = manifest.entitySprites[monsterId];
  if (!spriteKey) {
    fail(`monster ${monsterId}: missing manifest.entitySprites mapping`);
  } else if (!imageIds.has(spriteKey)) {
    fail(`monster ${monsterId}: sprite key ${spriteKey} missing from manifest.images`);
  }
}

for (const entityId of usedEntityIds) {
  if (!monsterIds.has(entityId) && !itemIds.has(entityId) && !shopIds.has(entityId) && !npcIds.has(entityId)) {
    fail(`used entity ${entityId} is unresolved`);
  }
}

for (const shop of shops.shops) {
  if (!shop.options?.length) fail(`shop ${shop.id}: must have at least one option`);
  for (const option of shop.options ?? []) {
    if (!Number.isFinite(option.cost) || option.cost < 0) fail(`shop ${shop.id}: option ${option.id} has invalid cost`);
    const effect = option.effect ?? {};
    if (!['hp', 'attack', 'defense'].some((key) => typeof effect[key] === 'number')) {
      fail(`shop ${shop.id}: option ${option.id} has no supported numeric effect`);
    }
  }
}

for (const npc of npcs.npcs) {
  if (!npc.name || !npc.speaker || !npc.dialogue) {
    fail(`npc ${npc.id}: name, speaker, and dialogue are required`);
  }
}

for (const event of storyEvents.runtimeEvents ?? []) {
  const context = `story event ${event.id}`;
  const floor = floors.floors.find((candidate) => candidate.id === event.floor);
  if (!floor) {
    fail(`${context}: floor ${event.floor} does not exist`);
    continue;
  }

  if (!['floorEnter', 'position', 'battleWin'].includes(event.trigger)) {
    fail(`${context}: trigger ${event.trigger} is unsupported`);
  }

  if (event.trigger === 'position') {
    if (!event.position) fail(`${context}: position trigger requires position`);
    if (event.position && !tileAt(floor.grid, event.position.x, event.position.y)) {
      fail(`${context}: trigger position is outside map`);
    }
  }

  if (event.trigger === 'battleWin') {
    if (!event.monsterId) fail(`${context}: battleWin trigger requires monsterId`);
    if (event.monsterId && !monsterIds.has(event.monsterId)) {
      fail(`${context}: battleWin monster ${event.monsterId} does not exist`);
    }
  }

  for (const action of event.actions ?? []) {
    if (action.kind === 'replaceTile') {
      const targetFloor = action.floor
        ? floors.floors.find((candidate) => candidate.id === action.floor)
        : floor;
      if (!targetFloor) {
        fail(`${context}: replaceTile target floor ${action.floor} does not exist`);
        continue;
      }
      if (!tileAt(targetFloor.grid, action.position.x, action.position.y)) {
        fail(`${context}: replaceTile position is outside map`);
      }
      if (!floors.tileLegend[action.tile]) {
        fail(`${context}: replaceTile writes unknown tile "${action.tile}"`);
      }
      if (!manifest.tilePresentation[action.tile]) {
        fail(`${context}: replaceTile tile "${action.tile}" is missing from asset manifest`);
      }
    } else if (action.kind === 'grantStat') {
      if (!storyRewardStats.has(action.stat)) fail(`${context}: grantStat stat ${action.stat} is unsupported`);
      if (!Number.isFinite(action.amount) || action.amount <= 0) {
        fail(`${context}: grantStat ${action.stat} requires a positive amount`);
      }
    } else if (action.kind === 'grantKey') {
      if (!storyKeyColors.has(action.color)) fail(`${context}: grantKey color ${action.color} is unsupported`);
      if (!Number.isFinite(action.amount) || action.amount <= 0) {
        fail(`${context}: grantKey ${action.color} requires a positive amount`);
      }
    } else if (action.kind === 'queueDialogue') {
      if (!Array.isArray(action.entries) || action.entries.length === 0) {
        fail(`${context}: queueDialogue requires at least one entry`);
      }
      for (const [index, entry] of (action.entries ?? []).entries()) {
        if (!entry.body) fail(`${context}: queueDialogue entry ${index} requires body`);
      }
    } else if (action.kind !== 'unlock') {
      fail(`${context}: action kind ${action.kind} is unsupported`);
    }
  }
}

function cloneRouteGrids() {
  return Object.fromEntries(
    floors.floors.map((floor) => [floor.id, floor.grid.map((row) => row.replace('@', '.').split(''))])
  );
}

function makeInitialRouteState(route) {
  const firstFloor = floorById.get('F02_PRISON') ?? floors.floors[0];
  const initial = readJson(join(dataDir, 'player-growth.json')).initial;
  const state = {
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
      equipment: { weapon: '木剑', shield: '皮盾' },
      unlocks: [],
      direction: 'up'
    },
    grids: cloneRouteGrids(),
    seenEvents: [],
    storyLog: [],
    message: '',
    lastBattle: null,
    activeShop: null,
    activeNpc: null
  };

  if (route.start === 'initial') {
    triggerRouteEvent(state, 'floorEnter');
    return state;
  }

  state.player = {
    ...state.player,
    floor: route.start.floor,
    x: route.start.position.x,
    y: route.start.position.y,
    hp: route.start.hp,
    maxHp: route.start.maxHp,
    attack: route.start.attack,
    defense: route.start.defense,
    gold: route.start.gold,
    exp: route.start.exp,
    keys: { ...route.start.keys },
    equipment: { ...route.start.equipment },
    unlocks: [...(route.start.unlocks ?? [])],
    direction: route.start.direction ?? 'up'
  };
  state.seenEvents = [...(route.start.seenEvents ?? [])];
  state.storyLog = [...(route.start.storyLog ?? [])];
  return state;
}

function currentRouteGrid(state) {
  return state.grids[state.player.floor];
}

function routeTileAt(state, position) {
  return currentRouteGrid(state)[position.y]?.[position.x];
}

function setRouteTile(state, position, tile) {
  currentRouteGrid(state)[position.y][position.x] = tile;
}

function monsterFromTile(tile) {
  const id = floors.entityMap[tile];
  return id ? monsterById.get(id) : null;
}

function itemFromTile(tile) {
  const id = floors.entityMap[tile];
  return id ? itemById.get(id) : null;
}

function shopFromTile(tile) {
  const id = floors.entityMap[tile];
  return id ? shopById.get(id) : null;
}

function npcFromTile(tile) {
  const id = floors.entityMap[tile];
  return id ? npcById.get(id) : null;
}

function previewRouteBattle(player, monster) {
  const heroDamage = Math.max(1, player.attack - monster.defense);
  const monsterDamage = Math.max(0, monster.attack - player.defense);
  const rounds = Math.ceil(monster.hp / heroDamage);
  const loss = monsterDamage * Math.max(0, rounds - 1);
  return { rounds, loss, canWin: player.hp > loss };
}

function triggerRouteEvent(state, trigger, position, context = {}) {
  const event = (storyEvents.runtimeEvents ?? []).find((candidate) => {
    if (candidate.trigger !== trigger || candidate.floor !== state.player.floor) return false;
    if (candidate.once !== false && state.seenEvents.includes(candidate.id)) return false;
    if (candidate.trigger === 'position') {
      return Boolean(position && candidate.position && candidate.position.x === position.x && candidate.position.y === position.y);
    }
    if (candidate.trigger === 'battleWin') {
      return Boolean(candidate.monsterId && candidate.monsterId === context.monsterId);
    }
    return true;
  });
  if (!event) return;

  if (event.once !== false) state.seenEvents.push(event.id);
  for (const action of event.actions ?? []) {
    if (action.kind === 'replaceTile') {
      const floorId = action.floor ?? event.floor;
      const grid = state.grids[floorId];
      if (grid?.[action.position.y]?.[action.position.x] !== undefined) {
        grid[action.position.y][action.position.x] = action.tile;
      }
    }
    if (action.kind === 'unlock' && !state.player.unlocks.includes(action.id)) {
      state.player.unlocks.push(action.id);
    }
    if (action.kind === 'grantStat') {
      applyRouteStoryStatReward(state, action.stat, action.amount);
    }
    if (action.kind === 'grantKey') {
      state.player.keys[action.color] += action.amount;
    }
  }

  const followups = (event.actions ?? [])
    .filter((action) => action.kind === 'queueDialogue')
    .flatMap((action) => action.entries);
  const entry = { id: event.id, title: event.title, speaker: event.speaker, body: event.body, followups };
  state.storyLog = [entry, ...state.storyLog.filter((candidate) => candidate.id !== event.id)].slice(0, 5);
  state.message = event.speaker ? `${event.speaker}：${event.body}` : `${event.title}：${event.body}`;
}

function applyRouteStoryStatReward(state, stat, amount) {
  if (stat === 'maxHp') {
    state.player.maxHp += amount;
    state.player.hp += amount;
    return;
  }
  if (stat === 'hp') {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount);
    return;
  }
  state.player[stat] += amount;
}

function useRouteStair(state, tile) {
  const floor = floorById.get(state.player.floor);
  const targetId = tile === 'U' ? floor.up : floor.down;
  if (!targetId) throw new Error('stair has no target');
  const target = floorById.get(targetId);
  if (!target) throw new Error(`missing stair target ${targetId}`);
  state.player.floor = target.id;
  const opposite = tile === 'U' ? 'N' : 'U';
  const landing = findTile(state.grids[target.id].map((row) => row.join('')), opposite) ?? target.heroStart;
  state.player.x = landing.x;
  state.player.y = landing.y;
  triggerRouteEvent(state, 'floorEnter');
  if (!state.message) state.message = `进入 ${target.name}。`;
}

function applyRouteItem(state, position, tile) {
  const item = itemFromTile(tile);
  if (!item) throw new Error(`missing item for tile ${tile}`);
  const effect = item.effect;
  if (item.type === 'key' && typeof effect.openDoor === 'string') state.player.keys[effect.openDoor] += 1;
  if (typeof effect.hp === 'number') state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.hp);
  if (typeof effect.attack === 'number') state.player.attack += effect.attack;
  if (typeof effect.defense === 'number') state.player.defense += effect.defense;
  if (typeof effect.unlock === 'string' && !state.player.unlocks.includes(effect.unlock)) state.player.unlocks.push(effect.unlock);
  if (item.type === 'equipment' && item.slot) state.player.equipment[item.slot] = item.name;
  setRouteTile(state, position, '.');
  state.player.x = position.x;
  state.player.y = position.y;
  state.activeShop = null;
  state.activeNpc = null;
  state.message = `获得 ${item.name}。`;
}

function applyRouteShopEffect(state, option) {
  if (typeof option.effect.hp === 'number') {
    state.player.maxHp += option.effect.hp;
    state.player.hp += option.effect.hp;
  }
  if (typeof option.effect.attack === 'number') state.player.attack += option.effect.attack;
  if (typeof option.effect.defense === 'number') state.player.defense += option.effect.defense;
}

function applyRouteShopPurchase(state, optionId) {
  const shop = state.activeShop ? shopById.get(state.activeShop) : null;
  const option = shop?.options.find((candidate) => candidate.id === optionId);
  if (!shop || !option) throw new Error(`no active shop option ${optionId}`);
  if (state.player.gold < option.cost) throw new Error(`shop option ${optionId} needs ${option.cost} gold, got ${state.player.gold}`);
  state.player.gold -= option.cost;
  applyRouteShopEffect(state, option);
  state.message = `${shop.speaker}：成交，${option.label}。`;
}

function applyRouteMove(state, direction) {
  const delta = directionDelta[direction];
  if (!delta) throw new Error(`unknown direction ${direction}`);
  const next = { x: state.player.x + delta.x, y: state.player.y + delta.y };
  state.player.direction = direction;
  const tile = routeTileAt(state, next);

  if (!tile || tile === '#') throw new Error(`blocked by wall at ${state.player.floor}:${next.x},${next.y}`);

  if (tileDoors[tile]) {
    const color = tileDoors[tile];
    if (state.player.keys[color] <= 0) throw new Error(`missing ${color} key at ${state.player.floor}:${next.x},${next.y}`);
    state.player.keys[color] -= 1;
    setRouteTile(state, next, '.');
    state.player.x = next.x;
    state.player.y = next.y;
    state.activeShop = null;
    state.activeNpc = null;
    state.message = `opened ${color} door`;
    return;
  }

  const monster = monsterFromTile(tile);
  if (monster) {
    const preview = previewRouteBattle(state.player, monster);
    if (!preview.canWin) throw new Error(`cannot defeat ${monster.name}; expected loss ${preview.loss}, hp ${state.player.hp}`);
    state.player.hp -= preview.loss;
    state.player.gold += monster.money;
    state.player.exp += monster.money;
    setRouteTile(state, next, '.');
    state.player.x = next.x;
    state.player.y = next.y;
    state.activeShop = null;
    state.activeNpc = null;
    state.lastBattle = monster.name;
    state.message = `击败 ${monster.name}`;
    triggerRouteEvent(state, 'battleWin', next, { monsterId: monster.id });
    return;
  }

  if (itemFromTile(tile)) {
    applyRouteItem(state, next, tile);
    return;
  }

  const shop = shopFromTile(tile);
  if (shop) {
    state.player.x = next.x;
    state.player.y = next.y;
    state.activeShop = shop.id;
    state.activeNpc = null;
    state.message = `${shop.speaker}：${shop.description}`;
    return;
  }

  const npc = npcFromTile(tile);
  if (npc) {
    state.player.x = next.x;
    state.player.y = next.y;
    state.activeShop = null;
    state.activeNpc = npc.id;
    state.message = `${npc.speaker}：${npc.dialogue}`;
    return;
  }

  if (tile === 'U' || tile === 'N') {
    state.activeShop = null;
    state.activeNpc = null;
    useRouteStair(state, tile);
    return;
  }

  state.player.x = next.x;
  state.player.y = next.y;
  state.activeShop = null;
  state.activeNpc = null;
  triggerRouteEvent(state, 'position', next);
  if (!state.message) state.message = 'move';
}

function assertRoute(route, state) {
  const expected = route.expect ?? {};
  if (expected.floor && state.player.floor !== expected.floor) {
    throw new Error(`expected floor ${expected.floor}, got ${state.player.floor}`);
  }
  if (expected.position && (state.player.x !== expected.position.x || state.player.y !== expected.position.y)) {
    throw new Error(`expected position ${expected.position.x},${expected.position.y}, got ${state.player.x},${state.player.y}`);
  }
  if (typeof expected.minHp === 'number' && state.player.hp < expected.minHp) {
    throw new Error(`expected hp >= ${expected.minHp}, got ${state.player.hp}`);
  }
  for (const stat of ['hp', 'maxHp', 'attack', 'defense', 'gold', 'exp']) {
    if (typeof expected[stat] === 'number' && state.player[stat] !== expected[stat]) {
      throw new Error(`expected ${stat} ${expected[stat]}, got ${state.player[stat]}`);
    }
  }
  for (const [color, value] of Object.entries(expected.keys ?? {})) {
    if (state.player.keys[color] !== value) throw new Error(`expected ${color} keys ${value}, got ${state.player.keys[color]}`);
  }
  for (const eventId of expected.seenEvents ?? []) {
    if (!state.seenEvents.includes(eventId)) throw new Error(`expected seen event ${eventId}`);
  }
  for (const unlockId of expected.unlocks ?? []) {
    if (!state.player.unlocks.includes(unlockId)) throw new Error(`expected unlock ${unlockId}`);
  }
  for (const expectedTile of expected.tiles ?? []) {
    const floorId = expectedTile.floor ?? state.player.floor;
    const actualTile = state.grids[floorId]?.[expectedTile.position.y]?.[expectedTile.position.x];
    if (actualTile !== expectedTile.tile) {
      throw new Error(`expected tile ${floorId}:${expectedTile.position.x},${expectedTile.position.y} to be ${expectedTile.tile}, got ${actualTile}`);
    }
  }
  if (expected.lastBattle && state.lastBattle !== expected.lastBattle) {
    throw new Error(`expected last battle ${expected.lastBattle}, got ${state.lastBattle}`);
  }
  if (expected.activeNpc && state.activeNpc !== expected.activeNpc) {
    throw new Error(`expected active npc ${expected.activeNpc}, got ${state.activeNpc}`);
  }
  if (expected.activeShop && state.activeShop !== expected.activeShop) {
    throw new Error(`expected active shop ${expected.activeShop}, got ${state.activeShop}`);
  }
  if (expected.messageIncludes && !state.message.includes(expected.messageIncludes)) {
    throw new Error(`expected message to include ${expected.messageIncludes}, got ${state.message}`);
  }
  for (const text of expected.storyLogIncludes ?? []) {
    const storyText = state.storyLog
      .map((entry) => [
        entry.title,
        entry.speaker,
        entry.body,
        ...(entry.followups ?? []).flatMap((line) => [line.title, line.speaker, line.body])
      ].filter(Boolean).join(' '))
      .join(' ');
    if (!storyText.includes(text)) throw new Error(`expected story log to include ${text}, got ${storyText}`);
  }
}

for (const route of routeSmoke.routes ?? []) {
  try {
    const state = makeInitialRouteState(route);
    const segmentsByStep = new Map();
    for (const [index, segment] of (route.segments ?? []).entries()) {
      const context = `route ${route.id} segment ${segment.id ?? index}`;
      if (!segment.id) throw new Error(`${context}: id is required`);
      if (!segment.title) throw new Error(`${context}: title is required`);
      if (!segment.rationale) throw new Error(`${context}: rationale is required`);
      if (!Number.isInteger(segment.afterStep) || segment.afterStep < 0 || segment.afterStep > route.steps.length) {
        throw new Error(`${context}: afterStep must be between 0 and ${route.steps.length}`);
      }
      if (segment.expect && typeof segment.expect !== 'object') {
        throw new Error(`${context}: expect must be an object when present`);
      }
      const entries = segmentsByStep.get(segment.afterStep) ?? [];
      entries.push(segment);
      segmentsByStep.set(segment.afterStep, entries);
    }

    for (const segment of segmentsByStep.get(0) ?? []) {
      try {
        assertRoute({ expect: segment.expect ?? {} }, state);
      } catch (error) {
        throw new Error(`segment ${segment.id}: ${error.message}`);
      }
    }

    route.steps.forEach((step, index) => {
      if (typeof step === 'string') {
        applyRouteMove(state, step);
      } else if (step.buy) {
        applyRouteShopPurchase(state, step.buy);
      } else {
        throw new Error(`unsupported route step ${JSON.stringify(step)}`);
      }

      for (const segment of segmentsByStep.get(index + 1) ?? []) {
        try {
          assertRoute({ expect: segment.expect ?? {} }, state);
        } catch (error) {
          throw new Error(`segment ${segment.id}: ${error.message}`);
        }
      }
    });
    assertRoute(route, state);
  } catch (error) {
    fail(`route ${route.id}: ${error.message}`);
  }
}

if (warnings.length) {
  console.warn('Data validation warnings:');
  warnings.forEach((message) => console.warn(`- ${message}`));
}

if (errors.length) {
  console.error('Data validation failed:');
  errors.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Data validation passed: ${floors.floors.length} floors, ${usedEntityIds.size} used entities, ${Object.keys(manifest.images).length} images, ${Object.keys(manifest.generatedSources ?? {}).length} generated sources, ${audioIds.size} audio cues, ${Object.keys(manifest.monsterDefeatAnimations ?? {}).length} monster defeat animations, ${(routeSmoke.routes ?? []).length} smoke routes.`);
