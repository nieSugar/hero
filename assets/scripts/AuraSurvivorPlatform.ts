import { AudioClip, AudioSource, isValid, Node, resources, sys } from 'cc';

import { AUDIO_PATHS, DEFAULT_PROFILE, PROFILE_KEY } from './AuraSurvivorModel';
import type { AuraPath, Profile, RunOutcome, SoundKey, ThreatLevel } from './AuraSurvivorModel';

export type RunSummary = {
  aliveTime: number;
  level: number;
  kills: number;
  damageDealt: number;
  threatLevel: ThreatLevel;
  lastBuild: string;
};

export class ProfileStore {
  load(): Profile {
    try {
      const raw = sys.localStorage.getItem(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE, unlockedPaths: [] };
      const parsed = JSON.parse(raw) as Partial<Profile>;
      const number = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
      const unlocked = Array.isArray(parsed.unlockedPaths)
        ? parsed.unlockedPaths.filter((path): path is AuraPath => path === 'pulse' || path === 'frost' || path === 'focus')
        : [];
      return {
        bestTime: number(parsed.bestTime, 0),
        highestLevel: number(parsed.highestLevel, 1),
        highestKills: number(parsed.highestKills, 0),
        bestDamage: number(parsed.bestDamage, 0),
        perfectWins: number(parsed.perfectWins, 0),
        highestThreat: Math.min(2, Math.floor(number(parsed.highestThreat, 0))) as ThreatLevel,
        lastBuild: typeof parsed.lastBuild === 'string' ? parsed.lastBuild.slice(0, 240) : '无',
        unlockedPaths: [...new Set(unlocked)],
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        shakeEnabled: typeof parsed.shakeEnabled === 'boolean' ? parsed.shakeEnabled : true,
        reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : false,
      };
    } catch (error) {
      console.warn('Failed to load local profile', error);
      return { ...DEFAULT_PROFILE, unlockedPaths: [] };
    }
  }

  save(profile: Profile): void {
    try {
      sys.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn('Failed to save local profile', error);
    }
  }

  record(profile: Profile, summary: RunSummary, outcome: RunOutcome): string {
    const records: string[] = [];
    if (summary.aliveTime > profile.bestTime) {
      profile.bestTime = summary.aliveTime;
      records.push('最长生存');
    }
    if (summary.level > profile.highestLevel) {
      profile.highestLevel = summary.level;
      records.push('最高等级');
    }
    if (summary.kills > profile.highestKills) {
      profile.highestKills = summary.kills;
      records.push('最高击杀');
    }
    if (summary.damageDealt > profile.bestDamage) {
      profile.bestDamage = Math.round(summary.damageDealt);
      records.push('最高伤害');
    }
    if (outcome !== 'failure' && summary.threatLevel > profile.highestThreat) {
      profile.highestThreat = summary.threatLevel;
      records.push('最高威胁通关');
    }
    if (outcome === 'perfect') profile.perfectWins += 1;
    if (outcome !== 'failure') {
      for (const path of outcome === 'perfect' ? ['pulse', 'frost', 'focus'] as const : ['pulse', 'frost'] as const) {
        if (profile.unlockedPaths.indexOf(path) < 0) profile.unlockedPaths.push(path);
      }
    }
    profile.lastBuild = summary.lastBuild;
    this.save(profile);
    return records.length > 0 ? `新纪录：${records.join('、')}` : '';
  }
}

export class GameAudio {
  private readonly musicSource: AudioSource;
  private readonly sfxSource: AudioSource;
  private readonly clips = new Map<SoundKey, AudioClip>();
  private active = true;

  constructor(node: Node, private readonly enabled: () => boolean) {
    this.musicSource = node.addComponent(AudioSource);
    this.musicSource.loop = true;
    this.musicSource.volume = 0.28;
    this.sfxSource = node.addComponent(AudioSource);
    this.sfxSource.volume = 0.72;
  }

  load(shouldPlay: () => boolean): void {
    for (const key of Object.keys(AUDIO_PATHS) as SoundKey[]) {
      resources.load(AUDIO_PATHS[key], AudioClip, (error, clip) => {
        if (!this.active) return;
        if (error || !clip) {
          console.warn(`Failed to load ${AUDIO_PATHS[key]}`, error);
          return;
        }
        this.clips.set(key, clip);
        if (key === 'bgm_loop' && shouldPlay()) this.playBgm();
      });
    }
  }

  playBgm(): void {
    const clip = this.clips.get('bgm_loop');
    if (!this.enabled() || !clip) return;
    this.musicSource.clip = clip;
    this.musicSource.play();
  }

  pause(): void {
    this.musicSource.pause();
  }

  stop(): void {
    this.musicSource.stop();
  }

  destroy(): void {
    this.active = false;
    this.stop();
    this.clips.clear();
    if (isValid(this.musicSource, true)) this.musicSource.destroy();
    if (isValid(this.sfxSource, true)) this.sfxSource.destroy();
  }

  playSound(key: Exclude<SoundKey, 'bgm_loop'>, volume = 1): void {
    const clip = this.clips.get(key);
    if (this.enabled() && clip) this.sfxSource.playOneShot(clip, volume);
  }
}
