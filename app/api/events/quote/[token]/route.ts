import { getQuoteByAccessToken } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { formatDisplayDate } from "@/lib/time/kolkata";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const result = await getQuoteByAccessToken(token);
    if (!result) return json({ error: "Quotation not found." }, 404);
    const { quote, enquiry } = result;
    return json({
      quote: {
        version: quote.version,
        status: quote.status,
        overnightRoomsIncluded: quote.overnightRoomsIncluded,
        overnightRoomsStatement: quote.overnightRoomsStatement,
        inclusions: quote.inclusions,
        exclusions: quote.exclusions,
        lines: quote.lines,
        depositPaise: quote.depositPaise,
        balancePaise: quote.balancePaise,
        securityDepositPaise: quote.securityDepositPaise,
        totalPaise: quote.totalPaise,
        cancellationTerms: quote.cancellationTerms,
        expiresAt: quote.expiresAt,
        policySnapshot: quote.policySnapshot,
      },
      enquiry: {
        id: enquiry.id,
        reference: enquiry.reference,
        customerAccessToken: enquiry.customerAccessToken,
        eventType: enquiry.eventType,
        startDate: enquiry.startDate,
        endDate: enquiry.endDate,
        startLabel: formatDisplayDate(enquiry.startDate),
        endLabel: formatDisplayDate(enquiry.endDate),
        expectedAttendance: enquiry.expectedAttendance,
        status: enquiry.status,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
