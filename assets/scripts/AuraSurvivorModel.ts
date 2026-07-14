export type GameMode = 'menu' | 'playing' | 'paused' | 'upgrade' | 'gameover' | 'victory';
export type EnemyId = 'shade' | 'runner' | 'bulwark' | 'rift_eye' | 'bomber_spore' | 'wind_cutter';
export type AuraPath = 'pulse' | 'frost' | 'focus';
export type UpgradeKind = 'damage' | 'radius' | 'speed' | 'hp' | 'pickup' | AuraPath;
export type InitialTendency = 'balanced' | AuraPath;
export type ThreatLevel = 0 | 1 | 2;
export type RunOutcome = 'failure' | 'normal' | 'perfect';
export type SoundKey = 'hit' | 'kill' | 'pickup' | 'boss' | 'bgm_loop';
export type SpriteKey = 'player_front' | 'player_left' | 'player_right' | 'player_back' | 'enemy_knight' | 'enemy_eye' | 'orb' | 'tile';
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Rgba = { r: number; g: number; b: number; a: number };
export type Effect = { pos: Point; age: number; life: number; radius: number; sparks: number; seed: number; power: number; color: Rgba };
export type Enemy = {
  pos: Point;
  type: EnemyId;
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  exp: number;
  radius: number;
  scale: number;
  tint: Rgba;
  hitCd: number;
  flash: number;
  fuse: number;
  guard: number;
  abilityTimer: number;
  warnTimer: number;
  seed: number;
  boss: boolean;
  elite: boolean;
  phase: number;
  auraEdgeArmed: boolean;
  dashDir: Point;
  dashTimer: number;
};
export type Orb = { pos: Point; value: number };
export type Upgrade = { title: string; kind: UpgradeKind; maxLevel: number };
export type Stage = {
  name: string;
  start: number;
  pool: [EnemyId, number][];
};
export type StageRule = {
  label: string;
  obstacleChance: number;
  obstacleScale: number;
  playerSpeedMult: number;
  sweetDamageMult: number;
};
export type WaveTemplate = {
  name: string;
  stages: number[];
  enemies: [EnemyId, number][];
  elite: EnemyId;
};
export type Profile = {
  bestTime: number;
  highestLevel: number;
  highestKills: number;
  bestDamage: number;
  perfectWins: number;
  highestThreat: ThreatLevel;
  lastBuild: string;
  unlockedPaths: AuraPath[];
  soundEnabled: boolean;
  shakeEnabled: boolean;
  reduceMotion: boolean;
};
export type SafeInsets = { left: number; right: number; top: number; bottom: number };
export type Theme = {
  bg: Rgba;
  tile: Rgba;
  grid: Rgba;
  rock: Rgba;
  trunk: Rgba;
  leaf: Rgba;
};

