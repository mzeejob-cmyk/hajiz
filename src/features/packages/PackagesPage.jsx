import { FeaturePage } from "../../design-system/patterns/FeaturePage.jsx"
import { toCatalogPresentation } from "../../services/contracts/catalogPresentation.js"
const contract = toCatalogPresentation({ type: "package", title: "رحلة متكاملة في مكان واحد", summary: "عرض محتوى فقط؛ لا يوجد منشئ باقات ديناميكي أو نشر من المتصفح." })
export default function PackagesPage() { return <div data-catalog-type={contract.type} data-publish-authority={contract.publishAuthority} data-dynamic-builder={contract.dynamicBuilder}><FeaturePage eyebrow="الباقات" title={contract.title} description={contract.summary} /></div> }
