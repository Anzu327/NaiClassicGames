type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  turnRate: number;
  color: string;
  naiwa: boolean;
  sprite: number;
};

const COLORS = ["#70f5c1", "#ffd83d", "#25d9ff", "#fff3c4"];
const NAIWA_SPRITES = [
  "./branding/naiwa-particle-round-v2.png",
  "./branding/naiwa-particle-poop-v2.png",
  "./branding/naiwa-particle-oval-v2.png",
  "./branding/naiwa-particle-drop-v2.png",
];

const between = (min: number, max: number): number => min + Math.random() * (max - min);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class ParticleField {
  private readonly context: CanvasRenderingContext2D;
  private readonly naiwas = NAIWA_SPRITES.map((source) => {
    const image = new Image();
    image.src = source;
    image.addEventListener("load", () => this.draw());
    return image;
  });
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private animationFrame = 0;
  private previousTime = 0;
  private enabled: boolean;

  constructor(private readonly canvas: HTMLCanvasElement, enabled = true) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Particle canvas is unavailable");
    this.context = context;
    this.enabled = enabled;
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.syncAnimation);
    this.reducedMotion.addEventListener("change", this.syncAnimation);
    this.syncAnimation();
  }

  start(): void {
    this.enabled = true;
    this.syncAnimation();
  }

  stop(): void {
    this.enabled = false;
    this.syncAnimation();
  }

  private readonly resize = (): void => {
    const oldWidth = this.width || window.innerWidth;
    const oldHeight = this.height || window.innerHeight;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.imageSmoothingEnabled = false;

    if (this.particles.length) {
      this.particles.forEach((particle) => {
        particle.x = particle.x / oldWidth * this.width;
        particle.y = particle.y / oldHeight * this.height;
      });
    }
    this.rebalance();
    this.draw();
  };

  private rebalance(): void {
    const area = this.width * this.height;
    const pixelCount = Math.round(clamp(area / 23_000, 26, 72));
    const naiwaCount = Math.round(clamp(area / 90_000, 8, 16));
    const create = (naiwa: boolean): Particle => {
      const angle = between(0, Math.PI * 2);
      const speed = naiwa ? between(.08, .22) : between(.12, .42);
      return {
        x: between(0, this.width),
        y: between(0, this.height),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: naiwa ? between(30, 58) : between(2.2, 4.8),
        alpha: naiwa ? between(.13, .27) : between(.2, .58),
        phase: between(0, Math.PI * 2),
        turnRate: between(.25, .8),
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        naiwa,
        sprite: naiwa ? Math.floor(Math.random() * this.naiwas.length) : 0,
      };
    };
    this.particles = [
      ...Array.from({ length: pixelCount }, () => create(false)),
      ...Array.from({ length: naiwaCount }, () => create(true)),
    ];
    this.canvas.dataset.pixelParticles = String(pixelCount);
    this.canvas.dataset.naiwaParticles = String(naiwaCount);
    this.canvas.dataset.naiwaVariants = String(this.naiwas.length);
  }

  private readonly syncAnimation = (): void => {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.previousTime = 0;
    if (this.enabled && !document.hidden && !this.reducedMotion.matches) {
      this.animationFrame = requestAnimationFrame(this.animate);
    } else {
      this.draw();
    }
  };

  private readonly animate = (time: number): void => {
    const delta = this.previousTime ? Math.min((time - this.previousTime) / 16.67, 2.5) : 1;
    this.previousTime = time;
    for (const particle of this.particles) {
      particle.phase += particle.turnRate * .012 * delta;
      const steering = particle.naiwa ? .0018 : .004;
      particle.vx += Math.sin(particle.phase * 1.7) * steering * delta;
      particle.vy += Math.cos(particle.phase * 1.31) * steering * delta;
      const maxSpeed = particle.naiwa ? .24 : .46;
      const speed = Math.hypot(particle.vx, particle.vy);
      if (speed > maxSpeed) {
        particle.vx = particle.vx / speed * maxSpeed;
        particle.vy = particle.vy / speed * maxSpeed;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      const margin = particle.size;
      if (particle.x < -margin) particle.x = this.width + margin;
      else if (particle.x > this.width + margin) particle.x = -margin;
      if (particle.y < -margin) particle.y = this.height + margin;
      else if (particle.y > this.height + margin) particle.y = -margin;
    }
    this.draw();
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private draw(): void {
    this.context.clearRect(0, 0, this.width, this.height);
    for (const particle of this.particles) {
      this.context.globalAlpha = particle.alpha;
      const sprite = this.naiwas[particle.sprite];
      if (particle.naiwa && sprite?.complete && sprite.naturalWidth) {
        const bob = Math.sin(particle.phase * 2.2) * 2;
        const size = Math.round(particle.size);
        this.context.globalAlpha = particle.alpha * .22;
        this.context.drawImage(
          sprite,
          Math.round(particle.x - size / 2 - 2),
          Math.round(particle.y - size / 2 + bob - 2),
          size + 4,
          size + 4,
        );
        this.context.globalAlpha = particle.alpha;
        this.context.drawImage(
          sprite,
          Math.round(particle.x - size / 2),
          Math.round(particle.y - size / 2 + bob),
          size,
          size,
        );
      } else if (!particle.naiwa) {
        this.context.fillStyle = particle.color;
        const size = Math.max(1, Math.round(particle.size));
        this.context.fillRect(Math.round(particle.x), Math.round(particle.y), size, size);
        if (size >= 3) {
          this.context.globalAlpha = particle.alpha * .35;
          this.context.fillRect(Math.round(particle.x - 2), Math.round(particle.y + 1), size + 4, 1);
          this.context.fillRect(Math.round(particle.x + 1), Math.round(particle.y - 2), 1, size + 4);
        }
      }
    }
    this.context.globalAlpha = 1;
  }
}