export const TAU = Math.PI * 2;
export const PLAYER_RADIUS = 14;
export const ORB_RADIUS = 5;
export const AURA_TICK = 0.3;
export const SLICE_DURATION = 480;
export const PULSE_INTERVAL = 2.4;
export const PULSE_DAMAGE_MULT = 2.4;
export const PULSE_FLASH_TIME = 0.22;
export const FROST_SPEED_MULT = 0.72;
export const AURA_SWEET_RATIO = 0.72;
export const AURA_SWEET_DAMAGE_MULT = 1.5;
export const AURA_EDGE_REARM_MARGIN = 18;
export const PULSE_EDGE_CHARGE_RATIO = 0.05;
export const SHATTER_RADIUS = 48;
export const SHATTER_DAMAGE_MULT = 1.2;
export const SHATTER_EFFECT_CAP = 8;
export const DAMAGE_UPGRADE_MULT = 1.25;
export const RADIUS_UPGRADE_AMOUNT = 18;
export const SPEED_UPGRADE_AMOUNT = 20;
export const HP_UPGRADE_AMOUNT = 20;
export const HP_UPGRADE_HEAL = 35;
export const PICKUP_UPGRADE_AMOUNT = 28;
export const PULSE_INTERVAL_MULT = 0.82;
export const PULSE_INTERVAL_MIN = 1.05;
export const PULSE_DAMAGE_STEP = 0.42;
export const FROST_SPEED_STEP = 0.06;
export const FROST_SPEED_MIN = 0.46;
export const FROST_RADIUS_STEP = 8;
export const FOCUS_RADIUS_MULT = 0.72;
export const FOCUS_DAMAGE_MULT = 1.45;
export const MIN_AURA_RADIUS = 68;
export const BULWARK_GUARD_MULT = 0.45;
export const BULWARK_GUARD_DURATION = 0.42;
export const FINAL_BOSS_TIME = 420;
export const FIXED_CHALLENGE_SEED = 20260710;
export const PROFILE_KEY = 'aura-survivor-profile-v1';
export const BOMBER_TRIGGER_RANGE = 95;
export const BOMBER_FUSE = 0.8;
export const BOMBER_EXPLOSION_RADIUS = 120;
export const RIFT_WARN_TIME = 0.72;
export const RIFT_PULSE_RADIUS = 138;
export const BOSS_WARN_TIME = 1.0;
export const BOSS_PULSE_RADIUS = 210;
export const BOSS_PHASE_RATIO = 0.5;
export const PLAYER_HIT_INVULNERABILITY = 0.45;
export const MAX_SIM_STEP = 0.05;
export const MAX_SIM_STEPS = 10;
export const MAX_FRAME_CATCHUP = MAX_SIM_STEP * MAX_SIM_STEPS; // ponytail: cap catch-up; use an accumulator only if sub-2 FPS support becomes real.
export const SPAWN_START_INTERVAL = 0.82;
export const SPAWN_END_INTERVAL = 0.22;
export const ENEMY_END_GROWTH = 1.7;
export const ENEMY_CAP = 120; // ponytail: demo hard cap; switch to pooled enemies if density becomes the feature.
export const EFFECT_CAP = 120; // ponytail: drawn bursts are capped; swap to Cocos particles when fill-rate becomes the limit.
export const ORB_CAP = 140; // ponytail: linear merge scan is bounded; spatial hashing can wait until this cap becomes visible.
export const ORB_MERGE_RADIUS = 42;
export const SPECIAL_RULES: Partial<Record<EnemyId, { cap: number; cooldown: number }>> = {
  bomber_spore: { cap: 4, cooldown: 2.5 },
  rift_eye: { cap: 2, cooldown: 6 },
};
export const BOSS_MINION_POOL: [EnemyId, number][] = [['runner', 65], ['bulwark', 35]];
export const FOREST_CELL_SIZE = 168;
export const FOREST_CLEAR_RADIUS = 240;
export const PLAYER_TEXTURE = 'sprites/player_aura_sheet/texture';
export const ATLAS_TEXTURE = 'sprites/aura_survivor_atlas/texture';
export const AUDIO_PATHS: Record<SoundKey, string> = {
  hit: 'audio/hit',
  kill: 'audio/kill',
  pickup: 'audio/pickup',
  boss: 'audio/boss',
  bgm_loop: 'audio/bgm_loop',
};

export const rgba = (r: number, g: number, b: number, a = 255): Rgba => ({ r, g, b, a });
export const WHITE = rgba(255, 255, 255);
export const SOFT_TEXT = rgba(198, 220, 235);

export const ENEMY_TYPES: Record<EnemyId, Omit<Enemy, 'pos' | 'type' | 'hp' | 'maxHp' | 'hitCd' | 'flash' | 'fuse' | 'guard' | 'abilityTimer' | 'warnTimer' | 'seed' | 'boss' | 'elite' | 'phase' | 'auraEdgeArmed' | 'dashDir' | 'dashTimer'>> = {
  shade: { name: '影虱', speed: 120, damage: 6, exp: 5, radius: 11, scale: 0.82, tint: rgba(140, 255, 115) },
  runner: { name: '疾行妖', speed: 215, damage: 5, exp: 8, radius: 10, scale: 0.74, tint: rgba(115, 230, 255) },
  bulwark: { name: '石壳兽', speed: 72, damage: 15, exp: 40, radius: 18, scale: 1.22, tint: rgba(190, 178, 242) },
  rift_eye: { name: '裂隙眼', speed: 105, damage: 22, exp: 90, radius: 21, scale: 1.42, tint: rgba(255, 158, 72) },
  bomber_spore: { name: '爆裂孢子', speed: 95, damage: 26, exp: 18, radius: 13, scale: 0.92, tint: rgba(255, 92, 48) },
  wind_cutter: { name: '风剪灵', speed: 165, damage: 12, exp: 24, radius: 12, scale: 0.9, tint: rgba(102, 246, 226) },
};

export const ENEMY_HP: Record<EnemyId, number> = {
  shade: 18,
  runner: 12,
  bulwark: 80,
  rift_eye: 190,
  bomber_spore: 26,
  wind_cutter: 18,
};

