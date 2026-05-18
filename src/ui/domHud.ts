import type { BattlePreview, GameSnapshot, LastBattle, StoryRewardView } from '../types';
import type { GameStore } from '../state/GameStore';

export function mountHud(store: GameStore) {
  const hudRoot = document.querySelector<HTMLElement>('#hud-root');
  const sideRoot = document.querySelector<HTMLElement>('#side-root');
  const toastRoot = document.querySelector<HTMLElement>('#toast-root');
  const victoryRoot = document.querySelector<HTMLElement>('#victory-root');
  const resetRun = document.querySelector<HTMLButtonElement>('#resetRun');
  if (!hudRoot || !sideRoot) throw new Error('Missing HUD roots');

  resetRun?.addEventListener('click', () => store.startNewRun());
  store.subscribe((snapshot) => {
    hudRoot.innerHTML = renderHud(snapshot);
    sideRoot.innerHTML = renderSide(snapshot);
    if (toastRoot) toastRoot.innerHTML = renderToast(snapshot);
    if (victoryRoot) {
      victoryRoot.innerHTML = renderVictory(snapshot);
      wireVictory(victoryRoot, store);
    }
    wireButtons(sideRoot, store);
  });
}

function wireButtons(root: HTMLElement, store: GameStore) {
  root.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((button) => {
    button.addEventListener('click', () => store.saveSlot(Number(button.dataset.save)));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-load]').forEach((button) => {
    button.addEventListener('click', () => store.loadSlot(Number(button.dataset.load)));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => store.deleteSlot(Number(button.dataset.delete)));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-shop-buy]').forEach((button) => {
    button.addEventListener('click', () => store.buyShopOption(String(button.dataset.shopBuy)));
  });
}

function wireVictory(root: HTMLElement, store: GameStore) {
  root.querySelector<HTMLButtonElement>('[data-victory-dismiss]')?.addEventListener('click', () => store.dismissVictory());
  root.querySelector<HTMLButtonElement>('[data-victory-reset]')?.addEventListener('click', () => store.startNewRun());
}

function renderHud(snapshot: GameSnapshot) {
  const player = snapshot.player;
  return `
    <section class="panel hero-status">
      <p class="eyebrow">Current floor</p>
      <h1>${snapshot.activeFloorName}</h1>
      ${renderObjective(snapshot)}
      <div class="hp-readout">
        <span>HP</span>
        <strong>${player.hp}</strong>
        <i style="--value:${Math.max(6, Math.round((player.hp / player.maxHp) * 100))}%"></i>
      </div>
    </section>
    <section class="panel stats-panel">
      ${statRow('攻击', player.attack, 'atk')}
      ${statRow('防御', player.defense, 'def')}
      ${statRow('金币', player.gold, 'gold')}
      ${statRow('经验', player.exp, 'exp')}
    </section>
    <section class="panel keys-panel">
      <p class="eyebrow">Keys</p>
      <div class="key-grid">
        ${keyBadge('黄', player.keys.yellow, 'yellow')}
        ${keyBadge('蓝', player.keys.blue, 'blue')}
        ${keyBadge('红', player.keys.red, 'red')}
      </div>
    </section>
    <section class="panel equipment-panel">
      <p class="eyebrow">Equipment</p>
      <div class="gear-row"><span>武器</span><strong>${player.equipment.weapon}</strong></div>
      <div class="gear-row"><span>盾牌</span><strong>${player.equipment.shield}</strong></div>
      <div class="unlock-row">${player.unlocks.length ? player.unlocks.map((item) => `<span>${unlockLabel(item)}</span>`).join('') : '<em>尚未解锁系统道具</em>'}</div>
    </section>
  `;
}

