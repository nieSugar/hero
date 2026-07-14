import {
  AURA_EDGE_REARM_MARGIN,
  AURA_SWEET_RATIO,
  AURA_TICK,
  BOMBER_EXPLOSION_RADIUS,
  BOMBER_FUSE,
  BOMBER_TRIGGER_RANGE,
  BOSS_MINION_POOL,
  BOSS_PHASE_RATIO,
  BOSS_PULSE_RADIUS,
  BOSS_WARN_TIME,
  BULWARK_GUARD_DURATION,
  BULWARK_GUARD_MULT,
  DAMAGE_UPGRADE_MULT,
  EFFECT_CAP,
  ENEMY_CAP,
  ENEMY_END_GROWTH,
  ENEMY_HP,
  ENEMY_TYPES,
  FINAL_BOSS_TIME,
  FIXED_CHALLENGE_SEED,
  FOCUS_DAMAGE_MULT,
  FOCUS_RADIUS_MULT,
  FOREST_CELL_SIZE,
  FOREST_CLEAR_RADIUS,
  FROST_RADIUS_STEP,
  FROST_SPEED_MIN,
  FROST_SPEED_MULT,
  FROST_SPEED_STEP,
  HP_UPGRADE_AMOUNT,
  HP_UPGRADE_HEAL,
  MAX_FRAME_CATCHUP,
  MAX_SIM_STEP,
  MIN_AURA_RADIUS,
  ORB_CAP,
  ORB_RADIUS,
  ORB_MERGE_RADIUS,
  PICKUP_UPGRADE_AMOUNT,
  PLAYER_HIT_INVULNERABILITY,
  PLAYER_RADIUS,
  PULSE_DAMAGE_MULT,
  PULSE_DAMAGE_STEP,
  PULSE_EDGE_CHARGE_RATIO,
  PULSE_FLASH_TIME,
  PULSE_INTERVAL,
  PULSE_INTERVAL_MIN,
  PULSE_INTERVAL_MULT,
  RADIUS_UPGRADE_AMOUNT,
  RIFT_PULSE_RADIUS,
  RIFT_WARN_TIME,
  SHATTER_DAMAGE_MULT,
  SHATTER_EFFECT_CAP,
  SHATTER_RADIUS,
  SLICE_DURATION,
  SPAWN_END_INTERVAL,
  SPAWN_START_INTERVAL,
  SPECIAL_RULES,
  SPEED_UPGRADE_AMOUNT,
  STAGES,
  STAGE_RULES,
  TAU,
  THEMES,
  UPGRADE_POOL,
  WAVE_TEMPLATES,
  rgba,
  type AuraPath,
  type Effect,
  type Enemy,
  type EnemyId,
  type GameMode,
  type InitialTendency,
  type Orb,
  type Point,
  type Profile,
  type Rgba,
  type RunOutcome,
  type SoundKey,
  type Stage,
  type StageRule,
  type Theme,
  type ThreatLevel,
  type Upgrade,
  type UpgradeKind,
  type WaveTemplate,
} from './AuraSurvivorModel';

export type SessionEvent =
  | { type: 'sound'; key: Exclude<SoundKey, 'bgm_loop'>; volume: number }
  | { type: 'music'; action: 'play' | 'pause' | 'stop' }
  | { type: 'clear-input' }
  | { type: 'record'; outcome: RunOutcome };

export class AuraSurvivorSession {
  readonly profile: Profile;
  private events: SessionEvent[] = [];

  mode: GameMode = 'menu';
  player: Point = { x: 0, y: 0 };
  maxHp = 100;
  hp = 100;
  moveSpeed = 250;
  auraRadius = 100;
  auraDamage = 10;
  pickupRadius = 90;
  level = 1;
  exp = 0;
  expToNext = 100;
  kills = 0;
  aliveTime = 0;
  spawnTimer = 0;
  auraTimer = AURA_TICK;
  pulseUnlocked = false;
  pulseTimer = PULSE_INTERVAL;
  pulseInterval = PULSE_INTERVAL;
  pulseDamageMult = PULSE_DAMAGE_MULT;
  pulseFlash = 0;
  frostUnlocked = false;
  frostSpeedMult = FROST_SPEED_MULT;
  finalBossSpawned = false;
  bossDefeated = false;
  playerHitCooldown = 0;
  playerFlash = 0;
  damageDealt = 0;
  damageTaken = 0;
  deathReason = '';
  nextSpecialSpawnAt: Partial<Record<EnemyId, number>> = {};
  tutorialStep = 0;
  lastStageIndex = 0;
  noticeText = '';
  noticeTimer = 0;
  threatLevel: ThreatLevel = 0;
  fixedChallenge = false;
  initialTendency: InitialTendency = 'balanced';
  randomState = 1;
  runRecorded = false;
  newRecordText = '';
  pickupSoundCooldown = 0;
  lastWaveName = '';
  walkTime = 0;
  isMoving = false;
  facing: Point = { x: 0, y: 1 };
  enemies: Enemy[] = [];
  orbs: Orb[] = [];
  effects: Effect[] = [];
  shakeTime = 0;
  shakeDuration = 0;
  shakePower = 0;
  shakeOffset: Point = { x: 0, y: 0 };
  upgradeChoices: Upgrade[] = [];
  upgradeLevels: Partial<Record<UpgradeKind, number>> = {};
  rerollsLeft = 1;
  learned: string[] = [];

  constructor(profile: Profile) {
    this.profile = profile;
  }

  update(deltaTime: number, movement: Point): void {
    const realDelta = this.realFrameDelta(deltaTime);
    if (this.mode === 'playing') {
      this.aliveTime = Math.min(SLICE_DURATION, this.aliveTime + realDelta);
      if (this.aliveTime >= SLICE_DURATION) this.finishVictory(false);
    }
    const frameDelta = this.simulationFrameDelta(realDelta);
    let remaining = frameDelta;
    while (this.mode === 'playing' && remaining > 0.000001) {
      const step = Math.min(MAX_SIM_STEP, remaining);
      this.updatePlaying(step, movement);
      remaining -= step;
    }
    this.updateEffects(frameDelta);
  }

