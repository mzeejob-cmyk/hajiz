import { FeaturePage } from "../../design-system/patterns/FeaturePage.jsx"
import { toCatalogPresentation } from "../../services/contracts/catalogPresentation.js"
const contract = toCatalogPresentation({ type: "offer", title: "فرص مختارة لرحلتك القادمة", summary: "عقد عرض CMS فقط؛ لا نشر حي ولا صلاحية تسعير من المتصفح." })
export default function OffersPage() { return <div data-catalog-type={contract.type} data-publish-authority={contract.publishAuthority} data-dynamic-builder={contract.dynamicBuilder}><FeaturePage eyebrow="العروض" title={contract.title} description={contract.summary} /></div> }