function renderObjective(snapshot: GameSnapshot) {
  const objective = snapshot.objective;
  return `
    <div class="objective-strip">
      <div>
        <span>目标 ${objective.progressLabel}</span>
        <strong>${objective.title}</strong>
        <p>${objective.body}</p>
      </div>
      <ol aria-label="Demo 通关进度">
        ${objective.milestones.map((milestone) => `
          <li class="${milestone.completed ? 'done' : ''}">
            <span>${milestone.label}</span>
          </li>
        `).join('')}
      </ol>
    </div>
  `;
}

function renderSide(snapshot: GameSnapshot) {
  return `
    ${renderStoryEvent(snapshot)}
    ${renderShop(snapshot)}
    ${renderNpc(snapshot)}
    ${renderBattlePreview(snapshot.targetPreview)}
    ${renderLastBattle(snapshot.lastBattle)}
    ${renderMonsterBook(snapshot)}
    <section class="panel save-panel">
      <p class="eyebrow">Local saves</p>
      ${[1, 2, 3].map((slot) => `
        <div class="save-row">
          <strong>槽 ${slot}</strong>
          <span>
            <button data-save="${slot}">存</button>
            <button data-load="${slot}">读</button>
            <button data-delete="${slot}" aria-label="删除存档 ${slot}">×</button>
          </span>
        </div>
      `).join('')}
    </section>
  `;
}

function renderToast(snapshot: GameSnapshot) {
  return `
    <div class="game-toast" data-version="${snapshot.version}">
      <span>Log</span>
      <strong>${snapshot.message}</strong>
    </div>
  `;
}

function renderVictory(snapshot: GameSnapshot) {
  if (!snapshot.victory.visible) return '';
  const player = snapshot.player;
  return `
    <section class="victory-panel">
      <p class="eyebrow">Trial clear</p>
      <h2>紫焰试炼完成</h2>
      <p>龙首守卫已被击败，星镜塔台重新显影。当前路线已形成完整通关闭环。</p>
      <div class="victory-stats">
        <span>HP <strong>${player.hp}</strong></span>
        <span>ATK <strong>${player.attack}</strong></span>
        <span>DEF <strong>${player.defense}</strong></span>
        <span>Gold <strong>${player.gold}</strong></span>
      </div>
      <div class="victory-actions">
        <button type="button" data-victory-dismiss>继续探索</button>
        <button type="button" data-victory-reset>重新开始</button>
      </div>
    </section>
  `;
}

function renderNpc(snapshot: GameSnapshot) {
  if (!snapshot.activeNpc) return '';
  const npc = snapshot.activeNpc;
  return `
    <section class="panel npc-panel">
      <p class="eyebrow">NPC</p>
      <h2>${npc.name}</h2>
      <p><strong>${npc.speaker}</strong>${npc.dialogue}</p>
    </section>
  `;
}

