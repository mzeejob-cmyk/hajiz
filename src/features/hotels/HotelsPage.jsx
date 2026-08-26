import { useNavigate, useSearchParams } from "react-router-dom"
import { GuestDetails } from "./components/GuestDetails.jsx"
import { HotelResults } from "./components/HotelResults.jsx"
import { RoomSelection } from "./components/RoomSelection.jsx"
import { resolveHotel, resolveRoom } from "./data/hotelFixtures.js"

export default function HotelsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const view = params.get("view")
  const hotelKey = params.get("hotel")
  const roomKey = params.get("room")
  const results = () => navigate("/hotels")
  if (view === "rooms" && resolveHotel(hotelKey)?.key === "palm-dubai") return <RoomSelection initialRoomKey={roomKey} onBack={results} onGuest={key => navigate(`/hotels?view=guest&hotel=palm-dubai&room=${encodeURIComponent(key)}`)}/>
  if (view === "guest" && hotelKey === "palm-dubai" && resolveRoom(roomKey)) return <GuestDetails roomKey={roomKey} onBack={() => navigate(`/hotels?view=rooms&hotel=palm-dubai&room=${encodeURIComponent(roomKey)}`)}/>
  return <HotelResults onRooms={key => key === "palm-dubai" ? navigate("/hotels?view=rooms&hotel=palm-dubai&room=deluxe") : results()}/>
}
