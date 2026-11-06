// Boss fights (M3). Hook points only: the fight asks for a boss controller when the fish's
// behaviour has `boss: { phases: [...] }`. The API below is what fight.js calls.
//
// phases: [{ hp: 0..1 share, moves: [...], attacks: [{ id, telegraph, radius, element }] }]
// controller.update(dt, ctx) -> { moveOverride?, attacks?: [...] }
// controller.damage(amount) -> lowers HP; returns { phaseChanged, phase, hp }
// controller.hp (0..1), controller.phase (index), controller.done
export function createBossController(behaviour) {
  if (!behaviour?.boss?.phases?.length) return null;
  const phases = behaviour.boss.phases;
  let phase = 0;
  let hp = 1;
  return {
    get hp() { return hp; },
    get phase() { return phase; },
    get done() { return hp <= 0; },
    get moves() { return phases[phase].moves || behaviour.moves || []; },
    // M3: telegraphed elemental attacks on the player's position, dodged with the joystick.
    update() { return { attacks: [] }; },
    damage(amount) {
      hp = Math.max(0, hp - amount);
      let boundary = 1;
      for (let i = 0; i <= phase; i++) boundary -= phases[i].hp;
      const phaseChanged = hp <= boundary + 1e-6 && phase < phases.length - 1;
      if (phaseChanged) phase += 1;
      return { phaseChanged, phase, hp };
    },
  };
}
