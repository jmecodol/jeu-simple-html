/**
 * Bonus registry
 *
 * Centralises bonus behavior so adding a new bonus does not require
 * editing the core simulation loop.
 */

function makeFanProjectiles(ship, speed, angle, offsets, speedMultiplier = 1, btype = "normal") {
  return offsets.map((offset) => ({
    x: ship.x,
    y: ship.y,
    vx: Math.cos(angle + offset) * speed * speedMultiplier,
    vy: Math.sin(angle + offset) * speed * speedMultiplier,
    btype,
  }));
}

function makeRadialProjectiles(ship, speed, count, speedMultiplier, btype) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    result.push({
      x: ship.x,
      y: ship.y,
      vx: Math.cos(angle) * speed * speedMultiplier,
      vy: Math.sin(angle) * speed * speedMultiplier,
      btype,
    });
  }
  return result;
}

const bonusRegistry = {
  ring: {
    spawn({ ship, speed }) {
      return makeRadialProjectiles(ship, speed, 8, 0.85, "ring");
    },
  },
  triple: {
    spawn({ ship, speed, aimAngle }) {
      return makeFanProjectiles(ship, speed, aimAngle, [-0.32, 0, 0.32], 1, "triple");
    },
  },
  scatter: {
    spawn({ ship, speed, aimAngle }) {
      return makeFanProjectiles(ship, speed, aimAngle, [-0.55, -0.28, 0, 0.28, 0.55], 0.9, "scatter");
    },
  },
  burst: {
    spawn({ ship, speed, aimAngle }) {
      return makeFanProjectiles(ship, speed, aimAngle, [-0.12, -0.04, 0.04, 0.12], 1.1, "burst");
    },
  },
  nova: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 0.8, vy: aimVy * 0.8, btype: "nova" }];
    },
  },
  quake: {
    spawn({ ship, speed }) {
      return makeRadialProjectiles(ship, speed, 12, 1.05, "quake");
    },
  },
  // normal / rapid
  default: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx, vy: aimVy, btype: "normal" }];
    },
  },
};

export function createProjectilesForBonusShot(context) {
  const behavior = bonusRegistry[context.type] || bonusRegistry.default;
  const projectiles = behavior.spawn(context);

  // Bonus shots travel 50% to 100% faster than classic shots.
  if (context.type) {
    for (const projectile of projectiles) {
      const len = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
      const boostedSpeed = context.speed * (1.5 + Math.random() * 0.5);
      projectile.vx = (projectile.vx / len) * boostedSpeed;
      projectile.vy = (projectile.vy / len) * boostedSpeed;
    }
  }

  return projectiles;
}

export function applyCollectedBonus(ship, type) {
  ship.bonusType = type;
  ship.bonusExpiry = Infinity;
}
