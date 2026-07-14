import {
  AURA_EDGE_REARM_MARGIN,
  AURA_SWEET_DAMAGE_MULT,
  AURA_SWEET_RATIO,
  BOSS_MINION_POOL,
  BOSS_PHASE_RATIO,
  BULWARK_GUARD_MULT,
  EFFECT_CAP,
  ENEMY_CAP,
  ENEMY_HP,
  ENEMY_TYPES,
  FINAL_BOSS_TIME,
  FIXED_CHALLENGE_SEED,
  FROST_SPEED_MULT,
  FROST_SPEED_STEP,
  MAX_FRAME_CATCHUP,
  MAX_SIM_STEP,
  MAX_SIM_STEPS,
  ORB_CAP,
  PLAYER_HIT_INVULNERABILITY,
  PULSE_DAMAGE_MULT,
  PULSE_DAMAGE_STEP,
  PULSE_EDGE_CHARGE_RATIO,
  PULSE_INTERVAL,
  PULSE_INTERVAL_MIN,
  PULSE_INTERVAL_MULT,
  SHATTER_DAMAGE_MULT,
  SHATTER_EFFECT_CAP,
  SHATTER_RADIUS,
  SLICE_DURATION,
  SPECIAL_RULES,
  STAGES,
  STAGE_RULES,
  THEMES,
  UPGRADE_POOL,
  WAVE_TEMPLATES,
  type Enemy,
  type EnemyId,
  type Profile,
} from './AuraSurvivorModel';
import type { AuraSurvivorRenderer } from './AuraSurvivorRenderer';
import { AuraSurvivorSession } from './AuraSurvivorSession';

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.000001;

const testEnemy = (x: number, type: EnemyId = 'shade'): Enemy => ({
  ...ENEMY_TYPES[type],
  pos: { x, y: 0 },
  type,
  hp: 100,
  maxHp: 100,
  hitCd: 0,
  flash: 0,
  fuse: 0,
  guard: 0,
  abilityTimer: 0,
  warnTimer: 0,
  seed: 0,
  boss: false,
  elite: false,
  phase: 1,
  auraEdgeArmed: true,
  dashDir: { x: 0, y: 0 },
  dashTimer: 0,
});

