import {
  Color,
  Graphics,
  isValid,
  Label,
  Node,
  Rect as CocosRect,
  resources,
  Size,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  UITransform,
  Vec2,
  view,
} from 'cc';

import {
  ATLAS_TEXTURE,
  AURA_SWEET_RATIO,
  BOMBER_EXPLOSION_RADIUS,
  BOMBER_FUSE,
  BOSS_WARN_TIME,
  FINAL_BOSS_TIME,
  FIXED_CHALLENGE_SEED,
  FOREST_CELL_SIZE,
  ORB_RADIUS,
  PLAYER_RADIUS,
  PLAYER_TEXTURE,
  PULSE_FLASH_TIME,
  RIFT_WARN_TIME,
  SLICE_DURATION,
  SOFT_TEXT,
  TAU,
  WHITE,
  rgba,
  type Enemy,
  type Point,
  type Rect,
  type Rgba,
  type SafeInsets,
  type SpriteKey,
} from './AuraSurvivorModel';
import type { JoystickSnapshot } from './AuraSurvivorInput';
import type { AuraSurvivorSession } from './AuraSurvivorSession';

type SpriteSlot = { node: Node; sprite: Sprite; transform: UITransform };

export type UiAction =
  | { type: 'start' }
  | { type: 'threat' }
  | { type: 'challenge' }
  | { type: 'tendency' }
  | { type: 'sound' }
  | { type: 'motion' }
  | { type: 'shake' }
  | { type: 'pause' }
  | { type: 'continue' }
  | { type: 'restart' }
  | { type: 'menu' }
  | { type: 'reroll' }
  | { type: 'upgrade'; index: number };

