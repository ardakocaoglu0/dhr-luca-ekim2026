const fs = require("fs");
const path = require("path");
const dataPath = path.join(__dirname, "..", "src", "data", "logins.json");
const roster = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "data", "paket_roster.json"), "utf8"));
const logins = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const people = [roster.manager, ...roster.people].map((p) => ({
  sicil: p.sicil,
  name: p.name,
  email: p.email,
  password: "Bordro123!",
  profile: p.profile,
  note: p.scenario || p.note,
  unit: "Bordro Paket",
  group: "paket",
}));
const group = { id: "paket", title: "Bordro Paket (6300–6330)", people };
const idx = logins.groups.findIndex((g) => g.id === "izole");
if (logins.groups.find((g) => g.id === "paket")) {
  logins.groups = logins.groups.map((g) => (g.id === "paket" ? group : g));
} else {
  logins.groups.splice(idx >= 0 ? idx + 1 : logins.groups.length, 0, group);
}
fs.writeFileSync(dataPath, JSON.stringify(logins, null, 2) + "\n");
console.log("logins paket", people.length);
