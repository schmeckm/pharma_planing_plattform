import cron from 'node-cron';

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  cron.schedule('0 8 * * *', () => {
    console.log(JSON.stringify({ level: 'info', msg: 'scheduler_tick', job: 'morning_digest' }));
  });
}
