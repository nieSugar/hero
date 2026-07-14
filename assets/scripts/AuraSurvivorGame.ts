import {
  _decorator,
  Component,
  game,
  Game,
  Graphics,
  macro,
  view,
} from 'cc';

import { GameInput, type InputAction } from './AuraSurvivorInput';
import { GameAudio, ProfileStore } from './AuraSurvivorPlatform';
import { AuraSurvivorRenderer, type UiAction } from './AuraSurvivorRenderer';
import { AuraSurvivorSession, type SessionEvent } from './AuraSurvivorSession';
import { runSelfCheck } from './AuraSurvivorChecks';

const { ccclass, requireComponent } = _decorator;

@ccclass('AuraSurvivorGame')
@requireComponent(Graphics)
export class AuraSurvivorGame extends Component {
  private readonly profileStore = new ProfileStore();
  private session!: AuraSurvivorSession;
  private renderer!: AuraSurvivorRenderer;
  private controls!: GameInput;
  private audio!: GameAudio;

  onLoad(): void {
    const graphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
    if (!graphics) throw new Error('Graphics component is required');

    view.setOrientation(macro.ORIENTATION_LANDSCAPE);
    this.session = new AuraSurvivorSession(this.profileStore.load());
    this.renderer = new AuraSurvivorRenderer(this.node, graphics, this.session);
    this.audio = new GameAudio(this.node, () => this.session.profile.soundEnabled);
    this.controls = new GameInput(
      () => this.renderer.viewport(),
      () => this.session.mode === 'playing',
      (point) => this.renderer.useJoystick(point),
      (action) => this.handleInput(action),
    );

    this.audio.load(() => this.session.mode === 'playing' || this.session.mode === 'upgrade');
    runSelfCheck(this.session, this.renderer);
    this.session.drainEvents();
    this.renderer.redraw(this.controls.joystick());
    this.controls.start();
    game.on(Game.EVENT_HIDE, this.onGameHide, this);
    game.on(Game.EVENT_SHOW, this.onGameShow, this);
  }

  onDestroy(): void {
    this.controls.stop();
    this.audio.destroy();
    this.renderer.destroy();
    game.off(Game.EVENT_HIDE, this.onGameHide, this);
    game.off(Game.EVENT_SHOW, this.onGameShow, this);
  }

  update(deltaTime: number): void {
    this.session.update(deltaTime, this.controls.movement());
    this.flushEvents();
    this.renderer.redraw(this.controls.joystick());
  }

  private handleInput(action: InputAction): void {
    if (action.type === 'escape') {
      if (this.session.mode === 'playing') this.pauseGame();
      else if (this.session.mode === 'paused') this.continueGame();
    } else if (action.type === 'confirm') {
      if (this.session.mode === 'menu' || this.session.mode === 'gameover' || this.session.mode === 'victory') this.session.startGame();
    } else if (action.type === 'upgrade') {
      this.session.chooseUpgrade(action.index);
    } else if (action.type === 'reroll') {
      this.session.rerollUpgrades();
    } else {
      const uiAction = this.renderer.actionAt(action.point);
      if (uiAction) this.handleUiAction(uiAction);
    }
    this.flushEvents();
  }

  private handleUiAction(action: UiAction): void {
    if (action.type === 'start' || action.type === 'restart') {
      this.session.startGame();
    } else if (action.type === 'threat') {
      this.session.cycleThreat();
    } else if (action.type === 'challenge') {
      this.session.toggleFixedChallenge();
    } else if (action.type === 'tendency') {
      this.session.cycleInitialTendency();
    } else if (action.type === 'sound') {
      this.session.profile.soundEnabled = !this.session.profile.soundEnabled;
      if (!this.session.profile.soundEnabled) this.audio.stop();
      this.profileStore.save(this.session.profile);
    } else if (action.type === 'motion') {
      this.session.profile.reduceMotion = !this.session.profile.reduceMotion;
      this.profileStore.save(this.session.profile);
    } else if (action.type === 'shake') {
      this.session.profile.shakeEnabled = !this.session.profile.shakeEnabled;
      this.profileStore.save(this.session.profile);
    } else if (action.type === 'pause') {
      this.pauseGame();
    } else if (action.type === 'continue') {
      this.continueGame();
    } else if (action.type === 'menu') {
      this.session.returnToMenu();
    } else if (action.type === 'reroll') {
      this.session.rerollUpgrades();
    } else if (action.type === 'upgrade') {
      this.session.chooseUpgrade(action.index);
    }
  }

  private pauseGame(): void {
    if (!this.session.pause()) return;
    this.controls.clear();
    this.audio.pause();
  }

  private continueGame(): void {
    if (!this.session.resume()) return;
    this.controls.clear();
    this.audio.playBgm();
  }

  private flushEvents(): void {
    for (const event of this.session.drainEvents()) this.handleSessionEvent(event);
  }

  private handleSessionEvent(event: SessionEvent): void {
    if (event.type === 'sound') {
      this.audio.playSound(event.key, event.volume);
    } else if (event.type === 'music') {
      if (event.action === 'play') this.audio.playBgm();
      else if (event.action === 'pause') this.audio.pause();
      else this.audio.stop();
    } else if (event.type === 'clear-input') {
      this.controls.clear();
    } else {
      this.session.newRecordText = this.profileStore.record(this.session.profile, {
        aliveTime: this.session.aliveTime,
        level: this.session.level,
        kills: this.session.kills,
        damageDealt: this.session.damageDealt,
        threatLevel: this.session.threatLevel,
        lastBuild: `${this.session.buildName()} · ${this.session.learnedSummary()}`,
      }, event.outcome);
    }
  }

  private onGameHide(): void {
    this.controls.clear();
    this.session.pause();
    this.session.isMoving = false;
    this.audio.pause();
  }

  private onGameShow(): void {
    if (this.session.mode === 'upgrade') this.audio.playBgm();
  }
}
