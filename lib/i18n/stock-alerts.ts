export const stockAlertsSr = {
  critical: "Kritično",
  belowMinimum: "Ispod minimuma",
  filter: "Prikaži u tabeli",
  clearFilter: "Prikaži sve",
  filteredEmpty: "Nema stavki koje uskoro nestaju.",
  notifications: "Obaveštenja o stanju",
  pushLabel: "Mise · Obaveštenje",
  pushTime: "sada",
  projection: "Projekcija po današnjoj potrošnji.",
  goneEta: "nema zalihe",
  shortEta: "manje od 1 smene",
  stockZero: "stanje je 0.",
  goneTitle: (count: number) =>
    count === 1 ? "1 stavka je nestala." : `${count} stavki je nestalo.`,
  soonTitle: (count: number) =>
    count === 1 ? "1 stavka nestaje za 1–2 smene." : `${count} stavke nestaju za 1–2 smene.`,
  shiftCount: (count: number) => `~${count} ${count === 1 ? "smena" : "smene"}`,
  pushGone: (name: string) => `${name} · nema zalihe`,
  pushSoon: (name: string, eta: string) => `${name} nestaje za ${eta}`,
  buySub: "Lista za dobavljača",
  buyEmptyHint: "Na listi trenutno nema stavki.",
} as const;
