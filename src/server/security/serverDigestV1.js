import { createHash } from "node:crypto"

export const createServerDigestV1 = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
