import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

const SYSTEM_PROMPT = `You are a color palette designer for an e-commerce storefront. Given either a text description or reference image, generate a cohesive color palette mapped to the following CSS token names.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with these exact keys:

{
  "comic-red": "#hex",       // Primary action color (buttons, CTAs)
  "comic-red-dark": "#hex",  // Darker variant of primary
  "comic-cyan": "#hex",      // Secondary color (footer, badges)
  "comic-cyan-dark": "#hex", // Darker variant of secondary
  "comic-yellow": "#hex",    // Accent color (header background, price tags)
  "comic-yellow-dark": "#hex", // Darker variant of accent
  "comic-blue": "#hex",      // Supporting color
  "comic-pink": "#hex",      // Supporting highlight
  "comic-ink": "#hex",       // Main text and borders
  "comic-paper": "#hex",     // Page background
  "comic-panel": "#hex",     // Card/panel background
  "comic-muted": "#hex",     // Muted/secondary text
  "comic-light-gray": "#hex", // Light background areas
  "comic-error": "#hex",     // Error states
  "comic-on-primary": "#hex",    // Text color on primary bg
  "comic-on-secondary": "#hex",  // Text color on secondary bg
  "comic-on-accent": "#hex"      // Text color on accent bg
}

Rules:
- All values must be valid 6-digit hex colors with # prefix
- Ensure WCAG AA contrast (4.5:1 minimum) between:
  - comic-on-primary and comic-red
  - comic-on-secondary and comic-cyan
  - comic-on-accent and comic-yellow
  - comic-ink and comic-paper
- The palette should feel cohesive and professional
- comic-paper should be a light/subtle background color
- comic-ink should be dark enough for readable body text`;

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI generation not configured. Set ANTHROPIC_API_KEY environment variable." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const { mode, prompt, image } = body;

    if (mode !== "text" && mode !== "image") {
      return NextResponse.json({ error: "mode must be 'text' or 'image'" }, { status: 400 });
    }

    if (mode === "text" && !prompt) {
      return NextResponse.json({ error: "prompt is required for text mode" }, { status: 400 });
    }

    if (mode === "image" && !image) {
      return NextResponse.json({ error: "image is required for image mode" }, { status: 400 });
    }

    const content = mode === "text"
      ? [{ type: "text" as const, text: `Generate a color palette for a storefront described as: "${prompt}"` }]
      : [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: "image/jpeg" as const,
              data: image,
            },
          },
          {
            type: "text" as const,
            text: "Analyze this image and extract its aesthetic intent, mood, and color story. Generate a cohesive storefront color palette inspired by this image.",
          },
        ];

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!claudeRes.ok) {
      const errData = await claudeRes.json().catch(() => ({}));
      const errMsg = (errData as Record<string, unknown>)?.error ?? "Claude API error";
      return NextResponse.json(
        { error: `AI generation failed: ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)}` },
        { status: 502 },
      );
    }

    const claudeData = await claudeRes.json();
    const textBlock = claudeData.content?.find(
      (b: { type: string }) => b.type === "text",
    );

    if (!textBlock?.text) {
      return NextResponse.json({ error: "No response from AI" }, { status: 502 });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 502 });
    }

    const colors = JSON.parse(jsonMatch[0]);

    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const requiredKeys = [
      "comic-red", "comic-cyan", "comic-yellow", "comic-ink",
      "comic-paper", "comic-on-primary", "comic-on-secondary", "comic-on-accent",
    ];

    for (const key of requiredKeys) {
      if (!colors[key] || !hexPattern.test(colors[key])) {
        return NextResponse.json(
          { error: `Invalid or missing color for ${key}` },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ colors });
  } catch (err) {
    console.error("AI theme generation error:", err);
    return NextResponse.json(
      { error: "Theme generation failed. Please try again." },
      { status: 500 },
    );
  }
}
