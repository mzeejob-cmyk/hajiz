import { HeroSection } from "./components/HeroSection.jsx"
import { TrustStrip } from "./components/TrustStrip.jsx"
import { OffersSection } from "./components/OffersSection.jsx"
import { PopularRoutesSection } from "./components/PopularRoutesSection.jsx"
import { HotelDestinationsSection } from "./components/HotelDestinationsSection.jsx"
import { PackagesSection } from "./components/PackagesSection.jsx"
import { HomeCTA } from "./components/HomeCTA.jsx"

/**
 * Section order follows the canonical desktop frame 14:24:
 * hero -> signature search -> trust strip -> discovery.
 * The discovery modules and CTAs are unchanged in behaviour and authority.
 */
export default function HomePage() {
  return <div className="home-v2">
    <HeroSection/>
    <TrustStrip/>
    <OffersSection/>
    <PopularRoutesSection/>
    <HotelDestinationsSection/>
    <PackagesSection/>
    <HomeCTA type="insurance"/>
    <HomeCTA type="partners"/>
  </div>
}
