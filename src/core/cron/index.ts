/** Cron job registry; modules register jobs by name. */
type Job = () => Promise<unknown>;
const jobs = new Map<string, Job>();

export function registerCronJob(name: string, job: Job) {
  jobs.set(name, job);
}

export async function runCronJob(name: string) {
  const j = jobs.get(name);
  if (!j) return null;
  return j();
}
