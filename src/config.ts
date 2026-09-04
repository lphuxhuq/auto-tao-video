import "dotenv/config";

export type TtsProvider = "edge-tts" | "lucylab" | "elevenlabs" | "vbee";
export type VideoTheme = "dark-neon" | "light-pro";

export interface TiktokConfig {
  displayName: string;
  handle: string;
  followers: string;
  /** URL to download avatar JPG. If undefined, the bundled `assets/avatar.jpg` is used. */
  avatarUrl?: string;
}

export interface WatermarkConfig {
  /** Master switch to enable/disable persistent watermark overlay. */
  enabled: boolean;
  /** Custom brand name (top-left). Defaults to script metadata channel or TIKTOK_DISPLAY_NAME */
  brandName?: string;
  /** Brand category/tag (top-left subtext). e.g. "TIN TỨC", "24H", "HOT". Default: "TIN TỨC" */
  brandTag?: string;
  /** Brand icon symbol. e.g. ">_", "⚡", "★". Default: ">_" */
  brandIcon?: string;
  /** Custom handle text (bottom-right). Defaults to TIKTOK_HANDLE */
  handle?: string;
  /** Show top-left brand header box. Default: true */
  showHeader: boolean;
  /** Show bottom-right handle pill. Default: true */
  showHandle: boolean;
  /** Show bottom-center domain pill (e.g. "thanhnien.vn"). Default: true */
  showDomain: boolean;
}

export interface OutroConfig {
  /** Master switch to enable/disable outro scene. Default: true */
  enabled: boolean;
  /** CTA text at top of outro (e.g. "Cập nhật tin mới mỗi ngày"). Defaults to script templateData.ctaTop */
  ctaTop?: string;
  /** Channel display name in outro. Defaults to TIKTOK_DISPLAY_NAME or script templateData.channelName */
  channelName?: string;
  /** Spoken voice callout for outro. If set, overrides the script outro voiceText. */
  voiceText?: string;
  /** Show the TikTok follow profile card sliding up. Default: true */
  showTiktokCard: boolean;
  /** Extra hold duration in seconds after voice ends. Default: 3 */
  holdSec: number;
}

export interface Config {
  ttsProvider: TtsProvider;

  // Edge TTS (Free, no API key required)
  edgeTtsVoice: string;
  edgeTtsRate: string;
  edgeTtsPitch: string;
  edgeTtsVolume: string;

  // LucyLab
  lucylabApiKey?: string;
  lucylabVoiceId?: string;
  lucylabEndpoint: string;
  lucylabPollIntervalMs: number;
  lucylabPollTimeoutMs: number;

  // ElevenLabs
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  elevenlabsModelId: string;
  elevenlabsEndpoint: string;

  // Vbee
  vbeeAppId?: string;
  vbeeAccessToken?: string;
  vbeeEndpoint: string;
  vbeeVoiceCode: string;
  vbeeSpeedRate: number;
  vbeePollIntervalMs: number;
  vbeePollTimeoutMs: number;

  // TikTok follow card (outro)
  tiktok: TiktokConfig;

  // Persistent watermark overlay
  watermark: WatermarkConfig;

  // Outro scene configuration
  outro: OutroConfig;

  ttsConcurrency: number;

  /** Visual template — selects which styles.<theme>.css file gets used. */
  videoTheme: VideoTheme;

  /** Persistent channel logo & handle watermark overlay. Default true unless disabled in env. */
  showWatermark: boolean;
}

function intDefault(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`Env var ${name} must be integer, got "${v}"`);
  return n;
}

function floatDefault(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseFloat(v);
  if (isNaN(n)) throw new Error(`Env var ${name} must be a number, got "${v}"`);
  return n;
}

