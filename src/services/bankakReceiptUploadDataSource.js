import { getAccountSessionClient } from "./myTripsDataSource.js"

export const MAX_BANKAK_RECEIPT_BYTES = 10 * 1024 * 1024
export const BANKAK_RECEIPT_MIME_TYPES = Object.freeze(["image/jpeg", "image/png", "application/pdf"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EXTENSION = Object.freeze({ "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" })
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key))

function validateFile(file) {
  if (!file || typeof file !== "object" || !BANKAK_RECEIPT_MIME_TYPES.includes(file.type) || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_BANKAK_RECEIPT_BYTES) throw new Error("BANKAK_RECEIPT_INVALID_FILE")
  return file
}

function validateResponse(value) {
  const keys = ["accepted", "detectedMime", "sha256"]
  if (!exact(value, keys) || value.accepted !== true || !BANKAK_RECEIPT_MIME_TYPES.includes(value.detectedMime) || !/^[0-9a-f]{64}$/.test(value.sha256)) throw new Error("BANKAK_RECEIPT_RESPONSE_INVALID")
  return Object.freeze({ accepted: true, detectedMime: value.detectedMime, sha256: value.sha256 })
}

export function createBankakReceiptUploadDataSource({ getClient = getAccountSessionClient, createId = () => globalThis.crypto.randomUUID() } = {}) {
  if (typeof getClient !== "function" || typeof createId !== "function") throw new TypeError("Bankak receipt dependencies are required")
  return Object.freeze({
    async upload(input) {
      if (!exact(input, ["paymentId", "file"]) || !UUID.test(input.paymentId)) throw new Error("BANKAK_RECEIPT_INVALID_FILE")
      const file = validateFile(input.file)
      let client, authData, authError
      try {
        client = getClient()
        ;({ data: authData, error: authError } = await client.auth.getUser())
      } catch { throw new Error("BANKAK_RECEIPT_AUTH_REQUIRED") }
      const userId = authData?.user?.id
      if (authError || typeof userId !== "string" || !UUID.test(userId)) throw new Error("BANKAK_RECEIPT_AUTH_REQUIRED")
      const receiptId = createId()
      if (typeof receiptId !== "string" || !UUID.test(receiptId)) throw new Error("BANKAK_RECEIPT_UPLOAD_FAILED")
      const objectName = `${userId}/${input.paymentId}/receipt-${receiptId}.${EXTENSION[file.type]}`
      let uploadResult
      try { uploadResult = await client.storage.from("receipts").upload(objectName, file, { contentType: file.type, upsert: false }) }
      catch { throw new Error("BANKAK_RECEIPT_UPLOAD_FAILED") }
      if (uploadResult?.error) throw new Error("BANKAK_RECEIPT_UPLOAD_FAILED")
      let inspection
      try { inspection = await client.functions.invoke("inspect-payment-receipt", { body: { paymentId: input.paymentId, objectName } }) }
      catch { throw new Error("BANKAK_RECEIPT_INSPECTION_FAILED") }
      if (inspection?.error) throw new Error("BANKAK_RECEIPT_INSPECTION_FAILED")
      return validateResponse(inspection?.data)
    },
  })
}

export const bankakReceiptUploadDataSource = createBankakReceiptUploadDataSource()