  updatePlaying(delta: number, movement: Point): void {
    this.playerHitCooldown = Math.max(0, this.playerHitCooldown - delta);
    this.playerFlash = Math.max(0, this.playerFlash - delta);
    this.pickupSoundCooldown = Math.max(0, this.pickupSoundCooldown - delta);
    this.updateStageNotice();
    this.updateFinalBoss();
    this.updatePlayer(delta, movement);
    this.updateSpawner(delta);
    this.updateAuraEdges();
    this.updateAura(delta);
    if (this.mode === 'playing') this.updatePulse(delta);
    if (this.mode === 'playing') this.updateEnemies(delta);
    if (this.mode === 'playing') this.updateOrbs(delta);
  }

  startGame(): void {
    this.mode = 'playing';
    this.player = { x: 0, y: 0 };
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.moveSpeed = 250;
    this.auraRadius = 100;
    this.auraDamage = 10;
    this.pickupRadius = 90;
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
    this.bossDefeated = false;
    this.playerHitCooldown = 0;
    this.playerFlash = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.deathReason = '';
    this.nextSpecialSpawnAt = {};
    this.tutorialStep = 0;
    this.lastStageIndex = 0;
    this.randomState = this.fixedChallenge ? FIXED_CHALLENGE_SEED : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
    this.runRecorded = false;
    this.newRecordText = '';
    this.pickupSoundCooldown = 0;
    this.lastWaveName = '';
    this.noticeText = 'WASD 移动，把怪物引进蓝色光环';
    this.noticeTimer = 3.2;
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
    this.upgradeLevels = {};
    this.rerollsLeft = 1;
    this.learned = [];
    this.clearTouch();
    this.applyInitialTendency();
    this.playBgm();
  }

  returnToMenu(): void {
    this.mode = 'menu';
    this.player = { x: 0, y: 0 };
    this.aliveTime = 0;
    this.lastStageIndex = 0;
    this.enemies = [];
    this.orbs = [];
    this.effects = [];
    this.upgradeChoices = [];
    this.noticeTimer = 0;
    this.isMoving = false;
    this.clearTouch();
    this.stopBgm();
  }

  pause(): boolean {
    if (this.mode !== 'playing') return false;
    this.mode = 'paused';
    this.isMoving = false;
    return true;
  }

  resume(): boolean {
    if (this.mode !== 'paused') return false;
    this.mode = 'playing';
    return true;
  }

  cycleThreat(): void {
    this.threatLevel = ((this.threatLevel + 1) % 3) as ThreatLevel;
  }

  toggleFixedChallenge(): void {
    this.fixedChallenge = !this.fixedChallenge;
  }

  cycleInitialTendency(): void {
    const choices: InitialTendency[] = ['balanced', ...this.profile.unlockedPaths];
    this.initialTendency = choices[(choices.indexOf(this.initialTendency) + 1) % choices.length];
  }

  updateStageNotice(): void {
    const stageIndex = this.currentStageIndex();
    if (stageIndex === this.lastStageIndex) return;
    for (let index = this.lastStageIndex + 1; index <= stageIndex; index += 1) this.triggerStageEvent(index);
    this.lastStageIndex = stageIndex;
    this.player = this.pushFromObstacles(this.player, PLAYER_RADIUS);
    for (const enemy of this.enemies) enemy.pos = this.pushFromObstacles(enemy.pos, enemy.radius);
  }

  triggerStageEvent(stageIndex: number): void {
    const available = WAVE_TEMPLATES.filter((wave) => wave.stages.indexOf(stageIndex) >= 0);
    const fresh = available.filter((wave) => wave.name !== this.lastWaveName);
    const pool = fresh.length > 0 ? fresh : available;
    const wave = pool[Math.floor(this.random() * pool.length)];
    if (!wave) return;
    this.lastWaveName = wave.name;
    this.spawnWave(wave);
    this.showNotice(`${STAGES[stageIndex].name} · ${wave.name} · 击败精英获得重抽`);
  }

  spawnWave(wave: WaveTemplate): void {
    let eliteSpawned = false;
    for (const [type, baseCount] of wave.enemies) {
      const count = baseCount + this.threatLevel;
      for (let index = 0; index < count; index += 1) {
        const elite = !eliteSpawned && type === wave.elite;
        if (this.spawnEnemy(type, elite, 430 + index * 24) && elite) eliteSpawned = true;
      }
    }
    if (!eliteSpawned) {
      const fallback = wave.enemies.find(([type]) => !SPECIAL_RULES[type])?.[0] ?? 'runner';
      this.spawnEnemy(fallback, true, 470);
    }
  }

  updateFinalBoss(): void {
    if (this.finalBossSpawned || this.aliveTime < FINAL_BOSS_TIME) return;
    this.finalBossSpawned = true;
    this.spawnFinalBoss();
    this.showNotice('裂隙核心降临：击破可提前完美通关');
  }

  spawnFinalBoss(): void {
    this.enemies = this.enemies.filter((enemy) => enemy.type !== 'rift_eye' && enemy.type !== 'bomber_spore');
    this.nextSpecialSpawnAt.rift_eye = SLICE_DURATION;
    const angle = this.random() * TAU;
    this.enemies.push({
      pos: { x: this.player.x + Math.cos(angle) * 620, y: this.player.y + Math.sin(angle) * 620 },
      type: 'rift_eye',
      name: '裂隙核心',
      hp: 1450,
      maxHp: 1450,
      speed: 82,
      damage: 44,
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
      elite: false,
      phase: 1,
      auraEdgeArmed: true,
      dashDir: { x: 0, y: 0 },
      dashTimer: 0,
    });
    this.spawnBurst(this.player, rgba(255, 76, 220), this.auraRadius + 150, 36, 0.68, 1.45);
    this.addShake(0.35, 8);
    this.playSound('boss', 0.9);
  }

