import { Container } from "../../../design-system/primitives/Container.jsx"
import { HomeHero } from "./HomeHero.jsx"
import { HomeSearch } from "./HomeSearch.jsx"

/**
 * Home masthead: V2 hero (14:38 / 16:39) with the Signature Search card
 * (15:2 / 16:49) stacked beneath it, matching the canonical Home composition.
 */
export function HeroSection() {
  return (
    <section className="home-masthead-v2">
      <HomeHero />
      <Container className="home-masthead-v2__search">
        <HomeSearch />
      </Container>
    </section>
  )
}
