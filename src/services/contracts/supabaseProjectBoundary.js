const PROJECTS = Object.freeze({
  staging: Object.freeze({
    environment: "staging",
    projectRef: "pdnuswmljownjzjzpoop",
    origin: "https://pdnuswmljownjzjzpoop.supabase.co",
  }),
  production: Object.freeze({
    environment: "production",
    projectRef: "pbvbhbxqtaafqkwlnlxd",
    origin: "https://pbvbhbxqtaafqkwlnlxd.supabase.co",
  }),
})

const ENVIRONMENT_TARGETS = Object.freeze({
  development: "staging",
  test: "staging",
  staging: "staging",
  production: "production",
})

function boundaryError() {
  return new Error("SUPABASE_PROJECT_BOUNDARY_REJECTED")
}

export function getSupabaseProjectForEnvironment(environment) {
  if (typeof environment !== "string" || !Object.hasOwn(ENVIRONMENT_TARGETS, environment)) throw boundaryError()
  return PROJECTS[ENVIRONMENT_TARGETS[environment]]
}

export function validateSupabaseProjectBoundary({ environment, projectRef, supabaseUrl } = {}) {
  const expected = getSupabaseProjectForEnvironment(environment)
  if (projectRef !== expected.projectRef || typeof supabaseUrl !== "string") throw boundaryError()

  let parsed
  try { parsed = new URL(supabaseUrl) } catch { throw boundaryError() }
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== expected.origin ||
    parsed.hostname !== `${expected.projectRef}.supabase.co` ||
    parsed.port || parsed.username || parsed.password ||
    !["", "/"].includes(parsed.pathname) || parsed.search || parsed.hash
  ) throw boundaryError()

  return Object.freeze({
    environment,
    targetEnvironment: expected.environment,
    projectRef: expected.projectRef,
    origin: expected.origin,
    hostname: `${expected.projectRef}.supabase.co`,
  })
}

export const HAJIZ_STAGING_PROJECT = PROJECTS.staging
export const HAJIZ_PRODUCTION_PROJECT = PROJECTS.production
