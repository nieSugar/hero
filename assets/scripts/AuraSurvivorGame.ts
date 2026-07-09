import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  EventMouse,
  Graphics,
  input,
  Input,
  KeyCode,
  Label,
  Node,
  Rect as CocosRect,
  resources,
  Size,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec2,
  view,
} from 'cc';

const { ccclass, requireComponent } = _decorator;

type GameMode = 'menu' | 'playing' | 'paused' | 'upgrade' | 'gameover' | 'victory';
type EnemyId = 'shade' | 'runner' | 'bulwark' | 'rift_eye' | 'bomber_spore';
type UpgradeKind = 'damage' | 'radius' | 'speed' | 'hp' | 'pickup' | 'exp' | 'pulse' | 'frost' | 'focus';
type SpriteKey = 'player_front' | 'player_left' | 'player_right' | 'player_back' | 'enemy_knight' | 'enemy_eye' | 'orb';
type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type SpriteSlot = { node: Node; sprite: Sprite; transform: UITransform };
type Effect = { pos: Point; age: number; life: number; radius: number; sparks: number; seed: number; power: number; color: Color };
type Enemy = {
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
  tint: Color;
  hitCd: number;
  flash: number;
  fuse: number;
  guard: number;
  abilityTimer: number;
  warnTimer: number;
  seed: number;
  boss: boolean;
};
type Orb = { pos: Point; value: number };
type Upgrade = { title: string; desc: string; kind: UpgradeKind };
type Stage = {
  name: string;
  start: number;
  spawn: number;
  count: number;
  growth: number;
  pool: [EnemyId, number][];
};
type Theme = {
  bg: Color;
  tile: Color;
  grid: Color;
  rock: Color;
  trunk: Color;
  leaf: Color;
};

const TAU = Math.PI * 2;
const PLAYER_RADIUS = 14;
const ORB_RADIUS = 5;
const AURA_TICK = 0.3;
const SLICE_DURATION = 480;
const PULSE_INTERVAL = 2.4;
const PULSE_DAMAGE_MULT = 2.4;
const PULSE_FLASH_TIME = 0.22;
const FROST_SPEED_MULT = 0.72;
const FINAL_BOSS_TIME = 420;
const BOMBER_TRIGGER_RANGE = 95;
const BOMBER_FUSE = 0.8;
const BOMBER_EXPLOSION_RADIUS = 120;
const RIFT_WARN_TIME = 0.72;
const RIFT_PULSE_RADIUS = 138;
const BOSS_WARN_TIME = 1.0;
const BOSS_PULSE_RADIUS = 210;
const ENEMY_CAP = 180; // ponytail: demo hard cap; switch to pooled enemies if density becomes the feature.
const EFFECT_CAP = 120; // ponytail: drawn bursts are capped; swap to Cocos particles when fill-rate becomes the limit.
const FOREST_CELL_SIZE = 168;
const FOREST_CLEAR_RADIUS = 240;
const PLAYER_TEXTURE = 'sprites/player_aura_sheet/texture';
const ATLAS_TEXTURE = 'sprites/aura_survivor_atlas/texture';

const rgba = (r: number, g: number, b: number, a = 255): Color => new Color(r, g, b, a);
const WHITE = rgba(255, 255, 255);
const SOFT_TEXT = rgba(198, 220, 235);

const ENEMY_TYPES: Record<EnemyId, Omit<Enemy, 'pos' | 'type' | 'hp' | 'maxHp' | 'hitCd' | 'flash' | 'fuse' | 'guard' | 'abilityTimer' | 'warnTimer' | 'seed' | 'boss'>> = {
  shade: { name: '影虱', speed: 120, damage: 6, exp: 5, radius: 11, scale: 0.82, tint: rgba(140, 255, 115) },
  runner: { name: '疾行妖', speed: 215, damage: 5, exp: 8, radius: 10, scale: 0.74, tint: rgba(115, 230, 255) },
  bulwark: { name: '石壳兽', speed: 72, damage: 15, exp: 16, radius: 18, scale: 1.22, tint: rgba(190, 178, 242) },
  rift_eye: { name: '裂隙眼', speed: 105, damage: 22, exp: 46, radius: 21, scale: 1.42, tint: rgba(255, 158, 72) },
  bomber_spore: { name: '爆裂孢子', speed: 95, damage: 26, exp: 12, radius: 13, scale: 0.92, tint: rgba(255, 92, 48) },
};

const ENEMY_HP: Record<EnemyId, number> = {
  shade: 18,
  runner: 12,
  bulwark: 80,
  rift_eye: 190,
  bomber_spore: 26,
};

const STAGES: Stage[] = [
  { name: '第一关 幽暗草场', start: 0, spawn: 0.82, count: 1, growth: 0.0028, pool: [['shade', 90], ['bomber_spore', 10]] },
  { name: '第二关 疾风荒径', start: 90, spawn: 0.62, count: 1, growth: 0.0035, pool: [['shade', 60], ['runner', 30], ['bomber_spore', 10]] },
  { name: '第三关 石壳废墟', start: 210, spawn: 0.48, count: 2, growth: 0.0045, pool: [['shade', 35], ['runner', 25], ['bulwark', 30], ['bomber_spore', 10]] },
  { name: '第四关 裂隙深处', start: 330, spawn: 0.35, count: 2, growth: 0.006, pool: [['runner', 30], ['bulwark', 30], ['rift_eye', 25], ['bomber_spore', 15]] },
];

const THEMES: Theme[] = [
  { bg: rgba(6, 10, 9), tile: rgba(32, 48, 35, 120), grid: rgba(12, 22, 17), rock: rgba(44, 52, 46), trunk: rgba(28, 18, 10), leaf: rgba(3, 14, 8, 194) },
  { bg: rgba(20, 18, 13), tile: rgba(70, 60, 38, 105), grid: rgba(48, 42, 30), rock: rgba(95, 92, 78), trunk: rgba(70, 48, 24), leaf: rgba(56, 68, 60, 188) },
  { bg: rgba(12, 13, 16), tile: rgba(55, 58, 62, 120), grid: rgba(36, 37, 44), rock: rgba(88, 90, 94), trunk: rgba(52, 48, 44), leaf: rgba(33, 30, 45, 190) },
  { bg: rgba(10, 6, 16), tile: rgba(42, 26, 68, 128), grid: rgba(22, 17, 38), rock: rgba(78, 62, 106), trunk: rgba(42, 26, 58), leaf: rgba(16, 20, 42, 196) },
];

const UPGRADE_POOL: Upgrade[] = [
  { title: '光环伤害', desc: '+25% 伤害', kind: 'damage' },
  { title: '光环范围', desc: '+18 半径', kind: 'radius' },
  { title: '移动速度', desc: '+20 速度', kind: 'speed' },
  { title: '生命上限', desc: '+20 MaxHP 并回复', kind: 'hp' },
  { title: '拾取范围', desc: '+28 吸附半径', kind: 'pickup' },
  { title: '经验增幅', desc: '+15% 经验获取', kind: 'exp' },
  { title: '脉冲光环', desc: '解锁或强化周期爆发', kind: 'pulse' },
  { title: '寒霜光环', desc: '解锁或强化范围减速', kind: 'frost' },
  { title: '压缩光环', desc: '半径变小，伤害暴涨', kind: 'focus' },
];

