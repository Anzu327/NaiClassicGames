import type { GameId } from "./gameCatalog";

const A4 = 440;
const note = (semitones: number) => A4 * 2 ** (semitones / 12);
const SIXTEENTH = 60 / 112 / 4;
const STEPS_PER_BAR = 16;
const SCHEDULE_AHEAD = 0.24;

type Theme = {
  progression: readonly number[];
  chord: readonly number[];
  bass: readonly (number | null)[];
  lead: readonly (number | null)[];
  leadWave: OscillatorType;
  color: number;
};

// Original four-bar themes. The game selection changes the voicing, bass line,
// melody contour, synth timbre and filter color without interrupting the beat.
const THEMES: Record<GameId, Theme> = {
  "pac-wa": {
    progression: [-9, -5, -2, -4], chord: [0, 3, 7, 10], color: 1550, leadWave: "square",
    bass: [0, null, 0, 7, null, 0, 10, null, 0, null, 7, 10, null, 7, 3, null],
    lead: [12, null, 15, 19, null, 22, 19, null, 15, 17, null, 15, 12, null, 10, null],
  },
  naitris: {
    progression: [-12, -7, -5, -9], chord: [0, 4, 7, 11], color: 2300, leadWave: "triangle",
    bass: [0, null, 7, null, 0, null, 11, 7, 0, null, 4, null, 7, null, 11, null],
    lead: [19, 16, 12, null, 23, 19, 16, null, 14, 16, 19, null, 23, 21, 19, null],
  },
  naisnake: {
    progression: [-7, -10, -3, -5], chord: [0, 3, 7, 12], color: 1050, leadWave: "sawtooth",
    bass: [0, null, 0, null, 7, null, 10, 7, 0, null, 12, null, 10, 7, 3, null],
    lead: [12, null, 15, 17, 19, null, 17, 15, 12, null, 10, 12, 15, null, 19, null],
  },
  "naippy-wa": {
    progression: [-5, -9, -12, -7], chord: [0, 4, 7, 9], color: 3000, leadWave: "sine",
    bass: [0, null, 7, null, 9, null, 7, null, 0, null, 4, 7, null, 9, 7, null],
    lead: [16, 19, null, 21, 23, null, 21, 19, 16, null, 14, 16, 19, null, 23, 21],
  },
};

