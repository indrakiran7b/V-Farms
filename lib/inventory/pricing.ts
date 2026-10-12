import type { AddOn, PriceSnapshot, RateRule, TaxLine } from "@/lib/types";
import { CURRENCY } from "@/lib/types";
import { eachDate, nowIso, weekdaySundayZero } from "@/lib/time/kolkata";

export function nightlyRate(date: string, rules: RateRule[]): RateRule {
  const weekday = weekdaySundayZero(date);
  const applicable = rules
    .filter((rule) => {
      if (rule.startDate && date < rule.startDate) return false;
      if (rule.endDate && date > rule.endDate) return false;
      if (rule.weekdays && !rule.weekdays.includes(weekday)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
  const chosen = applicable[0];
  if (!chosen) {
    throw new Error(`No rate rule covers ${date}`);
  }
  return chosen;
}

export function quoteStay(input: {
  checkIn: string;
  checkOut: string;
  rateRules: RateRule[];
  taxes: TaxLine[];
  addOns: AddOn[];
  selectedAddOnIds?: string[];
  depositPercentBps?: number;
  now?: Date;
}): PriceSnapshot {
  const nights = eachDate(input.checkIn, input.checkOut).map((date) => {
    const rule = nightlyRate(date, input.rateRules);
    return { date, nightlyPaise: rule.nightlyPaise, rateLabel: rule.label };
  });
  const subtotalPaise = nights.reduce((sum, night) => sum + night.nightlyPaise, 0);
  const selected = (input.selectedAddOnIds ?? [])
    .map((id) => input.addOns.find((item) => item.id === id && item.offered))
    .filter((item): item is AddOn => Boolean(item));
  const nightCount = nights.length;
  const addOnLines = selected.map((item) => ({
    code: item.id,
    label: item.name,
    amountPaise: item.perNight ? item.amountPaise * nightCount : item.amountPaise,
  }));
  const addOnTotal = addOnLines.reduce((sum, line) => sum + line.amountPaise, 0);
  const taxable = subtotalPaise + addOnTotal;
  const taxLines = input.taxes
    .filter((tax) => tax.percentBps > 0)
    .map((tax) => ({
      code: tax.id,
      label: tax.name,
      amountPaise: Math.round((taxable * tax.percentBps) / 10_000),
    }));
  const taxTotal = taxLines.reduce((sum, line) => sum + line.amountPaise, 0);
  const totalPaise = taxable + taxTotal;
  const depositPercentBps = input.depositPercentBps ?? 10_000;
  const amountDueNowPaise = Math.round((totalPaise * depositPercentBps) / 10_000);
  const notes: string[] = [];
  if (input.rateRules.some((rule) => rule.awaitingOwnerApproval)) {
    notes.push("Displayed stay rates are development placeholders pending owner approval.");
  }
  if (input.taxes.some((tax) => tax.awaitingOwnerApproval)) {
    notes.push("Tax treatment is not published. Confirm classification with a qualified advisor before live charges.");
  }
  return {
    currency: CURRENCY,
    nights,
    subtotalPaise,
    addOns: addOnLines,
    taxes: taxLines,
    depositPaise: amountDueNowPaise,
    securityDepositPaise: 0,
    totalPaise,
    amountDueNowPaise,
    balanceDuePaise: totalPaise - amountDueNowPaise,
    notes,
    generatedAt: nowIso(input.now),
  };
}
