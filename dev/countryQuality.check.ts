import assert from "node:assert/strict";
import { CountryRenderQuality } from "../src/countryProfile/quality";

function fixture(mode = "auto") {
  const quality = new CountryRenderQuality(mode);
  let now = 0;
  let applications = 0;
  return {
    quality,
    frames(count: number, interval = 1000 / 120, busy = false, ready = true) {
      for (let frame = 0; frame < count; frame++) {
        now += interval;
        if (quality.tick(now, busy, ready) === "apply") applications++;
      }
      return applications;
    },
    background() {
      quality.tick(now, false, true, true);
      now += 180_000;
      quality.tick(now, false, true);
    },
  };
}

assert.throws(() => new CountryRenderQuality("invalid"), /Unknown cpQuality/);
const auto = fixture();
assert.equal(auto.quality.level, "light");
assert.equal(auto.quality.settings.capacity, 16_384);
assert.equal(auto.frames(650), 0, "startup must gather three complete healthy windows");
assert.equal(auto.frames(100, 1000 / 120, true), 0, "network construction blocks an upgrade");
for (let frame = 0; frame < 120 && auto.quality.target === "light"; frame++) auto.frames(1);
assert.equal(auto.frames(0), 1);
assert.equal(auto.quality.target, "standard");
assert.equal(auto.quality.level, "light", "a requested pool is not yet an applied pool");
auto.frames(120, 1000 / 120, false, false);
assert.equal(auto.quality.level, "light");
auto.frames(1);
assert.equal(auto.quality.level, "standard");
assert.equal(auto.quality.settings.capacity, 32_768);
assert.equal(auto.frames(400, 1000 / 30), 2, "a bad upgrade must downgrade promptly, not wait its cooldown");
assert.equal(auto.quality.target, "light");
auto.frames(1);
assert.equal(auto.quality.level, "light");
assert.equal(auto.frames(5000), 2, "recovery must not oscillate before sixty seconds");
assert.equal(auto.frames(3000), 3, "sustained recovery can restore standard");
auto.frames(1);
auto.background();
assert.equal(auto.frames(240, 1000 / 30), 3, "background return restarts warmup and its sample windows");

for (const [level, capacity] of [["light", 16_384], ["standard", 32_768], ["rich", 65_536]] as const) {
  const forced = fixture(level);
  forced.frames(3000, 1000 / 30);
  assert.equal(forced.quality.level, level);
  assert.equal(forced.quality.target, level);
  assert.equal(forced.quality.settings.capacity, capacity);
  forced.background();
  forced.frames(3000);
  assert.equal(forced.quality.level, level);
  // Owned arrays plus conservative hash-container allowances from the detail controller.
  // Selection and depth borrow the two existing shared surfaces, so neither adds another sphere.
  const rootStorage = 82_000 * (2 * 32 + 4 + 8 + 8 + 1 + 4) + 4096;
  const descendants = capacity * (2 * 60 + 4 + 256 + (level === "rich" ? 320 : 256));
  const surfacesAndBorders = 20_003_064;
  const landMask = 2_097_152;
  const cappedAtmosphere = 1_048_576 * 12 + 4176;
  const upper = rootStorage + descendants + surfacesAndBorders + landMask + cappedAtmosphere;
  assert.ok(upper < forced.quality.activeBudgetBytes, level + ": declared pool exceeds the aggregate detail budget");
}
console.log("country quality: bounded profiles, idle upgrades, prompt downgrade, cooldown, hidden tabs, forced levels OK");
