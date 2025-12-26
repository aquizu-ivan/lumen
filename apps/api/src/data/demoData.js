const rangeFrom = "2025-01-01";
const rangeTo = "2025-03-31";

const services = [
  { id: "svc-1", name: "Corte" },
  { id: "svc-2", name: "Consulta" },
  { id: "svc-3", name: "Revision" },
  { id: "svc-4", name: "Color" }
];

const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
const appointments = [];
const start = new Date(Date.UTC(2025, 0, 1));
let counter = 0;

for (let dayIndex = 0; dayIndex < 90; dayIndex += 1) {
  const date = new Date(start.getTime() + dayIndex * 86400000);
  const dateStr = date.toISOString().slice(0, 10);
  for (let hourIndex = 0; hourIndex < hours.length; hourIndex += 1) {
    counter += 1;
    const service = services[(counter - 1) % services.length];
    const status = counter % 10 === 0 ? "no-show" : "ok";
    appointments.push({
      id: `apt-${String(counter).padStart(4, "0")}`,
      date: dateStr,
      hour: hours[hourIndex],
      serviceId: service.id,
      status
    });
  }
}

const demoData = {
  rangeFrom,
  rangeTo,
  services,
  appointments
};

export default demoData;