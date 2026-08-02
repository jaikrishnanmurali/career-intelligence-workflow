export function localDateParts(date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function scheduledHour(expression) {
  const hourField = String(expression || '').trim().split(/\s+/)[1];
  return /^\d{1,2}$/.test(hourField) ? Number(hourField) : null;
}

export function slotIdFor(date = new Date(), scheduleExpression = '', timeZone = 'UTC') {
  const parts = localDateParts(date, timeZone);
  const hour = scheduledHour(scheduleExpression) ?? Number(parts.hour);
  return `${parts.year}-${parts.month}-${parts.day}-${hour < 13 ? 'morning' : 'evening'}`;
}

export function manualSlotId(runId, date = new Date()) {
  const stableRunId = String(runId || '').trim();
  return stableRunId
    ? `manual-${stableRunId}`
    : `manual-${date.toISOString().replaceAll(/[^0-9]/g, '').slice(0, 14)}`;
}

export function successfulRun(run) {
  return Boolean(run?.at && (
    run.resendId
    || run.deliveryStatus === 'accepted'
    || run.deliveryStatus === 'no-recommendations'
  ));
}

export function scheduleDecision({
  state,
  slotId,
  now = new Date(),
  minimumGapHours = 6,
  force = false,
} = {}) {
  const pause = state?.paused;
  const pauseUntil = pause?.until ? new Date(pause.until).getTime() : null;
  const pauseActive = Boolean(pause) && (!pauseUntil || pauseUntil > now.getTime());
  if (pauseActive) {
    return {
      shouldRun: false,
      resumeDelivery: false,
      reason: `Digests are paused: ${pause.reason || 'no reason recorded'}`,
    };
  }
  const outbox = state?.outbox && typeof state.outbox === 'object' ? state.outbox : {};
  if (outbox[slotId]?.status === 'delivered') {
    return { shouldRun: false, resumeDelivery: false, reason: `Slot ${slotId} was already delivered.` };
  }
  if (outbox[slotId]?.status === 'no-recommendations') {
    return { shouldRun: false, resumeDelivery: false, reason: `Slot ${slotId} completed with no recommendations.` };
  }
  if (outbox[slotId]?.status === 'prepared') {
    return {
      shouldRun: true,
      resumeDelivery: true,
      reason: `Slot ${slotId} has a durable prepared email awaiting delivery.`,
    };
  }

  const runs = Array.isArray(state?.runs) ? state.runs : [];
  if (runs.some((run) => successfulRun(run) && run.slotId === slotId)) {
    return { shouldRun: false, resumeDelivery: false, reason: `Slot ${slotId} was already delivered.` };
  }
  if (force) {
    return { shouldRun: true, resumeDelivery: false, reason: 'Manual run requested.' };
  }

  const lastSuccessful = [...runs].reverse().find(successfulRun);
  if (lastSuccessful) {
    const elapsedHours = (now.getTime() - new Date(lastSuccessful.at).getTime()) / 3_600_000;
    if (Number.isFinite(elapsedHours) && elapsedHours >= 0 && elapsedHours < minimumGapHours) {
      return {
        shouldRun: false,
        resumeDelivery: false,
        reason: `A digest was delivered ${elapsedHours.toFixed(2)} hours ago.`,
      };
    }
  }
  return {
    shouldRun: true,
    resumeDelivery: false,
    reason: `No successful delivery exists for ${slotId}.`,
  };
}
