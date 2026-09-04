import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

const ENV_KEYS = [
  "TTS_PROVIDER",
  "EDGE_TTS_VOICE",
  "EDGE_TTS_RATE",
  "EDGE_TTS_PITCH",
  "EDGE_TTS_VOLUME",
  "VIETNAMESE_API_KEY",
  "VIETNAMESE_VOICEID",
  "LUCYLAB_ENDPOINT",
  "LUCYLAB_POLL_INTERVAL_MS",
  "LUCYLAB_POLL_TIMEOUT_MS",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_MODEL_ID",
  "ELEVENLABS_ENDPOINT",
  "VBEE_APP_ID",
  "VBEE_ACCESS_TOKEN",
  "VBEE_ENDPOINT",
  "VBEE_VOICE_CODE",
  "VBEE_SPEED_RATE",
  "VBEE_POLL_INTERVAL_MS",
  "VBEE_POLL_TIMEOUT_MS",
  "TTS_CONCURRENCY",
  "SHOW_WATERMARK",
  "WATERMARK",
  "WATERMARK_BRAND_NAME",
  "WATERMARK_BRAND_TAG",
  "WATERMARK_BRAND_ICON",
  "WATERMARK_HANDLE",
  "WATERMARK_SHOW_HEADER",
  "WATERMARK_SHOW_HANDLE",
  "WATERMARK_SHOW_DOMAIN",
  "SHOW_OUTRO",
  "ENABLE_OUTRO",
  "OUTRO_ENABLED",
  "OUTRO_CTA_TOP",
  "OUTRO_CHANNEL_NAME",
  "OUTRO_VOICE_TEXT",
  "OUTRO_SHOW_TIKTOK_CARD",
  "OUTRO_HOLD_SEC",
];

