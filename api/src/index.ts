import { createApp } from './app.js';
import { prisma } from './lib/db.js';
import * as clock from './lib/clock.js';
import { loadHolidays } from './lib/workdays.js';

async function main() {
  await clock.refresh();
  await loadHolidays(prisma);
  const port = Number(process.env.PORT ?? 4000);
  createApp().listen(port, () => {
    console.log(`[api] listening on ${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