export class AuraSurvivorRenderer {
  private graphics!: Graphics;
  private backgroundGraphics!: Graphics;
  private foregroundGraphics!: Graphics;
  private hudGraphics!: Graphics;
  private overlayGraphics!: Graphics;
  private entityRoot!: Node;
  private hudRoot!: Node;
  private overlayRoot!: Node;
  private screenW = 1280;
  private screenH = 720;
  private safeInsets: SafeInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  private labels: Label[] = [];
  private overlayLabels: Label[] = [];
  private spriteFrames = new Map<SpriteKey, SpriteFrame>();
  private spriteSlots: SpriteSlot[] = [];
  private labelCursor = 0;
  private overlayLabelCursor = 0;
  private spriteCursor = 0;
  private drawingOverlay = false;
  private startButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private continueButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private restartButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private menuButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rerollButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private threatButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private challengeButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private tendencyButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private soundButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private motionButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private shakeButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private pauseButton: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private joystickState: JoystickSnapshot = { touchId: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 } };
  private active = true;

  constructor(
    private readonly root: Node,
    baseGraphics: Graphics,
    readonly session: Readonly<AuraSurvivorSession>,
  ) {
    this.backgroundGraphics = baseGraphics;
    this.graphics = baseGraphics;
    this.entityRoot = this.createLayer('Entities');
    this.foregroundGraphics = this.createLayer('Foreground').addComponent(Graphics);
    this.hudRoot = this.createLayer('HUD');
    this.hudGraphics = this.hudRoot.addComponent(Graphics);
    this.overlayRoot = this.createLayer('Overlay');
    this.overlayGraphics = this.overlayRoot.addComponent(Graphics);
    this.syncScreen();
    this.loadSpriteFrames();
  }

  destroy(): void {
    this.active = false;
    this.spriteFrames.clear();
    for (const node of [this.entityRoot, this.foregroundGraphics.node, this.hudRoot, this.overlayRoot]) {
      if (isValid(node, true)) node.destroy();
    }
  }

  viewport(): { width: number; height: number } {
    return { width: this.screenW, height: this.screenH };
  }

  useJoystick(point: Point): boolean {
    return this.session.mode === 'playing' && !this.contains(this.pauseButton, point);
  }

  actionAt(point: Point): UiAction | null {
    const mode = this.session.mode;
    if (mode === 'playing') return this.contains(this.pauseButton, point) ? { type: 'pause' } : null;
    if (mode === 'menu') {
      if (this.contains(this.startButton, point)) return { type: 'start' };
      if (this.contains(this.threatButton, point)) return { type: 'threat' };
      if (this.contains(this.challengeButton, point)) return { type: 'challenge' };
      if (this.contains(this.tendencyButton, point)) return { type: 'tendency' };
      if (this.contains(this.soundButton, point)) return { type: 'sound' };
      if (this.contains(this.motionButton, point)) return { type: 'motion' };
      if (this.contains(this.shakeButton, point)) return { type: 'shake' };
      return null;
    }
    if (mode === 'paused') {
      if (this.contains(this.continueButton, point)) return { type: 'continue' };
      if (this.contains(this.restartButton, point)) return { type: 'restart' };
      if (this.contains(this.menuButton, point)) return { type: 'menu' };
      return null;
    }
    if (mode === 'upgrade') {
      if (this.contains(this.rerollButton, point)) return { type: 'reroll' };
      for (let index = 0; index < this.session.upgradeChoices.length; index += 1) {
        if (this.contains(this.upgradeRect(index), point)) return { type: 'upgrade', index };
      }
      return null;
    }
    if (this.contains(this.restartButton, point)) return { type: 'restart' };
    return this.contains(this.menuButton, point) ? { type: 'menu' } : null;
  }

  selfCheck(): void {
    if (this.backgroundGraphics.node !== this.root || this.entityRoot.parent !== this.root || this.foregroundGraphics.node.parent !== this.root || this.hudRoot.parent !== this.root || this.overlayRoot.parent !== this.root) {
      throw new Error('render layers must share the Canvas parent');
    }
    const order = [this.entityRoot, this.foregroundGraphics.node, this.hudRoot, this.overlayRoot].map((node) => node.getSiblingIndex());
    if (order.some((value, index) => index > 0 && value <= order[index - 1])) {
      throw new Error('render layers must stay in entity, foreground, HUD, overlay order');
    }
  }

  private get touchId(): number | null {
    return this.joystickState.touchId;
  }

  private get touchOrigin(): Readonly<Point> {
    return this.joystickState.origin;
  }

  private get touchCurrent(): Readonly<Point> {
    return this.joystickState.current;
  }

  private createLayer(name: string): Node {
    const node = new Node(name);
    node.layer = this.root.layer;
    node.addComponent(UITransform);
    this.root.addChild(node);
    return node;
  }

  redraw(joystick: JoystickSnapshot): void {
    this.joystickState = joystick;
    this.syncScreen();
    this.backgroundGraphics.clear();
    this.foregroundGraphics.clear();
    this.hudGraphics.clear();
    this.overlayGraphics.clear();
    this.graphics = this.backgroundGraphics;
    this.labelCursor = 0;
    this.overlayLabelCursor = 0;
    this.spriteCursor = 0;
    this.drawingOverlay = false;
    this.drawWorld();
    if (this.session.mode === 'menu') {
      this.graphics = this.hudGraphics;
      this.drawMenu();
      this.hideUnusedSprites();
      this.hideUnusedLabels();
      return;
    }
    this.drawGame();
    if (this.session.mode !== 'playing') this.beginOverlay();
    if (this.session.mode === 'upgrade') this.drawUpgrade();
    if (this.session.mode === 'paused') this.drawPause();
    if (this.session.mode === 'gameover') this.drawGameOver();
    if (this.session.mode === 'victory') this.drawVictory();
    this.hideUnusedSprites();
    this.hideUnusedLabels();
  }

  private beginOverlay(): void {
    this.graphics = this.overlayGraphics;
    this.drawingOverlay = true;
  }

  private drawWorld(): void {
    const theme = this.session.currentTheme();
    const stage = this.session.currentStageIndex();
    this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, theme.bg);
    const tile = 64;
    const ox = Math.floor(this.session.fposmod(-this.session.player.x, tile));
    const oy = Math.floor(this.session.fposmod(-this.session.player.y, tile));
    for (let x = ox; x < this.screenW + tile; x += tile) {
      for (let y = oy; y < this.screenH + tile; y += tile) {
        if (stage >= 2 && this.drawSprite('tile', x + tile * 0.5, y + tile * 0.5, tile, tile, stage === 2 ? rgba(255, 255, 255, 150) : rgba(212, 166, 255, 125))) continue;
        const alternate = (Math.floor((x - ox) / tile) + Math.floor((y - oy) / tile)) % 2 !== 0;
        this.fillRect({ x, y, w: tile, h: tile }, alternate ? rgba(theme.tile.r, theme.tile.g, theme.tile.b, Math.max(0, theme.tile.a - 28)) : theme.tile);
      }
    }
    for (let y = oy; y < this.screenH + tile; y += tile) this.line(0, y, this.screenW, y, theme.grid, 1);
    for (let x = ox; x < this.screenW + tile; x += tile) this.line(x, 0, x, this.screenH, theme.grid, 1);
    this.drawStageDecor();
    this.drawObstacles(false);
  }

  private drawStageDecor(): void {
    const stage = this.session.currentStageIndex();
    const gap = 96;
    const originX = this.session.fposmod(-this.session.player.x, gap);
    const originY = this.session.fposmod(-this.session.player.y, gap);
    for (let x = originX - gap; x < this.screenW + gap; x += gap) {
      for (let y = originY - gap; y < this.screenH + gap; y += gap) {
        const cellX = Math.floor((x + this.session.player.x) / gap);
        const cellY = Math.floor((y + this.session.player.y) / gap);
        if (this.session.hash01(cellX, cellY, 8 + stage) < 0.42) continue;
        if (stage === 0) {
          this.line(x - 5, y + 8, x, y - 5, rgba(78, 126, 74, 110), 2);
          this.line(x, y - 5, x + 7, y + 5, rgba(78, 126, 74, 110), 2);
        } else if (stage === 1) {
          this.line(x - 28, y + 8, x + 28, y - 8, rgba(220, 205, 142, 72), 2);
          this.line(x - 12, y + 20, x + 34, y + 8, rgba(220, 205, 142, 48), 1);
        } else if (stage === 2) {
          this.strokeRect({ x: x - 24, y: y - 10, w: 48, h: 20 }, rgba(132, 132, 142, 60), 2);
          this.line(x, y - 10, x, y + 10, rgba(132, 132, 142, 50), 1);
        } else {
          this.line(x - 26, y - 18, x, y, rgba(168, 92, 255, 92), 2);
          this.line(x, y, x + 30, y - 8, rgba(168, 92, 255, 92), 2);
          this.line(x, y, x + 8, y + 24, rgba(168, 92, 255, 72), 2);
        }
      }
    }
  }

  private drawGame(): void {
    const center = { x: this.screenW * 0.5 + this.session.shakeOffset.x, y: this.screenH * 0.5 + this.session.shakeOffset.y };
    const aura = this.session.auraRadius;
    this.circle(center.x, center.y, aura, rgba(38, 140, 255, 30), true);
    this.circle(center.x, center.y, aura, rgba(88, 190, 255, 220), false, 3);
    this.circle(center.x, center.y, aura * AURA_SWEET_RATIO, rgba(118, 218, 255, 125), false, 2);
    this.drawAuraEffects(center, aura);
    this.graphics = this.foregroundGraphics;
    for (const orb of this.session.orbs) {
      const pos = this.toScreen(orb.pos);
      if (!this.isScreenVisible(pos, 40)) continue;
      const scale = Math.min(1.55, 1 + Math.log2(Math.max(1, orb.value / 5)) * 0.12);
      if (this.drawSprite('orb', pos.x, pos.y, 22 * scale, 34 * scale)) continue;
      this.circle(pos.x, pos.y, 8 * scale, rgba(40, 190, 255), true);
      this.circle(pos.x, pos.y, ORB_RADIUS * scale, rgba(210, 245, 255), true);
    }
    for (const enemy of this.session.enemies) {
      const pos = this.toScreen(enemy.pos);
      if (!this.isScreenVisible(pos, enemy.boss ? 300 : 170)) continue;
      if (enemy.type === 'bomber_spore' && enemy.fuse > 0) {
        const heat = 1 - enemy.fuse / BOMBER_FUSE;
        this.circle(pos.x, pos.y, BOMBER_EXPLOSION_RADIUS, rgba(255, 80, 36, Math.floor(58 + heat * 78)), false, 3);
      }
      if (enemy.type === 'rift_eye' && enemy.warnTimer > 0) {
        const radius = this.session.riftPulseRadius(enemy);
        const heat = 1 - enemy.warnTimer / (enemy.boss ? BOSS_WARN_TIME : RIFT_WARN_TIME);
        this.circle(pos.x, pos.y, radius, rgba(215, 76, 255, Math.floor(70 + heat * 90)), false, enemy.boss ? 6 : 3);
      }
      if (enemy.type === 'wind_cutter' && enemy.warnTimer > 0) {
        this.line(pos.x, pos.y, pos.x + enemy.dashDir.x * 180, pos.y + enemy.dashDir.y * 180, rgba(140, 255, 236, 210), 3);
      }
      if (this.session.runnerSurging(enemy)) {
        this.line(pos.x - 20, pos.y + 18, pos.x + 20, pos.y + 18, rgba(126, 236, 255, 175), 3);
      }
      if (enemy.guard > 0) {
        this.circle(pos.x, pos.y, enemy.radius * enemy.scale * 2.4, rgba(220, 214, 255, 165), false, 3);
      }
      const tint = enemy.flash > 0 || (enemy.type === 'bomber_spore' && enemy.fuse > 0 && Math.floor(enemy.fuse * 16) % 2 === 0) ? WHITE : enemy.tint;
      const sprite = this.enemySprite(enemy);
      const spriteTint = enemy.flash > 0 ? WHITE : rgba(180 + Math.floor(enemy.tint.r * 0.29), 180 + Math.floor(enemy.tint.g * 0.29), 180 + Math.floor(enemy.tint.b * 0.29));
      if (!sprite || !this.drawSprite(sprite, pos.x, pos.y, enemy.radius * enemy.scale * 4.2, enemy.radius * enemy.scale * 4.2, spriteTint)) {
        this.circle(pos.x, pos.y, enemy.radius * enemy.scale, tint, true);
        this.circle(pos.x - enemy.radius * 0.25, pos.y - enemy.radius * 0.25, enemy.radius * 0.32, rgba(255, 255, 255, 55), true);
      }
      this.drawEnemyOutline(enemy, pos);
      if (enemy.boss || enemy.elite || enemy.flash > 0) {
        const hpWidth = 26 * Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        this.fillRect({ x: pos.x - 13, y: pos.y - 22, w: 26, h: 3 }, rgba(38, 5, 5));
        this.fillRect({ x: pos.x - 13, y: pos.y - 22, w: hpWidth, h: 3 }, rgba(242, 92, 72));
      }
    }
    this.drawPlayer(center);
    this.circle(center.x, center.y, this.session.pickupRadius, rgba(180, 230, 255, 64), false, 1);
    this.drawObstacles(true);
    this.drawEffects();
    if (this.session.hp / this.session.maxHp < 0.3) this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(180, 12, 24, 34));
    this.graphics = this.hudGraphics;
    this.drawHud();
  }

  private drawEnemyOutline(enemy: Enemy, pos: Point): void {
    const radius = enemy.radius * enemy.scale;
    if (enemy.type === 'bomber_spore') {
      for (let index = 0; index < 6; index += 1) {
        const angle = index * TAU / 6;
        this.circle(pos.x + Math.cos(angle) * radius * 0.72, pos.y + Math.sin(angle) * radius * 0.72, radius * 0.42, rgba(255, 178, 92, 190), false, 2);
      }
      this.line(pos.x, pos.y - radius, pos.x + radius * 0.72, pos.y - radius * 1.65, WHITE, 2);
      if (enemy.fuse > 0) {
        this.line(pos.x - 9, pos.y - 4, pos.x + 9, pos.y + 4, WHITE, 3);
        this.line(pos.x + 9, pos.y - 4, pos.x - 9, pos.y + 4, WHITE, 3);
      }
    }
    if (enemy.type === 'rift_eye') {
      const points = [{ x: 0, y: -radius * 1.45 }, { x: radius * 1.2, y: 0 }, { x: 0, y: radius * 1.45 }, { x: -radius * 1.2, y: 0 }];
      for (let index = 0; index < points.length; index += 1) {
        const from = points[index];
        const to = points[(index + 1) % points.length];
        this.line(pos.x + from.x, pos.y + from.y, pos.x + to.x, pos.y + to.y, WHITE, enemy.boss ? 4 : 2);
      }
      this.line(pos.x - radius, pos.y, pos.x + radius, pos.y, WHITE, 2);
      if (enemy.boss) {
        this.circle(pos.x, pos.y, radius * 1.75, WHITE, false, 3);
        this.circle(pos.x, pos.y, radius * 2.08, rgba(255, 255, 255, 150), false, 2);
      }
    }
    if (enemy.type === 'wind_cutter') {
      const dx = enemy.dashTimer > 0 || enemy.warnTimer > 0 ? enemy.dashDir.x : Math.cos(enemy.seed);
      const dy = enemy.dashTimer > 0 || enemy.warnTimer > 0 ? enemy.dashDir.y : Math.sin(enemy.seed);
      const px = -dy;
      const py = dx;
      this.line(pos.x + dx * radius * 1.5, pos.y + dy * radius * 1.5, pos.x - dx * radius - px * radius, pos.y - dy * radius - py * radius, WHITE, 3);
      this.line(pos.x + dx * radius * 1.5, pos.y + dy * radius * 1.5, pos.x - dx * radius + px * radius, pos.y - dy * radius + py * radius, WHITE, 3);
    }
    if (enemy.elite) this.circle(pos.x, pos.y, radius * 1.9, rgba(255, 226, 96, 220), false, 3);
  }

  private drawAuraEffects(center: Point, aura: number): void {
    if (this.session.frostUnlocked) {
      this.drawFrostAura(center, aura);
    }
    if (!this.session.pulseUnlocked) return;
    this.drawPulseAura(center, aura);
  }

  private drawFrostAura(center: Point, aura: number): void {
    const inner = aura * AURA_SWEET_RATIO;
    const phase = this.session.aliveTime;
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
    const charge = Math.max(0, Math.min(1, 1 - this.session.pulseTimer / this.session.pulseInterval));
    const phase = this.session.aliveTime;
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
    if (this.session.pulseFlash <= 0) return;
    const flash = this.session.pulseFlash / PULSE_FLASH_TIME;
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
    for (const effect of this.session.effects) {
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

  private snowflake(x: number, y: number, radius: number, rotation: number, color: Rgba): void {
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
    const bob = this.session.isMoving ? Math.sin(this.session.walkTime * 2) * 3 : 0;
    const tint = this.session.playerFlash > 0 ? rgba(255, 118, 118) : WHITE;
    if (this.drawSprite(this.playerSprite(), center.x, center.y - 10 - bob, 56, 86, tint)) return;
    this.circle(center.x, center.y - bob, PLAYER_RADIUS + 5, this.session.playerFlash > 0 ? rgba(255, 92, 92) : rgba(250, 224, 90), true);
    this.circle(center.x, center.y - 15 - bob, 10, rgba(255, 238, 150), true);
    this.line(center.x, center.y - bob, center.x + this.session.facing.x * 22, center.y + this.session.facing.y * 22 - bob, rgba(255, 255, 255, 210), 3);
  }

  private drawHud(): void {
    const left = this.safeInsets.left + 24;
    const top = this.safeInsets.top + 24;
    const right = this.screenW - this.safeInsets.right - 190;
    const hpRatio = this.session.maxHp <= 0 ? 0 : this.session.hp / this.session.maxHp;
    this.fillRect({ x: left - 12, y: top - 12, w: 354, h: 130 }, rgba(4, 10, 18, 178));
    this.fillRect({ x: left - 12, y: top - 12, w: 4, h: 130 }, rgba(72, 196, 255, 190));
    this.strokeRect({ x: left - 12, y: top - 12, w: 354, h: 130 }, rgba(96, 166, 204, 92), 1);
    this.fillRect({ x: right - 12, y: top - 12, w: 202, h: 92 }, rgba(4, 10, 18, 178));
    this.fillRect({ x: right + 186, y: top - 12, w: 4, h: 92 }, rgba(255, 196, 86, 190));
    this.strokeRect({ x: right - 12, y: top - 12, w: 202, h: 92 }, rgba(196, 158, 92, 82), 1);
    this.fillRect({ x: left, y: top, w: 220, h: 14 }, rgba(40, 8, 10));
    this.fillRect({ x: left, y: top, w: 220 * hpRatio, h: 14 }, rgba(216, 43, 46));
    this.text(`HP ${Math.floor(this.session.hp)}/${Math.floor(this.session.maxHp)}  Lv.${this.session.level}`, left, top + 21, 260, 18, WHITE);
    this.fillRect({ x: left, y: top + 46, w: 220, h: 8 }, rgba(10, 20, 36));
    this.fillRect({ x: left, y: top + 46, w: 220 * Math.min(1, this.session.exp / this.session.expToNext), h: 8 }, rgba(66, 163, 255));
    this.text(this.session.currentStage().name, left, top + 67, 300, 17, rgba(230, 214, 148));
    this.text(this.session.currentStageRule().label, left, top + 91, 330, 14, rgba(178, 199, 210));
    this.text(`时间 ${this.session.formatTime(this.session.aliveTime)}`, right, top + 1, 170, 18, WHITE);
    this.text(`击杀 ${this.session.kills} · ${this.session.threatName()}`, right, top + 27, 180, 18, WHITE);
    this.text(`剩余 ${this.session.formatTime(SLICE_DURATION - this.session.aliveTime)}`, right, top + 53, 170, 18, rgba(230, 214, 148));
    const pulse = this.session.pulseUnlocked ? `  脉冲 ${this.session.pulseFlash > 0 ? '爆发' : this.session.pulseTimer.toFixed(1) + 's'}` : '';
    const frost = this.session.frostUnlocked ? '  寒霜' : '';
    const bottom = this.screenH - this.safeInsets.bottom;
    this.fillRect({ x: left - 12, y: bottom - 82, w: 790, h: 64 }, rgba(4, 10, 18, 150));
    this.strokeRect({ x: left - 12, y: bottom - 82, w: 790, h: 64 }, rgba(86, 146, 184, 72), 1);
    this.text(`${this.session.buildName()}  光环 ${Math.round(this.session.auraRadius)}  伤害 ${this.session.auraDamage.toFixed(1)}  移速 ${Math.round(this.session.moveSpeed)}${pulse}${frost}`, left, bottom - 42, 760, 16, rgba(209, 230, 242));
    if (this.session.learned.length > 0) {
      this.text(`强化：${this.session.learned.slice(-4).join(', ')}`, left, bottom - 70, 520, 15, rgba(184, 219, 255));
    }
    this.drawBossHud();
    if (this.session.mode === 'playing' && this.session.noticeTimer > 0) {
      this.text(this.session.noticeText, this.screenW * 0.5 - 260, 116, 520, 24, rgba(255, 232, 132), 'center');
    }
    if (!this.session.finalBossSpawned && this.session.aliveTime >= FINAL_BOSS_TIME - 20) {
      this.text('裂隙核心即将降临', this.screenW * 0.5 - 160, 148, 320, 18, rgba(255, 172, 220), 'center');
    }
    this.drawTouchControls();
  }

  private drawBossHud(): void {
    const boss = this.session.enemies.find((enemy) => enemy.boss);
    if (!boss) return;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const width = Math.max(220, Math.min(520, this.screenW - 320));
    const x = this.screenW * 0.5 - width * 0.5;
    this.fillRect({ x, y: 25, w: width, h: 12 }, rgba(42, 8, 38));
    this.fillRect({ x, y: 25, w: width * ratio, h: 12 }, rgba(255, 72, 214));
    this.text(`${boss.name}  ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)}`, x, 42, width, 16, rgba(255, 205, 246), 'center');
  }

  private drawMenu(): void {
    this.graphics = this.backgroundGraphics;
    this.circle(this.screenW * 0.5, this.screenH * 0.13, 82, rgba(48, 174, 255, 28), true);
    this.circle(this.screenW * 0.5, this.screenH * 0.13, 70, rgba(112, 220, 255, 120), false, 2);
    this.graphics = this.hudGraphics;
    const panel = { x: this.screenW * 0.5 - 390, y: this.screenH * 0.20, w: 780, h: this.screenH * 0.68 };
    this.fillRect(panel, rgba(4, 9, 18, 158));
    this.strokeRect(panel, rgba(76, 164, 214, 86), 1);
    this.drawSprite('player_front', this.screenW * 0.5, this.screenH * 0.13, 66, 102);
    this.text('光环生存', this.screenW * 0.5 - 260, this.screenH * 0.25, 520, 42, rgba(230, 248, 255), 'center');
    this.text('拖怪入环，撑过 8 分钟；击破裂隙核心可提前完美通关。', this.screenW * 0.5 - 360, this.screenH * 0.34, 720, 17, SOFT_TEXT, 'center');
    this.startButton = { x: this.screenW * 0.5 - 110, y: this.screenH * 0.43, w: 220, h: 50 };
    this.button(this.startButton, '开始游戏');
    const width = 178;
    const gap = 14;
    const rowX = this.screenW * 0.5 - (width * 3 + gap * 2) * 0.5;
    this.threatButton = { x: rowX, y: this.screenH * 0.54, w: width, h: 40 };
    this.challengeButton = { x: rowX + width + gap, y: this.screenH * 0.54, w: width, h: 40 };
    this.tendencyButton = { x: rowX + (width + gap) * 2, y: this.screenH * 0.54, w: width, h: 40 };
    this.soundButton = { x: rowX, y: this.screenH * 0.62, w: width, h: 40 };
    this.motionButton = { x: rowX + width + gap, y: this.screenH * 0.62, w: width, h: 40 };
    this.shakeButton = { x: rowX + (width + gap) * 2, y: this.screenH * 0.62, w: width, h: 40 };
    this.button(this.threatButton, `威胁：${this.session.threatName()}`);
    this.button(this.challengeButton, this.session.fixedChallenge ? `种子：${FIXED_CHALLENGE_SEED}` : '固定种子：关');
    this.button(this.tendencyButton, `倾向：${this.session.tendencyName()}`);
    this.button(this.soundButton, `声音：${this.session.profile.soundEnabled ? '开' : '关'}`);
    this.button(this.motionButton, `减少动态：${this.session.profile.reduceMotion ? '开' : '关'}`);
    this.button(this.shakeButton, `震屏：${this.session.profile.shakeEnabled ? '开' : '关'}`);
    this.text(`纪录：${this.session.formatTime(this.session.profile.bestTime)} · Lv.${this.session.profile.highestLevel} · ${this.session.profile.highestKills} 杀 · 完美 ${this.session.profile.perfectWins}`, this.screenW * 0.5 - 360, this.screenH * 0.72, 720, 16, rgba(206, 222, 236), 'center');
    this.text(`上局：${this.session.profile.lastBuild}`, this.screenW * 0.5 - 380, this.screenH * 0.77, 760, 14, rgba(158, 185, 204), 'center');
    this.text('WASD / 方向键或左侧单摇杆移动 · 光环自动攻击 · ESC 暂停', this.screenW * 0.5 - 360, this.screenH * 0.84, 720, 15, rgba(170, 194, 210), 'center');
  }

  private drawUpgrade(): void {
    this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(0, 0, 0, 132));
    this.text('升级！选择一个强化', this.screenW * 0.5 - 160, this.screenH * 0.22, 320, 30, WHITE, 'center');
    for (let i = 0; i < this.session.upgradeChoices.length; i += 1) {
      const rect = this.upgradeRect(i);
      const upgrade = this.session.upgradeChoices[i];
      this.fillRect({ x: rect.x + 4, y: rect.y + 6, w: rect.w, h: rect.h }, rgba(0, 0, 0, 110));
      this.fillRect(rect, rgba(12, 23, 38, 244));
      this.fillRect({ x: rect.x, y: rect.y, w: rect.w, h: 5 }, rgba(72, 194, 255, 210));
      this.strokeRect(rect, rgba(106, 188, 238), 2);
      this.text(`${i + 1}. ${upgrade.title} Lv.${this.session.upgradeLevel(upgrade.kind) + 1}/${upgrade.maxLevel}`, rect.x + 18, rect.y + 28, rect.w - 36, 21, WHITE);
      this.text(this.session.upgradeDesc(upgrade), rect.x + 18, rect.y + 66, rect.w - 36, 16, SOFT_TEXT, 'left', 62);
    }
    this.rerollButton = { x: this.screenW * 0.5 - 100, y: this.screenH * 0.65, w: 200, h: 44 };
    if (this.session.canRerollUpgrades()) {
      this.button(this.rerollButton, `R 重抽（${this.session.rerollsLeft}）`);
    } else {
      this.fillRect(this.rerollButton, rgba(38, 42, 48));
      this.strokeRect(this.rerollButton, rgba(88, 98, 108), 2);
      this.text(this.session.rerollsLeft > 0 ? '暂无新选项' : '重抽已使用', this.rerollButton.x, this.rerollButton.y + 12, this.rerollButton.w, 18, rgba(132, 142, 152), 'center');
    }
  }

  private drawGameOver(): void {
    this.drawOverlay('游戏结束', `${this.session.buildName()}  |  生存 ${this.session.formatTime(this.session.aliveTime)}  |  Lv.${this.session.level}  |  击杀 ${this.session.kills}`);
    this.text(`死因：${this.session.deathReason || '未知'}  |  造成伤害 ${Math.round(this.session.damageDealt)}  |  承受伤害 ${Math.round(this.session.damageTaken)}`, this.screenW * 0.5 - 360, this.screenH * 0.51, 720, 17, rgba(255, 190, 190), 'center');
    this.text(this.session.learnedSummary(), this.screenW * 0.5 - 360, this.screenH * 0.56, 720, 16, SOFT_TEXT, 'center');
    this.text(this.session.resultRecordText(), this.screenW * 0.5 - 360, this.screenH * 0.60, 720, 15, rgba(255, 226, 118), 'center');
    this.drawResultButtons('重新开始');
  }

  private drawVictory(): void {
    const title = this.session.bossDefeated ? '完美胜利 · 裂隙净化' : '生存成功 · 光环稳定';
    const boss = this.session.bossDefeated ? '核心已击破' : '核心未击破';
    this.drawOverlay(title, `${this.session.buildName()}  |  ${boss}  |  ${this.session.formatTime(this.session.aliveTime)}  |  Lv.${this.session.level}  |  击杀 ${this.session.kills}`);
    this.text(`造成伤害 ${Math.round(this.session.damageDealt)}  |  承受伤害 ${Math.round(this.session.damageTaken)}`, this.screenW * 0.5 - 300, this.screenH * 0.51, 600, 17, rgba(210, 242, 255), 'center');
    this.text(this.session.learnedSummary(), this.screenW * 0.5 - 360, this.screenH * 0.56, 720, 16, SOFT_TEXT, 'center');
    this.text(this.session.resultRecordText(), this.screenW * 0.5 - 360, this.screenH * 0.60, 720, 15, rgba(255, 226, 118), 'center');
    this.drawResultButtons('再来一局');
  }

  private drawPause(): void {
    this.drawOverlay('暂停', '按 ESC 或点击继续');
    const x = this.screenW * 0.5 - 110;
    this.continueButton = { x, y: this.screenH * 0.51, w: 220, h: 48 };
    this.restartButton = { x, y: this.screenH * 0.60, w: 220, h: 48 };
    this.menuButton = { x, y: this.screenH * 0.69, w: 220, h: 48 };
    this.button(this.continueButton, '继续');
    this.button(this.restartButton, '重新开始');
    this.button(this.menuButton, '返回菜单');
  }

  private drawResultButtons(restartLabel: string): void {
    const gap = 24;
    const width = 210;
    const x = this.screenW * 0.5 - width - gap * 0.5;
    this.restartButton = { x, y: this.screenH * 0.65, w: width, h: 50 };
    this.menuButton = { x: x + width + gap, y: this.screenH * 0.65, w: width, h: 50 };
    this.button(this.restartButton, restartLabel);
    this.button(this.menuButton, '返回菜单');
  }

  private drawTouchControls(): void {
    if (this.session.mode !== 'playing') return;
    const base = this.touchId === null
      ? { x: this.safeInsets.left + 92, y: this.screenH - this.safeInsets.bottom - 94 }
      : this.touchOrigin;
    let knob = this.touchId === null ? base : this.touchCurrent;
    const dx = knob.x - base.x;
    const dy = knob.y - base.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 54) knob = { x: base.x + dx / distance * 54, y: base.y + dy / distance * 54 };
    this.circle(base.x, base.y, 58, rgba(18, 36, 54, 105), true);
    this.circle(base.x, base.y, 58, rgba(160, 215, 242, 120), false, 2);
    this.circle(knob.x, knob.y, 23, rgba(118, 205, 248, 150), true);
    this.pauseButton = { x: this.screenW - this.safeInsets.right - 92, y: this.safeInsets.top + 106, w: 68, h: 38 };
    this.button(this.pauseButton, '暂停');
  }

  private drawOverlay(title: string, subtitle: string): void {
    this.fillRect({ x: 0, y: 0, w: this.screenW, h: this.screenH }, rgba(2, 5, 12, 205));
    const panel = { x: this.screenW * 0.5 - 400, y: this.screenH * 0.30, w: 800, h: this.screenH * 0.50 };
    this.fillRect(panel, rgba(8, 17, 30, 230));
    this.strokeRect(panel, rgba(84, 178, 232, 118), 1);
    this.text(title, this.screenW * 0.5 - 180, this.screenH * 0.39, 360, 34, WHITE, 'center');
    this.text(subtitle, this.screenW * 0.5 - 260, this.screenH * 0.47, 520, 18, SOFT_TEXT, 'center');
  }

  private button(rect: Rect, label: string): void {
    this.fillRect({ x: rect.x + 3, y: rect.y + 4, w: rect.w, h: rect.h }, rgba(0, 0, 0, 105));
    this.fillRect(rect, rgba(16, 42, 70, 238));
    this.fillRect({ x: rect.x, y: rect.y, w: 4, h: rect.h }, rgba(72, 204, 255, 210));
    this.strokeRect(rect, rgba(112, 202, 255), 2);
    this.text(label, rect.x, rect.y + 13, rect.w, 20, WHITE, 'center');
  }

  private drawObstacles(foreground: boolean): void {
    const drawDistance = Math.max(this.screenW, this.screenH) * 0.75 + FOREST_CELL_SIZE * 2;
    const theme = this.session.currentTheme();
    for (const obstacle of this.session.obstaclesNear(this.session.player, drawDistance)) {
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
  }

  private upgradeRect(index: number): Rect {
    const width = 230;
    const height = 136;
    const gap = 24;
    const count = Math.max(1, this.session.upgradeChoices.length);
    const total = width * count + gap * (count - 1);
    return { x: this.screenW * 0.5 - total * 0.5 + index * (width + gap), y: this.screenH * 0.38, w: width, h: height };
  }

  private syncScreen(): void {
    const size = view.getVisibleSize();
    this.screenW = size.width || this.screenW;
    this.screenH = size.height || this.screenH;
    const safe = sys.getSafeAreaRect(true);
    this.safeInsets = {
      left: Math.max(0, safe.x),
      right: Math.max(0, this.screenW - safe.x - safe.width),
      top: Math.max(0, this.screenH - safe.y - safe.height),
      bottom: Math.max(0, safe.y),
    };
    const transform = this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform);
    if (!transform) throw new Error('Game UITransform is required');
    transform.setContentSize(this.screenW, this.screenH);
    for (const node of [this.entityRoot, this.foregroundGraphics.node, this.hudRoot, this.overlayRoot]) {
      node.getComponent(UITransform)?.setContentSize(this.screenW, this.screenH);
    }
  }

  private loadSpriteFrames(): void {
    resources.load(PLAYER_TEXTURE, Texture2D, (error, texture) => {
      if (!this.active) return;
      if (error || !texture) {
        console.warn(`Failed to load ${PLAYER_TEXTURE}`, error);
        return;
      }
      this.spriteFrames.set('player_front', this.makeFrame(texture, 163, 112, 302, 479));
      this.spriteFrames.set('player_left', this.makeFrame(texture, 715, 122, 255, 470));
      this.spriteFrames.set('player_right', this.makeFrame(texture, 1213, 123, 255, 470));
      this.spriteFrames.set('player_back', this.makeFrame(texture, 1711, 112, 301, 478));
    });
    resources.load(ATLAS_TEXTURE, Texture2D, (error, texture) => {
      if (!this.active) return;
      if (error || !texture) {
        console.warn(`Failed to load ${ATLAS_TEXTURE}`, error);
        return;
      }
      this.spriteFrames.set('enemy_knight', this.makeFrame(texture, 119, 113, 446, 446));
      this.spriteFrames.set('enemy_eye', this.makeFrame(texture, 710, 120, 427, 427));
      this.spriteFrames.set('orb', this.makeFrame(texture, 225, 718, 224, 371));
      this.spriteFrames.set('tile', this.makeFrame(texture, 725, 711, 375, 375));
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

  private drawSprite(key: SpriteKey, x: number, y: number, width: number, height: number, color: Rgba = WHITE): boolean {
    const frame = this.spriteFrames.get(key);
    if (!frame) return false;
    const slot = this.nextSprite();
    slot.sprite.spriteFrame = frame;
    slot.sprite.color = this.toColor(color);
    slot.transform.setContentSize(width, height);
    slot.node.active = true;
    slot.node.setPosition(this.localX(x), this.localY(y), 0);
    return true;
  }

  private nextSprite(): SpriteSlot {
    if (this.spriteCursor >= this.spriteSlots.length) {
      const node = new Node(`Sprite${this.spriteSlots.length}`);
      node.layer = this.root.layer;
      this.entityRoot.addChild(node);
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
    if (Math.abs(this.session.facing.x) > Math.abs(this.session.facing.y)) return this.session.facing.x < 0 ? 'player_left' : 'player_right';
    return this.session.facing.y < 0 ? 'player_back' : 'player_front';
  }

  private enemySprite(enemy: Enemy): SpriteKey | null {
    if (enemy.boss || enemy.type === 'bomber_spore' || enemy.type === 'rift_eye' || enemy.type === 'wind_cutter') return null;
    return enemy.type === 'bulwark' ? 'enemy_knight' : 'enemy_eye';
  }

  private text(value: string, x: number, y: number, width: number, size: number, color: Rgba, align: 'left' | 'center' = 'left', height = Math.ceil(size * 1.4)): void {
    const label = this.nextLabel();
    const transform = label.getComponent(UITransform);
    if (!transform) throw new Error('Label UITransform is required');
    transform.setContentSize(width, height);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = Math.ceil(size * 1.2);
    label.color = this.toColor(color);
    label.horizontalAlign = align === 'center' ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = true;
    label.node.active = true;
    label.node.setPosition(this.localX(x + width * 0.5), this.localY(y + height * 0.5), 0);
  }

  private nextLabel(): Label {
    const labels = this.drawingOverlay ? this.overlayLabels : this.labels;
    const cursor = this.drawingOverlay ? this.overlayLabelCursor : this.labelCursor;
    if (cursor >= labels.length) {
      const node = new Node(`${this.drawingOverlay ? 'OverlayLabel' : 'HudLabel'}${labels.length}`);
      node.layer = this.root.layer;
      (this.drawingOverlay ? this.overlayRoot : this.hudRoot).addChild(node);
      node.addComponent(UITransform);
      labels.push(node.addComponent(Label));
    }
    if (this.drawingOverlay) {
      this.overlayLabelCursor += 1;
    } else {
      this.labelCursor += 1;
    }
    return labels[cursor];
  }

  private hideUnusedLabels(): void {
    for (let i = this.labelCursor; i < this.labels.length; i += 1) {
      this.labels[i].node.active = false;
    }
    for (let i = this.overlayLabelCursor; i < this.overlayLabels.length; i += 1) {
      this.overlayLabels[i].node.active = false;
    }
  }

  private toScreen(worldPos: Point): Point {
    return {
      x: worldPos.x - this.session.player.x + this.screenW * 0.5 + this.session.shakeOffset.x,
      y: worldPos.y - this.session.player.y + this.screenH * 0.5 + this.session.shakeOffset.y,
    };
  }

  private fillRect(rect: Rect, color: Rgba): void {
    this.graphics.fillColor = this.toColor(color);
    this.graphics.rect(this.localX(rect.x), this.localY(rect.y + rect.h), rect.w, rect.h);
    this.graphics.fill();
  }

  private strokeRect(rect: Rect, color: Rgba, width: number): void {
    this.graphics.strokeColor = this.toColor(color);
    this.graphics.lineWidth = width;
    this.graphics.rect(this.localX(rect.x), this.localY(rect.y + rect.h), rect.w, rect.h);
    this.graphics.stroke();
  }

  private circle(x: number, y: number, radius: number, color: Rgba, fill: boolean, width = 1): void {
    if (fill) {
      this.graphics.fillColor = this.toColor(color);
      this.graphics.circle(this.localX(x), this.localY(y), radius);
      this.graphics.fill();
      return;
    }
    this.graphics.strokeColor = this.toColor(color);
    this.graphics.lineWidth = width;
    this.graphics.circle(this.localX(x), this.localY(y), radius);
    this.graphics.stroke();
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: Rgba, width: number): void {
    this.graphics.strokeColor = this.toColor(color);
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

  private contains(rect: Rect, point: Point): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }
  private isScreenVisible(pos: Point, margin: number): boolean {
    return pos.x >= -margin && pos.x <= this.screenW + margin && pos.y >= -margin && pos.y <= this.screenH + margin;
  }

  private toColor(value: Rgba): Color {
    return new Color(value.r, value.g, value.b, value.a);
  }
}
