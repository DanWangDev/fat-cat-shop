import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface SiteSettingsMap {
    site_title: string;
    site_description: string;
    hero_heading: string;
    hero_subheading: string;
    footer_text: string;
    footer_copyright: string;
    favicon_url: string;
    banner_image_url: string;
    shop_name: string;
    theme_config: string;
    owner_email: string;
    default_address: string;
    enable_recommendation_codes: string;
}

const DEFAULTS: SiteSettingsMap = {
    site_title: "Fat Cat Shop",
    site_description: "Your one-stop shop for happy cats. Premium toys, treats, and accessories for your feline friends.",
    hero_heading: "Everything Your Cat Needs",
    hero_subheading: "Premium toys, treats, and accessories curated for your feline friends. Because happy cats make happy homes.",
    footer_text: "Your one-stop shop for happy cats.",
    footer_copyright: "Fat Cat Shop",
    favicon_url: "",
    banner_image_url: "",
    shop_name: "Fat Cat",
    theme_config: "",
    owner_email: "grace.by.wang@gmail.com",
    default_address: '{"addressLine1":"Brook Grn","city":"London","postalCode":"W6 7BS","country":"United Kingdom"}',
    enable_recommendation_codes: "false",
};

export async function getSiteSettings(): Promise<SiteSettingsMap> {
    try {
        const rows = await db.select().from(siteSettings);
        const map: Record<string, string> = {};
        for (const row of rows) {
            map[row.key] = row.value;
        }
        return { ...DEFAULTS, ...map } as SiteSettingsMap;
    } catch {
        // Table might not exist yet during build
        return { ...DEFAULTS };
    }
}

export async function setSiteSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    if (existing.length > 0) {
        db.update(siteSettings)
            .set({ value, updatedAt: now })
            .where(eq(siteSettings.key, key))
            .run();
    } else {
        db.insert(siteSettings)
            .values({ key, value, updatedAt: now })
            .run();
    }
}

export function getSettingDefaults(): SiteSettingsMap {
    return { ...DEFAULTS };
}
