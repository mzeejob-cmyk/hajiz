const URL = /\b(?:postgres(?:ql)?|https?):\/\/[^\s"']+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SUPABASE_KEY = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g;
const AUTH_HEADER = /\b(?:authorization|apikey)\s*[:=]\s*[^,;\s]+/gi;

export function sanitizeMessage(value) {
  const text = typeof value === 'string' ? value : '';
  return text.replace(URL,'[REDACTED_URL]').replace(JWT,'[REDACTED_JWT]')
    .replace(SUPABASE_KEY,'[REDACTED_KEY]').replace(AUTH_HEADER,'[REDACTED_HEADER]')
    .replace(/[\r\n\t]+/g,' ').slice(0,300) || 'No safe message available';
}

export function diagnostic(error, { stage, subsystem, networkConnected }) {
  const status = Number.isInteger(error?.status) ? error.status : undefined;
  const rawCode = error?.code ?? error?.cause?.code ?? error?.supabaseCode ?? status;
  const safeCode = typeof rawCode === 'string' || typeof rawCode === 'number' ? String(rawCode).slice(0,80) : 'UNAVAILABLE';
  return {
    stage,
    subsystem,
    safeCode,
    message: sanitizeMessage(error?.message),
    exceptionName: typeof error?.name === 'string' ? error.name.slice(0,80) : 'Error',
    networkConnectionEstablished: Boolean(networkConnected),
    targetCategory: 'HAJIZ STAGING',
    timestamp: new Date().toISOString()
  };
}

export function stageSubsystem(stage) {
  if (stage === 'ENVIRONMENT_VALIDATION') return 'environment';
  if (stage === 'CA_LOAD') return 'tls';
  if (stage.startsWith('POSTGRES')) return stage === 'POSTGRES_CONNECT' ? 'postgres' : 'postgres';
  if (stage.startsWith('AUTH')) return 'auth';
  if (stage === 'REST_PROBE') return 'rest';
  if (stage === 'STORAGE_PROBE') return 'storage';
  if (stage.includes('FILESYSTEM') || stage.includes('ARTIFACT')) return 'filesystem';
  return 'other';
}