@ccclass('AuraSurvivorGame')
@requireComponent(Graphics)
export class AuraSurvivorGame extends Component {
  private graphics!: Graphics;
  private screenW = 1280;
  private screenH = 720;
  private mode: GameMode = 'menu';
  private player: Point = { x: 0, y: 0 };
  private maxHp = 100;
  private hp = 100;
  private moveSpeed = 250;
  private auraRadius = 100;
  private auraDamage = 10;
  private pickupRadius = 90;
  private expGain = 1;
  private level = 1;
  private exp = 0;
  private expToNext = 100;
  private kills = 0;
  private aliveTime = 0;
  private spawnTimer = 0;
  private auraTimer = AURA_TICK;
  private pulseUnlocked = false;
  private pulseTimer = PULSE_INTERVAL;
  private pulseInterval = PULSE_INTERVAL;
  private pulseDamageMult = PULSE_DAMAGE_MULT;
  private pulseFlash = 0;
  private frostUnlocked = false;
  private frostSpeedMult = FROST_SPEED_MULT;
  private finalBossSpawned = false;
  private lastStageIndex = 0;
  private noticeText = '';
  private noticeTimer = 0;
  private walkTime = 0;
  private isMoving = false;
  private facing: Point = { x: 0, y: 1 };
  private enemies: Enemy[] = [];
  private orbs: Orb[] = [];
  private effects: Effect[] = [];
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakePower = 0;
  private shakeOffset: Point = { x: 0, y: 0 };
  private upgradeChoices: Upgrade[] = [];
  private learned: string[] = [];
  private pressed = new Set<KeyCode>();
  private labels: Label[] = [];
  private spriteFrames = new Map<SpriteKey, SpriteFrame>();
  private spriteSlots: SpriteSlot[] = [];
  private labelCursor = 0;
  private spriteCursor = 0;
  private startButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private restartButton: Rect = { x: 0, y: 0, w: 0, h: 0 };

  onLoad(): void {
    const graphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
    if (!graphics) throw new Error('Graphics component is required');
    this.graphics = graphics;
    this.syncScreen();
    this.selfCheck();
    this.loadSpriteFrames();
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
  }

  update(deltaTime: number): void {
    const delta = Math.min(deltaTime, 0.05);
    this.syncScreen();
    if (this.mode === 'playing') {
      this.aliveTime = Math.min(SLICE_DURATION, this.aliveTime + delta);
      if (this.aliveTime >= SLICE_DURATION) {
        this.mode = 'victory';
      } else {
        this.updateStageNotice();
        this.updateFinalBoss();
        this.updatePlayer(delta);
        this.updateSpawner(delta);
        this.updateEnemies(delta);
        if (this.mode === 'playing') {
          this.updateAura(delta);
          this.updatePulse(delta);
          this.updateOrbs(delta);
        }
      }
    }
    this.updateEffects(delta);
    this.redraw();
  }

  private startGame(): void {
    this.mode = 'playing';
    this.player = { x: 0, y: 0 };
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.moveSpeed = 250;
    this.auraRadius = 100;
    this.auraDamage = 10;
    this.pickupRadius = 90;
    this.expGain = 1;
    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.kills = 0;
    this.aliveTime = 0;
    this.spawnTimer = 0.1;
    this.auraTimer = AURA_TICK;
    this.pulseUnlocked = false;
    this.pulseTimer = PULSE_INTERVAL;
    this.pulseInterval = PULSE_INTERVAL;
    this.pulseDamageMult = PULSE_DAMAGE_MULT;
    this.pulseFlash = 0;
    this.frostUnlocked = false;
    this.frostSpeedMult = FROST_SPEED_MULT;
    this.finalBossSpawned = false;
    this.lastStageIndex = 0;
    this.noticeText = '拖怪入环，别贴脸硬莽';
    this.noticeTimer = 2.2;
    this.walkTime = 0;
    this.isMoving = false;
    this.facing = { x: 0, y: 1 };
    this.enemies = [];
    this.orbs = [];
    this.effects = [];
    this.shakeTime = 0;
    this.shakeDuration = 0;
    this.shakePower = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.upgradeChoices = [];
    this.learned = [];
  }

  private updateStageNotice(): void {
    const stageIndex = this.currentStageIndex();
    if (stageIndex === this.lastStageIndex) return;
    this.lastStageIndex = stageIndex;
    this.showNotice(this.currentStage().name);
  }

  private updateFinalBoss(): void {
    if (this.finalBossSpawned || this.aliveTime < FINAL_BOSS_TIME) return;
    this.finalBossSpawned = true;
    this.spawnFinalBoss();
    this.showNotice('裂隙核心降临，撑住最后一分钟');
  }

  private spawnFinalBoss(): void {
    if (this.enemies.length >= ENEMY_CAP) this.enemies.splice(0, this.enemies.length - ENEMY_CAP + 1);
    const angle = Math.random() * TAU;
    this.enemies.push({
      pos: { x: this.player.x + Math.cos(angle) * 620, y: this.player.y + Math.sin(angle) * 620 },
      type: 'rift_eye',
      name: '裂隙核心',
      hp: 1450,
      maxHp: 1450,
      speed: 82,
      damage: 30,
      exp: 260,
      radius: 42,
      scale: 2.2,
      tint: rgba(255, 104, 216),
      hitCd: 0,
      flash: 0,
      fuse: 0,
      guard: 0,
      abilityTimer: 1.2,
      warnTimer: 0,
      seed: Math.random() * TAU,
      boss: true,
    });
    this.spawnBurst(this.player, rgba(255, 76, 220), this.auraRadius + 150, 36, 0.68, 1.45);
    this.addShake(0.35, 8);
  }

  private updatePlayer(delta: number): void {
    let x = 0;
    let y = 0;
    if (this.down(KeyCode.ARROW_LEFT, KeyCode.KEY_A)) x -= 1;
    if (this.down(KeyCode.ARROW_RIGHT, KeyCode.KEY_D)) x += 1;
    if (this.down(KeyCode.ARROW_UP, KeyCode.KEY_W)) y -= 1;
    if (this.down(KeyCode.ARROW_DOWN, KeyCode.KEY_S)) y += 1;
    const length = Math.hypot(x, y);
    this.isMoving = length > 0;
    if (!this.isMoving) {
      this.walkTime = 0;
      return;
    }
    x /= length;
    y /= length;
    this.facing = { x, y };
    this.walkTime += delta * 9;
    this.player = this.pushFromObstacles(
      { x: this.player.x + x * this.moveSpeed * delta, y: this.player.y + y * this.moveSpeed * delta },
      PLAYER_RADIUS,
    );
  }

  private updateSpawner(delta: number): void {
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    const stage = this.currentStage();
    const count = stage.count + Math.floor(this.aliveTime / 110);
    for (let i = 0; i < count; i += 1) {
      this.spawnEnemy();
    }
    this.spawnTimer = Math.max(0.16, stage.spawn - this.aliveTime * 0.0012);
  }

  private spawnEnemy(): void {
    if (this.enemies.length >= ENEMY_CAP) return;
    const angle = Math.random() * TAU;
    const distance = 520 + Math.random() * 240;
    const type = this.pickEnemyType();
    const data = ENEMY_TYPES[type];
    const growth = 1 + this.aliveTime * this.currentStage().growth;
    const hp = ENEMY_HP[type] * growth;
    this.enemies.push({
      pos: { x: this.player.x + Math.cos(angle) * distance, y: this.player.y + Math.sin(angle) * distance },
      type,
      name: data.name,
      hp,
      maxHp: hp,
      speed: data.speed * Math.min(1.35, 1 + this.aliveTime * 0.001),
      damage: data.damage * growth,
      exp: data.exp + Math.floor(this.aliveTime / 35),
      radius: data.radius,
      scale: data.scale,
      tint: data.tint,
      hitCd: 0,
      flash: 0,
      fuse: 0,
      guard: 0,
      abilityTimer: type === 'rift_eye' ? 2.2 + Math.random() * 1.4 : 0,
      warnTimer: 0,
      seed: Math.random() * TAU,
      boss: false,
    });
  }