export const STAGES: Stage[] = [
  { name: '第一关 幽暗草场', start: 0, pool: [['shade', 90], ['bomber_spore', 10]] },
  { name: '第二关 疾风荒径', start: 90, pool: [['shade', 45], ['runner', 30], ['wind_cutter', 15], ['bomber_spore', 10]] },
  { name: '第三关 石壳废墟', start: 210, pool: [['shade', 25], ['runner', 20], ['wind_cutter', 15], ['bulwark', 30], ['bomber_spore', 10]] },
  { name: '第四关 裂隙深处', start: 330, pool: [['runner', 24], ['wind_cutter', 16], ['bulwark', 26], ['rift_eye', 20], ['bomber_spore', 14]] },
];

export const STAGE_RULES: readonly StageRule[] = [
  { label: '草场：标准地形', obstacleChance: 0.56, obstacleScale: 1, playerSpeedMult: 1, sweetDamageMult: AURA_SWEET_DAMAGE_MULT },
  { label: '风径：开阔地形，移速 +8%', obstacleChance: 0.34, obstacleScale: 0.82, playerSpeedMult: 1.08, sweetDamageMult: AURA_SWEET_DAMAGE_MULT },
  { label: '废墟：窄道与大型石障', obstacleChance: 0.68, obstacleScale: 1.22, playerSpeedMult: 1, sweetDamageMult: AURA_SWEET_DAMAGE_MULT },
  { label: '裂隙：外沿伤害提升至 1.7×', obstacleChance: 0.46, obstacleScale: 0.94, playerSpeedMult: 1, sweetDamageMult: 1.7 },
];

export const WAVE_TEMPLATES: readonly WaveTemplate[] = [
  { name: '快怪突袭', stages: [1, 2, 3], enemies: [['runner', 4], ['shade', 2]], elite: 'runner' },
  { name: '风剪穿插', stages: [1, 2, 3], enemies: [['wind_cutter', 3], ['runner', 2]], elite: 'wind_cutter' },
  { name: '石壳护送', stages: [2, 3], enemies: [['bulwark', 2], ['runner', 3]], elite: 'bulwark' },
  { name: '自爆包围', stages: [1, 2, 3], enemies: [['bomber_spore', 2], ['shade', 3]], elite: 'shade' },
  { name: '裂隙炮台', stages: [3], enemies: [['rift_eye', 1], ['bulwark', 2], ['runner', 2]], elite: 'bulwark' },
];

export const DEFAULT_PROFILE: Profile = {
  bestTime: 0,
  highestLevel: 1,
  highestKills: 0,
  bestDamage: 0,
  perfectWins: 0,
  highestThreat: 0,
  lastBuild: '无',
  unlockedPaths: [],
  soundEnabled: true,
  shakeEnabled: true,
  reduceMotion: false,
};

export const THEMES: Theme[] = [
  { bg: rgba(10, 18, 16), tile: rgba(32, 56, 42, 170), grid: rgba(48, 76, 58, 105), rock: rgba(72, 84, 76), trunk: rgba(66, 42, 26), leaf: rgba(18, 56, 38, 220) },
  { bg: rgba(28, 25, 18), tile: rgba(82, 68, 40, 150), grid: rgba(112, 94, 56, 92), rock: rgba(110, 105, 88), trunk: rgba(84, 55, 28), leaf: rgba(66, 80, 68, 210) },
  { bg: rgba(19, 20, 28), tile: rgba(66, 68, 80, 150), grid: rgba(100, 96, 122, 96), rock: rgba(108, 110, 124), trunk: rgba(68, 56, 52), leaf: rgba(54, 46, 70, 210) },
  { bg: rgba(16, 8, 28), tile: rgba(68, 36, 92, 155), grid: rgba(128, 72, 164, 105), rock: rgba(90, 72, 112), trunk: rgba(62, 34, 72), leaf: rgba(52, 22, 74, 212) },
];

export const UPGRADE_POOL: readonly Upgrade[] = [
  { title: '光环伤害', kind: 'damage', maxLevel: 4 },
  { title: '光环范围', kind: 'radius', maxLevel: 4 },
  { title: '移动速度', kind: 'speed', maxLevel: 4 },
  { title: '生命上限', kind: 'hp', maxLevel: 4 },
  { title: '拾取范围', kind: 'pickup', maxLevel: 3 },
  { title: '脉冲光环', kind: 'pulse', maxLevel: 5 },
  { title: '寒霜光环', kind: 'frost', maxLevel: 5 },
  { title: '压缩光环', kind: 'focus', maxLevel: 1 },
];
