const STEPS = ["اختيار الرحلة", "بيانات المسافر", "الدفع"]
export function BookingSteps({ activeStep = 1 }) { return <ol className="booking-steps" aria-label="خطوات الحجز">{STEPS.map((step, index) => <li key={step} aria-current={index + 1 === activeStep ? "step" : undefined}><span>{index + 1}</span>{step}</li>)}</ol> }
