import cron, { ScheduledTask } from 'node-cron';

interface StoredJob {
  task: ScheduledTask;
  status: 'running' | 'stopped';
  lastRun: Date | null;
  schedule: string;
}

// Global variable untuk persistensi saat hot-reload di development
const globalForCron = global as unknown as { cronJobs: Record<string, StoredJob> };

export const cronJobs = globalForCron.cronJobs || {};

if (process.env.NODE_ENV !== 'production') globalForCron.cronJobs = cronJobs;

export function registerCronJob(name: string, schedule: string, callback: () => void | Promise<void>) {
  // Stop existing job jika ada duplikasi
  if (cronJobs[name]) {
    cronJobs[name].task.stop();
  }

  const task = cron.schedule(schedule, async () => {
    cronJobs[name].lastRun = new Date();
    await callback();
  });

  cronJobs[name] = {
    task,
    status: 'stopped',
    lastRun: null,
    schedule
  };

  return {
    start: () => {
      cronJobs[name].task.start();
      cronJobs[name].status = 'running';
    },
    stop: () => {
      cronJobs[name].task.stop();
      cronJobs[name].status = 'stopped';
    }
  };
}

export function getCronStatus() {
  return Object.keys(cronJobs).map(key => ({
    name: key,
    status: cronJobs[key].status,
    lastRun: cronJobs[key].lastRun,
    schedule: cronJobs[key].schedule
  }));
}

export function controlCron(name: string, action: 'start' | 'stop') {
  const job = cronJobs[name];
  if (!job) throw new Error(`Job ${name} not found`);

  if (action === 'start') {
    job.task.start();
    job.status = 'running';
  } else {
    job.task.stop();
    job.status = 'stopped';
  }
  return job.status;
}
