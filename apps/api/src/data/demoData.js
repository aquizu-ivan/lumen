const DEFAULT_SEED = "lumen-demo";
const seed = String(process.env.LUMEN_DEMO_SEED ?? DEFAULT_SEED);
const days = 90;
const recommendedRangeDays = 7;

function hashSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seedValue) {
  let value = seedValue;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(hashSeed(seed));
const start = new Date(Date.UTC(2025, 0, 1));
const rangeFrom = start.toISOString().slice(0, 10);
const end = new Date(start.getTime() + (days - 1) * 86400000);
const rangeTo = end.toISOString().slice(0, 10);

const services = [
  { id: "svc-1", name: "Corte", durationMin: 30 },
  { id: "svc-2", name: "Color", durationMin: 90 },
  { id: "svc-3", name: "Barba", durationMin: 20 },
  { id: "svc-4", name: "Peinado", durationMin: 45 },
  { id: "svc-5", name: "Tratamiento", durationMin: 60 }
];

const peakHours = new Set([10, 11, 12, 13, 16, 17, 18, 19]);
const weightedSlots = [];
for (let hour = 8; hour <= 19; hour += 1) {
  const weight = peakHours.has(hour) ? 3 : 1;
  for (let repeat = 0; repeat < weight; repeat += 1) {
    weightedSlots.push(`${String(hour).padStart(2, "0")}:00`);
    weightedSlots.push(`${String(hour).padStart(2, "0")}:30`);
  }
}

const holidayIndexes = new Set([12, 45, 73]);
const bookings = [];
let counter = 0;

for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
  const date = new Date(start.getTime() + dayIndex * 86400000);
  const dayOfWeek = date.getUTCDay();
  const base = dayOfWeek === 0 || dayOfWeek === 6 ? 18 : 26;
  const variance = Math.floor(rng() * 8);
  let multiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1;
  if (holidayIndexes.has(dayIndex)) {
    multiplier *= 0.4;
  }
  const total = Math.max(6, Math.floor((base + variance) * multiplier));
  const noShowRate = 0.03 + rng() * 0.09;
  const cancelRate = 0.02 + rng() * 0.04;

  for (let slotIndex = 0; slotIndex < total; slotIndex += 1) {
    counter += 1;
    const service = services[Math.floor(rng() * services.length)];
    const time = weightedSlots[Math.floor(rng() * weightedSlots.length)];
    const [hour, minute] = time.split(":").map(Number);
    const startAt = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute)
    ).toISOString();
    const roll = rng();
    let status = "attended";
    if (roll < cancelRate) {
      status = "cancelled";
    } else if (roll < cancelRate + noShowRate) {
      status = "no_show";
    }
    bookings.push({
      id: `evt-${String(counter).padStart(5, "0")}`,
      serviceId: service.id,
      startAt,
      durationMin: service.durationMin,
      status
    });
  }
}

const demoData = {
  rangeFrom,
  rangeTo,
  services,
  bookings,
  meta: {
    kind: "demo",
    days,
    seed,
    from: rangeFrom,
    to: rangeTo
  },
  defaults: {
    recommendedRangeDays
  }
};

export default demoData;
