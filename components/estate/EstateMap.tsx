"use client";

import { useState } from "react";
import type { EstateHotspot } from "@/lib/types";

export function EstateMap({ hotspots }: { hotspots: EstateHotspot[] }) {
  const [active, setActive] = useState(hotspots[0]?.id ?? null);
  const selected = hotspots.find((item) => item.id === active) ?? hotspots[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="relative min-h-[420px] bg-forest-900">
        <svg viewBox="0 0 100 70" className="h-full w-full" role="img" aria-label="Schematic estate map">
          <rect width="100" height="70" fill="#163024" />
          <ellipse cx="62" cy="38" rx="28" ry="18" fill="#1f4633" />
          <rect x="42" y="26" width="14" height="10" fill="#e6d8c0" />
          {hotspots.map((spot) => (
            <g key={spot.id}>
              <circle
                cx={spot.xPercent}
                cy={(spot.yPercent / 100) * 70}
                r={active === spot.id ? 3.2 : 2.4}
                fill={active === spot.id ? "#c45c7a" : "#c4ae7a"}
              />
            </g>
          ))}
        </svg>
        {hotspots.map((spot) => (
          <button
            key={spot.id}
            type="button"
            onClick={() => setActive(spot.id)}
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ivory-50/40"
            style={{ left: `${spot.xPercent}%`, top: `${spot.yPercent}%` }}
            aria-pressed={active === spot.id}
          >
            <span className="sr-only">{spot.title}</span>
          </button>
        ))}
        <p className="absolute bottom-3 left-3 text-xs uppercase tracking-[0.18em] text-gold-400">Schematic only</p>
      </div>
      <div>
        <ul className="space-y-3">
          {hotspots.map((spot) => (
            <li key={spot.id}>
              <button
                type="button"
                className={`w-full border px-4 py-3 text-left ${active === spot.id ? "border-forest-800 bg-ivory-100" : "border-earth-700/15"}`}
                onClick={() => setActive(spot.id)}
              >
                {spot.title}
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <article className="mt-6">
            <h2 className="font-serif text-3xl">{selected.title}</h2>
            <p className="mt-3 leading-7 text-muted">{selected.description}</p>
            {selected.awaitingOwnerApproval ? (
              <p className="mt-3 text-sm text-earth-700">Awaiting owner verification of geography and facilities.</p>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}
