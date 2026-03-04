import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recommendationCodes, recommendationCodeUses, orders, customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
    try {
        const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
        const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

        if (!code) {
            return NextResponse.json({ valid: false, error: "Code is required" });
        }

        const recCode = db
            .select()
            .from(recommendationCodes)
            .where(eq(recommendationCodes.code, code))
            .get();

        if (!recCode) {
            return NextResponse.json({ valid: false, error: "Invalid recommendation code" });
        }

        // Check if the person trying to use it is the same person who generated it
        if (email && recCode.customerEmail === email) {
            return NextResponse.json({ valid: false, error: "You cannot use your own recommendation code" });
        }

        // Check if this email has already placed an order (first-time buyer check)
        if (email) {
            const existingCustomer = db
                .select({ id: customers.id })
                .from(customers)
                .where(eq(customers.email, email))
                .get();

            if (existingCustomer) {
                const existingOrder = db
                    .select({ id: orders.id })
                    .from(orders)
                    .where(eq(orders.customerId, existingCustomer.id))
                    .get();

                if (existingOrder) {
                    return NextResponse.json({ valid: false, error: "Recommendation codes are for first-time buyers only" });
                }
            }
        }

        // Check if this email has already used any recommendation code
        if (email) {
            const alreadyUsed = db
                .select()
                .from(recommendationCodeUses)
                .where(eq(recommendationCodeUses.usedByEmail, email))
                .get();

            if (alreadyUsed) {
                return NextResponse.json({ valid: false, error: "You have already used a recommendation code" });
            }
        }

        return NextResponse.json({ valid: true, code: recCode.code });
    } catch {
        return NextResponse.json(
            { valid: false, error: "Could not validate code" },
            { status: 500 },
        );
    }
}
