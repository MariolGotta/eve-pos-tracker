export async function register() {
  // Only run in Node.js runtime (not edge), and only on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronScheduler } = await import("./server/cron");
    startCronScheduler();
  }
}
