// Exports the frontend template catalogue as JSON for `api seed-templates`.
// Usage: node --experimental-strip-types scripts/export-templates.mts > templates.json
import { TEMPLATES } from '../frontend/lib/templatesCatalog.ts';

const out = TEMPLATES.map((t) => ({
  id: t.id, kind: t.kind === 'booth' ? 'booth' : t.kind, category: t.kind, name: t.name, audience: t.audience,
  document: { docs: [t.build()], assets: {} },
}));
process.stdout.write(JSON.stringify(out));