  updatePlayer(delta: number, movement: Point): void {
    let x = movement.x;
    let y = movement.y;
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
    if (this.tutorialStep === 0) {
      this.tutorialStep = 1;
      this.showNotice('外沿亮环伤害更高；寒霜则偏爱内圈');
    }
    const stageSpeed = this.currentStageRule().playerSpeedMult;
    this.player = this.pushFromObstacles(
      { x: this.player.x + x * this.moveSpeed * stageSpeed * delta, y: this.player.y + y * this.moveSpeed * stageSpeed * delta },
      PLAYER_RADIUS,
    );
  }

  updateSpawner(delta: number): void {
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    this.spawnEnemy();
    this.spawnTimer += this.spawnIntervalAt(this.aliveTime);
  }

  spawnEnemy(forcedType?: EnemyId, elite = false, spawnDistance?: number): boolean {
    const cap = this.finalBossSpawned ? ENEMY_CAP : ENEMY_CAP - 1;
    if (this.enemies.length >= cap) return false;
    const angle = this.random() * TAU;
    const distance = spawnDistance ?? 520 + this.random() * 240;
    const type = forcedType ?? this.pickEnemyType();
    if (!type || !this.canSpawnType(type, forcedType !== undefined)) return false;
    const data = ENEMY_TYPES[type];
    const growth = this.enemyGrowthAt(this.aliveTime);
    const hp = ENEMY_HP[type] * growth * (elite ? 2.2 : 1);
    this.enemies.push({
      pos: { x: this.player.x + Math.cos(angle) * distance, y: this.player.y + Math.sin(angle) * distance },
      type,
      name: elite ? `精英${data.name}` : data.name,
      hp,
      maxHp: hp,
      speed: data.speed * Math.min(1.35, 1 + this.aliveTime * 0.001),
      damage: data.damage * growth * (elite ? 1.25 : 1),
      exp: Math.round(this.enemyRewardAt(type, this.aliveTime) * (elite ? 1.6 : 1)),
      radius: data.radius,
      scale: data.scale * (elite ? 1.2 : 1),
      tint: data.tint,
      hitCd: 0,
      flash: 0,
      fuse: 0,
      guard: 0,
      abilityTimer: type === 'rift_eye' ? 2.2 + this.random() * 1.4 : type === 'wind_cutter' ? 1.4 + this.random() * 1.2 : 0,
      warnTimer: 0,
      seed: this.random() * TAU,
      boss: false,
      elite,
      phase: 1,
      auraEdgeArmed: true,
      dashDir: { x: 0, y: 0 },
      dashTimer: 0,
    });
    const rule = SPECIAL_RULES[type];
    if (rule) this.nextSpecialSpawnAt[type] = this.aliveTime + rule.cooldown * (1 - this.threatLevel * 0.15);
    return true;
  }

  spawnIntervalAt(time: number): number {
    const progress = Math.max(0, Math.min(1, time / SLICE_DURATION));
    const interval = this.lerp(SPAWN_START_INTERVAL, SPAWN_END_INTERVAL, Math.pow(progress, 1.15));
    const relief = this.lerp(1, 1.6, Math.max(0, Math.min(1, (time - FINAL_BOSS_TIME) / (SLICE_DURATION - FINAL_BOSS_TIME))));
    return interval * relief * ([1, 0.88, 0.76][this.threatLevel] ?? 1);
  }

  enemyGrowthAt(time: number): number {
    const progress = Math.max(0, Math.min(1, time / SLICE_DURATION));
    return 1 + ENEMY_END_GROWTH * Math.pow(progress, 1.15);
  }

  enemyRewardAt(type: EnemyId, time: number): number {
    return Math.round(ENEMY_TYPES[type].exp * this.enemyGrowthAt(time));
  }

