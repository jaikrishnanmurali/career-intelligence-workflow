#!/usr/bin/env node

import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function localClock(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.hour}:${values.minute}`;
}

function localWeekday(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
}

export function inLocalWindow({
  date = new Date(),
  timeZone = 'UTC',
  allowedTimes = [],
  manual = false,
  weekdaysOnly = false,
} = {}) {
  if (manual) return { allowed: true, localTime: localClock(date, timeZone), reason: 'Manual run.' };
  const localTime = localClock(date, timeZone);
  const weekend = ['Sat', 'Sun'].includes(localWeekday(date, timeZone));
  const allowed = allowedTimes.includes(localTime) && !(weekdaysOnly && weekend);
  return {
    allowed,
    localTime,
    reason: allowed
      ? `Local delivery window ${localTime} in ${timeZone}.`
      : weekdaysOnly && weekend
        ? `Weekend delivery is disabled in ${timeZone}.`
      : `${localTime} in ${timeZone} is not a configured delivery attempt.`,
  };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const timeZone = process.env.CAREER_TIME_ZONE || 'UTC';
  const allowedTimes = String(process.env.CAREER_LOCAL_TIMES || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const decision = inLocalWindow({
    timeZone,
    allowedTimes,
    manual: process.env.EVENT_NAME === 'workflow_dispatch',
    weekdaysOnly: String(process.env.CAREER_WEEKDAYS_ONLY || '').toLowerCase() === 'true',
  });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `in_window=${decision.allowed}\nlocal_time=${decision.localTime}\nreason=${decision.reason}\n`,
      'utf8',
    );
  }
  process.stdout.write(`${decision.allowed ? 'CONTINUE' : 'SKIP'}: ${decision.reason}\n`);
}
