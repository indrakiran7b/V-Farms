'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Menu, Sprout, Users, X } from 'lucide-react'

const rooms = [
  ['The Canopy', 'A quiet corner above the plantation, filled with morning light.', '01'],
  ['The Orchard', 'A generous room opening toward the old mango trees.', '02'],
  ['The Courtyard', 'An intimate hideaway with a private garden outlook.', '03'],
  ['The Veranda', 'Slow afternoons and long views across the farm.', '04'],
  ['The Studio', 'A considered space for unhurried weekends.', '05'],
]

const experiences = [
  ['01', 'Walk the plantation', 'Follow the rows at first light and learn the rhythm of the farm.'],
  ['02', 'Gather around the table', 'Seasonal food, thoughtful hosting, and evenings that linger.'],
  ['03', 'Make space to be still', 'A private estate designed for conversations, celebrations, and rest.'],
]

function BookingSearch() {
  const [mode, setMode] = useState<'stay' | 'event'>('stay')
  const [step, setStep] = useState<'search' | 'details' | 'payment' | 'success'>('search')
  const [dates, setDates] = useState({ checkIn: '', checkOut: '', guests: '2' })
  const [details, setDetails] = useState({ name: '', email: '', phone: '' })
  const [event, setEvent] = useState({ type: '', attendance: '20', notes: '', name: '', email: '', phone: '' })
  const [quote, setQuote] = useState<{ nights: number; total: number } | null>(null)
  const [booking, setBooking] = useState<{ id: string; reference: string } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  async function checkAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/bookings/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkIn: dates.checkIn, checkOut: dates.checkOut, adults: Number(dates.guests), children: 0 }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Those dates are not available.')
      setQuote(data.quote); setStep('details')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to check those dates.') } finally { setBusy(false) }
  }

  async function createHold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/bookings/hold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkIn: dates.checkIn, checkOut: dates.checkOut, adults: Number(dates.guests), children: 0, guestName: details.name, guestEmail: details.email, guestPhone: details.phone, termsAccepted: true }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Unable to hold those dates.')
      setBooking({ id: data.booking.id, reference: data.booking.booking_reference }); setStep('payment')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to reserve your stay.') } finally { setBusy(false) }
  }

  async function payNow() {
    if (!booking) return; setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/payments/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Unable to start secure checkout.')
      const openCheckout = () => {
        const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay
        if (!Razorpay) { setMessage('Unable to load secure checkout. Please try again.'); return }
        const checkout = new Razorpay({ key: data.keyId, amount: data.amount, currency: data.currency, name: 'V-Farms', description: `Estate stay · ${data.bookingReference}`, order_id: data.orderId, prefill: data.prefill, theme: { color: '#17382b' }, handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verified = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.id, ...payment }) })
          const result = await verified.json()
          if (!verified.ok) { setMessage(result.error ?? 'Payment is pending verification.'); return }
          setStep('success')
          }
        })
        checkout.open()
      }
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
      if (existingScript) openCheckout()
      else { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = openCheckout; script.onerror = () => setMessage('Unable to load secure checkout. Please try again.'); document.body.appendChild(script) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start payment.') } finally { setBusy(false) }
  }

  function submitEvent(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault(); setBusy(true); setMessage('')
    window.setTimeout(() => { setBusy(false); setMessage('Your enquiry has been received. Our team will review the dates and reply with a written quote. No dates have been held.') }, 450)
  }

  const tabs = <div className="booking-tabs" role="tablist"><button type="button" role="tab" aria-selected={mode === 'stay'} className={mode === 'stay' ? 'active' : ''} onClick={() => { setMode('stay'); setMessage('') }}>Entire estate stay</button><button type="button" role="tab" aria-selected={mode === 'event'} className={mode === 'event' ? 'active' : ''} onClick={() => { setMode('event'); setMessage('') }}>Exclusive event</button></div>
  if (mode === 'event') return <div className="booking-panel event-booking">{tabs}<p className="booking-intro">An enquiry is not a booking and does not hold the calendar.</p><form onSubmit={submitEvent} className="event-form"><label className="booking-input">Gathering type<input value={event.type} onChange={e => setEvent({ ...event, type: e.target.value })} placeholder="Family gathering, birthday…" required /></label><label className="booking-input">Expected attendance<input type="number" min="1" max="500" value={event.attendance} onChange={e => setEvent({ ...event, attendance: e.target.value })} required /></label><label className="booking-input">Start date<input type="date" min={today} required /></label><label className="booking-input">End date<input type="date" min={today} required /></label><label className="booking-input wide">Setup requirements<textarea value={event.notes} onChange={e => setEvent({ ...event, notes: e.target.value })} rows={3} placeholder="Catering, seating, vendors…" /></label><label className="booking-input">Organiser name<input value={event.name} onChange={e => setEvent({ ...event, name: e.target.value })} required /></label><label className="booking-input">Email<input type="email" value={event.email} onChange={e => setEvent({ ...event, email: e.target.value })} required /></label><label className="booking-input">Phone<input type="tel" value={event.phone} onChange={e => setEvent({ ...event, phone: e.target.value })} required /></label><button className="button button-dark wide" type="submit" disabled={busy}>{busy ? 'Sending enquiry…' : 'Request a quote'} <ArrowRight aria-hidden="true" /></button></form>{message && <p className="booking-note" role="status">{message}</p>}</div>
  if (step === 'success') return <div className="booking-panel booking-success" role="status"><p className="eyebrow">Booking confirmed</p><h3>Your stay is secured.</h3><p>Reference <strong>{booking?.reference}</strong>. A confirmation will be sent to {details.email}.</p><button className="text-link" type="button" onClick={() => { setStep('search'); setBooking(null) }}>Start another search <ArrowRight aria-hidden="true" /></button></div>
  if (step === 'payment') return <div className="booking-panel booking-details"><div className="booking-summary"><p className="eyebrow">Held for 15 minutes</p><strong>₹{((quote?.total ?? 0) / 100).toLocaleString('en-IN')}</strong></div><p className="booking-intro">Reference {booking?.reference}. Secure payment is required to confirm the estate.</p><button className="button button-dark" type="button" disabled={busy} onClick={payNow}>{busy ? 'Preparing checkout…' : 'Continue to secure payment'} <ArrowRight aria-hidden="true" /></button><button className="text-link" type="button" onClick={() => setStep('details')}>Back to guest details</button>{message && <p className="booking-note" role="alert">{message}</p>}</div>
  if (step === 'details') return <form onSubmit={createHold} className="booking-panel booking-details">{tabs}<div className="booking-summary"><p className="eyebrow">{quote?.nights} nights · {dates.guests} guests</p><strong>₹{((quote?.total ?? 0) / 100).toLocaleString('en-IN')}</strong><button className="text-link" type="button" onClick={() => setStep('search')}>Change dates</button></div><label className="booking-input">Your name<input value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} required minLength={2} /></label><label className="booking-input">Email address<input type="email" value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })} required /></label><label className="booking-input">Phone number<input type="tel" value={details.phone} onChange={e => setDetails({ ...details, phone: e.target.value })} required minLength={7} /></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Holding your dates…' : 'Continue to payment'} <ArrowRight aria-hidden="true" /></button>{message && <p className="booking-note" role="alert">{message}</p>}</form>
  return <form onSubmit={checkAvailability} className="booking-panel">{tabs}<p className="booking-intro">Reserves the whole property, including all five rooms. Individual rooms are not sold.</p><div className="booking-field"><CalendarDays aria-hidden="true" /><label htmlFor="check-in">Check in<input id="check-in" type="date" min={today} value={dates.checkIn} onChange={e => setDates({ ...dates, checkIn: e.target.value })} required /></label></div><div className="booking-field"><CalendarDays aria-hidden="true" /><label htmlFor="check-out">Check out<input id="check-out" type="date" min={dates.checkIn || today} value={dates.checkOut} onChange={e => setDates({ ...dates, checkOut: e.target.value })} required /></label></div><div className="booking-field"><Users aria-hidden="true" /><label htmlFor="guests">Guests<select id="guests" value={dates.guests} onChange={e => setDates({ ...dates, guests: e.target.value })}><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option><option value="8">8 guests</option></select></label></div><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Checking dates…' : 'Check availability'} <ArrowRight aria-hidden="true" /></button>{message && <p className="booking-note" role="alert">{message}</p>}</form>
}

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <main>
      <section className="hero" id="home">
        <img src="/vfarms-hero.png" alt="Dragon fruit plantation and guesthouse at V-Farms" className="hero-image" />
        <div className="hero-shade" />
        <nav className="nav shell" aria-label="Main navigation">
          <a href="#home" className="wordmark">V<span>—</span>FARMS</a>
          <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
            <a href="#story" onClick={() => setMenuOpen(false)}>The estate</a><a href="#rooms" onClick={() => setMenuOpen(false)}>Stay</a><a href="#events" onClick={() => setMenuOpen(false)}>Events</a><a href="#contact" onClick={() => setMenuOpen(false)}>Visit</a>
            <a className="nav-book" href="#book" onClick={() => setMenuOpen(false)}>Book your stay <ArrowRight aria-hidden="true" /></a>
          </div>
          <button className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </nav>
        <div className="hero-content shell">
          <p className="eyebrow light">A private farm retreat · Hyderabad, Telangana</p>
          <h1>A singular<br /><em>escape</em> to nature.</h1>
          <p className="hero-copy">Five acres of dragon fruit, open skies, and a place to gather well.</p>
          <div className="hero-actions"><a href="#book" className="button button-light">Book entire resort <ArrowRight aria-hidden="true" /></a><a href="#events" className="text-link light">Plan an event <ArrowRight aria-hidden="true" /></a></div>
        </div>
        <a href="#story" className="scroll-cue"><span /> Scroll to explore</a>
      </section>

      <section className="intro shell" id="story"><div className="intro-mark"><Sprout aria-hidden="true" /></div><div><p className="eyebrow">The V-Farms feeling</p><h2>Come for the quiet.<br /><em>Stay for the feeling.</em></h2><p className="body-copy">V-Farms is a private five-acre estate shaped by the land around it. A considered place to slow down, share a meal, celebrate something meaningful, or simply wake up somewhere green.</p><a href="#estate" className="text-link">Discover the estate <ArrowRight aria-hidden="true" /></a></div></section>

      <section className="image-story shell" id="estate"><div className="story-image"><img src="/vfarms-garden.png" alt="Dragon fruit growing at the plantation" /></div><div className="story-copy"><p className="eyebrow">01 / The plantation</p><h2>Rooted in<br /><em>the real.</em></h2><p className="body-copy">There is a particular pleasure in being close to where things grow. Walk between the dragon fruit rows, follow the changing light, and let the day find its own pace.</p><div className="stat-row"><div><strong>05</strong><span>acres of land</span></div><div><strong>01</strong><span>private estate</span></div></div></div></section>

      <section className="rooms-section" id="rooms"><div className="shell section-heading"><div><p className="eyebrow">The accommodation</p><h2>Five rooms.<br /><em>One whole resort.</em></h2></div><p className="body-copy">Each room has its own character. Your booking gives you the entire estate, so every room is included.</p></div><div className="rooms-grid shell">{rooms.map(([name, desc, number], index) => <article className={`room-card room-${index + 1}`} key={name}>{index === 0 && <img src="/vfarms-room.png" alt="The Canopy guest room" />}<div className="room-overlay"><span>{number}</span><div><h3>{name}</h3><p>{desc}</p></div></div></article>)}</div><p className="room-note shell">Five distinct rooms. One exclusive booking. All five rooms are included in a whole-resort stay.</p></section>

      <section className="experience-section shell"><div className="section-heading"><div><p className="eyebrow">A day at V-Farms</p><h2>Let the day<br /><em>unfold.</em></h2></div></div><div className="experience-grid">{experiences.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="event-banner" id="events"><div className="shell event-inner"><p className="eyebrow light">Gather here</p><h2>For the days<br /><em>worth gathering for.</em></h2><p>From intimate celebrations to thoughtful events, make the estate yours.</p><a href="#contact" className="button button-light">Plan an event <ArrowRight aria-hidden="true" /></a></div></section>

      <section className="book-section shell" id="book"><div className="book-heading"><p className="eyebrow">Make your way here</p><h2>Find your<br /><em>way to V-Farms.</em></h2><p className="body-copy">Book exclusive access to the estate and all five rooms. We look forward to welcoming you.</p></div><BookingSearch /></section>

      <footer id="contact"><div className="shell footer-top"><div><a href="#home" className="wordmark">V<span>—</span>FARMS</a><p>A singular escape to nature.</p></div><div className="footer-links"><div><p className="eyebrow">Explore</p><a href="#story">The estate</a><a href="#rooms">The rooms</a><a href="#events">Private events</a></div><div><p className="eyebrow">Find us</p><p>Near Hyderabad,<br />Telangana, India</p><a href="mailto:hello@vfarms.in">hello@vfarms.in</a></div></div></div><div className="shell footer-bottom"><span>© 2025 V-Farms</span><span>Private by nature.</span><a href="#home" aria-label="V-Farms on Instagram">IG</a></div></footer>
    </main>
  )
}
