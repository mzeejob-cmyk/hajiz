import { assertPspAdapter } from "./adapter.js"

export class PspAdapterRegistry {
  #entries = new Map()

  register({ name, adapter, enabled = false }) {
    if (typeof name !== "string" || !/^[a-z0-9_-]+$/.test(name) || name === "bankak" || name === "manual_transfer") {
      throw new TypeError("provider name is invalid or reserved for the separate manual rail")
    }
    if (this.#entries.has(name)) throw new Error(`provider already registered: ${name}`)
    const checked = assertPspAdapter(adapter)
    if (checked.getMetadata().name !== name) throw new Error("registry name must match adapter metadata")
    this.#entries.set(name, Object.freeze({ adapter: checked, enabled: enabled === true }))
    return this
  }

  resolveConfiguredProvider(configuredProviderName) {
    if (typeof configuredProviderName !== "string" || !configuredProviderName) throw new Error("PSP provider is not configured")
    const entry = this.#entries.get(configuredProviderName)
    if (!entry) throw new Error(`unknown PSP provider: ${configuredProviderName}`)
    if (!entry.enabled) throw new Error(`PSP provider is disabled: ${configuredProviderName}`)
    return entry.adapter
  }

  listMetadata() {
    return Object.freeze([...this.#entries.entries()].map(([name, entry]) => Object.freeze({
      name, enabled: entry.enabled, capabilities: entry.adapter.getMetadata().capabilities,
    })))
  }
}

export function resolveServerConfiguredAdapter(registry, serverConfig) {
  if (!serverConfig || typeof serverConfig !== "object" || Array.isArray(serverConfig)) throw new TypeError("server configuration is required")
  return registry.resolveConfiguredProvider(serverConfig.pspProvider)
}
