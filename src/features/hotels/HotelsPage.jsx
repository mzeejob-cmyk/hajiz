import { useNavigate, useSearchParams } from "react-router-dom"
import { GuestDetails } from "./components/GuestDetails.jsx"
import { HotelReview } from "./components/HotelReview.jsx"
import { HotelResults } from "./components/HotelResults.jsx"
import { RoomSelection } from "./components/RoomSelection.jsx"
import { resolveHotel, resolveRoom } from "./data/hotelCanonicalFixtures.js"

export default function HotelsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const view = params.get("view")
  const rawHotelKey = params.get("hotel")
  const hotelKey = rawHotelKey === "palm-dubai" ? "hjz_htl_palm_dubai" : rawHotelKey
  const roomKey = params.get("rate") ?? params.get("room")
  const results = () => navigate("/hotels")
  // Legacy presentation entry accepted only as an input alias: view=guest&hotel=palm-dubai&room=deluxe
  if (view === "rooms" && hotelKey === "hjz_htl_palm_dubai") return <RoomSelection initialRoomKey={resolveRoom(roomKey)?.canonicalRateId} onBack={results} onGuest={key => navigate(`/hotels?view=guest&hotel=hjz_htl_palm_dubai&rate=${encodeURIComponent(key)}`)}/>
  if (view === "guest" && hotelKey === "hjz_htl_palm_dubai" && resolveRoom(roomKey)) return <GuestDetails roomKey={roomKey} onBack={() => navigate(`/hotels?view=rooms&hotel=hjz_htl_palm_dubai&rate=${encodeURIComponent(roomKey)}`)} onReview={key => navigate(`/hotels?view=review&hotel=hjz_htl_palm_dubai&rate=${encodeURIComponent(key)}`)}/>
  if (view === "review" && resolveHotel(hotelKey) && resolveRoom(roomKey)) return <HotelReview canonicalHotelId={hotelKey} canonicalRateId={roomKey} onBack={() => navigate(`/hotels?view=guest&hotel=${hotelKey}&rate=${roomKey}`)}/>
  return <HotelResults onRooms={key => key === "hjz_htl_palm_dubai" ? navigate("/hotels?view=rooms&hotel=hjz_htl_palm_dubai&rate=hjz_rate_palm_deluxe_breakfast_flex") : results()}/>
}
