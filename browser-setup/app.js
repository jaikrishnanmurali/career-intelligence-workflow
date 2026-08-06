const form = document.querySelector('#setup-form');
const stages = [...document.querySelectorAll('.stage')];
const progressItems = [...document.querySelectorAll('.progress-list li')];
const nextButton = document.querySelector('#next-stage');
const backButton = document.querySelector('#back-stage');
const globalStatus = document.querySelector('#global-status');
const roleList = document.querySelector('#role-list');
const roleTemplate = document.querySelector('#role-template');

let currentStage = 0;
let highestStage = 0;
let sessionToken = '';
let workspacePrepared = false;
let privatePublished = false;
let emailConfigured = false;
let scheduleActive = false;
const completedChecks = new Set();

function lines(value) {
  return String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function separateLines(value) {
  return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function setOperationStatus(element, message, type = '') {
  element.className = `${element.className.split(' ')[0]}${type ? ` is-${type}` : ''}`;
  element.textContent = message;
}

function setGlobal(message) { globalStatus.textContent = message; }

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'x-setup-token': sessionToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The setup action failed.');
  return result;
}

function addRole(values = {}) {
  if (roleList.children.length >= 8) return;
  const fragment = roleTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.role-card');
  card.querySelector('[data-field="label"]').value = values.label || '';
  card.querySelector('[data-field="titleTerms"]').value = (values.titleTerms || []).join('\n');
  card.querySelector('[data-field="responsibilityTerms"]').value = (values.responsibilityTerms || []).join('\n');
  card.querySelector('.remove-role').addEventListener('click', () => {
    if (roleList.children.length === 1) return;
    card.remove();
    renumberRoles();
  });
  roleList.append(card);
  renumberRoles();
}

function renumberRoles() {
  [...roleList.children].forEach((card, index) => {
    card.querySelector('.role-count').textContent = `Role ${index + 1}`;
    card.querySelector('.remove-role').hidden = roleList.children.length === 1;
  });
}

function roles() {
  return [...roleList.children].map((card) => ({
    label: card.querySelector('[data-field="label"]').value,
    titleTerms: lines(card.querySelector('[data-field="titleTerms"]').value),
    responsibilityTerms: lines(card.querySelector('[data-field="responsibilityTerms"]').value),
  }));
}

function setupPayload() {
  const data = new FormData(form);
  return {
    fullName: data.get('fullName'),
    email: data.get('email'),
    cvText: data.get('cvText'),
    city: data.get('city'),
    country: data.get('country'),
    timezone: data.get('timezone'),
    roles: roles(),
    locations: separateLines(data.get('locations')).map((label) => ({ label, terms: [label] })),
    workingLanguages: lines(data.get('workingLanguages')),
    unsupportedLanguages: lines(data.get('unsupportedLanguages')),
    authorizedIn: lines(data.get('authorizedIn')),
    needsSponsorship: data.get('needsSponsorship') === 'on',
    managerPreference: data.get('managerPreference'),
    selectedPlatforms: data.getAll('platform'),
    discoveryConsent: data.get('discoveryConsent') === 'on',
    morningTime: data.get('morningTime'),
    eveningTime: data.get('eveningTime'),
    weekdaysOnly: data.get('weekdaysOnly') === 'on',
    repoName: data.get('repoName'),
    profileConfirmed: data.get('profileConfirmed') === 'on',
    privateRepoConsent: data.get('privateRepoConsent') === 'on',
  };
}

function fieldsForStage(index) {
  return [...stages[index].querySelectorAll('input, textarea, select')]
    .filter((field) => !field.disabled && field.type !== 'file' && field.id !== 'resend-key');
}

function validateStage(index) {
  for (const field of fieldsForStage(index)) {
    if (!field.checkValidity()) {
      field.reportValidity();
      field.focus();
      return false;
    }
  }
  if (index === 2) {
    for (const card of roleList.children) {
      const fields = [...card.querySelectorAll('[required]')];
      const invalid = fields.find((field) => !field.value.trim());
      if (invalid) { invalid.focus(); return false; }
    }
  }
  return true;
}

function setStage(index) {
  currentStage = Math.max(0, Math.min(stages.length - 1, index));
  highestStage = Math.max(highestStage, currentStage);
  stages.forEach((stage, stageIndex) => {
    const active = stageIndex === currentStage;
    stage.hidden = !active;
    stage.classList.toggle('is-active', active);
  });
  progressItems.forEach((item, itemIndex) => {
    item.classList.toggle('is-current', itemIndex === currentStage);
    item.classList.toggle('is-complete', itemIndex < currentStage);
    item.querySelector('button').disabled = itemIndex > highestStage;
    item.querySelector('button').setAttribute('aria-current', itemIndex === currentStage ? 'step' : 'false');
  });
  backButton.hidden = currentStage === 0;
  nextButton.hidden = currentStage === stages.length - 1;
  nextButton.textContent = currentStage === 3 ? 'Review my plan →' : 'Continue →';
  setGlobal(`Stage ${currentStage + 1} of ${stages.length}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  stages[currentStage].querySelector('h1')?.focus?.({ preventScroll: true });
}

function renderReview(preview) {
  const output = document.querySelector('#review-output');
  const roleText = preview.roleFamilies.map((family) => `${family.label}: ${family.title_terms.join(', ')}`).join(' · ');
  const locationText = preview.locations.map((location) => location.label).join(' → ');
  const languageText = preview.unsupportedLanguages.length
    ? `Block only when mandatory: ${preview.unsupportedLanguages.join(', ')}`
    : 'No hard language blockers added';
  output.innerHTML = `
    <div class="review-grid">
      <article class="full"><h3>Role families</h3><p>${escapeHtml(roleText)}</p></article>
      <article><h3>Location order</h3><p>${escapeHtml(locationText)}</p></article>
      <article><h3>Language rule</h3><p>${escapeHtml(languageText)}</p></article>
      <article><h3>Schedule</h3><p>${escapeHtml(preview.schedule.firstAttempts.join(' and '))} · ${escapeHtml(preview.schedule.timezone)}</p></article>
      <article><h3>Coverage</h3><p>${preview.selectedPlatforms.length ? `${preview.selectedPlatforms.length} optional alert routes selected` : 'Structured sources only for now'}</p></article>
    </div>`;
}

async function buildReview() {
  const payload = setupPayload();
  payload.profileConfirmed = true;
  payload.privateRepoConsent = true;
  try {
    const preview = await api('/api/setup/preview', { method: 'POST', body: payload });
    renderReview(preview);
    return preview;
  } catch (error) {
    setGlobal(error.message);
    throw error;
  }
}

async function handleCvFile(file) {
  const status = document.querySelector('#cv-file-status');
  if (!file) return;
  if (file.size > 5_000_000) { setOperationStatus(status, 'Choose a file smaller than 5 MB.', 'error'); return; }
  setOperationStatus(status, `Reading ${file.name}…`);
  const dataBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  try {
    const result = await api('/api/setup/extract-cv', { method: 'POST', body: { name: file.name, type: file.type, dataBase64 } });
    document.querySelector('#cv-text').value = result.text;
    setOperationStatus(status, `${file.name} is ready. Review the extracted text below.`, 'success');
  } catch (error) {
    setOperationStatus(status, error.message, 'error');
  }
}

async function prepareWorkspace() {
  const status = document.querySelector('#prepare-status');
  if (!validateStage(4)) return;
  const button = document.querySelector('#prepare-workspace');
  button.disabled = true;
  setOperationStatus(status, 'Preparing Career Ops, your search map and the cloud workflows. This can take several minutes…', 'loading');
  try {
    await buildReview();
    const result = await api('/api/setup/prepare', { method: 'POST', body: setupPayload() });
    workspacePrepared = true;
    document.querySelector('#github-box').hidden = false;
    document.querySelector('#reset-workspace').hidden = false;
    setOperationStatus(status, `Workspace prepared with Career Ops ${result.mode === 'discovery' ? 'and zero-token Discovery Digest' : ''}. Nothing has been published.`, 'success');
  } catch (error) {
    setOperationStatus(status, error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function connectGitHub() {
  const output = document.querySelector('#github-auth-output');
  const environment = await api('/api/status');
  if (environment.githubAuthenticated) {
    setOperationStatus(output, 'GitHub is already connected. You can create the private repository.', 'success');
    return;
  }
  setOperationStatus(output, 'Starting GitHub’s browser sign-in…');
  try {
    await api('/api/github/auth/start', { method: 'POST', body: {} });
    const deviceUrl = 'https://github.com/login/device';
    const poll = async () => {
      const state = await api('/api/github/auth/status');
      output.innerHTML = `<a href="${deviceUrl}" target="_blank" rel="noreferrer">Open GitHub device sign-in ↗</a>\n${escapeHtml(state.output || 'Waiting for GitHub to provide the one-time code…')}`;
      output.className = `auth-output${state.status === 'connected' ? ' is-success' : state.status === 'failed' ? ' is-error' : ''}`;
      if (state.status === 'running') window.setTimeout(poll, 1800);
    };
    await poll();
  } catch (error) {
    setOperationStatus(output, error.message, 'error');
  }
}

async function resetWorkspace() {
  const status = document.querySelector('#prepare-status');
  if (!window.confirm('Discard the unpublished generated Career Ops workspace and start again?')) return;
  try {
    await api('/api/setup/reset', { method: 'POST', body: {} });
    workspacePrepared = false;
    document.querySelector('#github-box').hidden = true;
    document.querySelector('#reset-workspace').hidden = true;
    setOperationStatus(status, 'The unpublished generated workspace was removed. Your form entries are still on this page.', 'success');
  } catch (error) {
    setOperationStatus(status, error.message, 'error');
  }
}

async function publishWorkspace() {
  const output = document.querySelector('#github-auth-output');
  if (!workspacePrepared) { setOperationStatus(output, 'Prepare the workspace first.', 'error'); return; }
  const button = document.querySelector('#publish-workspace');
  button.disabled = true;
  setOperationStatus(output, 'Creating and verifying the private repository…', 'loading');
  try {
    const result = await api('/api/github/publish', { method: 'POST', body: { repoName: form.elements.repoName.value } });
    privatePublished = true;
    output.innerHTML = `Private repository verified. <a href="${escapeHtml(result.repository.url)}" target="_blank" rel="noreferrer">Open it on GitHub ↗</a>`;
    output.className = 'auth-output is-success';
    highestStage = Math.max(highestStage, 5);
  } catch (error) {
    setOperationStatus(output, error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function configureEmail() {
  const status = document.querySelector('#email-status');
  if (!privatePublished) { setOperationStatus(status, 'Create the private repository first.', 'error'); return; }
  const key = document.querySelector('#resend-key');
  const from = document.querySelector('#digest-from');
  const to = document.querySelector('#digest-to');
  if (![key, from, to].every((field) => field.reportValidity())) return;
  const button = document.querySelector('#configure-email');
  button.disabled = true;
  setOperationStatus(status, 'Passing the values directly to GitHub Secrets…', 'loading');
  try {
    const result = await api('/api/resend/configure', {
      method: 'POST',
      body: { apiKey: key.value, from: from.value, to: to.value, sendTest: document.querySelector('#send-email-test').checked },
    });
    key.value = '';
    emailConfigured = true;
    setOperationStatus(status, result.test.sent ? `Email configured for ${result.recipient}; the test was accepted.` : `Email configured for ${result.recipient}. No test was sent.`, 'success');
    highestStage = Math.max(highestStage, 6);
  } catch (error) {
    key.value = '';
    setOperationStatus(status, error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

function checkButton(mode) {
  return document.querySelector(`.workflow-trigger[data-mode="${mode}"]`);
}

function renderCompletedCheck(mode) {
  completedChecks.add(mode);
  const button = checkButton(mode);
  if (button) {
    button.disabled = true;
    button.textContent = mode === 'guard-only' ? 'Safety check passed' : 'No-email scan passed';
  }
  if (completedChecks.has('guard-only') && completedChecks.has('structured-only')) highestStage = Math.max(highestStage, 7);
}

async function monitorWorkflow(mode, statusElement) {
  const button = checkButton(mode);
  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    if (Date.now() > deadline) {
      if (button) button.disabled = false;
      statusElement.textContent = `${mode} was still queued or running after 15 minutes. Check the run on GitHub, then retry if it did not finish.`;
      statusElement.className = 'operation-status is-error';
      return;
    }
    const result = await api('/api/workflow/status', { method: 'POST', body: { mode } });
    const link = result.actionsUrl
      ? ` <a href="${escapeHtml(result.actionsUrl)}" target="_blank" rel="noreferrer">View on GitHub ↗</a>` : '';
    if (result.status === 'completed' && result.conclusion === 'success') {
      renderCompletedCheck(mode);
      statusElement.innerHTML = `${escapeHtml(mode)} passed.${link}`;
      statusElement.className = 'operation-status is-success';
      return;
    }
    if (result.status === 'completed') {
      if (button) button.disabled = false;
      statusElement.innerHTML = `${escapeHtml(mode)} did not pass (${escapeHtml(result.conclusion || 'failed')}). Review the run, then use this button to retry.${link}`;
      statusElement.className = 'operation-status is-error';
      return;
    }
    statusElement.innerHTML = `${escapeHtml(mode)} is ${result.status === 'locating' ? 'joining the GitHub queue' : 'running'}. This page is watching it for you.${link}`;
    statusElement.className = 'operation-status';
    await new Promise((resolve) => window.setTimeout(resolve, 5_000));
  }
}

async function triggerWorkflow(mode, statusElement = document.querySelector('#workflow-status')) {
  if (!privatePublished) { setOperationStatus(statusElement, 'Create the private repository first.', 'error'); return; }
  if (mode === 'structured-only' && !completedChecks.has('guard-only')) {
    setOperationStatus(statusElement, 'Run the guard-only safety check successfully first.', 'error');
    return;
  }
  const button = checkButton(mode);
  if (button) button.disabled = true;
  setOperationStatus(statusElement, `Starting the ${mode} workflow…`, 'loading');
  try {
    const result = await api('/api/workflow/run', { method: 'POST', body: { mode } });
    if (mode === 'run') {
      statusElement.innerHTML = `${escapeHtml(mode)} started. <a href="${escapeHtml(result.actionsUrl)}" target="_blank" rel="noreferrer">Watch the run on GitHub ↗</a>`;
      statusElement.className = 'operation-status is-success';
      return;
    }
    await monitorWorkflow(mode, statusElement);
  } catch (error) {
    if (button) button.disabled = false;
    setOperationStatus(statusElement, error.message, 'error');
  }
}

async function activateSchedule() {
  const status = document.querySelector('#activation-status');
  if (!emailConfigured) { setOperationStatus(status, 'Connect email before activating scheduled delivery.', 'error'); return; }
  if (!completedChecks.has('guard-only') || !completedChecks.has('structured-only')) {
    setOperationStatus(status, 'Complete both cloud checks before activating scheduled delivery.', 'error');
    return;
  }
  setOperationStatus(status, 'Enabling the private morning and evening schedule…', 'loading');
  try {
    await api('/api/workflow/activate', { method: 'POST', body: {} });
    scheduleActive = true;
    setOperationStatus(status, 'The private Discovery Digest schedule is active. Smart Digest remains off.', 'success');
  } catch (error) {
    setOperationStatus(status, error.message, 'error');
  }
}

document.querySelector('#add-role').addEventListener('click', () => addRole());
document.querySelector('#preview-plan').addEventListener('click', buildReview);
document.querySelector('#prepare-workspace').addEventListener('click', prepareWorkspace);
document.querySelector('#connect-github').addEventListener('click', connectGitHub);
document.querySelector('#reset-workspace').addEventListener('click', resetWorkspace);
document.querySelector('#publish-workspace').addEventListener('click', publishWorkspace);
document.querySelector('#configure-email').addEventListener('click', configureEmail);
document.querySelector('#activate-schedule').addEventListener('click', activateSchedule);
document.querySelector('#run-first-digest').addEventListener('click', () => {
  if (!scheduleActive && !window.confirm('The schedule is not active yet. Run one deliberate digest anyway?')) return;
  if (window.confirm('This runs a live scan and may send an email if new recommendations survive. Continue?')) {
    triggerWorkflow('run', document.querySelector('#activation-status'));
  }
});
document.querySelectorAll('.workflow-trigger').forEach((button) => button.addEventListener('click', () => triggerWorkflow(button.dataset.mode)));
document.querySelector('#cv-file').addEventListener('change', (event) => handleCvFile(event.target.files[0]));

const drop = document.querySelector('#cv-drop');
['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.remove('is-dragging'); }));
drop.addEventListener('drop', (event) => handleCvFile(event.dataTransfer.files[0]));

nextButton.addEventListener('click', async () => {
  if (!validateStage(currentStage)) return;
  if (currentStage === 3) {
    setStage(4);
    try { await buildReview(); } catch { /* stage displays the correction */ }
    return;
  }
  if (currentStage === 4 && !privatePublished) { setGlobal('Create the private repository before continuing to email.'); return; }
  if (currentStage === 5 && !emailConfigured) { setGlobal('Connect email before continuing to cloud checks.'); return; }
  if (currentStage === 6 && (!completedChecks.has('guard-only') || !completedChecks.has('structured-only'))) {
    setGlobal('Wait for both cloud checks to pass before activating the schedule.');
    return;
  }
  setStage(currentStage + 1);
});
backButton.addEventListener('click', () => setStage(currentStage - 1));
progressItems.forEach((item) => item.querySelector('button').addEventListener('click', () => setStage(Number(item.querySelector('button').dataset.jump))));

async function boot() {
  const session = await apiWithRetry('/api/session');
  sessionToken = session.token;
  const status = await apiWithRetry('/api/status');
  workspacePrepared = status.workspacePrepared;
  privatePublished = status.repositoryPublished;
  emailConfigured = status.emailConfigured;
  scheduleActive = status.scheduleActive;
  for (const mode of status.completedChecks || []) renderCompletedCheck(mode);
  if (workspacePrepared) {
    highestStage = scheduleActive || (completedChecks.has('guard-only') && completedChecks.has('structured-only'))
      ? 7 : emailConfigured ? 6 : privatePublished ? 5 : 4;
    document.querySelector('#github-box').hidden = false;
    document.querySelector('#reset-workspace').hidden = privatePublished;
    const preparedMessage = privatePublished
      ? `Your private repository is verified.${emailConfigured ? ' Email is connected.' : ' Continue with email setup.'}`
      : 'A prepared workspace is available. Continue with GitHub publishing.';
    setOperationStatus(document.querySelector('#prepare-status'), preparedMessage, 'success');
  }
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.querySelector('#timezone').value = detectedTimezone || 'UTC';
  addRole();
  setStage(scheduleActive ? 7 : emailConfigured ? 6 : privatePublished ? 5 : workspacePrepared ? 4 : 0);
}

async function apiWithRetry(path, { attempts = 8, delayMs = 1500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await api(path);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function showBootRetry(message) {
  setGlobal(message);
  const retry = document.querySelector('#boot-retry');
  if (!retry) return;
  retry.hidden = false;
  retry.onclick = () => {
    retry.hidden = true;
    setGlobal('Reconnecting to the setup service…');
    startBoot();
  };
}

async function startBoot() {
  try {
    await boot();
  } catch (error) {
    showBootRetry('The setup service could not be reached. It may still be starting — try again in a moment.');
  }
}

startBoot();
