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
  laser: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 1.65, vy: aimVy * 1.65, btype: "laser" }];
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
  sniper: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 3.2, vy: aimVy * 3.2, btype: "sniper" }];
    },
  },
  mega: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx * 0.55, vy: aimVy * 0.55, btype: "mega" }];
    },
  },
  homing: {
    spawn({ ship, aimVx, aimVy }) {
      return [{ x: ship.x, y: ship.y, vx: aimVx, vy: aimVy, btype: "homing" }];
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
  return behavior.spawn(context);
}

export function applyCollectedBonus(ship, type) {
  if (type === "shield") {
    ship.shield = true;
    return;
  }

  ship.bonusType = type;
  ship.bonusExpiry = Infinity;
}
