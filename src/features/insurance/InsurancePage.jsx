import { Badge, Container, NetworkMark, Surface } from "../../design-system/index.js"

const boundaries = Object.freeze([
  { number: "01", title: "لا يوجد عرض سعر حي", body: "لا تعيد هذه الصفحة سعرًا أو عملة أو خطة تأمين قابلة للاختيار." },
  { number: "02", title: "لا توجد عملية شراء", body: "لا يتم تحصيل مبلغ أو فتح مسار دفع من واجهة التأمين الحالية." },
  { number: "03", title: "لا تُصدر وثيقة", body: "لا ينشئ العرض الحالي وثيقة أو رقم بوليصة أو مطالبة تأمين." },
])

const futurePath = Object.freeze([
  ["ربط موثوق", "لن تبدأ الخدمة قبل وجود تكامل خادمي معتمد."],
  ["عرض واضح", "ستُعرض الشروط القادمة من المصدر الموثوق دون سلطة للمتصفح."],
  ["إصدار مؤكد", "ستبقى الوثيقة غير صادرة حتى يؤكدها النظام المسؤول صراحةً."],
])

function ShieldIllustration() {
  return <div className="insurance-v2__visual" aria-hidden="true">
    <div className="insurance-v2__orbit insurance-v2__orbit--one" />
    <div className="insurance-v2__orbit insurance-v2__orbit--two" />
    <svg className="insurance-v2__shield" viewBox="0 0 180 210" focusable="false">
      <path d="M90 10 156 34v58c0 49-27 86-66 108-39-22-66-59-66-108V34L90 10Z" />
      <path d="m59 103 21 21 43-48" />
    </svg>
    <span className="insurance-v2__node insurance-v2__node--navy" />
    <span className="insurance-v2__node insurance-v2__node--gold" />
  </div>
}

export default function InsurancePage() {
  return <div className="insurance-v2" data-insurance-v2="truthful-presentation" data-live-service="false">
    <section className="insurance-v2__hero" aria-labelledby="insurance-title">
      <Container className="insurance-v2__hero-grid">
        <div className="insurance-v2__intro">
          <Badge accent>التأمين · واجهة تجريبية</Badge>
          <h1 id="insurance-title">رحلة مطمئنة تبدأ من معلومة واضحة</h1>
          <p className="insurance-v2__lead">تصوّر مرئي لتجربة تأمين السفر المستقبلية في حاجز — بلا عروض وهمية أو شراء غير متاح.</p>
          <div className="insurance-v2__truth" role="status" aria-live="polite">
            <span className="insurance-v2__truth-mark" aria-hidden="true">i</span>
            <div>
              <strong>خدمة التأمين غير مفعّلة للحجز أو الشراء حاليًا.</strong>
              <p>المحتوى المعروض للتقديم البصري فقط؛ لا يُرجع عرضًا حيًا، ولا ينفذ دفعًا، ولا يصدر وثيقة.</p>
            </div>
          </div>
        </div>
        <ShieldIllustration />
      </Container>
    </section>

    <Container as="main" className="insurance-v2__content">
      <section aria-labelledby="insurance-boundaries-title">
        <div className="insurance-v2__section-heading">
          <span className="insurance-v2__eyebrow">الحالة الحالية</span>
          <h2 id="insurance-boundaries-title">ما الذي تعنيه الواجهة التجريبية؟</h2>
          <p>ثلاثة حدود صريحة تمنع التصميم من الإيحاء بخدمة غير موجودة.</p>
        </div>
        <div className="insurance-v2__boundary-grid">
          {boundaries.map(item => <Surface as="article" elevation="raised" className="insurance-v2__boundary" key={item.number}>
            <span className="insurance-v2__number" aria-hidden="true">{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </Surface>)}
        </div>
      </section>

      <section className="insurance-v2__future" aria-labelledby="insurance-future-title">
        <div className="insurance-v2__future-brand" aria-hidden="true"><NetworkMark /><span>HAJIZ</span></div>
        <div className="insurance-v2__future-copy">
          <span className="insurance-v2__eyebrow">قبل التفعيل</span>
          <h2 id="insurance-future-title">مسار الثقة يسبق أي معاملة</h2>
          <p>عندما تصبح الخدمة جاهزة، ستعتمد على بيانات موثوقة من الخادم مع فصل واضح بين العرض والدفع والإصدار.</p>
        </div>
        <ol className="insurance-v2__future-list">
          {futurePath.map(([title, body], index) => <li key={title}>
            <span aria-hidden="true">{index + 1}</span>
            <div><h3>{title}</h3><p>{body}</p></div>
          </li>)}
        </ol>
      </section>

      <aside className="insurance-v2__closing" aria-label="حالة خدمة التأمين">
        <span className="insurance-v2__closing-icon" aria-hidden="true">✦</span>
        <div><strong>نلتزم بالوضوح قبل الإطلاق.</strong><p>ستظل هذه الصفحة تعريفية حتى تتوفر خدمة تأمين حقيقية بعقود وسلطات موثوقة.</p></div>
      </aside>
    </Container>
  </div>
}