  private updateEnemies(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.flash = Math.max(0, enemy.flash - delta);
      enemy.guard = Math.max(0, enemy.guard - delta);
      enemy.hitCd = Math.max(0, enemy.hitCd - delta);
      this.updateRiftPulse(enemy, delta);
      if (this.mode !== 'playing') return;
      const dx = this.player.x - enemy.pos.x;
      const dy = this.player.y - enemy.pos.y;
      const length = Math.hypot(dx, dy);
      if (enemy.type === 'bomber_spore') {
        const speed = this.enemyMoveSpeed(enemy);
        if (enemy.fuse > 0) {
          enemy.fuse -= delta;
          if (enemy.fuse <= 0) {
            this.explodeBomber(i);
            if (this.mode !== 'playing') return;
            continue;
          }
        } else if (length <= BOMBER_TRIGGER_RANGE) {
          enemy.fuse = BOMBER_FUSE;
        } else if (length > 1) {
          enemy.pos.x += (dx / length) * speed * delta;
          enemy.pos.y += (dy / length) * speed * delta;
        }
        enemy.pos = this.pushFromObstacles(enemy.pos, enemy.radius);
        continue;
      }
      if (length > 1) {
        const speed = this.enemyMoveSpeed(enemy);
        enemy.pos.x += (dx / length) * speed * delta;
        enemy.pos.y += (dy / length) * speed * delta;
      }
      enemy.pos = this.pushFromObstacles(enemy.pos, enemy.radius);
      if (this.distance(enemy.pos, this.player) <= PLAYER_RADIUS + enemy.radius && enemy.hitCd <= 0) {
        this.hp -= enemy.damage;
        enemy.hitCd = 0.6;
        if (this.hp <= 0) {
          this.hp = 0;
          this.mode = 'gameover';
          return;
        }
      }
    }
  }

  private enemyMoveSpeed(enemy: Enemy): number {
    let speed = enemy.speed;
    if (this.runnerSurging(enemy)) speed *= 1.55;
    if (this.frostUnlocked && this.distance(enemy.pos, this.player) <= this.auraRadius + enemy.radius) speed *= this.frostSpeedMult;
    if (enemy.warnTimer > 0) speed *= enemy.boss ? 0.25 : 0.55;
    return speed;
  }

  private runnerSurging(enemy: Enemy): boolean {
    return enemy.type === 'runner' && Math.sin(this.aliveTime * 3.8 + enemy.seed) > 0.68;
  }

  private updateRiftPulse(enemy: Enemy, delta: number): void {
    if (enemy.type !== 'rift_eye') return;
    if (enemy.warnTimer > 0) {
      enemy.warnTimer -= delta;
      if (enemy.warnTimer <= 0) this.fireRiftPulse(enemy);
      return;
    }
    enemy.abilityTimer -= delta;
    if (enemy.abilityTimer <= 0) enemy.warnTimer = enemy.boss ? BOSS_WARN_TIME : RIFT_WARN_TIME;
  }

  private fireRiftPulse(enemy: Enemy): void {
    const radius = enemy.boss ? BOSS_PULSE_RADIUS : RIFT_PULSE_RADIUS;
    this.spawnBurst(enemy.pos, enemy.boss ? rgba(255, 70, 220) : rgba(190, 90, 255), radius, enemy.boss ? 34 : 18, 0.5, enemy.boss ? 1.35 : 0.85);
    this.addShake(enemy.boss ? 0.2 : 0.1, enemy.boss ? 5 : 2.2);
    if (this.distance(enemy.pos, this.player) <= radius + PLAYER_RADIUS) this.hp -= enemy.damage * (enemy.boss ? 1.2 : 0.75);
    enemy.abilityTimer = enemy.boss ? 2.6 : 3.5 + Math.random() * 1.2;
    if (this.hp <= 0) {
      this.hp = 0;
      this.mode = 'gameover';
    }
  }

  private explodeBomber(index: number): void {
    const enemy = this.enemies[index];
    this.spawnBurst(enemy.pos, rgba(255, 92, 48), BOMBER_EXPLOSION_RADIUS, 24, 0.46, 1.35);
    this.addShake(0.18, 5);
    if (this.distance(enemy.pos, this.player) <= BOMBER_EXPLOSION_RADIUS + PLAYER_RADIUS) {
      this.hp -= enemy.damage;
    }
    this.enemies.splice(index, 1);
    if (this.hp <= 0) {
      this.hp = 0;
      this.mode = 'gameover';
    }
  }

  private updateAura(delta: number): void {
    this.auraTimer -= delta;
    if (this.auraTimer > 0) return;
    this.auraTimer += AURA_TICK;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (this.distance(enemy.pos, this.player) <= this.auraRadius + enemy.radius) {
        this.damageEnemy(i, this.auraDamage);
      }
    }
  }

  private updatePulse(delta: number): void {
    this.pulseFlash = Math.max(0, this.pulseFlash - delta);
    if (!this.pulseUnlocked) return;
    this.pulseTimer -= delta;
    if (this.pulseTimer > 0) return;
    this.pulseTimer += this.pulseInterval;
    this.pulseFlash = PULSE_FLASH_TIME;
    this.spawnBurst(this.player, rgba(255, 220, 92), this.auraRadius + 54, 22, 0.34, 0.95);
    this.addShake(0.1, 2);
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (this.distance(enemy.pos, this.player) <= this.auraRadius + enemy.radius) {
        this.damageEnemy(i, this.auraDamage * this.pulseDamageMult);
      }
    }
  }

  private damageEnemy(index: number, damage: number): void {
    const enemy = this.enemies[index];
    const finalDamage = enemy.type === 'bulwark' && enemy.guard > 0 ? damage * 0.45 : damage;
    enemy.hp -= finalDamage;
    enemy.flash = 0.1;
    if (enemy.type === 'bulwark') enemy.guard = 0.42;
    if (enemy.hp <= 0) this.killEnemy(index);
  }

  private killEnemy(index: number): void {
    const enemy = this.enemies[index];
    this.kills += 1;
    this.spawnBurst(enemy.pos, enemy.type === 'bomber_spore' ? rgba(255, 126, 58) : rgba(96, 210, 255), 30 + enemy.radius * 2, 10, 0.32, 0.7);
    this.orbs.push({ pos: { ...enemy.pos }, value: enemy.exp });
    this.enemies.splice(index, 1);
  }

  private updateEffects(delta: number): void {
    this.noticeTimer = Math.max(0, this.noticeTimer - delta);
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.age += delta;
      if (effect.age >= effect.life) this.effects.splice(i, 1);
    }
    this.shakeTime = Math.max(0, this.shakeTime - delta);
    if (this.shakeTime <= 0) {
      this.shakePower = 0;
      this.shakeDuration = 0;
      this.shakeOffset = { x: 0, y: 0 };
      return;
    }
    const fade = this.shakeTime / Math.max(0.001, this.shakeDuration);
    const strength = this.shakePower * fade;
    const phase = this.aliveTime * 90 + this.shakeTime * 37;
    this.shakeOffset = {
      x: Math.sin(phase * 1.7) * strength,
      y: Math.cos(phase * 2.3) * strength,
    };
  }

  private spawnBurst(pos: Point, color: Color, radius: number, sparks: number, life: number, power: number): void {
    this.effects.push({
      pos: { ...pos },
      age: 0,
      life,
      radius,
      sparks,
      seed: Math.random() * TAU,
      power,
      color,
    });
    if (this.effects.length > EFFECT_CAP) this.effects.splice(0, this.effects.length - EFFECT_CAP);
  }

  private addShake(duration: number, power: number): void {
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakePower = Math.max(this.shakePower, power);
  }

  private showNotice(text: string): void {
    this.noticeText = text;
    this.noticeTimer = 2.4;
  }

  private updateOrbs(delta: number): void {
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      let distance = this.distance(orb.pos, this.player);
      if (distance <= this.pickupRadius) {
        orb.pos = this.moveToward(orb.pos, this.player, 560 * delta);
        distance = this.distance(orb.pos, this.player);
      }
      if (distance <= PLAYER_RADIUS + ORB_RADIUS + 2) {
        this.spawnBurst(orb.pos, rgba(80, 220, 255), 24, 7, 0.2, 0.42);
        this.exp += orb.value * this.expGain;
        this.orbs.splice(i, 1);
        this.checkLevelUp();
      }
    }
  }

  private checkLevelUp(): void {
    if (this.exp < this.expToNext) return;
    this.exp -= this.expToNext;
    this.level += 1;
    this.expToNext = Math.round(this.expToNext * 1.45 + 20);
    const pool = [...UPGRADE_POOL];
    this.shuffle(pool);
    this.upgradeChoices = pool.slice(0, 3);
    this.mode = 'upgrade';
    this.spawnBurst(this.player, rgba(255, 226, 96), this.auraRadius + 42, 20, 0.42, 0.9);
    this.addShake(0.08, 2.5);
  }

  private chooseUpgrade(index: number): void {
    const upgrade = this.upgradeChoices[index];
    if (!upgrade) return;
    if (upgrade.kind === 'damage') this.auraDamage *= 1.25;
    if (upgrade.kind === 'radius') this.auraRadius += 18;
    if (upgrade.kind === 'speed') this.moveSpeed += 20;
    if (upgrade.kind === 'hp') {
      this.maxHp += 20;
      this.hp = Math.min(this.maxHp, this.hp + 35);
    }
    if (upgrade.kind === 'pickup') this.pickupRadius += 28;
    if (upgrade.kind === 'exp') this.expGain += 0.15;
    if (upgrade.kind === 'pulse') {
      if (!this.pulseUnlocked) {
        this.pulseUnlocked = true;
        this.pulseTimer = this.pulseInterval;
      } else {
        this.pulseInterval = Math.max(1.05, this.pulseInterval * 0.82);
        this.pulseDamageMult += 0.42;
      }
      this.pulseFlash = PULSE_FLASH_TIME;
    }
    if (upgrade.kind === 'frost') {
      if (!this.frostUnlocked) {
        this.frostUnlocked = true;
      } else {
        this.frostSpeedMult = Math.max(0.46, this.frostSpeedMult - 0.06);
        this.auraRadius += 8;
      }
    }
    if (upgrade.kind === 'focus') {
      this.auraDamage *= 1.45;
      this.auraRadius = Math.max(68, this.auraRadius - 10);
    }
    this.spawnBurst(this.player, rgba(255, 226, 96), this.auraRadius + 84, 28, 0.58, 1.25);
    this.addShake(0.16, 4);
    this.learned.push(upgrade.title);
    this.showNotice(`${this.buildName()} 成型中`);
    this.upgradeChoices = [];
    this.mode = 'playing';
    this.checkLevelUp();
  }

  private upgradeDesc(upgrade: Upgrade): string {
    if (upgrade.kind === 'pulse' && this.pulseUnlocked) {
      return `冷却 ${this.pulseInterval.toFixed(1)}s -> ${Math.max(1.05, this.pulseInterval * 0.82).toFixed(1)}s，爆发更痛`;
    }
    if (upgrade.kind === 'frost' && this.frostUnlocked) {
      return `减速 ${Math.round((1 - this.frostSpeedMult) * 100)}% -> ${Math.round((1 - Math.max(0.46, this.frostSpeedMult - 0.06)) * 100)}%，范围 +8`;
    }
    if (upgrade.kind === 'focus') return `伤害 ${this.auraDamage.toFixed(1)} -> ${(this.auraDamage * 1.45).toFixed(1)}，半径 -10`;
    return upgrade.desc;
  }

  private buildName(): string {
    if (this.pulseUnlocked && this.frostUnlocked) return '霜爆光环';
    if (this.pulseUnlocked) return '脉冲爆发';
    if (this.frostUnlocked) return '寒霜控场';
    if (this.learned.indexOf('压缩光环') >= 0) return '压缩灼杀';
    return '原初光环';
  }

  private redraw(): void {
    this.graphics.clear();
    this.labelCursor = 0;
    this.spriteCursor = 0;
    this.drawWorld();
    if (this.mode === 'menu') {
      this.drawMenu();
      this.hideUnusedSprites();
      this.hideUnusedLabels();
      return;
    }
    this.drawGame();
    if (this.mode === 'upgrade') this.drawUpgrade();
    if (this.mode === 'paused') this.drawOverlay('暂停', '按 ESC 继续');
    if (this.mode === 'gameover') this.drawGameOver();
    if (this.mode === 'victory') this.drawVictory();
    this.hideUnusedSprites();
    this.hideUnusedLabels();
  }

  private drawWorld(): void {
    const theme = this.currentTheme();
    this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, theme.bg);
    const tile = 64;
    const ox = Math.floor(this.fposmod(-this.player.x, tile));
    const oy = Math.floor(this.fposmod(-this.player.y, tile));
    for (let x = ox; x < this.screenW + tile; x += tile) {
      for (let y = oy; y < this.screenH + tile; y += tile) {
        this.fillRect({ x, y, w: tile, h: tile }, theme.tile);
      }
    }
    for (let y = oy; y < this.screenH + tile; y += tile) this.line(0, y, this.screenW, y, theme.grid, 1);
    for (let x = ox; x < this.screenW + tile; x += tile) this.line(x, 0, x, this.screenH, theme.grid, 1);
    this.drawObstacles(false);
  }

  private drawGame(): void {
    const center = { x: this.screenW * 0.5 + this.shakeOffset.x, y: this.screenH * 0.5 + this.shakeOffset.y };
    const pulse = 1 + (this.isMoving ? Math.sin(this.walkTime * 2) * 0.035 : 0);
    const aura = this.auraRadius * pulse;
    this.circle(center.x, center.y, aura, rgba(38, 140, 255, 30), true);
    this.circle(center.x, center.y, aura, rgba(88, 190, 255, 220), false, 3);
    this.drawAuraEffects(center, aura);
    for (const orb of this.orbs) {
      const pos = this.toScreen(orb.pos);
      if (this.drawSprite('orb', pos.x, pos.y, 22, 34)) continue;
      this.circle(pos.x, pos.y, 8, rgba(40, 190, 255), true);
      this.circle(pos.x, pos.y, ORB_RADIUS, rgba(210, 245, 255), true);
    }
    for (const enemy of this.enemies) {
      const pos = this.toScreen(enemy.pos);
      if (enemy.type === 'bomber_spore' && enemy.fuse > 0) {
        const heat = 1 - enemy.fuse / BOMBER_FUSE;
        this.circle(pos.x, pos.y, BOMBER_EXPLOSION_RADIUS, rgba(255, 80, 36, Math.floor(58 + heat * 78)), false, 3);
      }
      if (enemy.type === 'rift_eye' && enemy.warnTimer > 0) {
        const radius = enemy.boss ? BOSS_PULSE_RADIUS : RIFT_PULSE_RADIUS;
        const heat = 1 - enemy.warnTimer / (enemy.boss ? BOSS_WARN_TIME : RIFT_WARN_TIME);
        this.circle(pos.x, pos.y, radius, rgba(215, 76, 255, Math.floor(70 + heat * 90)), false, enemy.boss ? 6 : 3);
      }
      if (this.runnerSurging(enemy)) {
        this.line(pos.x - 20, pos.y + 18, pos.x + 20, pos.y + 18, rgba(126, 236, 255, 175), 3);
      }
      if (enemy.guard > 0) {
        this.circle(pos.x, pos.y, enemy.radius * enemy.scale * 2.4, rgba(220, 214, 255, 165), false, 3);
      }
      const tint = enemy.flash > 0 || (enemy.type === 'bomber_spore' && enemy.fuse > 0 && Math.floor(enemy.fuse * 16) % 2 === 0) ? WHITE : enemy.tint;
      if (!this.drawSprite(this.enemySprite(enemy.type), pos.x, pos.y, enemy.radius * enemy.scale * 4.2, enemy.radius * enemy.scale * 4.2, tint)) {
        this.circle(pos.x, pos.y, enemy.radius * enemy.scale, tint, true);
        this.circle(pos.x - enemy.radius * 0.25, pos.y - enemy.radius * 0.25, enemy.radius * 0.32, rgba(255, 255, 255, 55), true);
      }
      const hpWidth = 26 * Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
      this.fillRect({ x: pos.x - 13, y: pos.y - 22, w: 26, h: 3 }, rgba(38, 5, 5));
      this.fillRect({ x: pos.x - 13, y: pos.y - 22, w: hpWidth, h: 3 }, rgba(242, 92, 72));
    }
    this.drawPlayer(center);
    this.circle(center.x, center.y, this.pickupRadius, rgba(180, 230, 255, 64), false, 1);
    this.drawObstacles(true);
    this.drawEffects();
    if (this.hp / this.maxHp < 0.3) this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(180, 12, 24, 34));
    this.drawHud();
  }

  private drawAuraEffects(center: Point, aura: number): void {
    if (this.frostUnlocked) {
      this.drawFrostAura(center, aura);
    }
    if (!this.pulseUnlocked) return;
    this.drawPulseAura(center, aura);
  }

  private drawFrostAura(center: Point, aura: number): void {
    const inner = aura * 0.78;
    const phase = this.aliveTime;
    this.circle(center.x, center.y, inner, rgba(72, 215, 255, 36), true);
    this.circle(center.x, center.y, inner - 14, rgba(200, 250, 255, 68), false, 1);
    this.circle(center.x, center.y, inner + 10, rgba(112, 236, 255, 210), false, 3);
    this.circle(center.x, center.y, aura - 8, rgba(52, 170, 255, 96), false, 1);
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * TAU - phase * 0.35;
      const wave = Math.sin(phase * 3.1 + i * 0.7) * 5;
      const base = inner + wave;
      const x1 = center.x + Math.cos(angle) * (base - 18);
      const y1 = center.y + Math.sin(angle) * (base - 18);
      const x2 = center.x + Math.cos(angle) * (base + 18);
      const y2 = center.y + Math.sin(angle) * (base + 18);
      this.line(x1, y1, x2, y2, rgba(176, 248, 255, 190), i % 3 === 0 ? 3 : 2);
      this.line(
        center.x + Math.cos(angle + 0.11) * (base + 3),
        center.y + Math.sin(angle + 0.11) * (base + 3),
        center.x + Math.cos(angle - 0.11) * (base + 15),
        center.y + Math.sin(angle - 0.11) * (base + 15),
        rgba(220, 255, 255, 120),
        1,
      );
    }
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * TAU + phase * 0.5;
      const radius = inner * 0.58 + Math.sin(phase * 2 + i) * 8;
      this.snowflake(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, 7 + (i % 3), angle, rgba(214, 255, 255, 170));
    }
  }

  private drawPulseAura(center: Point, aura: number): void {
    const charge = Math.max(0, Math.min(1, 1 - this.pulseTimer / this.pulseInterval));
    const phase = this.aliveTime;
    const chargeRadius = aura + 10 + charge * 24;
    this.circle(center.x, center.y, chargeRadius, rgba(255, 174, 48, 70 + Math.floor(charge * 98)), false, 4);
    this.circle(center.x, center.y, aura * 0.34 + Math.sin(phase * 6) * 4, rgba(255, 210, 72, 34 + Math.floor(charge * 58)), true);
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * TAU + phase * 1.4;
      const radius = aura + 2 + Math.sin(phase * 4 + i) * 10;
      const spark = 3 + (i % 3);
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      this.line(
        x - Math.cos(angle) * spark * 2,
        y - Math.sin(angle) * spark * 2,
        x + Math.cos(angle) * spark * 2,
        y + Math.sin(angle) * spark * 2,
        rgba(255, 232, 128, 120 + Math.floor(charge * 90)),
        2,
      );
    }
    if (this.pulseFlash <= 0) return;
    const flash = this.pulseFlash / PULSE_FLASH_TIME;
    const waveRadius = aura + (1 - flash) * 82;
    this.circle(center.x, center.y, aura * 0.48, rgba(255, 245, 180, Math.floor(105 * flash)), true);
    this.circle(center.x, center.y, waveRadius, rgba(255, 220, 92, Math.floor(230 * flash)), false, 6);
    this.circle(center.x, center.y, waveRadius + 18, rgba(255, 156, 45, Math.floor(120 * flash)), false, 2);
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * TAU + phase * 0.9;
      this.line(
        center.x + Math.cos(angle) * (aura * 0.24),
        center.y + Math.sin(angle) * (aura * 0.24),
        center.x + Math.cos(angle) * (waveRadius + 22),
        center.y + Math.sin(angle) * (waveRadius + 22),
        rgba(255, 232, 128, Math.floor(185 * flash)),
        i % 4 === 0 ? 5 : 3,
      );
    }
  }

  private drawEffects(): void {
    for (const effect of this.effects) {
      const t = Math.min(1, effect.age / effect.life);
      const fade = 1 - t;
      if (fade <= 0) continue;
      const pos = this.toScreen(effect.pos);
      const radius = effect.radius * (0.24 + t * 0.95);
      const alpha = Math.floor(effect.color.a * fade);
      const color = rgba(effect.color.r, effect.color.g, effect.color.b, Math.floor(alpha * 0.82));
      this.circle(pos.x, pos.y, radius, color, false, Math.max(1, 1 + effect.power * 4 * fade));
      this.circle(pos.x, pos.y, radius * 0.34, rgba(effect.color.r, effect.color.g, effect.color.b, Math.floor(alpha * 0.18)), true);
      for (let i = 0; i < effect.sparks; i += 1) {
        const angle = effect.seed + (i / effect.sparks) * TAU + Math.sin(effect.seed + i) * 0.18;
        const xDir = Math.cos(angle);
        const yDir = Math.sin(angle);
        const travel = effect.radius * (0.18 + t * (0.92 + (i % 5) * 0.06));
        const sparkX = pos.x + xDir * travel;
        const sparkY = pos.y + yDir * travel;
        const size = (5 + effect.power * 8 + (i % 4)) * fade;
        this.line(
          sparkX - xDir * size * 0.35,
          sparkY - yDir * size * 0.35,
          sparkX + xDir * size,
          sparkY + yDir * size,
          rgba(effect.color.r, effect.color.g, effect.color.b, Math.floor(alpha * 0.86)),
          Math.max(1, Math.ceil(effect.power * 2 * fade)),
        );
        if (i % 3 === 0) {
          this.circle(sparkX, sparkY, Math.max(1, size * 0.22), rgba(255, 255, 255, Math.floor(alpha * 0.55)), true);
        }
      }
    }
  }

  private snowflake(x: number, y: number, radius: number, rotation: number, color: Color): void {
    this.circle(x, y, radius * 0.28, rgba(232, 255, 255, color.a), true);
    for (let i = 0; i < 6; i += 1) {
      const angle = rotation + (i / 6) * TAU;
      this.line(x, y, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, color, 1);
      this.line(
        x + Math.cos(angle) * radius * 0.55,
        y + Math.sin(angle) * radius * 0.55,
        x + Math.cos(angle + 0.45) * radius * 0.78,
        y + Math.sin(angle + 0.45) * radius * 0.78,
        color,
        1,
      );
    }
  }

  private drawPlayer(center: Point): void {
    const bob = this.isMoving ? Math.sin(this.walkTime * 2) * 3 : 0;
    if (this.drawSprite(this.playerSprite(), center.x, center.y - 10 - bob, 56, 86)) return;
    this.circle(center.x, center.y - bob, PLAYER_RADIUS + 5, rgba(250, 224, 90), true);
    this.circle(center.x, center.y - 15 - bob, 10, rgba(255, 238, 150), true);
    this.line(center.x, center.y - bob, center.x + this.facing.x * 22, center.y + this.facing.y * 22 - bob, rgba(255, 255, 255, 210), 3);
  }

  private drawHud(): void {
    const hpRatio = this.maxHp <= 0 ? 0 : this.hp / this.maxHp;
    this.fillRect({ x: 24, y: 24, w: 220, h: 14 }, rgba(40, 8, 10));
    this.fillRect({ x: 24, y: 24, w: 220 * hpRatio, h: 14 }, rgba(216, 43, 46));
    this.text(`HP ${Math.floor(this.hp)}/${Math.floor(this.maxHp)}  Lv.${this.level}`, 24, 45, 260, 18, WHITE);
    this.fillRect({ x: 24, y: 70, w: 220, h: 8 }, rgba(10, 20, 36));
    this.fillRect({ x: 24, y: 70, w: 220 * Math.min(1, this.exp / this.expToNext), h: 8 }, rgba(66, 163, 255));
    this.text(this.currentStage().name, 24, 91, 280, 17, rgba(230, 214, 148));
    this.text(`时间 ${this.formatTime(this.aliveTime)}`, this.screenW - 190, 25, 170, 18, WHITE);
    this.text(`击杀 ${this.kills}`, this.screenW - 190, 51, 170, 18, WHITE);
    this.text(`剩余 ${this.formatTime(SLICE_DURATION - this.aliveTime)}`, this.screenW - 190, 77, 170, 18, rgba(230, 214, 148));
    const pulse = this.pulseUnlocked ? `  脉冲 ${this.pulseFlash > 0 ? '爆发' : this.pulseTimer.toFixed(1) + 's'}` : '';
    const frost = this.frostUnlocked ? '  寒霜' : '';
    this.text(`${this.buildName()}  光环 ${Math.round(this.auraRadius)}  伤害 ${this.auraDamage.toFixed(1)}  移速 ${Math.round(this.moveSpeed)}${pulse}${frost}`, 24, this.screenH - 42, 720, 16, rgba(209, 230, 242));
    if (this.learned.length > 0) {
      this.text(`强化：${this.learned.slice(-4).join(', ')}`, 24, this.screenH - 70, 520, 15, rgba(184, 219, 255));
    }
    this.drawBossHud();
    if (this.noticeTimer > 0) {
      this.text(this.noticeText, this.screenW * 0.5 - 260, 116, 520, 24, rgba(255, 232, 132), 'center');
    }
    if (!this.finalBossSpawned && this.aliveTime >= FINAL_BOSS_TIME - 20) {
      this.text('裂隙核心即将降临', this.screenW * 0.5 - 160, 148, 320, 18, rgba(255, 172, 220), 'center');
    }
  }

  private drawBossHud(): void {
    const boss = this.enemies.find((enemy) => enemy.boss);
    if (!boss) return;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const width = Math.max(220, Math.min(520, this.screenW - 320));
    const x = this.screenW * 0.5 - width * 0.5;
    this.fillRect({ x, y: 25, w: width, h: 12 }, rgba(42, 8, 38));
    this.fillRect({ x, y: 25, w: width * ratio, h: 12 }, rgba(255, 72, 214));
    this.text(`${boss.name}  ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}`, x, 42, width, 16, rgba(255, 205, 246), 'center');
  }

  private drawMenu(): void {
    this.drawSprite('player_front', this.screenW * 0.5, this.screenH * 0.24, 74, 112);
    this.text('光环生存 Demo', this.screenW * 0.5 - 260, this.screenH * 0.34, 520, 42, WHITE, 'center');
    this.text('拖怪入环，撑过 8 分钟。第 7 分钟裂隙核心降临，别搁那硬贴脸。', this.screenW * 0.5 - 360, this.screenH * 0.43, 720, 18, SOFT_TEXT, 'center');
    this.startButton = { x: this.screenW * 0.5 - 110, y: this.screenH * 0.55, w: 220, h: 52 };
    this.button(this.startButton, '开始游戏');
    this.text('Enter / Space 也能开始', this.screenW * 0.5 - 130, this.screenH * 0.55 + 88, 260, 15, rgba(140, 160, 174), 'center');
  }

  private drawUpgrade(): void {
    this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(0, 0, 0, 132));
    this.text('升级！选择一个强化', this.screenW * 0.5 - 160, this.screenH * 0.22, 320, 30, WHITE, 'center');
    for (let i = 0; i < this.upgradeChoices.length; i += 1) {
      const rect = this.upgradeRect(i);
      const upgrade = this.upgradeChoices[i];
      this.fillRect(rect, rgba(26, 33, 41));
      this.strokeRect(rect, rgba(92, 166, 242), 2);
      this.text(`${i + 1}. ${upgrade.title}`, rect.x + 18, rect.y + 28, rect.w - 36, 24, WHITE);
      this.text(this.upgradeDesc(upgrade), rect.x + 18, rect.y + 66, rect.w - 36, 18, SOFT_TEXT);
    }
  }

  private drawGameOver(): void {
    this.drawOverlay('游戏结束', `${this.buildName()}  |  生存 ${this.formatTime(this.aliveTime)}  |  等级 ${this.level}  |  击杀 ${this.kills}`);
    this.restartButton = { x: this.screenW * 0.5 - 105, y: this.screenH * 0.58, w: 210, h: 50 };
    this.button(this.restartButton, '重新开始');
  }

  private drawVictory(): void {
    this.drawOverlay('光环稳定', `${this.buildName()} 通关  |  等级 ${this.level}  |  击杀 ${this.kills}`);
    this.restartButton = { x: this.screenW * 0.5 - 105, y: this.screenH * 0.58, w: 210, h: 50 };
    this.button(this.restartButton, '再来一局');
  }

  private drawOverlay(title: string, subtitle: string): void {
    this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(0, 0, 0, 143));
    this.text(title, this.screenW * 0.5 - 180, this.screenH * 0.39, 360, 34, WHITE, 'center');
    this.text(subtitle, this.screenW * 0.5 - 260, this.screenH * 0.47, 520, 18, SOFT_TEXT, 'center');
  }

  private button(rect: Rect, label: string): void {
    this.fillRect(rect, rgba(36, 82, 138));
    this.strokeRect(rect, rgba(122, 199, 255), 2);
    this.text(label, rect.x, rect.y + 13, rect.w, 20, WHITE, 'center');
  }

  private drawObstacles(foreground: boolean): void {
    const drawDistance = Math.max(this.screenW, this.screenH) * 0.75 + FOREST_CELL_SIZE * 2;
    const theme = this.currentTheme();
    for (const obstacle of this.obstaclesNear(this.player, drawDistance)) {
      const pos = this.toScreen(obstacle.pos);
      if (obstacle.kind === 'rock') {
        if (foreground) continue;
        this.circle(pos.x + 5, pos.y + 7, obstacle.radius * 1.08, rgba(0, 0, 0, 86), true);
        this.circle(pos.x, pos.y, obstacle.radius, theme.rock, true);
        this.circle(pos.x - obstacle.radius * 0.25, pos.y - obstacle.radius * 0.25, obstacle.radius * 0.38, rgba(140, 160, 140, 80), true);
        continue;
      }
      if (foreground) {
        this.circle(pos.x, pos.y - obstacle.radius * 0.72, obstacle.radius * 1.38, theme.leaf, true);
        this.circle(pos.x - obstacle.radius * 0.72, pos.y - obstacle.radius * 0.35, obstacle.radius * 0.84, theme.leaf, true);
        this.circle(pos.x + obstacle.radius * 0.68, pos.y - obstacle.radius * 0.42, obstacle.radius * 0.78, theme.leaf, true);
      } else {
        this.circle(pos.x + 6, pos.y + 10, obstacle.radius * 1.28, rgba(0, 0, 0, 86), true);
        this.fillRect({ x: pos.x - obstacle.radius * 0.22, y: pos.y - obstacle.radius * 0.12, w: obstacle.radius * 0.44, h: obstacle.radius * 0.92 }, theme.trunk);
        this.circle(pos.x, pos.y, obstacle.radius * 0.38, theme.trunk, true);
      }
    }
    if (foreground) this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(0, 3, 3, 40));
  }

  private obstaclesNear(worldPos: Point, distance: number): Array<{ pos: Point; radius: number; kind: 'rock' | 'tree' }> {
    const result: Array<{ pos: Point; radius: number; kind: 'rock' | 'tree' }> = [];
    const minX = Math.floor((worldPos.x - distance) / FOREST_CELL_SIZE);
    const maxX = Math.floor((worldPos.x + distance) / FOREST_CELL_SIZE);
    const minY = Math.floor((worldPos.y - distance) / FOREST_CELL_SIZE);
    const maxY = Math.floor((worldPos.y + distance) / FOREST_CELL_SIZE);
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellY = minY; cellY <= maxY; cellY += 1) {
        const obstacle = this.obstacleForCell(cellX, cellY);
        if (obstacle) result.push(obstacle);
      }
    }
    return result;
  }

  private obstacleForCell(cellX: number, cellY: number): { pos: Point; radius: number; kind: 'rock' | 'tree' } | null {
    if (this.hash01(cellX, cellY, 0) < 0.44) return null;
    const pos = {
      x: (cellX + 0.18 + this.hash01(cellX, cellY, 1) * 0.64) * FOREST_CELL_SIZE,
      y: (cellY + 0.18 + this.hash01(cellX, cellY, 2) * 0.64) * FOREST_CELL_SIZE,
    };
    if (Math.hypot(pos.x, pos.y) < FOREST_CLEAR_RADIUS) return null;
    const isRock = this.hash01(cellX, cellY, 3) < 0.18;
    return {
      pos,
      radius: isRock ? this.lerp(18, 28, this.hash01(cellX, cellY, 4)) : this.lerp(24, 38, this.hash01(cellX, cellY, 5)),
      kind: isRock ? 'rock' : 'tree',
    };
  }

  private pushFromObstacles(pos: Point, radius: number): Point {
    let pushed = { ...pos };
    for (const obstacle of this.obstaclesNear(pushed, radius + FOREST_CELL_SIZE)) {
      const dx = pushed.x - obstacle.pos.x;
      const dy = pushed.y - obstacle.pos.y;
      const minDistance = radius + obstacle.radius;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > 0.001 && distanceSq < minDistance * minDistance) {
        const distance = Math.sqrt(distanceSq);
        pushed = { x: obstacle.pos.x + (dx / distance) * minDistance, y: obstacle.pos.y + (dy / distance) * minDistance };
      } else if (distanceSq <= 0.001) {
        pushed.x += minDistance;
      }
    }
    return pushed;
  }

  private onKeyDown(event: EventKeyboard): void {
    this.pressed.add(event.keyCode);
    if (event.keyCode === KeyCode.ESCAPE && this.mode === 'playing') {
      this.mode = 'paused';
    } else if (event.keyCode === KeyCode.ESCAPE && this.mode === 'paused') {
      this.mode = 'playing';
    } else if ((this.mode === 'menu' || this.mode === 'gameover' || this.mode === 'victory') && this.isConfirmKey(event.keyCode)) {
      this.startGame();
    } else if (this.mode === 'upgrade') {
      if (event.keyCode === KeyCode.DIGIT_1) this.chooseUpgrade(0);
      if (event.keyCode === KeyCode.DIGIT_2) this.chooseUpgrade(1);
      if (event.keyCode === KeyCode.DIGIT_3) this.chooseUpgrade(2);
    }
  }

  private onKeyUp(event: EventKeyboard): void {
    this.pressed.delete(event.keyCode);
  }

  private onMouseDown(event: EventMouse): void {
    if (event.getButton() !== 0) return;
    const location = event.getUILocation();
    const point = { x: location.x, y: this.screenH - location.y };
    if (this.mode === 'menu' && this.contains(this.startButton, point)) this.startGame();
    if ((this.mode === 'gameover' || this.mode === 'victory') && this.contains(this.restartButton, point)) this.startGame();
    if (this.mode === 'upgrade') {
      for (let i = 0; i < this.upgradeChoices.length; i += 1) {
        if (this.contains(this.upgradeRect(i), point)) this.chooseUpgrade(i);
      }
    }
  }

  private currentStage(): Stage {
    return STAGES[this.currentStageIndex()];
  }

  private currentStageIndex(): number {
    let index = 0;
    for (let i = 0; i < STAGES.length; i += 1) {
      if (this.aliveTime >= STAGES[i].start) index = i;
    }
    return index;
  }

  private currentTheme(): Theme {
    return THEMES[this.currentStageIndex()];
  }

  private pickEnemyType(): EnemyId {
    const pool = this.currentStage().pool.filter(([type]) => this.aliveTime >= 25 || type !== 'bomber_spore');
    const total = pool.reduce((sum, item) => sum + item[1], 0);
    let roll = Math.floor(Math.random() * total) + 1;
    for (const [type, weight] of pool) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return pool[0][0];
  }

  private upgradeRect(index: number): Rect {
    const width = 230;
    const height = 136;
    const gap = 24;
    const total = width * 3 + gap * 2;
    return { x: this.screenW * 0.5 - total * 0.5 + index * (width + gap), y: this.screenH * 0.38, w: width, h: height };
  }

  private syncScreen(): void {
    const size = view.getVisibleSize();
    this.screenW = size.width || this.screenW;
    this.screenH = size.height || this.screenH;
    const transform = this.getComponent(UITransform) ?? this.addComponent(UITransform);
    if (!transform) throw new Error('Game UITransform is required');
    transform.setContentSize(this.screenW, this.screenH);
  }

  private loadSpriteFrames(): void {
    resources.load(PLAYER_TEXTURE, Texture2D, (error, texture) => {
      if (error || !texture) {
        console.warn(`Failed to load ${PLAYER_TEXTURE}`, error);
        return;
      }
      this.spriteFrames.set('player_front', this.makeFrame(texture, 125, 118, 300, 455));
      this.spriteFrames.set('player_left', this.makeFrame(texture, 698, 128, 245, 450));
      this.spriteFrames.set('player_right', this.makeFrame(texture, 1241, 128, 245, 450));
      this.spriteFrames.set('player_back', this.makeFrame(texture, 1779, 125, 260, 450));
    });
    resources.load(ATLAS_TEXTURE, Texture2D, (error, texture) => {
      if (error || !texture) {
        console.warn(`Failed to load ${ATLAS_TEXTURE}`, error);
        return;
      }
      this.spriteFrames.set('enemy_knight', this.makeFrame(texture, 130, 120, 430, 420));
      this.spriteFrames.set('enemy_eye', this.makeFrame(texture, 725, 140, 430, 400));
      this.spriteFrames.set('orb', this.makeFrame(texture, 245, 735, 205, 340));
    });
  }

  private makeFrame(texture: Texture2D, x: number, y: number, width: number, height: number): SpriteFrame {
    const frame = new SpriteFrame();
    frame.reset({
      texture,
      rect: new CocosRect(x, y, width, height),
      originalSize: new Size(width, height),
      offset: new Vec2(0, 0),
    });
    return frame;
  }

  private drawSprite(key: SpriteKey, x: number, y: number, width: number, height: number, color: Color = WHITE): boolean {
    const frame = this.spriteFrames.get(key);
    if (!frame) return false;
    const slot = this.nextSprite();
    slot.sprite.spriteFrame = frame;
    slot.sprite.color = color;
    slot.transform.setContentSize(width, height);
    slot.node.active = true;
    slot.node.setPosition(this.localX(x), this.localY(y), 0);
    return true;
  }

  private nextSprite(): SpriteSlot {
    if (this.spriteCursor >= this.spriteSlots.length) {
      const node = new Node(`Sprite${this.spriteSlots.length}`);
      node.layer = this.node.layer;
      this.node.addChild(node);
      const transform = node.addComponent(UITransform);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.spriteSlots.push({ node, sprite, transform });
    }
    return this.spriteSlots[this.spriteCursor++];
  }

  private hideUnusedSprites(): void {
    for (let i = this.spriteCursor; i < this.spriteSlots.length; i += 1) {
      this.spriteSlots[i].node.active = false;
    }
  }

  private playerSprite(): SpriteKey {
    if (Math.abs(this.facing.x) > Math.abs(this.facing.y)) return this.facing.x < 0 ? 'player_left' : 'player_right';
    return this.facing.y < 0 ? 'player_back' : 'player_front';
  }

  private enemySprite(type: EnemyId): SpriteKey {
    return type === 'bulwark' ? 'enemy_knight' : 'enemy_eye';
  }

  private text(value: string, x: number, y: number, width: number, size: number, color: Color, align: 'left' | 'center' = 'left'): void {
    const label = this.nextLabel();
    const height = Math.ceil(size * 1.4);
    const transform = label.getComponent(UITransform);
    if (!transform) throw new Error('Label UITransform is required');
    transform.setContentSize(width, height);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = Math.ceil(size * 1.2);
    label.color = color;
    label.horizontalAlign = align === 'center' ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = true;
    label.node.active = true;
    label.node.setPosition(this.localX(x + width * 0.5), this.localY(y + height * 0.5), 0);
  }

  private nextLabel(): Label {
    if (this.labelCursor >= this.labels.length) {
      const node = new Node(`Label${this.labels.length}`);
      this.node.addChild(node);
      node.addComponent(UITransform);
      this.labels.push(node.addComponent(Label));
    }
    return this.labels[this.labelCursor++];
  }

  private hideUnusedLabels(): void {
    for (let i = this.labelCursor; i < this.labels.length; i += 1) {
      this.labels[i].node.active = false;
    }
  }

  private toScreen(worldPos: Point): Point {
    return {
      x: worldPos.x - this.player.x + this.screenW * 0.5 + this.shakeOffset.x,
      y: worldPos.y - this.player.y + this.screenH * 0.5 + this.shakeOffset.y,
    };
  }

  private fillRect(rect: Rect, color: Color): void {
    this.graphics.fillColor = color;
    this.graphics.rect(this.localX(rect.x), this.localY(rect.y + rect.h), rect.w, rect.h);
    this.graphics.fill();
  }

  private strokeRect(rect: Rect, color: Color, width: number): void {
    this.graphics.strokeColor = color;
    this.graphics.lineWidth = width;
    this.graphics.rect(this.localX(rect.x), this.localY(rect.y + rect.h), rect.w, rect.h);
    this.graphics.stroke();
  }

  private circle(x: number, y: number, radius: number, color: Color, fill: boolean, width = 1): void {
    if (fill) {
      this.graphics.fillColor = color;
      this.graphics.circle(this.localX(x), this.localY(y), radius);
      this.graphics.fill();
      return;
    }
    this.graphics.strokeColor = color;
    this.graphics.lineWidth = width;
    this.graphics.circle(this.localX(x), this.localY(y), radius);
    this.graphics.stroke();
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: Color, width: number): void {
    this.graphics.strokeColor = color;
    this.graphics.lineWidth = width;
    this.graphics.moveTo(this.localX(x1), this.localY(y1));
    this.graphics.lineTo(this.localX(x2), this.localY(y2));
    this.graphics.stroke();
  }

  private localX(x: number): number {
    return x - this.screenW * 0.5;
  }

  private localY(y: number): number {
    return this.screenH * 0.5 - y;
  }

  private down(...codes: KeyCode[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }

  private isConfirmKey(code: KeyCode): boolean {
    return code === KeyCode.ENTER || code === KeyCode.SPACE;
  }

  private contains(rect: Rect, point: Point): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  private distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private moveToward(from: Point, to: Point, maxDistance: number): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= maxDistance || distance === 0) return { ...to };
    return { x: from.x + (dx / distance) * maxDistance, y: from.y + (dy / distance) * maxDistance };
  }

  private hash01(cellX: number, cellY: number, salt: number): number {
    return this.fposmod(Math.sin(cellX * 127.1 + cellY * 311.7 + salt * 74.7) * 43758.5453, 1);
  }

  private fposmod(value: number, mod: number): number {
    return ((value % mod) + mod) % mod;
  }

  private lerp(from: number, to: number, weight: number): number {
    return from + (to - from) * weight;
  }

  private shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  private formatTime(value: number): string {
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  private selfCheck(): void {
    if (STAGES.length !== THEMES.length) {
      throw new Error('stages and themes must stay aligned');
    }
    if (SLICE_DURATION !== 480) {
      throw new Error('vertical slice must last 8 minutes');
    }
    if (!UPGRADE_POOL.some((upgrade) => upgrade.kind === 'pulse')) {
      throw new Error('pulse upgrade must exist');
    }
    if (!UPGRADE_POOL.some((upgrade) => upgrade.kind === 'frost')) {
      throw new Error('frost upgrade must exist');
    }
    if (!UPGRADE_POOL.some((upgrade) => upgrade.kind === 'focus')) {
      throw new Error('focus upgrade must exist');
    }
    if (FINAL_BOSS_TIME >= SLICE_DURATION) {
      throw new Error('final boss must spawn before victory');
    }
    if (!STAGES[0].pool.some(([type]) => type === 'bomber_spore')) {
      throw new Error('early bomber pressure must stay in stage one');
    }
    if (!ENEMY_TYPES.bomber_spore || ENEMY_HP.bomber_spore !== 26) {
      throw new Error('bomber_spore must be configured');
    }
    if (this.hash01(2, -3, 4) !== this.hash01(2, -3, 4)) {
      throw new Error('hash01 must be deterministic');
    }
    if (this.obstacleForCell(0, 0) !== null) {
      throw new Error('spawn area must stay clear');
    }
  }
}
