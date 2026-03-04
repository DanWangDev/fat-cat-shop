"use client";

import { useState, useEffect, useRef } from "react";

interface Settings {
    site_title: string;
    site_description: string;
    hero_heading: string;
    hero_subheading: string;
    footer_text: string;
    footer_copyright: string;
    favicon_url: string;
    banner_image_url: string;
    shop_name: string;
    owner_email: string;
    default_address: string;
    enable_recommendation_codes: string;
}

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/settings")
            .then((r) => r.json())
            .then(setSettings)
            .catch(() => setError("Failed to load settings"));
    }, []);

    async function saveSetting(key: string, value: string) {
        setSaving(key);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "Failed to save");
            }
            setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
            setSuccess(key);
            setTimeout(() => setSuccess(null), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(null);
        }
    }

    async function handleImageUpload(key: string, file: File) {
        setUploading(key);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            if (!uploadRes.ok) {
                const data = await uploadRes.json();
                throw new Error(data.error ?? "Upload failed");
            }
            const { url } = await uploadRes.json();
            await saveSetting(key, url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(null);
        }
    }

    if (!settings) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-warm-brown/50">Loading settings...</p>
            </div>
        );
    }

    return (
        <div>
            <h1 className="font-display text-2xl font-bold text-warm-brown">
                Store Settings
            </h1>
            <p className="mt-1 text-sm text-warm-brown/60">
                Customize your store&apos;s branding, content, and appearance.
            </p>

            {error && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Branding Section */}
            <section className="mt-8">
                <h2 className="font-display text-lg font-bold text-warm-brown">
                    Branding
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ImageUploadCard
                        title="Favicon"
                        description="PNG, SVG, or ICO — any size"
                        currentUrl={settings.favicon_url}
                        settingKey="favicon_url"
                        uploading={uploading === "favicon_url"}
                        onUpload={handleImageUpload}
                        onClear={() => saveSetting("favicon_url", "")}
                    />
                    <ImageUploadCard
                        title="Hero Banner Image"
                        description="Homepage hero background image (recommended: 1920×600)"
                        currentUrl={settings.banner_image_url}
                        settingKey="banner_image_url"
                        uploading={uploading === "banner_image_url"}
                        onUpload={handleImageUpload}
                        onClear={() => saveSetting("banner_image_url", "")}
                    />
                </div>
            </section>

            {/* Content Section */}
            <section className="mt-10">
                <h2 className="font-display text-lg font-bold text-warm-brown">
                    Content
                </h2>
                <div className="mt-4 space-y-4">
                    <TextSettingRow
                        label="Shop Name"
                        description="Shown in header and footer"
                        settingKey="shop_name"
                        value={settings.shop_name}
                        saving={saving === "shop_name"}
                        saved={success === "shop_name"}
                        onSave={saveSetting}
                    />
                    <TextSettingRow
                        label="Browser Tab Title"
                        description="Appears in browser tabs and search results (max 60 chars)"
                        settingKey="site_title"
                        value={settings.site_title}
                        maxLength={60}
                        saving={saving === "site_title"}
                        saved={success === "site_title"}
                        onSave={saveSetting}
                    />
                    <TextSettingRow
                        label="Site Description"
                        description="Shown in search engine results (max 160 chars)"
                        settingKey="site_description"
                        value={settings.site_description}
                        maxLength={160}
                        saving={saving === "site_description"}
                        saved={success === "site_description"}
                        onSave={saveSetting}
                    />
                    <TextSettingRow
                        label="Hero Heading"
                        description="Large heading text on the homepage banner"
                        settingKey="hero_heading"
                        value={settings.hero_heading}
                        saving={saving === "hero_heading"}
                        saved={success === "hero_heading"}
                        onSave={saveSetting}
                    />
                    <TextSettingRow
                        label="Hero Subheading"
                        description="Supporting text below the hero heading"
                        settingKey="hero_subheading"
                        value={settings.hero_subheading}
                        saving={saving === "hero_subheading"}
                        saved={success === "hero_subheading"}
                        onSave={saveSetting}
                    />
                    <TextSettingRow
                        label="Footer Tagline"
                        description="Short text displayed in the site footer"
                        settingKey="footer_text"
                        value={settings.footer_text}
                        saving={saving === "footer_text"}
                        saved={success === "footer_text"}
                        onSave={saveSetting}
                    />
                    <TextSettingRow
                        label="Footer Copyright Name"
                        description="Name shown in the © copyright line"
                        settingKey="footer_copyright"
                        value={settings.footer_copyright}
                        saving={saving === "footer_copyright"}
                        saved={success === "footer_copyright"}
                        onSave={saveSetting}
                    />
                </div>
            </section>

            {/* Notifications Section */}
            <section className="mt-10">
                <h2 className="font-display text-lg font-bold text-warm-brown">
                    Notifications
                </h2>
                <div className="mt-4 space-y-4">
                    <TextSettingRow
                        label="Owner Notification Email"
                        description="Email address that receives new order notifications"
                        settingKey="owner_email"
                        value={settings.owner_email}
                        saving={saving === "owner_email"}
                        saved={success === "owner_email"}
                        onSave={saveSetting}
                    />
                </div>
            </section>

            {/* Default Address Section */}
            <section className="mt-10">
                <h2 className="font-display text-lg font-bold text-warm-brown">
                    Default Shipping Address
                </h2>
                <p className="mt-1 text-xs text-warm-brown/50">
                    Pre-filled for customers at checkout. They can still edit it.
                </p>
                <DefaultAddressEditor
                    value={settings.default_address}
                    saving={saving === "default_address"}
                    saved={success === "default_address"}
                    onSave={(json) => saveSetting("default_address", json)}
                />
            </section>

            {/* Features Section */}
            <section className="mt-10">
                <h2 className="font-display text-lg font-bold text-warm-brown">
                    Features
                </h2>
                <div className="mt-4 space-y-4">
                    <ToggleSettingRow
                        label="Recommendation Codes"
                        description="Generate a shareable recommendation code for each order. New customers can enter a code at checkout."
                        enabled={settings.enable_recommendation_codes === "true"}
                        saving={saving === "enable_recommendation_codes"}
                        onToggle={(on) => saveSetting("enable_recommendation_codes", on ? "true" : "false")}
                    />
                </div>
            </section>
        </div>
    );
}

