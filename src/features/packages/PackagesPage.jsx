import { FeaturePage } from "../../design-system/patterns/FeaturePage.jsx"
import { PublicCatalogCollection } from "../catalog/components/PublicCatalogCollection.jsx"

export default function PackagesPage() { return <div data-catalog-type="package" data-publish-authority="false" data-dynamic-builder="false"><FeaturePage eyebrow="الباقات" title="رحلة متكاملة في مكان واحد" description="استعرض الباقات المنشورة المتاحة حاليًا."><PublicCatalogCollection type="package" /></FeaturePage></div> }
