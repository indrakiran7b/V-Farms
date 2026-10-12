"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Point = { x: number; y: number };

function applySpotlight(root: HTMLElement, point: Point, size: number, strength: number) {
  root.style.setProperty("--mouse-x", `${point.x}px`);
  root.style.setProperty("--mouse-y", `${point.y}px`);
  root.style.setProperty("--spot-size", `${size}px`);
  root.style.setProperty("--spot-strength", String(strength));
}

export function LuminousHero({
  eyebrow,
  headline,
  lede,
}: {
  eyebrow: string;
  headline: string;
  lede: string;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafId = useRef(0);
  const pending = useRef<Point | null>(null);
  const lastClient = useRef<Point | null>(null);
  const pointerInsideRef = useRef(false);

  const [isPointerInside, setIsPointerInside] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [finePointer, setFinePointer] = useState(true);

  const spotSize = useCallback(() => {
    if (reducedMotion) return 520;
    return finePointer ? 380 : 440;
  }, [reducedMotion, finePointer]);

  const coordsFromClient = useCallback((clientX: number, clientY: number): Point => {
    const root = heroRef.current;
    if (!root) return { x: 0, y: 0 };
    const rect = root.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const coordsFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLElement> | PointerEvent): Point =>
      coordsFromClient(event.clientX, event.clientY),
    [coordsFromClient],
  );

  const flushSpotlight = useCallback(() => {
    rafId.current = 0;
    const root = heroRef.current;
    const point = pending.current;
    if (!root || !point) return;
    const active = pointerInsideRef.current || reducedMotion;
    applySpotlight(root, point, spotSize(), active ? 1 : 0);
  }, [reducedMotion, spotSize]);

  const queueSpotlight = useCallback(
    (point: Point) => {
      pending.current = point;
      if (rafId.current) return;
      rafId.current = window.requestAnimationFrame(flushSpotlight);
    },
    [flushSpotlight],
  );

  const applySpotlightNow = useCallback(
    (point: Point) => {
      pending.current = point;
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      const root = heroRef.current;
      if (!root) return;
      const active = pointerInsideRef.current || reducedMotion;
      applySpotlight(root, point, spotSize(), active ? 1 : 0);
    },
    [reducedMotion, spotSize],
  );

  const staticReducedMotionPoint = useCallback((): Point => {
    const root = heroRef.current;
    if (!root) return { x: 0, y: 0 };
    const rect = root.getBoundingClientRect();
    return { x: rect.width * 0.5, y: rect.height * 0.42 };
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(pointer: fine)");
    const sync = () => {
      setReducedMotion(motion.matches);
      setFinePointer(pointer.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    pointer.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      pointer.removeEventListener("change", sync);
    };
  }, []);

  useLayoutEffect(() => {
    const root = heroRef.current;
    if (!root) return;

    if (reducedMotion) {
      applySpotlightNow(staticReducedMotionPoint());
      return;
    }

    applySpotlight(root, { x: 0, y: 0 }, spotSize(), 0);
  }, [reducedMotion, applySpotlightNow, staticReducedMotionPoint, spotSize]);

  useEffect(() => {
    if (reducedMotion) return;

    const onResizeOrScroll = () => {
      if (pointerInsideRef.current && lastClient.current) {
        queueSpotlight(coordsFromClient(lastClient.current.x, lastClient.current.y));
      }
    };

    window.addEventListener("resize", onResizeOrScroll, { passive: true });
    window.addEventListener("scroll", onResizeOrScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [reducedMotion, coordsFromClient, queueSpotlight]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    if (isPointerInside) {
      const play = () => {
        video.play().catch(() => setVideoFailed(true));
      };
      if (video.readyState >= 2) play();
      else video.addEventListener("canplay", play, { once: true });
      return () => video.removeEventListener("canplay", play);
    }

    video.pause();
  }, [isPointerInside, reducedMotion]);

  const onPointerEnter = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion) return;
    pointerInsideRef.current = true;
    setIsPointerInside(true);
    lastClient.current = { x: event.clientX, y: event.clientY };
    applySpotlightNow(coordsFromEvent(event));
  };

  const onPointerLeave = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const related = event.relatedTarget as Node | null;
    if (related && heroRef.current?.contains(related)) return;

    pointerInsideRef.current = false;
    setIsPointerInside(false);
    lastClient.current = null;

    const root = heroRef.current;
    if (root) {
      applySpotlight(root, pending.current ?? { x: 0, y: 0 }, spotSize(), 0);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion || !pointerInsideRef.current) return;
    lastClient.current = { x: event.clientX, y: event.clientY };
    queueSpotlight(coordsFromEvent(event));
  };

  const maskGradient =
    "radial-gradient(circle var(--spot-size, 380px) at var(--mouse-x) var(--mouse-y), #000 0%, #000 22%, rgba(0,0,0,0.6) 48%, rgba(0,0,0,0.12) 66%, transparent 80%)";

  const revealActive = reducedMotion || isPointerInside;
  const revealOpacity = reducedMotion ? 0.85 : isPointerInside ? 1 : 0;

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100svh] overflow-hidden text-ivory-50"
      aria-label="V-Farms cinematic introduction"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerMoveCapture={onPointerMove}
    >
      <div className="botanical-surface pointer-events-none absolute inset-0 z-0" />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 mix-blend-soft-light"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(196,174,122,0.18), transparent 28%), radial-gradient(circle at 80% 70%, rgba(196,92,122,0.12), transparent 32%)",
        }}
      />
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.12]"
        aria-hidden="true"
      >
        <defs>
          <pattern id="fronds" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M20 120 C40 40, 70 30, 90 10" fill="none" stroke="#e6d8c0" strokeWidth="0.6" />
            <path d="M70 130 C90 70, 110 50, 130 20" fill="none" stroke="#e6d8c0" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fronds)" />
      </svg>

      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-300 ease-out"
        style={{
          opacity: revealOpacity,
          visibility: revealActive ? "visible" : "hidden",
          WebkitMaskImage: revealActive ? maskGradient : "none",
          maskImage: revealActive ? maskGradient : "none",
        }}
      >
        {!videoFailed && !reducedMotion ? (
          <video
            ref={videoRef}
            className="pointer-events-none h-full w-full object-cover"
            src="/videos/farm-h1.mp4"
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/hero-poster.jpg"
            onError={() => setVideoFailed(true)}
            aria-hidden="true"
          />
        ) : (
          <div className="pointer-events-none h-full w-full bg-[url('/images/hero-base.svg')] bg-cover bg-center" />
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[1] mix-blend-screen transition-opacity duration-300 ease-out"
        style={{
          opacity: revealActive ? revealOpacity * 0.9 : 0,
          visibility: revealActive ? "visible" : "hidden",
          background:
            "radial-gradient(circle calc(var(--spot-size, 380px) * 0.9) at var(--mouse-x) var(--mouse-y), rgba(255,236,205,0.32), rgba(196,174,122,0.12) 45%, transparent 74%)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-forest-950 via-forest-950/20 to-forest-950/35" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 md:px-8 md:pb-24">
        <p className="text-xs uppercase tracking-[0.32em] text-gold-400">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.95] md:text-7xl">{headline}</h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-ivory-100/80 md:text-lg">{lede}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/booking"
            className="bg-ivory-50 px-6 py-3 text-center text-sm uppercase tracking-[0.16em] text-forest-950"
          >
            Book the Entire Resort
          </Link>
          <Link
            href="/events"
            className="border border-ivory-100/40 px-6 py-3 text-center text-sm uppercase tracking-[0.16em]"
          >
            Plan an Event
          </Link>
        </div>
        <p className="mt-8 max-w-md text-xs leading-6 text-ivory-200/60">
          {finePointer && !reducedMotion
            ? "Move across the frame to reveal the plantation. The light follows you; the land stays still."
            : reducedMotion
              ? "A still glimpse of the plantation at the heart of the frame."
              : "Tap and drag across the frame to move the luminous reveal across the plantation."}
          {videoFailed ? " Video could not be loaded; the botanical surface remains." : null}
        </p>
      </div>
    </section>
  );
}