function TextSettingRow({
    label,
    description,
    settingKey,
    value,
    maxLength,
    saving,
    saved,
    onSave,
}: {
    label: string;
    description: string;
    settingKey: string;
    value: string;
    maxLength?: number;
    saving: boolean;
    saved: boolean;
    onSave: (key: string, value: string) => void;
}) {
    const [draft, setDraft] = useState(value);
    const isDirty = draft !== value;

    useEffect(() => {
        setDraft(value);
    }, [value]);

    return (
        <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <label className="text-sm font-medium text-warm-brown">
                        {label}
                    </label>
                    <p className="text-xs text-warm-brown/50">{description}</p>
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={maxLength}
                        className="mt-2 w-full rounded-lg border border-warm-brown/20 px-4 py-2 text-sm text-warm-brown outline-none transition-colors focus:border-teal-primary"
                    />
                    {maxLength && (
                        <p className="mt-1 text-right text-xs text-warm-brown/40">
                            {draft.length}/{maxLength}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => onSave(settingKey, draft)}
                    disabled={saving || !isDirty}
                    className="mt-6 shrink-0 rounded-full bg-teal-primary px-5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
                >
                    {saving ? "Saving..." : saved ? "✓ Saved" : "Save"}
                </button>
            </div>
        </div>
    );
}

function ImageUploadCard({
    title,
    description,
    currentUrl,
    settingKey,
    uploading,
    onUpload,
    onClear,
}: {
    title: string;
    description: string;
    currentUrl: string;
    settingKey: string;
    uploading: boolean;
    onUpload: (key: string, file: File) => void;
    onClear: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            onUpload(settingKey, file);
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(settingKey, file);
        }
    }

    return (
        <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-medium text-warm-brown">{title}</h3>
            <p className="text-xs text-warm-brown/50">{description}</p>

            {currentUrl ? (
                <div className="mt-3">
                    <div className="relative overflow-hidden rounded-lg border border-warm-brown/10 bg-warm-gray">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={currentUrl}
                            alt={title}
                            className="mx-auto max-h-40 object-contain p-2"
                        />
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={() => inputRef.current?.click()}
                            disabled={uploading}
                            className="rounded-full bg-teal-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
                        >
                            {uploading ? "Uploading..." : "Replace"}
                        </button>
                        <button
                            onClick={onClear}
                            className="rounded-full border border-warm-brown/20 px-4 py-1.5 text-xs font-medium text-warm-brown/60 transition-colors hover:border-red-300 hover:text-red-500"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => inputRef.current?.click()}
                    className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-warm-brown/20 bg-warm-gray/30 px-4 py-8 transition-colors hover:border-teal-primary/50 hover:bg-teal-primary/5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-warm-brown/30">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="mt-2 text-xs text-warm-brown/50">
                        {uploading ? "Uploading..." : "Click or drag to upload"}
                    </p>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    );
}

function DefaultAddressEditor({
    value,
    saving,
    saved,
    onSave,
}: {
    value: string;
    saving: boolean;
    saved: boolean;
    onSave: (json: string) => void;
}) {
    const parsed = (() => {
        try {
            return JSON.parse(value);
        } catch {
            return { addressLine1: "", city: "", postalCode: "", country: "" };
        }
    })();

    const [addressLine1, setAddressLine1] = useState<string>(parsed.addressLine1 ?? "");
    const [city, setCity] = useState<string>(parsed.city ?? "");
    const [postalCode, setPostalCode] = useState<string>(parsed.postalCode ?? "");
    const [country, setCountry] = useState<string>(parsed.country ?? "");

    const currentJson = JSON.stringify({ addressLine1, city, postalCode, country });
    const isDirty = currentJson !== value;

    function handleSave() {
        onSave(currentJson);
    }

    return (
        <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="text-sm font-medium text-warm-brown">Address Line 1</label>
                    <input
                        type="text"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-warm-brown/20 px-4 py-2 text-sm text-warm-brown outline-none transition-colors focus:border-teal-primary"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-warm-brown">City</label>
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-warm-brown/20 px-4 py-2 text-sm text-warm-brown outline-none transition-colors focus:border-teal-primary"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-warm-brown">Postcode</label>
                    <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-warm-brown/20 px-4 py-2 text-sm text-warm-brown outline-none transition-colors focus:border-teal-primary"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-warm-brown">Country</label>
                    <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-warm-brown/20 px-4 py-2 text-sm text-warm-brown outline-none transition-colors focus:border-teal-primary"
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="rounded-full bg-teal-primary px-5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
                >
                    {saving ? "Saving..." : saved ? "Saved" : "Save Address"}
                </button>
            </div>
        </div>
    );
}

function ToggleSettingRow({
    label,
    description,
    enabled,
    saving,
    onToggle,
}: {
    label: string;
    description: string;
    enabled: boolean;
    saving: boolean;
    onToggle: (on: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm">
            <div>
                <p className="text-sm font-medium text-warm-brown">{label}</p>
                <p className="text-xs text-warm-brown/50">{description}</p>
            </div>
            <button
                type="button"
                onClick={() => onToggle(!enabled)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                    enabled ? "bg-teal-primary" : "bg-warm-brown/20"
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                />
            </button>
        </div>
    );
}
