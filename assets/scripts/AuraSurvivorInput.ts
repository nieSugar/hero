import { EventKeyboard, EventMouse, EventTouch, input, Input, KeyCode } from 'cc';

import type { Point } from './AuraSurvivorModel';

export type InputAction =
  | { type: 'escape' }
  | { type: 'confirm' }
  | { type: 'upgrade'; index: 0 | 1 | 2 }
  | { type: 'reroll' }
  | { type: 'pointer'; point: Point };

export type JoystickSnapshot = Readonly<{
  touchId: number | null;
  origin: Readonly<Point>;
  current: Readonly<Point>;
}>;

export class GameInput {
  private readonly pressed = new Set<KeyCode>();
  private touchId: number | null = null;
  private touchOrigin: Point = { x: 0, y: 0 };
  private touchCurrent: Point = { x: 0, y: 0 };
  private lastTouchInputAt = 0;
  private started = false;

  constructor(
    private readonly viewport: () => { width: number; height: number },
    private readonly isPlaying: () => boolean,
    private readonly useJoystick: (point: Point) => boolean,
    private readonly onAction: (action: InputAction) => void,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  movement(): Point {
    let x = 0;
    let y = 0;
    if (this.down(KeyCode.ARROW_LEFT, KeyCode.KEY_A)) x -= 1;
    if (this.down(KeyCode.ARROW_RIGHT, KeyCode.KEY_D)) x += 1;
    if (this.down(KeyCode.ARROW_UP, KeyCode.KEY_W)) y -= 1;
    if (this.down(KeyCode.ARROW_DOWN, KeyCode.KEY_S)) y += 1;
    if (this.touchId !== null) {
      x += Math.max(-1, Math.min(1, (this.touchCurrent.x - this.touchOrigin.x) / 54));
      y += Math.max(-1, Math.min(1, (this.touchCurrent.y - this.touchOrigin.y) / 54));
    }
    return { x, y };
  }

  joystick(): JoystickSnapshot {
    return {
      touchId: this.touchId,
      origin: { ...this.touchOrigin },
      current: { ...this.touchCurrent },
    };
  }

  clear(): void {
    this.pressed.clear();
    this.touchId = null;
    this.touchOrigin = { x: 0, y: 0 };
    this.touchCurrent = { x: 0, y: 0 };
  }

  private onKeyDown(event: EventKeyboard): void {
    if (this.isPlaying()) this.pressed.add(event.keyCode);
    if (event.keyCode === KeyCode.ESCAPE) this.onAction({ type: 'escape' });
    else if (event.keyCode === KeyCode.ENTER || event.keyCode === KeyCode.SPACE) this.onAction({ type: 'confirm' });
    else if (event.keyCode === KeyCode.DIGIT_1) this.onAction({ type: 'upgrade', index: 0 });
    else if (event.keyCode === KeyCode.DIGIT_2) this.onAction({ type: 'upgrade', index: 1 });
    else if (event.keyCode === KeyCode.DIGIT_3) this.onAction({ type: 'upgrade', index: 2 });
    else if (event.keyCode === KeyCode.KEY_R) this.onAction({ type: 'reroll' });
  }

  private onKeyUp(event: EventKeyboard): void {
    this.pressed.delete(event.keyCode);
  }

  private onMouseDown(event: EventMouse): void {
    if (event.getButton() !== 0 || Date.now() - this.lastTouchInputAt < 80) return;
    this.onAction({ type: 'pointer', point: this.eventPoint(event) });
  }

  private onTouchStart(event: EventTouch): void {
    const id = event.getID();
    if (id === null) return;
    this.lastTouchInputAt = Date.now();
    const point = this.eventPoint(event);
    if (this.isPlaying() && point.x < this.viewport().width * 0.48 && this.useJoystick(point)) {
      if (this.touchId !== null) return;
      this.touchId = id;
      this.touchOrigin = point;
      this.touchCurrent = point;
      return;
    }
    this.onAction({ type: 'pointer', point });
  }

  private onTouchMove(event: EventTouch): void {
    if (event.getID() === this.touchId) this.touchCurrent = this.eventPoint(event);
  }

  private onTouchEnd(event: EventTouch): void {
    this.lastTouchInputAt = Date.now();
    if (event.getID() === this.touchId) this.clearTouch();
  }

  private clearTouch(): void {
    this.touchId = null;
    this.touchOrigin = { x: 0, y: 0 };
    this.touchCurrent = { x: 0, y: 0 };
  }

  private down(...codes: KeyCode[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }

  private eventPoint(event: EventMouse | EventTouch): Point {
    const location = event.getUILocation();
    return { x: location.x, y: this.viewport().height - location.y };
  }
}
