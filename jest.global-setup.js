// Runs in the parent process before workers start, so every worker inherits this time zone.
// UTC+14 makes any local-date vs UTC mix-up (e.g. toISOString().slice(0, 10)) fail deterministically,
// whatever the time zone of the machine or CI runner.
module.exports = async () => {
  process.env.TZ = 'Pacific/Kiritimati';
};
