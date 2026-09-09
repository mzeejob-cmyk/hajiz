import { FeaturePage } from "../../design-system/patterns/FeaturePage.jsx"
import { PublicCatalogCollection } from "../catalog/components/PublicCatalogCollection.jsx"

export default function OffersPage() { return <div data-catalog-type="offer" data-publish-authority="false" data-dynamic-builder="false"><FeaturePage eyebrow="العروض" title="فرص مختارة لرحلتك القادمة" description="استعرض العروض المنشورة المتاحة حاليًا."><PublicCatalogCollection type="offer" /></FeaturePage></div> }