export class LauncherAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private ambience?: GainNode;
  private reverb?: ConvolverNode;
  private delay?: DelayNode;
  private noise?: AudioBuffer;
  private timer?: number;
  private nextStepAt = 0;
  private step = 0;
  private active: GameId = "pac-wa";
  private muted = localStorage.getItem("nai-classic-games.muted") === "true";

  get isMuted(): boolean { return this.muted; }

  setTheme(id: GameId): void { this.active = id; }

  async ensureStarted(): Promise<void> {
    if (!this.context) this.createGraph();
    if (this.context?.state === "suspended") await this.context.resume();
    if (!this.timer && this.context) {
      this.nextStepAt = this.context.currentTime + 0.05;
      this.scheduler();
      this.timer = window.setInterval(() => this.scheduler(), 50);
    }
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    localStorage.setItem("nai-classic-games.muted", String(this.muted));
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.82, this.context.currentTime, 0.045);
    }
    return this.muted;
  }

  selectGame(id: GameId): void {
    this.active = id;
    void this.ensureStarted().then(() => {
      const theme = THEMES[id];
      this.playChord(theme.chord.map((pitch) => pitch + theme.progression[0]!), 0.055, 0.55);
    });
  }

  playSelect(): void { void this.ensureStarted().then(() => this.tone(note(7), 0.07, 0.04, "triangle")); }
  playBoundary(): void { void this.ensureStarted().then(() => this.tone(note(-12), 0.05, 0.04, "square")); }
  playBack(): void {
    void this.ensureStarted().then(() => {
      this.tone(note(2), 0.08, 0.055, "sine");
      window.setTimeout(() => this.tone(note(-3), 0.12, 0.045, "sine"), 75);
    });
  }

  playConfirm(): void {
    void this.ensureStarted().then(() => {
      [-5, 0, 4, 7].forEach((pitch, index) => window.setTimeout(() => this.bell(note(pitch), 0.09), index * 72));
    });
  }

  fadeOut(): void {
    if (!this.context || !this.music) return;
    this.music.gain.cancelScheduledValues(this.context.currentTime);
    this.music.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.16);
    this.ambience?.gain.cancelScheduledValues(this.context.currentTime);
    this.ambience?.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.16);
  }

  fadeIn(): void {
    void this.ensureStarted().then(() => {
      if (!this.context || !this.music) return;
      this.music.gain.cancelScheduledValues(this.context.currentTime);
      this.music.gain.setTargetAtTime(0.29, this.context.currentTime, 0.28);
      this.ambience?.gain.cancelScheduledValues(this.context.currentTime);
      this.ambience?.gain.setTargetAtTime(0.18, this.context.currentTime, 0.28);
    });
  }

  suspend(): void { void this.context?.suspend(); }
  resume(): void { if (!this.muted) void this.ensureStarted(); }

  private createGraph(): void {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    this.ambience = this.context.createGain();
    this.reverb = this.context.createConvolver();
    this.delay = this.context.createDelay(1);
    const feedback = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();

    this.master.gain.value = this.muted ? 0 : 0.82;
    this.music.gain.value = 0.29;
    this.effects.gain.value = 0.46;
    this.ambience.gain.value = 0.18;
    this.delay.delayTime.value = SIXTEENTH * 3;
    feedback.gain.value = 0.22;
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.2;
    this.reverb.buffer = this.makeImpulse(2.1, 2.7);
    this.noise = this.makeNoise();

    this.music.connect(compressor);
    this.effects.connect(compressor);
    this.ambience.connect(this.reverb).connect(compressor);
    this.effects.connect(this.reverb);
    this.music.connect(this.delay);
    this.delay.connect(feedback).connect(this.delay);
    this.delay.connect(compressor);
    compressor.connect(this.master).connect(this.context.destination);
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const context = this.context!;
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** decay;
      }
    }
    return buffer;
  }

  private makeNoise(): AudioBuffer {
    const context = this.context!;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  private scheduler(): void {
    if (!this.context || this.context.state !== "running") return;
    while (this.nextStepAt < this.context.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.step, this.nextStepAt);
      this.step = (this.step + 1) % (STEPS_PER_BAR * 4);
      this.nextStepAt += SIXTEENTH;
    }
  }

  private scheduleStep(step: number, at: number): void {
    const theme = THEMES[this.active];
    const withinBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const root = theme.progression[bar] ?? theme.progression[0]!;
    const bass = theme.bass[withinBar];
    const lead = theme.lead[(withinBar + bar * 3) % theme.lead.length];

    if (withinBar % 4 === 0) this.kick(at, withinBar === 0 ? 0.12 : 0.085);
    if (withinBar === 4 || withinBar === 12) this.snare(at, 0.052);
    if (withinBar % 2 === 0) this.hat(at, withinBar % 4 === 2 ? 0.022 : 0.013, withinBar % 4 === 2);
    if (bass !== null && bass !== undefined) this.bass(note(root + bass - 24), at, SIXTEENTH * 1.8);
    if (lead !== null && lead !== undefined) this.lead(note(root + lead), at, theme);

    if (withinBar % 4 === 0) {
      const inversion = bar % 2 === 0 ? theme.chord : [...theme.chord.slice(1), theme.chord[0]! + 12];
      inversion.forEach((pitch, index) => this.pluck(note(root + pitch), at + index * 0.018, 0.025 / (index * 0.35 + 1), theme.color));
    }
    if (withinBar === 0) this.pad(theme.chord.map((pitch) => root + pitch), at, theme.color);
  }

  private kick(at: number, volume: number): void {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.setValueAtTime(130, at);
    oscillator.frequency.exponentialRampToValueAtTime(48, at + 0.11);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(gain).connect(this.music);
    oscillator.start(at);
    oscillator.stop(at + 0.23);
  }

  private snare(at: number, volume: number): void {
    if (!this.context || !this.music || !this.noise) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.value = 1750;
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    source.connect(filter).connect(gain).connect(this.music);
    source.start(at, Math.random() * 0.5);
    source.stop(at + 0.14);
  }

  private hat(at: number, volume: number, open: boolean): void {
    if (!this.context || !this.music || !this.noise) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const duration = open ? 0.095 : 0.035;
    source.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = 5800;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.music);
    source.start(at, Math.random() * 0.5);
    source.stop(at + duration + 0.01);
  }

  private bass(frequency: number, at: number, duration: number): void {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator();
    const sub = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = "sawtooth";
    sub.type = "sine";
    oscillator.frequency.value = frequency;
    sub.frequency.value = frequency / 2;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(620, at);
    filter.frequency.exponentialRampToValueAtTime(180, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.055, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.music);
    oscillator.start(at);
    sub.start(at);
    oscillator.stop(at + duration + 0.01);
    sub.stop(at + duration + 0.01);
  }

  private lead(frequency: number, at: number, theme: Theme): void {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    oscillator.type = theme.leadWave;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.detune.setValueAtTime(Math.sin(this.step * 1.7) * 5, at);
    filter.type = "lowpass";
    filter.frequency.value = theme.color * 1.3;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.018, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + SIXTEENTH * 0.82);
    pan.pan.value = Math.sin(this.step * 0.8) * 0.55;
    oscillator.connect(filter).connect(gain).connect(pan).connect(this.music);
    oscillator.start(at);
    oscillator.stop(at + SIXTEENTH);
  }

  private pad(chord: readonly number[], at: number, color: number): void {
    if (!this.context || !this.ambience) return;
    chord.forEach((pitch, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const filter = this.context!.createBiquadFilter();
      const pan = this.context!.createStereoPanner();
      oscillator.type = index % 2 === 0 ? "sine" : "triangle";
      oscillator.frequency.value = note(pitch - 12);
      oscillator.detune.value = index % 2 === 0 ? -4 : 4;
      filter.type = "lowpass";
      filter.frequency.value = color * 0.58;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.027, at + 0.42);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + SIXTEENTH * 15.5);
      pan.pan.value = (index / Math.max(1, chord.length - 1) - 0.5) * 1.2;
      oscillator.connect(filter).connect(gain).connect(pan).connect(this.ambience!);
      oscillator.start(at);
      oscillator.stop(at + SIXTEENTH * 15.6);
    });
  }

  private pluck(frequency: number, at: number, volume: number, color: number): void {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(color, at);
    filter.frequency.exponentialRampToValueAtTime(340, at + 0.28);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    oscillator.connect(filter).connect(gain).connect(this.music);
    oscillator.start(at);
    oscillator.stop(at + 0.34);
  }

  private bell(frequency: number, volume: number, destination = this.effects): void {
    if (!this.context || !destination) return;
    const now = this.context.currentTime;
    const carrier = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    const gain = this.context.createGain();
    carrier.type = "sine";
    overtone.type = "sine";
    carrier.frequency.value = frequency;
    overtone.frequency.value = frequency * 2.01;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    carrier.connect(gain);
    overtone.connect(gain);
    gain.connect(destination);
    carrier.start(now);
    overtone.start(now);
    carrier.stop(now + 0.92);
    overtone.stop(now + 0.92);
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  private playChord(chord: readonly number[], volume: number, length: number): void {
    chord.slice(0, 4).forEach((pitch, index) => window.setTimeout(() => this.bell(note(pitch + 12), volume / (index * 0.3 + 1)), index * length * 80));
  }
}
