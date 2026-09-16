import { NetworkMark } from "../../../design-system/primitives/NetworkMark.jsx"

/**
 * HAJIZ V2 Home hero.
 * Desktop: Figma node 14:38 - inverse navy surface, cinematic image with a
 * navy atmosphere overlay, right-aligned Arabic copy, living Network Mark.
 * Mobile: Figma node 16:39 - taller crop, bottom-anchored copy, smaller mark.
 *
 * The hero photograph is supplied through the --home-hero-image custom
 * property so the canonical Figma asset can be dropped in without touching
 * this component. When it is unset the hero renders the canonical navy
 * atmosphere gradient alone - no substitute stock photography is shipped.
 */
export function HomeHero() {
  return (
    <section className="home-hero-v2" data-home-hero="v2">
      <div className="home-hero-v2__image" aria-hidden="true" />
      <div className="home-hero-v2__overlay" aria-hidden="true" />
      <div className="home-hero-v2__copy">
        <h1 className="home-hero-v2__headline desktop-copy">من هنا تبدأ الحكاية.</h1>
        <h1 className="home-hero-v2__headline mobile-copy">العالم أقرب.</h1>
        <p className="home-hero-v2__subhead desktop-copy">رحلات وفنادق وتجارب، موصولة في مكان واحد.</p>
        <p className="home-hero-v2__subhead mobile-copy">رحلتك تبدأ من حاجز.</p>
        <p className="home-hero-v2__support desktop-copy">اكتشف العالم بثقة، واترك التفاصيل لحاجز.</p>
        <NetworkMark className="home-hero-v2__mark" />
      </div>
    </section>
  )
}
