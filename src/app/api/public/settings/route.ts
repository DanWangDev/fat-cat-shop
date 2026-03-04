import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

export async function GET() {
    try {
        const settings = await getSiteSettings();

        let defaultAddress = null;
        try {
            defaultAddress = settings.default_address
                ? JSON.parse(settings.default_address)
                : null;
        } catch {
            defaultAddress = null;
        }

        return NextResponse.json({
            shopName: settings.shop_name,
            defaultAddress,
            enableRecommendationCodes: settings.enable_recommendation_codes === "true",
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to load settings" },
            { status: 500 },
        );
    }
}