export function loadConfig(): Config {
  const rawProvider = (process.env.TTS_PROVIDER ?? "edge-tts").trim().toLowerCase();
  const provider = (rawProvider === "edgetts" ? "edge-tts" : rawProvider) as TtsProvider;

  if (
    provider !== "edge-tts" &&
    provider !== "lucylab" &&
    provider !== "elevenlabs" &&
    provider !== "vbee"
  ) {
    throw new Error(
      `TTS_PROVIDER must be "edge-tts", "lucylab", "elevenlabs" or "vbee", got "${rawProvider}"`
    );
  }

  // Validate provider-specific required vars
  if (provider === "lucylab") {
    if (!process.env.VIETNAMESE_API_KEY || process.env.VIETNAMESE_API_KEY.trim() === "") {
      throw new Error(
        `Missing VIETNAMESE_API_KEY (required when TTS_PROVIDER=lucylab). ` +
        `Copy .env.example to .env.local and fill in your LucyLab API key.`
      );
    }
    if (!process.env.VIETNAMESE_VOICEID || process.env.VIETNAMESE_VOICEID.trim() === "") {
      throw new Error(
        `Missing VIETNAMESE_VOICEID (required when TTS_PROVIDER=lucylab). ` +
        `Copy .env.example to .env.local and fill in your LucyLab voice ID.`
      );
    }
  } else if (provider === "elevenlabs") {
    if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.trim() === "") {
      throw new Error(
        `Missing ELEVENLABS_API_KEY (required when TTS_PROVIDER=elevenlabs). ` +
        `Copy .env.example to .env.local and fill in your ElevenLabs API key.`
      );
    }
    if (!process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID.trim() === "") {
      throw new Error(
        `Missing ELEVENLABS_VOICE_ID (required when TTS_PROVIDER=elevenlabs). ` +
        `Copy .env.example to .env.local and fill in your ElevenLabs voice ID.`
      );
    }
  } else if (provider === "vbee") {
    if (!process.env.VBEE_APP_ID || process.env.VBEE_APP_ID.trim() === "") {
      throw new Error(
        `Missing VBEE_APP_ID (required when TTS_PROVIDER=vbee). ` +
        `Copy .env.example to .env.local and fill in your Vbee app ID.`
      );
    }
    if (!process.env.VBEE_ACCESS_TOKEN || process.env.VBEE_ACCESS_TOKEN.trim() === "") {
      throw new Error(
        `Missing VBEE_ACCESS_TOKEN (required when TTS_PROVIDER=vbee). ` +
        `Copy .env.example to .env.local and fill in your Vbee access token.`
      );
    }
  }

  const videoTheme = (process.env.VIDEO_THEME ?? "dark-neon") as VideoTheme;
  if (videoTheme !== "dark-neon" && videoTheme !== "light-pro") {
    throw new Error(`VIDEO_THEME must be "dark-neon" or "light-pro", got "${videoTheme}"`);
  }

    const watermarkEnabled =
      process.env.SHOW_WATERMARK !== "false" &&
      process.env.WATERMARK !== "false" &&
      process.env.ENABLE_WATERMARK !== "false";

    return {
      ttsProvider: provider,
      edgeTtsVoice: process.env.EDGE_TTS_VOICE ?? "vi-VN-HoaiMyNeural",
      edgeTtsRate: process.env.EDGE_TTS_RATE ?? "+0%",
      edgeTtsPitch: process.env.EDGE_TTS_PITCH ?? "+0Hz",
      edgeTtsVolume: process.env.EDGE_TTS_VOLUME ?? "+0%",
      lucylabApiKey: process.env.VIETNAMESE_API_KEY,
      lucylabVoiceId: process.env.VIETNAMESE_VOICEID,
      lucylabEndpoint: process.env.LUCYLAB_ENDPOINT ?? "https://api.lucylab.io/json-rpc",
      lucylabPollIntervalMs: intDefault("LUCYLAB_POLL_INTERVAL_MS", 2000),
      lucylabPollTimeoutMs: intDefault("LUCYLAB_POLL_TIMEOUT_MS", 120000),
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
      elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
      elevenlabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
      elevenlabsEndpoint: process.env.ELEVENLABS_ENDPOINT ?? "https://api.elevenlabs.io/v1",
      vbeeAppId: process.env.VBEE_APP_ID,
      vbeeAccessToken: process.env.VBEE_ACCESS_TOKEN,
      vbeeEndpoint: process.env.VBEE_ENDPOINT ?? "https://vbee.vn/api/v1",
      vbeeVoiceCode: process.env.VBEE_VOICE_CODE ?? "n_hanoi_male_protrainer_education_vc",
      vbeeSpeedRate: floatDefault("VBEE_SPEED_RATE", 1.0),
      vbeePollIntervalMs: intDefault("VBEE_POLL_INTERVAL_MS", 2000),
      vbeePollTimeoutMs: intDefault("VBEE_POLL_TIMEOUT_MS", 60000),
      tiktok: {
        displayName: process.env.TIKTOK_DISPLAY_NAME ?? "Công nghệ 24h",
        handle: process.env.TIKTOK_HANDLE ?? "@congnghe24h",
        followers: process.env.TIKTOK_FOLLOWERS ?? "1.2M followers",
        avatarUrl: process.env.TIKTOK_AVATAR_URL || undefined,
      },
      watermark: {
        enabled: watermarkEnabled,
        brandName: process.env.WATERMARK_BRAND_NAME?.trim() || undefined,
        brandTag: process.env.WATERMARK_BRAND_TAG?.trim() || "TIN TỨC",
        brandIcon: process.env.WATERMARK_BRAND_ICON?.trim() || ">_",
        handle: process.env.WATERMARK_HANDLE?.trim() || undefined,
        showHeader: process.env.WATERMARK_SHOW_HEADER !== "false",
        showHandle: process.env.WATERMARK_SHOW_HANDLE !== "false",
        showDomain: process.env.WATERMARK_SHOW_DOMAIN !== "false",
      },
      outro: {
        enabled:
          process.env.SHOW_OUTRO !== "false" &&
          process.env.ENABLE_OUTRO !== "false" &&
          process.env.OUTRO_ENABLED !== "false",
        ctaTop: process.env.OUTRO_CTA_TOP?.trim() || undefined,
        channelName: process.env.OUTRO_CHANNEL_NAME?.trim() || undefined,
        voiceText: process.env.OUTRO_VOICE_TEXT?.trim() || undefined,
        showTiktokCard: process.env.OUTRO_SHOW_TIKTOK_CARD !== "false",
        holdSec: floatDefault("OUTRO_HOLD_SEC", 3),
      },
      ttsConcurrency: intDefault("TTS_CONCURRENCY", 1),
      videoTheme,
      showWatermark: watermarkEnabled,
    };
}
