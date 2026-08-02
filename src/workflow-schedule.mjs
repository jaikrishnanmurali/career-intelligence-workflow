function timeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  const representedAsUtc = Date.UTC(
    Number(value.year), Number(value.month) - 1, Number(value.day),
    Number(value.hour), Number(value.minute), Number(value.second),
  );
  return Math.round((representedAsUtc - date.getTime()) / 60_000);
}

function possibleOffsets(timeZone, year = new Date().getUTCFullYear()) {
  const offsets = new Set();
  for (const month of [0, 3, 6, 9]) {
    offsets.add(timeZoneOffsetMinutes(new Date(Date.UTC(year, month, 15, 12)), timeZone));
  }
  return [...offsets];
}

export function utcCronsForLocalTimes(localTimes, timeZone, year) {
  const crons = new Set();
  for (const localTime of localTimes) {
    const [hour, minute] = localTime.split(':').map(Number);
    for (const offset of possibleOffsets(timeZone, year)) {
      const utcMinutes = ((hour * 60 + minute - offset) % 1440 + 1440) % 1440;
      crons.add(`${utcMinutes % 60} ${Math.floor(utcMinutes / 60)} * * *`);
    }
  }
  return [...crons].sort((left, right) => {
    const [lm, lh] = left.split(' ').map(Number);
    const [rm, rh] = right.split(' ').map(Number);
    return lh * 60 + lm - (rh * 60 + rm);
  });
}

export function renderScheduledWorkflow(template, {
  timeZone,
  localTimes,
  maxAgentTurns = 12,
  weekdaysOnly = false,
}) {
  const cronBlock = utcCronsForLocalTimes(localTimes, timeZone)
    .map((cron) => `    - cron: "${cron}"`).join('\n');
  return String(template)
    .replace(
      /    # BEGIN GENERATED CRONS[\s\S]*?    # END GENERATED CRONS/,
      `    # BEGIN GENERATED CRONS\n${cronBlock}\n    # END GENERATED CRONS`,
    )
    .replace(/__CAREER_TIME_ZONE__/g, timeZone)
    .replace(/__CAREER_LOCAL_TIMES__/g, localTimes.join(','))
    .replace(/__CAREER_WEEKDAYS_ONLY__/g, String(weekdaysOnly))
    .replace(/__MAX_AGENT_TURNS__/g, String(maxAgentTurns));
}