function renderShop(snapshot: GameSnapshot) {
  if (!snapshot.activeShop) return '';
  const shop = snapshot.activeShop;
  return `
    <section class="panel shop-panel">
      <p class="eyebrow">Shop</p>
      <h2>${shop.name}</h2>
      <p><strong>${shop.speaker}</strong>${shop.description}</p>
      <div class="shop-options">
        ${shop.options.map((option) => {
          const disabled = snapshot.player.gold < option.cost ? 'disabled' : '';
          return `
            <button data-shop-buy="${option.id}" ${disabled}>
              <span>${option.label}</span>
              <strong>${option.cost} 金币</strong>
            </button>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderStoryEvent(snapshot: GameSnapshot) {
  if (!snapshot.activeStoryEvent) return '';
  const event = snapshot.activeStoryEvent;
  return `
    <section class="panel story-panel">
      <p class="eyebrow">Story event</p>
      <h2>${event.title}</h2>
      <p>${event.speaker ? `<strong>${event.speaker}</strong>` : ''}${event.body}</p>
      ${renderRewardChips(event.rewards)}
      ${event.followups?.length ? `
        <div class="story-followups">
          ${event.followups.map((line) => `
            <article>
              ${line.title ? `<h3>${line.title}</h3>` : ''}
              <p>${line.speaker ? `<strong>${line.speaker}</strong>` : ''}${line.body}</p>
            </article>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function renderMonsterBook(snapshot: GameSnapshot) {
  if (!snapshot.player.unlocks.includes('monsterBook')) {
    return `
      <section class="panel monster-book-panel locked">
        <p class="eyebrow">Monster book</p>
        <h2>未取得怪物手册</h2>
        <p class="muted">拾取手册后，会按当前楼层列出怪物属性、预计损耗和奖励。</p>
      </section>
    `;
  }

  if (!snapshot.monsterBook.length) {
    return `
      <section class="panel monster-book-panel">
        <p class="eyebrow">Monster book</p>
        <h2>本层没有怪物</h2>
      </section>
    `;
  }

  return `
    <section class="panel monster-book-panel">
      <p class="eyebrow">Monster book</p>
      <div class="book-list">
        ${snapshot.monsterBook.map((entry) => `
          <article class="${entry.canWin ? 'book-entry can-win' : 'book-entry danger'}">
            <header>
              <strong>${entry.name}</strong>
              <span>${entry.canWin ? `损 ${entry.loss}` : '危险'}</span>
            </header>
            <div>
              <span>HP ${entry.hp}</span>
              <span>ATK ${entry.attack}</span>
              <span>DEF ${entry.defense}</span>
              <span>+${entry.money} 金币</span>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderBattlePreview(preview: BattlePreview | null) {
  if (!preview) {
    return `
      <section class="panel battle-panel">
        <p class="eyebrow">Battle preview</p>
        <h2>面对怪物时显示损耗</h2>
        <p class="muted">移动到怪物前一格，或朝向怪物，即可看到回合数、预计损血和胜负判断。</p>
      </section>
    `;
  }

  return `
    <section class="panel battle-panel ${preview.canWin ? 'can-win' : 'danger'}">
      <p class="eyebrow">Battle preview</p>
      <h2>${preview.monster.name}</h2>
      <div class="monster-stats">
        <span>HP ${preview.monster.hp}</span>
        <span>ATK ${preview.monster.attack}</span>
        <span>DEF ${preview.monster.defense}</span>
      </div>
      <div class="loss-line"><span>预计损血</span><strong>${preview.loss}</strong></div>
      <p>${preview.canWin ? `可战斗，约 ${preview.rounds} 回合结束。` : '当前属性不足，建议先拿宝石或装备。'}</p>
    </section>
  `;
}

function renderLastBattle(lastBattle: LastBattle | null) {
  if (!lastBattle) return '';
  return `
    <section class="panel result-panel">
      <p class="eyebrow">Last battle</p>
      <strong>${lastBattle.monsterName}</strong>
      <span>${lastBattle.rounds ? `${lastBattle.rounds} 回合 · ` : ''}损失 ${lastBattle.loss} HP · +${lastBattle.gold} 金币 · +${lastBattle.exp} 经验</span>
      ${renderRewardChips(lastBattle.eventRewards)}
    </section>
  `;
}

function renderRewardChips(rewards: StoryRewardView[] | undefined) {
  if (!rewards?.length) return '';
  return `
    <div class="reward-chips">
      ${rewards.map((reward) => `<span class="${reward.kind}"><em>${reward.label}</em><strong>${reward.value}</strong></span>`).join('')}
    </div>
  `;
}

function statRow(label: string, value: number, type: string) {
  return `<div class="stat-row ${type}"><span>${label}</span><strong>${value}</strong></div>`;
}

function keyBadge(label: string, value: number, color: string) {
  return `<div class="key-badge ${color}"><span>${label}</span><strong>${value}</strong></div>`;
}

function unlockLabel(id: string) {
  const labels: Record<string, string> = {
    monsterBook: '怪物手册',
    floorTeleport: '楼层传送',
    forgeBossDefeated: '熔炉闸门'
  };
  return labels[id] ?? id;
}