  updateEnemies(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      enemy.flash = Math.max(0, enemy.flash - delta);
      enemy.guard = Math.max(0, enemy.guard - delta);
      enemy.hitCd = Math.max(0, enemy.hitCd - delta);
      this.updateBossPhase(enemy);
      this.updateRiftPulse(enemy, delta);
      if (this.mode !== 'playing') return;
      const dx = this.player.x - enemy.pos.x;
      const dy = this.player.y - enemy.pos.y;
      const length = Math.hypot(dx, dy);
      if (enemy.type === 'wind_cutter') {
        this.updateWindCutter(enemy, delta, dx, dy, length);
        if (this.distance(enemy.pos, this.player) <= PLAYER_RADIUS + enemy.radius && enemy.hitCd <= 0) {
          if (this.takeDamage(enemy.damage, `${enemy.name}冲刺`, enemy.pos)) enemy.hitCd = 0.6;
          if (this.mode !== 'playing') return;
        }
        continue;
      }
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
        if (this.takeDamage(enemy.damage, `${enemy.name}接触`, enemy.pos)) enemy.hitCd = 0.6;
        if (this.mode !== 'playing') return;
      }
    }
  }

  updateWindCutter(enemy: Enemy, delta: number, dx: number, dy: number, distance: number): void {
    if (enemy.dashTimer > 0) {
      enemy.dashTimer -= delta;
      enemy.pos.x += enemy.dashDir.x * 470 * delta;
      enemy.pos.y += enemy.dashDir.y * 470 * delta;
    } else if (enemy.warnTimer > 0) {
      enemy.warnTimer -= delta;
      if (enemy.warnTimer <= 0) enemy.dashTimer = 0.42;
    } else {
      enemy.abilityTimer -= delta;
      if (enemy.abilityTimer <= 0 && distance > 0.001) {
        enemy.dashDir = { x: dx / distance, y: dy / distance };
        enemy.warnTimer = 0.55;
        enemy.abilityTimer = 2.2 + this.random() * 0.8;
      } else if (distance > 0.001) {
        const sway = Math.sin(this.aliveTime * 2.6 + enemy.seed) * 0.42;
        const speed = this.enemyMoveSpeed(enemy);
        enemy.pos.x += (dx / distance - dy / distance * sway) * speed * delta;
        enemy.pos.y += (dy / distance + dx / distance * sway) * speed * delta;
      }
    }
    enemy.pos = this.pushFromObstacles(enemy.pos, enemy.radius);
  }

  updateBossPhase(enemy: Enemy): void {
    if (!enemy.boss || enemy.phase >= 2 || enemy.hp > enemy.maxHp * BOSS_PHASE_RATIO) return;
    enemy.phase = 2;
    enemy.name = '狂暴裂隙核心';
    enemy.speed *= 1.18;
    enemy.damage *= 1.15;
    enemy.abilityTimer = Math.min(enemy.abilityTimer, 0.65);
    this.showNotice('裂隙核心进入二阶段');
    this.spawnBurst(enemy.pos, rgba(255, 72, 226), BOSS_PULSE_RADIUS + 70, 40, 0.7, 1.55);
    this.addShake(0.32, 7);
  }

  enemyMoveSpeed(enemy: Enemy): number {
    let speed = enemy.speed;
    if (this.runnerSurging(enemy)) speed *= 1.55;
    if (this.frostUnlocked && this.auraZone(this.distance(enemy.pos, this.player), enemy.radius) === 'inner') speed *= this.frostSpeedMult;
    if (enemy.warnTimer > 0) speed *= enemy.boss ? 0.25 : 0.55;
    return speed;
  }

  auraZone(distance: number, enemyRadius: number): 'outside' | 'inner' | 'sweet' {
    if (distance > this.auraRadius + enemyRadius) return 'outside';
    return distance >= this.auraRadius * AURA_SWEET_RATIO ? 'sweet' : 'inner';
  }

  runnerSurging(enemy: Enemy): boolean {
    return enemy.type === 'runner' && Math.sin(this.aliveTime * 3.8 + enemy.seed) > 0.68;
  }

  updateRiftPulse(enemy: Enemy, delta: number): void {
    if (enemy.type !== 'rift_eye') return;
    if (enemy.warnTimer > 0) {
      enemy.warnTimer -= delta;
      if (enemy.warnTimer <= 0) this.fireRiftPulse(enemy);
      return;
    }
    enemy.abilityTimer -= delta;
    if (enemy.abilityTimer <= 0) enemy.warnTimer = enemy.boss ? BOSS_WARN_TIME : RIFT_WARN_TIME;
  }

  fireRiftPulse(enemy: Enemy): void {
    const radius = this.riftPulseRadius(enemy);
    this.spawnBurst(enemy.pos, enemy.boss ? rgba(255, 70, 220) : rgba(190, 90, 255), radius, enemy.boss ? 34 : 18, 0.5, enemy.boss ? 1.35 : 0.85);
    this.addShake(enemy.boss ? 0.2 : 0.1, enemy.boss ? 5 : 2.2);
    if (this.distance(enemy.pos, this.player) <= radius + PLAYER_RADIUS) {
      const multiplier = enemy.boss ? (enemy.phase >= 2 ? 1.35 : 1.2) : 0.75;
      this.takeDamage(enemy.damage * multiplier, enemy.boss ? '裂隙核心脉冲' : '裂隙脉冲', enemy.pos);
    }
    enemy.abilityTimer = enemy.boss ? (enemy.phase >= 2 ? 1.8 : 2.6) : 3.5 + this.random() * 1.2;
  }

  riftPulseRadius(enemy: Enemy): number {
    if (!enemy.boss) return RIFT_PULSE_RADIUS;
    return BOSS_PULSE_RADIUS + (enemy.phase >= 2 ? 42 : 0);
  }

  explodeBomber(index: number): void {
    const enemy = this.enemies[index];
    this.spawnBurst(enemy.pos, rgba(255, 92, 48), BOMBER_EXPLOSION_RADIUS, 24, 0.46, 1.35);
    this.addShake(0.18, 5);
    this.enemies.splice(index, 1);
    if (this.distance(enemy.pos, this.player) <= BOMBER_EXPLOSION_RADIUS + PLAYER_RADIUS) {
      this.takeDamage(enemy.damage, '爆裂孢子自爆', enemy.pos);
    }
  }

  updateAuraEdges(): void {
    for (const enemy of this.enemies) {
      const outer = this.auraRadius + enemy.radius;
      const distance = this.distance(enemy.pos, this.player);
      if (enemy.auraEdgeArmed && distance <= outer) {
        enemy.auraEdgeArmed = false;
        if (this.pulseUnlocked) {
          this.pulseTimer = Math.max(0, this.pulseTimer - this.pulseInterval * PULSE_EDGE_CHARGE_RATIO);
          this.spawnBurst(enemy.pos, rgba(255, 220, 92), 20, 4, 0.18, 0.3);
        }
      } else if (!enemy.auraEdgeArmed && distance >= outer + AURA_EDGE_REARM_MARGIN) {
        enemy.auraEdgeArmed = true;
      }
    }
  }

  updateAura(delta: number): void {
    this.auraTimer -= delta;
    if (this.auraTimer > 0) return;
    this.auraTimer += AURA_TICK;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const zone = this.auraZone(this.distance(enemy.pos, this.player), enemy.radius);
      if (zone === 'outside') continue;
      this.damageEnemy(i, this.auraDamage * (zone === 'sweet' ? this.currentStageRule().sweetDamageMult : 1));
      if (this.mode !== 'playing') return;
    }
  }

  updatePulse(delta: number): void {
    this.pulseFlash = Math.max(0, this.pulseFlash - delta);
    if (!this.pulseUnlocked) return;
    this.pulseTimer -= delta;
    if (this.pulseTimer > 0) return;
    this.pulseTimer += this.pulseInterval;
    this.pulseFlash = PULSE_FLASH_TIME;
    this.spawnBurst(this.player, rgba(255, 220, 92), this.auraRadius + 54, 22, 0.34, 0.95);
    this.addShake(0.1, 2);
    const plan = this.pulseDamagePlan();
    const effectCount = Math.min(SHATTER_EFFECT_CAP, plan.shatterOrigins.length);
    for (let i = 0; i < effectCount; i += 1) {
      const origin = plan.shatterOrigins[Math.floor(i * plan.shatterOrigins.length / effectCount)];
      this.spawnBurst(origin.pos, rgba(132, 238, 255), SHATTER_RADIUS, 6, 0.26, 0.62);
    }
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const damage = plan.damage.get(enemy);
      if (damage === undefined) continue;
      this.damageEnemy(i, damage);
      if (this.mode !== 'playing') return;
    }
  }

  pulseDamagePlan(): { damage: Map<Enemy, number>; shatterOrigins: Enemy[] } {
    const damage = new Map<Enemy, number>();
    const shatterOrigins: Enemy[] = [];
    for (const enemy of this.enemies) {
      const zone = this.auraZone(this.distance(enemy.pos, this.player), enemy.radius);
      if (zone === 'outside') continue;
      damage.set(enemy, this.auraDamage * this.pulseDamageMult);
      if (this.frostUnlocked && zone === 'inner') shatterOrigins.push(enemy);
    }
    // ponytail: O(n²) is bounded by ENEMY_CAP; add a spatial query only if that cap rises.
    for (const enemy of this.enemies) {
      if (!shatterOrigins.some((origin) => this.distance(origin.pos, enemy.pos) <= SHATTER_RADIUS + enemy.radius)) continue;
      damage.set(enemy, (damage.get(enemy) ?? 0) + this.auraDamage * SHATTER_DAMAGE_MULT);
    }
    return { damage, shatterOrigins };
  }

  damageEnemy(index: number, damage: number): void {
    const enemy = this.enemies[index];
    const guarded = enemy.type === 'bulwark' && enemy.guard > 0;
    const finalDamage = guarded ? damage * BULWARK_GUARD_MULT : damage;
    this.damageDealt += Math.min(enemy.hp, finalDamage);
    enemy.hp -= finalDamage;
    enemy.flash = 0.1;
    if (enemy.type === 'bulwark' && !guarded) enemy.guard = BULWARK_GUARD_DURATION;
    if (enemy.hp <= 0) this.killEnemy(index);
  }

  killEnemy(index: number): void {
    const enemy = this.enemies[index];
    this.kills += 1;
    this.spawnBurst(enemy.pos, enemy.boss ? rgba(255, 94, 224) : enemy.type === 'bomber_spore' ? rgba(255, 126, 58) : rgba(96, 210, 255), 30 + enemy.radius * 2, enemy.boss ? 42 : 10, enemy.boss ? 0.8 : 0.32, enemy.boss ? 1.7 : 0.7);
    this.enemies.splice(index, 1);
    this.playSound('kill', enemy.boss ? 0.95 : 0.48);
    if (enemy.elite) {
      this.rerollsLeft += 1;
      this.showNotice('精英击破：获得 1 次重抽');
      this.spawnBurst(enemy.pos, rgba(255, 226, 96), 96, 24, 0.55, 1.2);
    }
    if (enemy.boss) {
      this.finishVictory(true);
      return;
    }
    this.dropOrb(enemy.pos, enemy.exp);
    if (this.tutorialStep <= 1) {
      this.tutorialStep = 2;
      this.showNotice('击杀会掉落蓝色晶体，靠近即可吸附');
    }
  }

  takeDamage(amount: number, source: string, origin?: Point): boolean {
    if (this.mode !== 'playing' || this.playerHitCooldown > 0 || amount <= 0) return false;
    const applied = Math.min(this.hp, amount);
    this.hp = Math.max(0, this.hp - amount);
    this.damageTaken += applied;
    this.playerHitCooldown = PLAYER_HIT_INVULNERABILITY;
    this.playerFlash = 0.18;
    if (origin) {
      const dx = this.player.x - origin.x;
      const dy = this.player.y - origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.001) {
        this.player = this.pushFromObstacles({ x: this.player.x + (dx / distance) * 24, y: this.player.y + (dy / distance) * 24 }, PLAYER_RADIUS);
      }
    }
    this.spawnBurst(this.player, rgba(255, 74, 76), 48, 12, 0.28, 0.7);
    this.addShake(0.12, 3.5);
    this.playSound('hit', 0.75);
    if (this.hp <= 0) {
      this.deathReason = source;
      this.mode = 'gameover';
      this.isMoving = false;
      this.clearTouch();
      this.recordRun('failure');
      this.stopBgm();
    }
    return true;
  }

  finishVictory(perfect: boolean): void {
    this.bossDefeated = perfect;
    this.mode = 'victory';
    this.isMoving = false;
    this.clearTouch();
    this.spawnBurst(this.player, perfect ? rgba(255, 220, 92) : rgba(92, 220, 255), this.auraRadius + 120, 38, 0.72, 1.55);
    this.addShake(0.3, 6);
    this.recordRun(perfect ? 'perfect' : 'normal');
    this.stopBgm();
  }

  dropOrb(pos: Point, value: number): void {
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.orbs.length; i += 1) {
      const distance = this.distance(this.orbs[i].pos, pos);
      if (distance < nearestDistance) {
        nearest = i;
        nearestDistance = distance;
      }
    }
    if (nearest >= 0 && (nearestDistance <= ORB_MERGE_RADIUS || this.orbs.length >= ORB_CAP)) {
      this.orbs[nearest].value += value;
      return;
    }
    this.orbs.push({ pos: { ...pos }, value });
  }

  updateEffects(delta: number): void {
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

  spawnBurst(pos: Point, color: Rgba, radius: number, sparks: number, life: number, power: number): void {
    this.effects.push({
      pos: { ...pos },
      age: 0,
      life: this.profile.reduceMotion ? Math.min(life, 0.28) : life,
      radius,
      sparks: this.profile.reduceMotion ? Math.max(3, Math.ceil(sparks * 0.4)) : sparks,
      seed: Math.random() * TAU,
      power,
      color,
    });
    if (this.effects.length > EFFECT_CAP) this.effects.splice(0, this.effects.length - EFFECT_CAP);
  }

  addShake(duration: number, power: number): void {
    if (!this.profile.shakeEnabled || this.profile.reduceMotion) return;
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakePower = Math.max(this.shakePower, power);
  }

  showNotice(text: string): void {
    this.noticeText = text;
    this.noticeTimer = 2.4;
  }

  updateOrbs(delta: number): void {
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      let distance = this.distance(orb.pos, this.player);
      if (distance <= this.pickupRadius) {
        orb.pos = this.moveToward(orb.pos, this.player, 560 * delta);
        distance = this.distance(orb.pos, this.player);
      }
      if (distance <= PLAYER_RADIUS + ORB_RADIUS + 2) {
        this.spawnBurst(orb.pos, rgba(80, 220, 255), 24, 7, 0.2, 0.42);
        this.exp += orb.value;
        this.orbs.splice(i, 1);
        if (this.pickupSoundCooldown <= 0) {
          this.playSound('pickup', 0.42);
          this.pickupSoundCooldown = 0.08;
        }
        if (this.tutorialStep === 2) {
          this.tutorialStep = 3;
          this.showNotice('经验满后游戏暂停，选择一个强化');
        }
        this.checkLevelUp();
      }
    }
  }

  checkLevelUp(): void {
    if (this.mode === 'upgrade' || this.exp < this.expToNext) return;
    this.exp -= this.expToNext;
    this.level += 1;
    this.expToNext = this.nextExpRequirement(this.expToNext);
    this.upgradeChoices = this.rollUpgradeChoices();
    if (this.upgradeChoices.length === 0) {
      this.showNotice('全部强化已满级');
      this.mode = 'playing';
      this.checkLevelUp();
      return;
    }
    this.mode = 'upgrade';
    this.spawnBurst(this.player, rgba(255, 226, 96), this.auraRadius + 42, 20, 0.42, 0.9);
    this.addShake(0.08, 2.5);
  }

  nextExpRequirement(current: number): number {
    return Math.round(current * 1.45 + 20);
  }

  upgradeLevel(kind: UpgradeKind): number {
    return this.upgradeLevels[kind] ?? 0;
  }

  isAuraPath(kind: UpgradeKind): kind is AuraPath {
    return kind === 'pulse' || kind === 'frost' || kind === 'focus';
  }

  availableUpgrades(): Upgrade[] {
    const focused = this.upgradeLevel('focus') > 0;
    const pulseOrFrost = this.upgradeLevel('pulse') > 0 || this.upgradeLevel('frost') > 0;
    return UPGRADE_POOL.filter((upgrade) => {
      if (this.upgradeLevel(upgrade.kind) >= upgrade.maxLevel) return false;
      if (focused && (this.isAuraPath(upgrade.kind) || upgrade.kind === 'radius')) return false;
      if (pulseOrFrost && upgrade.kind === 'focus') return false;
      return true;
    });
  }

  rollUpgradeChoices(excluded: readonly UpgradeKind[] = []): Upgrade[] {
    const available = this.availableUpgrades();
    const fresh = available.filter((upgrade) => excluded.indexOf(upgrade.kind) < 0);
    const repeated = available.filter((upgrade) => excluded.indexOf(upgrade.kind) >= 0);
    this.shuffle(fresh);
    this.shuffle(repeated);
    const candidates = [...fresh, ...repeated];
    const choices: Upgrade[] = [];
    if (this.learned.length === 0) {
      const preferred = this.initialTendency === 'balanced' ? undefined : candidates.find((upgrade) => upgrade.kind === this.initialTendency);
      const behavior = preferred ?? candidates.find((upgrade) => this.isAuraPath(upgrade.kind));
      if (behavior) choices.push(behavior);
    }
    for (const candidate of candidates) {
      if (choices.length >= 3) break;
      if (choices.indexOf(candidate) < 0) choices.push(candidate);
    }
    return choices;
  }

  rerollUpgrades(): void {
    if (this.mode !== 'upgrade' || !this.canRerollUpgrades()) return;
    const excluded = this.upgradeChoices.map((upgrade) => upgrade.kind);
    this.rerollsLeft -= 1;
    this.upgradeChoices = this.rollUpgradeChoices(excluded);
  }

  canRerollUpgrades(): boolean {
    return this.rerollsLeft > 0 && this.availableUpgrades().some(
      (upgrade) => this.upgradeChoices.every((choice) => choice.kind !== upgrade.kind),
    );
  }

  chooseUpgrade(index: number): void {
    const upgrade = this.upgradeChoices[index];
    if (this.mode !== 'upgrade' || !upgrade) return;
    const level = this.upgradeLevel(upgrade.kind);
    if (level >= upgrade.maxLevel || !this.availableUpgrades().some((candidate) => candidate.kind === upgrade.kind)) return;
    if (upgrade.kind === 'damage') this.auraDamage *= DAMAGE_UPGRADE_MULT;
    if (upgrade.kind === 'radius') this.auraRadius += RADIUS_UPGRADE_AMOUNT;
    if (upgrade.kind === 'speed') this.moveSpeed += SPEED_UPGRADE_AMOUNT;
    if (upgrade.kind === 'hp') {
      this.maxHp += HP_UPGRADE_AMOUNT;
      this.hp = Math.min(this.maxHp, this.hp + HP_UPGRADE_HEAL);
    }
    if (upgrade.kind === 'pickup') this.pickupRadius += PICKUP_UPGRADE_AMOUNT;
    if (upgrade.kind === 'pulse') {
      if (level === 0) {
        this.pulseUnlocked = true;
        this.pulseTimer = this.pulseInterval;
      } else {
        this.pulseInterval = Math.max(PULSE_INTERVAL_MIN, this.pulseInterval * PULSE_INTERVAL_MULT);
        this.pulseDamageMult += PULSE_DAMAGE_STEP;
      }
      this.pulseFlash = PULSE_FLASH_TIME;
    }
    if (upgrade.kind === 'frost') {
      if (level === 0) {
        this.frostUnlocked = true;
      } else {
        this.frostSpeedMult = Math.max(FROST_SPEED_MIN, this.frostSpeedMult - FROST_SPEED_STEP);
        this.auraRadius += FROST_RADIUS_STEP;
      }
    }
    if (upgrade.kind === 'focus') {
      this.auraDamage *= FOCUS_DAMAGE_MULT;
      this.auraRadius = Math.max(MIN_AURA_RADIUS, Math.round(this.auraRadius * FOCUS_RADIUS_MULT));
    }
    this.upgradeLevels[upgrade.kind] = level + 1;
    this.spawnBurst(this.player, rgba(255, 226, 96), this.auraRadius + 84, 28, 0.58, 1.25);
    this.addShake(0.16, 4);
    this.playSound('pickup', 0.7);
    this.learned.push(upgrade.title);
    this.showNotice(`${this.buildName()} 成型中`);
    this.upgradeChoices = [];
    this.mode = 'playing';
    this.checkLevelUp();
  }

  upgradeDesc(upgrade: Upgrade): string {
    const level = this.upgradeLevel(upgrade.kind);
    let description = '';
    if (upgrade.kind === 'damage') description = `伤害 ${this.auraDamage.toFixed(1)} → ${(this.auraDamage * DAMAGE_UPGRADE_MULT).toFixed(1)}`;
    if (upgrade.kind === 'radius') description = `半径 ${Math.round(this.auraRadius)} → ${Math.round(this.auraRadius + RADIUS_UPGRADE_AMOUNT)}`;
    if (upgrade.kind === 'speed') description = `移速 ${Math.round(this.moveSpeed)} → ${Math.round(this.moveSpeed + SPEED_UPGRADE_AMOUNT)}`;
    if (upgrade.kind === 'hp') description = `上限 ${Math.round(this.maxHp)} → ${Math.round(this.maxHp + HP_UPGRADE_AMOUNT)}，HP ${Math.round(this.hp)} → ${Math.round(Math.min(this.maxHp + HP_UPGRADE_AMOUNT, this.hp + HP_UPGRADE_HEAL))}`;
    if (upgrade.kind === 'pickup') description = `拾取半径 ${Math.round(this.pickupRadius)} → ${Math.round(this.pickupRadius + PICKUP_UPGRADE_AMOUNT)}`;
    if (upgrade.kind === 'pulse') {
      description = level === 0
        ? `解锁：${this.pulseInterval.toFixed(1)}s / ${this.pulseDamageMult.toFixed(1)}× 爆发\n跨边界充能，压缩移出`
        : `冷却 ${this.pulseInterval.toFixed(2)} → ${Math.max(PULSE_INTERVAL_MIN, this.pulseInterval * PULSE_INTERVAL_MULT).toFixed(2)}s\n倍率 ${this.pulseDamageMult.toFixed(2)} → ${(this.pulseDamageMult + PULSE_DAMAGE_STEP).toFixed(2)}×`;
    }
    if (upgrade.kind === 'frost') {
      description = level === 0
        ? `解锁：内圈减速 ${Math.round((1 - this.frostSpeedMult) * 100)}%\n可与脉冲碎冰，压缩移出`
        : `减速 ${Math.round((1 - this.frostSpeedMult) * 100)}% → ${Math.round((1 - Math.max(FROST_SPEED_MIN, this.frostSpeedMult - FROST_SPEED_STEP)) * 100)}% · 半径 +${FROST_RADIUS_STEP}`;
    }
    if (upgrade.kind === 'focus') {
      description = `贴身：伤害 ${this.auraDamage.toFixed(1)} → ${(this.auraDamage * FOCUS_DAMAGE_MULT).toFixed(1)}\n半径 ${Math.round(this.auraRadius)} → ${Math.max(MIN_AURA_RADIUS, Math.round(this.auraRadius * FOCUS_RADIUS_MULT))}，移除范围牌及其余流派`;
    }
    return `${description}${level + 1 === upgrade.maxLevel ? '\n本次后满级' : ''}`;
  }

  buildName(): string {
    if (this.pulseUnlocked && this.frostUnlocked) return '霜爆光环';
    if (this.pulseUnlocked) return '脉冲爆发';
    if (this.frostUnlocked) return '寒霜控场';
    if (this.upgradeLevel('focus') > 0) return '压缩灼杀';
    return '原初光环';
  }

  learnedSummary(): string {
    if (this.learned.length === 0) return '强化：无';
    const counts = new Map<string, number>();
    for (const name of this.learned) counts.set(name, (counts.get(name) ?? 0) + 1);
    return `强化：${[...counts].map(([name, count]) => `${name}×${count}`).join(' · ')}`;
  }

  resultRecordText(): string {
    const record = `纪录 ${this.formatTime(this.profile.bestTime)} · Lv.${this.profile.highestLevel} · ${this.profile.highestKills} 杀 · ${Math.round(this.profile.bestDamage)} 伤害`;
    const run = `${this.threatName()}${this.fixedChallenge ? ` · Seed ${FIXED_CHALLENGE_SEED}` : ''}`;
    return this.newRecordText ? `${this.newRecordText}  |  ${run}  |  ${record}` : `${run}  |  ${record}`;
  }

  threatName(): string {
    return ['标准', '进阶', '极限'][this.threatLevel];
  }

  tendencyName(): string {
    return { balanced: '均衡', pulse: '脉冲', frost: '寒霜', focus: '压缩' }[this.initialTendency];
  }

  obstaclesNear(worldPos: Point, distance: number): Array<{ pos: Point; radius: number; kind: 'rock' | 'tree' }> {
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

  obstacleForCell(cellX: number, cellY: number): { pos: Point; radius: number; kind: 'rock' | 'tree' } | null {
    const rule = this.currentStageRule();
    if (this.hash01(cellX, cellY, 0) >= rule.obstacleChance) return null;
    const pos = {
      x: (cellX + 0.18 + this.hash01(cellX, cellY, 1) * 0.64) * FOREST_CELL_SIZE,
      y: (cellY + 0.18 + this.hash01(cellX, cellY, 2) * 0.64) * FOREST_CELL_SIZE,
    };
    if (Math.hypot(pos.x, pos.y) < FOREST_CLEAR_RADIUS) return null;
    const isRock = this.hash01(cellX, cellY, 3) < 0.18;
    return {
      pos,
      radius: (isRock ? this.lerp(18, 28, this.hash01(cellX, cellY, 4)) : this.lerp(24, 38, this.hash01(cellX, cellY, 5))) * rule.obstacleScale,
      kind: isRock ? 'rock' : 'tree',
    };
  }

  pushFromObstacles(pos: Point, radius: number): Point {
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

  currentStage(): Stage {
    return STAGES[this.currentStageIndex()];
  }

  currentStageIndex(): number {
    let index = 0;
    for (let i = 0; i < STAGES.length; i += 1) {
      if (this.aliveTime >= STAGES[i].start) index = i;
    }
    return index;
  }

  currentTheme(): Theme {
    return THEMES[this.currentStageIndex()];
  }

  currentStageRule(): StageRule {
    return STAGE_RULES[this.currentStageIndex()];
  }

  pickEnemyType(): EnemyId | null {
    const bossPool: [EnemyId, number][] = this.threatLevel === 0
      ? BOSS_MINION_POOL
      : this.threatLevel === 1
        ? [['runner', 48], ['wind_cutter', 22], ['bulwark', 30]]
        : [['runner', 34], ['wind_cutter', 31], ['bulwark', 35]];
    const source = this.finalBossSpawned ? bossPool : this.currentStage().pool;
    const pool = source.filter(([type]) => this.canSpawnType(type));
    if (pool.length === 0) return null;
    const total = pool.reduce((sum, item) => sum + item[1], 0);
    let roll = Math.floor(this.random() * total) + 1;
    for (const [type, weight] of pool) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return pool[0][0];
  }

  canSpawnType(type: EnemyId, ignoreCooldown = false): boolean {
    if (this.aliveTime < 25 && type === 'bomber_spore') return false;
    const rule = SPECIAL_RULES[type];
    if (!rule) return true;
    if (!ignoreCooldown && this.aliveTime < (this.nextSpecialSpawnAt[type] ?? 0)) return false;
    return this.enemies.filter((enemy) => enemy.type === type).length < rule.cap + this.threatLevel;
  }

  distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  moveToward(from: Point, to: Point, maxDistance: number): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= maxDistance || distance === 0) return { ...to };
    return { x: from.x + (dx / distance) * maxDistance, y: from.y + (dy / distance) * maxDistance };
  }
  hash01(cellX: number, cellY: number, salt: number): number {
    return this.fposmod(Math.sin(cellX * 127.1 + cellY * 311.7 + salt * 74.7) * 43758.5453, 1);
  }

  fposmod(value: number, mod: number): number {
    return ((value % mod) + mod) % mod;
  }

  lerp(from: number, to: number, weight: number): number {
    return from + (to - from) * weight;
  }

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  random(): number {
    let state = this.randomState | 0;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    this.randomState = state >>> 0 || 1;
    return this.randomState / 0x100000000;
  }

  realFrameDelta(deltaTime: number): number {
    return Number.isFinite(deltaTime) ? Math.max(0, deltaTime) : 0;
  }

  simulationFrameDelta(realDelta: number): number {
    return Math.min(realDelta, MAX_FRAME_CATCHUP);
  }

  applyInitialTendency(): void {
    if (this.initialTendency !== 'balanced' && this.profile.unlockedPaths.indexOf(this.initialTendency) < 0) this.initialTendency = 'balanced';
    if (this.initialTendency === 'pulse') {
      this.pulseInterval *= 0.9;
      this.auraDamage *= 0.92;
    } else if (this.initialTendency === 'frost') {
      this.auraRadius += 12;
      this.moveSpeed -= 12;
    } else if (this.initialTendency === 'focus') {
      this.auraDamage *= 1.15;
      this.auraRadius = Math.round(this.auraRadius * 0.88);
    }
  }
  formatTime(value: number): string {
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  drainEvents(): SessionEvent[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }

  recordRun(outcome: RunOutcome): void {
    if (this.runRecorded) return;
    this.runRecorded = true;
    this.events.push({ type: 'record', outcome });
  }

  playBgm(): void {
    this.events.push({ type: 'music', action: 'play' });
  }

  stopBgm(): void {
    this.events.push({ type: 'music', action: 'stop' });
  }

  playSound(key: Exclude<SoundKey, 'bgm_loop'>, volume = 1): void {
    this.events.push({ type: 'sound', key, volume });
  }

  clearTouch(): void {
    this.events.push({ type: 'clear-input' });
  }
}
