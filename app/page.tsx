'use client'

import { useState } from 'react'
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
  const [submitted, setSubmitted] = useState(false)
  return (
    <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }} className="booking-panel">
      <div className="booking-field"><CalendarDays aria-hidden="true" /><label htmlFor="check-in">Check in<input id="check-in" type="date" required /></label></div>
      <div className="booking-field"><CalendarDays aria-hidden="true" /><label htmlFor="check-out">Check out<input id="check-out" type="date" required /></label></div>
      <div className="booking-field"><Users aria-hidden="true" /><label htmlFor="guests">Guests<select id="guests" defaultValue="2"><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option><option value="8">8 guests</option></select></label></div>
      <button className="button button-dark" type="submit">Check availability <ArrowRight aria-hidden="true" /></button>
      {submitted && <p className="booking-note" role="status">Availability search ready — your dates are preserved for the booking flow.</p>}
    </form>
  )
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
