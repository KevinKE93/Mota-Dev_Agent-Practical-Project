import type { BattlePreview, MonsterDefinition, PlayerState } from '../types';

export function previewBattle(player: PlayerState, monster: MonsterDefinition): BattlePreview {
  const heroDamage = Math.max(1, player.attack - monster.defense);
  const monsterDamage = Math.max(0, monster.attack - player.defense);
  const rounds = Math.ceil(monster.hp / heroDamage);
  const loss = monsterDamage * Math.max(0, rounds - 1);

  return {
    monster,
    rounds,
    loss,
    canWin: player.hp > loss,
    heroDamage,
    monsterDamage
  };
}
