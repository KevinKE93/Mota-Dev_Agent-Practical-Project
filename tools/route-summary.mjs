import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const routeSmoke = JSON.parse(readFileSync(join(root, 'public', 'data', 'routes.smoke.json'), 'utf8'));

const args = process.argv.slice(2);
const routeId = args.find((arg) => !arg.startsWith('--'));

function formatStart(start) {
  if (start === 'initial') return 'initial';
  return `${start.floor}@${start.position.x},${start.position.y}`;
}

function countSteps(steps) {
  const counts = {
    moves: 0,
    buys: {}
  };

  for (const step of steps) {
    if (typeof step === 'string') {
      counts.moves += 1;
    } else if (step.buy) {
      counts.buys[step.buy] = (counts.buys[step.buy] ?? 0) + 1;
    }
  }

  return counts;
}

function formatBuys(buys) {
  const entries = Object.entries(buys);
  return entries.length ? entries.map(([id, count]) => `${id} x${count}`).join(', ') : 'none';
}

function formatPosition(expect) {
  if (!expect?.floor && !expect?.position) return '';
  const floor = expect.floor ?? '?';
  const position = expect.position ? `${expect.position.x},${expect.position.y}` : '?,?';
  return `${floor}@${position}`;
}

function formatStats(expect) {
  const stats = [];
  for (const stat of ['hp', 'maxHp', 'attack', 'defense', 'gold', 'exp']) {
    if (typeof expect?.[stat] === 'number') stats.push(`${stat} ${expect[stat]}`);
  }
  if (typeof expect?.minHp === 'number') stats.push(`minHp ${expect.minHp}`);
  return stats.join(', ');
}

function formatKeys(keys) {
  if (!keys) return '';
  return Object.entries(keys).map(([color, value]) => `${color} ${value}`).join(', ');
}

function formatExpectation(expect = {}) {
  const parts = [];
  const position = formatPosition(expect);
  const stats = formatStats(expect);
  const keys = formatKeys(expect.keys);

  if (position) parts.push(position);
  if (stats) parts.push(stats);
  if (keys) parts.push(`keys ${keys}`);
  if (expect.activeShop) parts.push(`shop ${expect.activeShop}`);
  if (expect.activeNpc) parts.push(`npc ${expect.activeNpc}`);
  if (expect.lastBattle) parts.push(`lastBattle ${expect.lastBattle}`);
  if (expect.seenEvents?.length) parts.push(`events ${expect.seenEvents.join(', ')}`);
  if (expect.unlocks?.length) parts.push(`unlocks ${expect.unlocks.join(', ')}`);
  if (expect.tiles?.length) {
    const tiles = expect.tiles.map((tile) => `${tile.floor ?? 'current'}@${tile.position.x},${tile.position.y}=${tile.tile}`);
    parts.push(`tiles ${tiles.join(', ')}`);
  }
  if (expect.messageIncludes) parts.push(`message includes "${expect.messageIncludes}"`);
  if (expect.storyLogIncludes?.length) parts.push(`story log includes ${expect.storyLogIncludes.map((item) => `"${item}"`).join(', ')}`);

  return parts.length ? parts.join(' | ') : 'no explicit expectation';
}

function printRouteList(routes) {
  console.log(`# Route Smoke Summary`);
  console.log('');
  for (const route of routes) {
    const counts = countSteps(route.steps ?? []);
    const segmentCount = route.segments?.length ?? 0;
    console.log(`- ${route.id}: ${route.steps?.length ?? 0} steps, ${counts.moves} moves, buys ${formatBuys(counts.buys)}, ${segmentCount} segments`);
  }
}

function printRoute(route) {
  const counts = countSteps(route.steps ?? []);
  console.log(`# ${route.id}`);
  console.log('');
  console.log(route.description);
  console.log('');
  console.log(`- Start: ${formatStart(route.start)}`);
  console.log(`- Steps: ${route.steps?.length ?? 0} total, ${counts.moves} moves, buys ${formatBuys(counts.buys)}`);
  console.log(`- Final: ${formatExpectation(route.expect)}`);

  if (!route.segments?.length) {
    console.log('- Segments: none');
    return;
  }

  console.log('');
  console.log('## Segments');
  for (const segment of route.segments) {
    console.log('');
    console.log(`### ${segment.afterStep}. ${segment.title} (${segment.id})`);
    console.log(segment.rationale);
    console.log(`Expect: ${formatExpectation(segment.expect)}`);
  }
}

if (routeId) {
  const route = (routeSmoke.routes ?? []).find((candidate) => candidate.id === routeId);
  if (!route) {
    console.error(`Unknown route "${routeId}". Available routes:`);
    (routeSmoke.routes ?? []).forEach((candidate) => console.error(`- ${candidate.id}`));
    process.exit(1);
  }
  printRoute(route);
} else {
  printRouteList(routeSmoke.routes ?? []);
}
