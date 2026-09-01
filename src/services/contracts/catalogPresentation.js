export const CATALOG_TYPES = Object.freeze(["package", "offer"])
export function toCatalogPresentation(item) {
  if (!CATALOG_TYPES.includes(item?.type) || typeof item?.title !== "string") throw new Error("CATALOG_PRESENTATION_INVALID")
  return Object.freeze({ type: item.type, title: item.title, summary: typeof item.summary === "string" ? item.summary : "", state: "draft-presentation", publishAuthority: false, dynamicBuilder: false })
}
