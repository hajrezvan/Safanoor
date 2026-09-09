export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
