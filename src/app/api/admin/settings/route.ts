import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { getSiteSettings, setSiteSetting } from "@/lib/site-settings";

export async function GET() {
    if (!(await isAuthenticated())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getSiteSettings();
    return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
    if (!(await isAuthenticated())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { key, value } = body;

        if (!key || typeof value !== "string") {
            return NextResponse.json(
                { error: "key and value are required" },
                { status: 400 },
            );
        }

        const validKeys = [
            "site_title", "site_description", "hero_heading", "hero_subheading",
            "footer_text", "footer_copyright", "favicon_url", "banner_image_url", "shop_name",
            "theme_config", "owner_email", "default_address", "enable_recommendation_codes",
        ];

        if (!validKeys.includes(key)) {
            return NextResponse.json(
                { error: `Invalid setting key: ${key}` },
                { status: 400 },
            );
        }

        await setSiteSetting(key, value);
        revalidatePath("/", "layout");
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Failed to save setting" },
            { status: 500 },
        );
    }
}