export const runSelfCheck = (live: AuraSurvivorSession, renderer: AuraSurvivorRenderer): void => {
  renderer.selfCheck();
  const profile: Profile = { ...live.profile, unlockedPaths: [...live.profile.unlockedPaths] };
  const game = new AuraSurvivorSession(profile);

  assert(STAGES.length === THEMES.length && STAGES.length === STAGE_RULES.length, 'stages, themes and rules must stay aligned');
  assert(ENEMY_HP.wind_cutter === 18 && STAGES.slice(1).some((stage) => stage.pool.some(([type]) => type === 'wind_cutter')), 'wind cutter must be configured after the opening stage');
  assert(!STAGES.slice(1).some((_, stage) => WAVE_TEMPLATES.filter((wave) => wave.stages.indexOf(stage + 1) >= 0).length < 2), 'each stage event needs multiple wave templates');
  assert(!WAVE_TEMPLATES.some((wave) => !wave.enemies.some(([type]) => type === wave.elite)), 'every wave elite must exist in its wave');
  assert(SLICE_DURATION === 480 && FINAL_BOSS_TIME < SLICE_DURATION, 'the boss must precede the 8 minute finish');
  assert(new Set(UPGRADE_POOL.map((upgrade) => upgrade.kind)).size === UPGRADE_POOL.length, 'upgrade kinds must stay unique');
  assert(new Set(UPGRADE_POOL.map((upgrade) => upgrade.title)).size === UPGRADE_POOL.length, 'upgrade titles must stay unique');
  assert(!UPGRADE_POOL.some((upgrade) => !Number.isInteger(upgrade.maxLevel) || upgrade.maxLevel <= 0), 'upgrade caps must be positive integers');
  assert(UPGRADE_POOL.find((upgrade) => upgrade.kind === 'focus')?.maxLevel === 1, 'focus must stay a one-time choice');
  assert(AURA_SWEET_RATIO > 0 && AURA_SWEET_RATIO < 1 && AURA_SWEET_DAMAGE_MULT > 1 && AURA_EDGE_REARM_MARGIN > 0, 'aura positioning constants must stay bounded');
  assert(PULSE_EDGE_CHARGE_RATIO > 0 && PULSE_EDGE_CHARGE_RATIO < 1 && SHATTER_RADIUS > 0 && SHATTER_DAMAGE_MULT > 0, 'aura synergy constants must stay bounded');
  assert(SHATTER_EFFECT_CAP >= 1 && SHATTER_EFFECT_CAP <= EFFECT_CAP, 'shatter effects must stay within the effect cap');
  assert(close(Math.max(PULSE_INTERVAL_MIN, PULSE_INTERVAL * PULSE_INTERVAL_MULT ** 4), 1.085092224), 'pulse cooldown curve changed unexpectedly');
  assert(close(PULSE_DAMAGE_MULT + PULSE_DAMAGE_STEP * 4, 4.08), 'pulse damage curve changed unexpectedly');
  assert(close(FROST_SPEED_MULT - FROST_SPEED_STEP * 4, 0.48), 'frost curve changed unexpectedly');

  const requirements = [100, 165, 259, 396, 594, 881, 1297, 1901, 2776, 4045, 5885];
  let requirement = 100;
  let total = 0;
  for (const expected of requirements) {
    assert(requirement === expected, 'experience curve changed unexpectedly');
    total += requirement;
    requirement = game.nextExpRequirement(requirement);
  }
  assert(total === 18299, 'level 12 experience total must stay deterministic');

  const runnerReward = game.enemyRewardAt('runner', 330);
  assert(game.enemyRewardAt('bulwark', 330) >= runnerReward * 3, 'bulwark reward is too low');
  assert(game.enemyRewardAt('rift_eye', 330) >= runnerReward * 7, 'rift reward is too low');
  assert(game.enemyRewardAt('bomber_spore', 330) >= runnerReward * 2, 'bomber reward is too low');

  const firstChoices = game.rollUpgradeChoices();
  assert(firstChoices.length === 3 && firstChoices.some((upgrade) => game.isAuraPath(upgrade.kind)), 'first upgrade must offer an aura path');
  game.upgradeLevels = { focus: 1 };
  assert(!game.availableUpgrades().some((upgrade) => game.isAuraPath(upgrade.kind) || upgrade.kind === 'radius'), 'focus must exclude other paths and radius');
  game.upgradeLevels = { pulse: 1 };
  assert(!game.availableUpgrades().some((upgrade) => upgrade.kind === 'focus') && game.availableUpgrades().some((upgrade) => upgrade.kind === 'frost'), 'pulse must allow frost but exclude focus');
  game.upgradeLevels = {};

  assert(PLAYER_HIT_INVULNERABILITY > 0 && PLAYER_HIT_INVULNERABILITY < 1, 'player protection must stay short');
  assert(BOSS_PHASE_RATIO > 0 && BOSS_PHASE_RATIO < 1, 'boss phase ratio must stay bounded');
  assert(MAX_SIM_STEP * MAX_SIM_STEPS >= 0.5 && MAX_FRAME_CATCHUP === MAX_SIM_STEP * MAX_SIM_STEPS, 'simulation catch-up must cover at least two FPS');
  assert(game.realFrameDelta(1) === 1 && game.simulationFrameDelta(1) === MAX_FRAME_CATCHUP, 'real time must remain independent from simulation catch-up');

  for (let index = 0; index < STAGES.length; index += 1) {
    const stage = STAGES[index];
    assert(index === 0 ? stage.start === 0 : stage.start > STAGES[index - 1].start, 'stage starts must be strictly increasing');
    assert(stage.pool.length > 0 && !stage.pool.some(([, weight]) => weight <= 0), 'stage pools need positive weights');
    assert(stage.pool.some(([type]) => !SPECIAL_RULES[type]), 'each stage needs a normal enemy fallback');
  }
  for (const type of ['bomber_spore', 'rift_eye'] as const) {
    const rule = SPECIAL_RULES[type];
    assert(rule && rule.cap > 0 && rule.cap < ENEMY_CAP && rule.cooldown > 0, 'special enemy rules must stay bounded');
  }
  assert(!BOSS_MINION_POOL.some(([type, weight]) => SPECIAL_RULES[type] || weight <= 0), 'boss minions must stay readable and non-special');

  const pressureTimes = [0, 90, 210, 330, FINAL_BOSS_TIME];
  const pressure = pressureTimes.map((time) => game.spawnIntervalAt(time));
  assert(!pressure.some((interval) => interval <= 0), 'spawn intervals must stay positive');
  assert(!pressure.some((interval, index) => index > 0 && interval >= pressure[index - 1]), 'spawn pressure must rise continuously before the boss');
  for (const boundary of STAGES.slice(1).map((stage) => stage.start)) {
    assert(Math.abs(game.spawnIntervalAt(boundary - 0.001) - game.spawnIntervalAt(boundary + 0.001)) <= 0.001, 'stage changes must not jump spawn pressure');
    assert(Math.abs(game.enemyGrowthAt(boundary - 0.001) - game.enemyGrowthAt(boundary + 0.001)) <= 0.001, 'stage changes must not jump enemy growth');
  }
  game.threatLevel = 0;
  const standardInterval = game.spawnIntervalAt(210);
  const standardGrowth = game.enemyGrowthAt(210);
  game.threatLevel = 2;
  assert(game.spawnIntervalAt(210) < standardInterval && close(game.enemyGrowthAt(210), standardGrowth), 'threat must change tempo without changing growth');
  game.threatLevel = 0;

  game.aliveTime = 0;
  assert(!game.canSpawnType('bomber_spore'), 'bombers must stay out of the opening');
  game.aliveTime = 26;
  game.nextSpecialSpawnAt = { bomber_spore: 30 };
  assert(!game.canSpawnType('bomber_spore'), 'special cooldown must block spawning');
  game.nextSpecialSpawnAt = {};
  game.enemies = Array.from({ length: SPECIAL_RULES.bomber_spore?.cap ?? 0 }, () => ({ type: 'bomber_spore' }) as Enemy);
  assert(!game.canSpawnType('bomber_spore'), 'special cap must block spawning');

  game.orbs = [];
  game.dropOrb({ x: 0, y: 0 }, 5);
  game.dropOrb({ x: 10, y: 0 }, 7);
  assert(game.orbs.length === 1 && game.orbs[0].value === 12, 'nearby orbs must merge without losing experience');
  game.orbs = Array.from({ length: ORB_CAP }, (_, index) => ({ pos: { x: index * 100, y: 0 }, value: 1 }));
  game.dropOrb({ x: 99999, y: 0 }, 9);
  assert(game.orbs.length === ORB_CAP && game.orbs.reduce((sum, orb) => sum + orb.value, 0) === ORB_CAP + 9, 'orb cap must preserve total experience');

  game.player = { x: 0, y: 0 };
  game.auraRadius = 100;
  game.auraDamage = 10;
  game.pulseUnlocked = true;
  game.pulseTimer = PULSE_INTERVAL;
  game.pulseInterval = PULSE_INTERVAL;
  game.pulseDamageMult = PULSE_DAMAGE_MULT;
  const edgeEnemy = testEnemy(110);
  edgeEnemy.radius = 10;
  game.enemies = [edgeEnemy];
  game.updateAuraEdges();
  assert(!edgeEnemy.auraEdgeArmed && close(game.pulseTimer, 2.28), 'first aura entry must charge pulse once');
  game.updateAuraEdges();
  assert(close(game.pulseTimer, 2.28), 'staying on the edge must not charge twice');

  game.frostUnlocked = true;
  game.enemies = [testEnemy(60), testEnemy(68), testEnemy(118), testEnemy(180)];
  const [sourceA, sourceB, outsideTarget, farTarget] = game.enemies;
  const plan = game.pulseDamagePlan();
  assert(close(plan.damage.get(sourceA) ?? 0, 36) && close(plan.damage.get(sourceB) ?? 0, 36), 'shatter sources must receive the expected damage');
  assert(close(plan.damage.get(outsideTarget) ?? 0, 12) && !plan.damage.has(farTarget), 'shatter range must remain bounded');

  const bulwark = testEnemy(0, 'bulwark');
  game.enemies = [bulwark];
  game.damageEnemy(0, 10);
  bulwark.guard -= 0.3;
  game.damageEnemy(0, 10);
  assert(close(bulwark.hp, 85.5) && close(bulwark.guard, 0.12), 'bulwark guard must reduce damage without refreshing');
  assert(close(BULWARK_GUARD_MULT, 0.45), 'bulwark guard multiplier changed unexpectedly');

  game.randomState = FIXED_CHALLENGE_SEED;
  const fixed = [game.random(), game.random(), game.random()];
  game.randomState = FIXED_CHALLENGE_SEED;
  const repeated = [game.random(), game.random(), game.random()];
  assert(fixed.every((value, index) => value === repeated[index]), 'fixed seed must reproduce gameplay randomness');
  assert(game.hash01(2, -3, 4) === game.hash01(2, -3, 4), 'world hash must be deterministic');
  assert(game.obstacleForCell(0, 0) === null, 'spawn area must stay clear');
};
