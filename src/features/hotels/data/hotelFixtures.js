// Frozen, synthetic presentation fixtures transcribed from Figma page 18:17.
// They are non-authoritative and must never be treated as inventory or repriced.
export const HOTEL_FIXTURES = Object.freeze([
  { key: "palm-dubai", name: "فندق النخلة دبي", stars: "★★★★★", location: "دبي · نخلة جميرا", roomPreview: "غرفة ديلوكس · سرير مزدوج", meal: "يشمل الإفطار", cancellation: "إلغاء مجاني حسب الشروط", price: "1,430", tax: "شامل الضرائب والرسوم", roomsCount: "6 خيارات غرف", badge: "الأفضل" },
  { key: "marina-sky", name: "فندق مارينا سكاي", stars: "★★★★★", location: "دبي · دبي مارينا", roomPreview: "غرفة قياسية · إطلالة المدينة", meal: "غرفة فقط", cancellation: "تطبق شروط الإلغاء", price: "1,180", tax: "شامل الضرائب والرسوم", roomsCount: "4 خيارات غرف", badge: "الأرخص" },
  { key: "rawda-apartments", name: "روضة دبي للشقق الفندقية", stars: "★★★★", location: "دبي · البرشاء", roomPreview: "استوديو · سرير مزدوج", meal: "غرفة فقط", cancellation: "قابل للإلغاء حسب الشروط", price: "980", tax: "رسوم تُدفع في الفندق", roomsCount: "3 خيارات غرف" },
])

export const PALM_ROOMS = Object.freeze([
  { key: "deluxe", name: "غرفة ديلوكس · سرير مزدوج", meal: "يشمل الإفطار", cancellation: "إلغاء مجاني حسب الشروط", price: "1,430", tax: "شامل الضرائب والرسوم" },
  { key: "standard", name: "غرفة قياسية · سرير مزدوج", meal: "غرفة فقط", cancellation: "تطبق شروط الإلغاء", price: "1,180", tax: "شامل الضرائب والرسوم" },
  { key: "junior-suite", name: "جناح صغير · سرير مزدوج", meal: "يشمل الإفطار", cancellation: "قابل للإلغاء حسب الشروط", price: "1,620", tax: "رسوم تُدفع في الفندق" },
])

export const resolveHotel = key => HOTEL_FIXTURES.find(hotel => hotel.key === key)
export const resolveRoom = key => PALM_ROOMS.find(room => room.key === key)