describe("loadConfig", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  describe("Edge TTS provider (default)", () => {
    it("reads Edge TTS defaults when no provider specified", () => {
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("edge-tts");
      expect(cfg.edgeTtsVoice).toBe("vi-VN-HoaiMyNeural");
      expect(cfg.edgeTtsRate).toBe("+0%");
      expect(cfg.edgeTtsPitch).toBe("+0Hz");
      expect(cfg.edgeTtsVolume).toBe("+0%");
      expect(cfg.ttsConcurrency).toBe(1);
    });

    it("respects EDGE_TTS overrides", () => {
      process.env.TTS_PROVIDER = "edge-tts";
      process.env.EDGE_TTS_VOICE = "vi-VN-NamMinhNeural";
      process.env.EDGE_TTS_RATE = "+10%";
      process.env.EDGE_TTS_PITCH = "+5Hz";
      process.env.EDGE_TTS_VOLUME = "-10%";
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("edge-tts");
      expect(cfg.edgeTtsVoice).toBe("vi-VN-NamMinhNeural");
      expect(cfg.edgeTtsRate).toBe("+10%");
      expect(cfg.edgeTtsPitch).toBe("+5Hz");
      expect(cfg.edgeTtsVolume).toBe("-10%");
    });

    it("accepts 'edgetts' as alias for 'edge-tts'", () => {
      process.env.TTS_PROVIDER = "edgetts";
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("edge-tts");
    });
  });

  describe("LucyLab provider", () => {
    it("reads LucyLab env vars when TTS_PROVIDER=lucylab", () => {
      process.env.TTS_PROVIDER = "lucylab";
      process.env.VIETNAMESE_API_KEY = "sk_test_abc";
      process.env.VIETNAMESE_VOICEID = "voice123";
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("lucylab");
      expect(cfg.lucylabApiKey).toBe("sk_test_abc");
      expect(cfg.lucylabVoiceId).toBe("voice123");
    });

    it("throws when VIETNAMESE_API_KEY missing", () => {
      process.env.TTS_PROVIDER = "lucylab";
      process.env.VIETNAMESE_VOICEID = "voice123";
      expect(() => loadConfig()).toThrow(/VIETNAMESE_API_KEY/);
    });

    it("uses sensible defaults for optional vars", () => {
      process.env.TTS_PROVIDER = "lucylab";
      process.env.VIETNAMESE_API_KEY = "k";
      process.env.VIETNAMESE_VOICEID = "v";
      const cfg = loadConfig();
      expect(cfg.lucylabEndpoint).toBe("https://api.lucylab.io/json-rpc");
      expect(cfg.lucylabPollIntervalMs).toBe(2000);
      expect(cfg.lucylabPollTimeoutMs).toBe(120000);
      expect(cfg.ttsConcurrency).toBe(1);
    });
  });

  describe("ElevenLabs provider", () => {
    it("reads ElevenLabs env vars when TTS_PROVIDER=elevenlabs", () => {
      process.env.TTS_PROVIDER = "elevenlabs";
      process.env.ELEVENLABS_API_KEY = "sk_eleven_xyz";
      process.env.ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("elevenlabs");
      expect(cfg.elevenlabsApiKey).toBe("sk_eleven_xyz");
      expect(cfg.elevenlabsVoiceId).toBe("EXAVITQu4vr4xnSDxMaL");
      expect(cfg.elevenlabsModelId).toBe("eleven_multilingual_v2");
      expect(cfg.elevenlabsEndpoint).toBe("https://api.elevenlabs.io/v1");
    });

    it("throws when ELEVENLABS_API_KEY missing", () => {
      process.env.TTS_PROVIDER = "elevenlabs";
      process.env.ELEVENLABS_VOICE_ID = "v";
      expect(() => loadConfig()).toThrow(/ELEVENLABS_API_KEY/);
    });

    it("respects ELEVENLABS_MODEL_ID override", () => {
      process.env.TTS_PROVIDER = "elevenlabs";
      process.env.ELEVENLABS_API_KEY = "k";
      process.env.ELEVENLABS_VOICE_ID = "v";
      process.env.ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";
      const cfg = loadConfig();
      expect(cfg.elevenlabsModelId).toBe("eleven_turbo_v2_5");
    });
  });

  describe("Vbee provider", () => {
    it("reads Vbee env vars when TTS_PROVIDER=vbee", () => {
      process.env.TTS_PROVIDER = "vbee";
      process.env.VBEE_APP_ID = "app-1";
      process.env.VBEE_ACCESS_TOKEN = "token-abc";
      const cfg = loadConfig();
      expect(cfg.ttsProvider).toBe("vbee");
      expect(cfg.vbeeAppId).toBe("app-1");
      expect(cfg.vbeeAccessToken).toBe("token-abc");
      expect(cfg.vbeeEndpoint).toBe("https://vbee.vn/api/v1");
      expect(cfg.vbeeVoiceCode).toBe("n_hanoi_male_protrainer_education_vc");
      expect(cfg.vbeeSpeedRate).toBe(1.0);
      expect(cfg.vbeePollIntervalMs).toBe(2000);
      expect(cfg.vbeePollTimeoutMs).toBe(60000);
    });

    it("throws when VBEE_APP_ID missing", () => {
      process.env.TTS_PROVIDER = "vbee";
      process.env.VBEE_ACCESS_TOKEN = "token-abc";
      expect(() => loadConfig()).toThrow(/VBEE_APP_ID/);
    });

    it("throws when VBEE_ACCESS_TOKEN missing", () => {
      process.env.TTS_PROVIDER = "vbee";
      process.env.VBEE_APP_ID = "app-1";
      expect(() => loadConfig()).toThrow(/VBEE_ACCESS_TOKEN/);
    });

    it("respects VBEE_VOICE_CODE and VBEE_SPEED_RATE overrides", () => {
      process.env.TTS_PROVIDER = "vbee";
      process.env.VBEE_APP_ID = "app-1";
      process.env.VBEE_ACCESS_TOKEN = "token-abc";
      process.env.VBEE_VOICE_CODE = "n_hanoi_female_nguyetnga2_book_vc";
      process.env.VBEE_SPEED_RATE = "1.2";
      const cfg = loadConfig();
      expect(cfg.vbeeVoiceCode).toBe("n_hanoi_female_nguyetnga2_book_vc");
      expect(cfg.vbeeSpeedRate).toBe(1.2);
    });
  });

  describe("Watermark configuration", () => {
    it("defaults to enabled with standard defaults", () => {
      const cfg = loadConfig();
      expect(cfg.watermark.enabled).toBe(true);
      expect(cfg.watermark.brandTag).toBe("TIN TỨC");
      expect(cfg.watermark.brandIcon).toBe(">_");
      expect(cfg.watermark.showHeader).toBe(true);
      expect(cfg.watermark.showHandle).toBe(true);
      expect(cfg.watermark.showDomain).toBe(true);
    });

    it("respects SHOW_WATERMARK=false", () => {
      process.env.SHOW_WATERMARK = "false";
      const cfg = loadConfig();
      expect(cfg.watermark.enabled).toBe(false);
      expect(cfg.showWatermark).toBe(false);
    });

    it("reads custom watermark branding from env", () => {
      process.env.SHOW_WATERMARK = "true";
      process.env.WATERMARK_BRAND_NAME = "Kênh Tin Nhanh";
      process.env.WATERMARK_BRAND_TAG = "HOT NEWS";
      process.env.WATERMARK_BRAND_ICON = "⚡";
      process.env.WATERMARK_HANDLE = "@tinnhanh60s";
      process.env.WATERMARK_SHOW_HEADER = "true";
      process.env.WATERMARK_SHOW_HANDLE = "false";
      process.env.WATERMARK_SHOW_DOMAIN = "false";
      const cfg = loadConfig();
      expect(cfg.watermark.enabled).toBe(true);
      expect(cfg.watermark.brandName).toBe("Kênh Tin Nhanh");
      expect(cfg.watermark.brandTag).toBe("HOT NEWS");
      expect(cfg.watermark.brandIcon).toBe("⚡");
      expect(cfg.watermark.handle).toBe("@tinnhanh60s");
      expect(cfg.watermark.showHeader).toBe(true);
      expect(cfg.watermark.showHandle).toBe(false);
      expect(cfg.watermark.showDomain).toBe(false);
    });
  });

  describe("Outro configuration", () => {
    it("defaults to enabled with standard defaults", () => {
      const cfg = loadConfig();
      expect(cfg.outro.enabled).toBe(true);
      expect(cfg.outro.ctaTop).toBeUndefined();
      expect(cfg.outro.channelName).toBeUndefined();
      expect(cfg.outro.voiceText).toBeUndefined();
      expect(cfg.outro.showTiktokCard).toBe(true);
      expect(cfg.outro.holdSec).toBe(3);
    });

    it("respects SHOW_OUTRO=false", () => {
      process.env.SHOW_OUTRO = "false";
      const cfg = loadConfig();
      expect(cfg.outro.enabled).toBe(false);
    });

    it("respects ENABLE_OUTRO=false and OUTRO_ENABLED=false", () => {
      process.env.ENABLE_OUTRO = "false";
      expect(loadConfig().outro.enabled).toBe(false);

      delete process.env.ENABLE_OUTRO;
      process.env.OUTRO_ENABLED = "false";
      expect(loadConfig().outro.enabled).toBe(false);
    });

    it("reads custom outro options from env", () => {
      process.env.SHOW_OUTRO = "true";
      process.env.OUTRO_CTA_TOP = "THEO DÕI ĐỂ KHÔNG BỎ LỠ";
      process.env.OUTRO_CHANNEL_NAME = "Tin Tức 24h";
      process.env.OUTRO_VOICE_TEXT = "Cảm ơn bạn đã xem. Đừng quên bấm theo dõi kênh nhé.";
      process.env.OUTRO_SHOW_TIKTOK_CARD = "false";
      process.env.OUTRO_HOLD_SEC = "4.5";

      const cfg = loadConfig();
      expect(cfg.outro.enabled).toBe(true);
      expect(cfg.outro.ctaTop).toBe("THEO DÕI ĐỂ KHÔNG BỎ LỠ");
      expect(cfg.outro.channelName).toBe("Tin Tức 24h");
      expect(cfg.outro.voiceText).toBe("Cảm ơn bạn đã xem. Đừng quên bấm theo dõi kênh nhé.");
      expect(cfg.outro.showTiktokCard).toBe(false);
      expect(cfg.outro.holdSec).toBe(4.5);
    });
  });

  it("rejects invalid TTS_PROVIDER", () => {
    process.env.TTS_PROVIDER = "google";
    process.env.VIETNAMESE_API_KEY = "k";
    process.env.VIETNAMESE_VOICEID = "v";
    expect(() => loadConfig()).toThrow(/TTS_PROVIDER/);
  });
});
