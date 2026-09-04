import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { ScriptSchema, type Script } from "./render/script-schema.js";
import { loadConfig } from "./config.js";
import { createTtsClient } from "./tts/tts-client.js";
import { fetchImage } from "./assets/image-fetcher.js";
import { getDurationSec, concatWithSilence, mixSfxOntoVoice, extractThumbnail, type SfxMixSpec } from "./assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "./assets/sfx-selector.js";
import { existsSync } from "node:fs";
import { composeHtml } from "./render/html-composer.js";
import { renderWithHyperframes } from "./render/hyperframes-runner.js";
import { log } from "./utils/logger.js";

const TOTAL_STEPS = 8;
const DURATION_MIN_SEC = 48;
const DURATION_MAX_SEC = 72;
const SCENE_GAP_SEC = 0.3;
/**
 * Extra seconds added to the outro scene visual duration AFTER the voice ends.
 * Gives the TikTok follow card time to be read by the viewer (otherwise the
 * video ends a few hundred ms after the card slides up + click animation).
 * Audio stays silent during this hold; visual stays on screen.
 */
const OUTRO_HOLD_SEC = 3;

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "render", "templates");
/** Path to the SFX library (relative to project root) */
const SFX_DIR = join(__dirname, "..", "assets", "sfx");

const HYPERFRAMES_CONFIG = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: {
    blocks: "compositions",
    components: "compositions/components",
    assets: "assets",
  },
};

export function buildCaptionText(script: Script): string {
  const title = script.metadata.title;
  const channel = script.metadata.channel;
  const domain = script.metadata.source.domain;

  const bodyScenes = script.scenes.filter((s) => s.type === "body");
  const bodyBullets = bodyScenes
    .map((s) => `- ${s.voiceText}`)
    .join("\n");

  const hookScene = script.scenes.find((s) => s.type === "hook");
  const hookText = hookScene?.voiceText ?? title;

  const channelTag = "#" + channel.toLowerCase().replace(/[^a-z0-9]/g, "");

  return [
    "=== TIÊU ĐỀ VIDEO ===",
    title,
    "",
    "=== MÔ TẢ VIDEO ===",
    `Bản tin cập nhật từ ${domain}:`,
    bodyBullets,
    "",
    `Theo dõi kênh ${channel} để cập nhật thông tin mới nhất mỗi ngày!`,
    `Nguồn: ${domain}`,
    "",
    "=== HASHTAGS ===",
    `#shorts #tintuc #xuhuong #fyp ${channelTag}`.trim(),
    "",
    "=== NỘI DUNG ĐĂNG NHANH (TIKTOK / SHORTS / REELS) ===",
    hookText,
    "",
    `Nguồn: ${domain} | Kênh: ${channel}`,
    "",
    `#shorts #tintuc #xuhuong #fyp ${channelTag}`.trim(),
    "",
  ].join("\n");
}

export async function runPipeline(scriptPath: string): Promise<void> {
  const cfg = loadConfig();
  const outputDir = dirname(scriptPath);
  log.info(`Output directory: ${outputDir}`);

  // STEP 1
  log.step(1, TOTAL_STEPS, `Load env + validate script.json (TTS provider: ${cfg.ttsProvider})`);
  const raw = JSON.parse(await readFile(scriptPath, "utf8"));
  // Substitute env placeholder before validation (works for all providers)
  if (raw.voice?.voiceId === "${VIETNAMESE_VOICEID}" || raw.voice?.voiceId === "${VOICE_ID}") {
    raw.voice.voiceId =
      cfg.ttsProvider === "edge-tts" ? cfg.edgeTtsVoice
      : cfg.ttsProvider === "lucylab" ? cfg.lucylabVoiceId!
      : cfg.ttsProvider === "elevenlabs" ? cfg.elevenlabsVoiceId!
      : cfg.vbeeVoiceCode;
  }
  const script: Script = ScriptSchema.parse(raw);

  // Outro configuration from .env:
  if (!cfg.outro.enabled) {
    script.scenes = script.scenes.filter((s) => s.type !== "outro");
    log.info("  Outro scene disabled by .env config (SHOW_OUTRO=false / ENABLE_OUTRO=false)");
  } else {
    const outroScene = script.scenes.find((s) => s.type === "outro");
    if (outroScene) {
      if (cfg.outro.voiceText) {
        outroScene.voiceText = cfg.outro.voiceText;
        log.info(`  Outro voice text configured from .env: "${cfg.outro.voiceText}"`);
      }
      if (cfg.outro.channelName && outroScene.templateData.template === "outro") {
        outroScene.templateData.channelName = cfg.outro.channelName;
      }
      if (cfg.outro.ctaTop && outroScene.templateData.template === "outro") {
        outroScene.templateData.ctaTop = cfg.outro.ctaTop;
      }
    }
  }

  // STEP 2
  log.step(2, TOTAL_STEPS, "Write script.txt for CapCut");
  const fullText = script.scenes.map((s) => s.voiceText).join("\n\n");
  await writeFile(join(outputDir, "script.txt"), fullText);

  // STEP 3 + 4 in parallel
  log.step(3, TOTAL_STEPS, "Fetch images (parallel) + Step 4 TTS");
  const imagesDir = join(outputDir, "images");
  await mkdir(imagesDir, { recursive: true });

  const mainImgPath = join(imagesDir, "bg.jpg");
  const mainImgPromise = fetchImage(script.metadata.source.image, mainImgPath);

  // Fetch scene-specific images if any bgSrc is a remote URL
  const sceneImgPromises = script.scenes.map(async (scene) => {
    const bgSrc = scene.templateData.bgSrc;
    if (bgSrc && (bgSrc.startsWith("http://") || bgSrc.startsWith("https://"))) {
      const destPath = join(imagesDir, `scene-${scene.id}.jpg`);
      const res = await fetchImage(bgSrc, destPath);
      if (res.success) {
        scene.templateData.bgSrc = `images/scene-${scene.id}.jpg`;
      }
    }
  });

  // STEP 4
  const ttsClient = createTtsClient(cfg);
  // Concurrency: LucyLab requires 1 (only 1 concurrent export per key);
  // ElevenLabs supports parallel calls but we keep 1 by default to be polite.
  const limit = pLimit(cfg.ttsConcurrency);
  const voiceDir = join(outputDir, "voice");
  await mkdir(voiceDir, { recursive: true });

  const sceneAudioPromises = script.scenes.map((scene) =>
    limit(async () => {
      const out = join(voiceDir, `scene-${scene.id}.mp3`);
      const srtOut = join(voiceDir, `scene-${scene.id}.srt`);

      // IDEMPOTENT: skip TTS if voice file already exists.
      // To force re-TTS for a scene, delete its mp3 file before running.
      // This saves API quota when only some scenes' voiceText changed.
      if (existsSync(out)) {
        const dur = await getDurationSec(out);
        log.info(`  scene ${scene.id}: REUSE existing mp3 (${dur.toFixed(2)}s) — delete to force re-TTS`);
        return { id: scene.id, path: out, durationSec: dur };
      }

      log.info(`  TTS scene ${scene.id} (${scene.voiceText.length} chars)...`);
      await ttsClient.generate(scene.voiceText, out, srtOut);
      const dur = await getDurationSec(out);
      log.info(`  scene ${scene.id}: ${dur.toFixed(2)}s`);
      return { id: scene.id, path: out, durationSec: dur };
    }),
  );

  const [imgResult, _, sceneAudio] = await Promise.all([
    mainImgPromise,
    Promise.all(sceneImgPromises),
    Promise.all(sceneAudioPromises),
  ]);

  let bgImageRelPath: string | null = null;
  if (imgResult.success) {
    bgImageRelPath = "images/bg.jpg";
  } else {
    log.warn(`Background image fetch failed: ${imgResult.reason} → using gradient fallback`);
  }

  // Substitute literal "$source.image" in any scene.templateData.bgSrc
  for (const s of script.scenes) {
    if (s.templateData.bgSrc === "$source.image") {
      s.templateData.bgSrc = bgImageRelPath ?? undefined;
    }
  }

  // STEP 5
  log.step(5, TOTAL_STEPS, "Concat voice scenes + mix SFX layer");
  const voiceRawMp3 = join(outputDir, "voice-raw.mp3");
  const voiceMp3 = join(outputDir, "voice.mp3");
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);

  // Compute scene start times (cumulative voice durations + gaps)
  let cursor = 0;
  const sceneStarts: Record<string, number> = {};
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }

  // Build SFX mix list using smart 3-tier selector
  const sfxIndex = indexSfxLibrary(SFX_DIR);
  const indexCats = Object.keys(sfxIndex).length;
  const indexFiles = Object.values(sfxIndex).reduce((s, a) => s + a.length, 0);
  log.info(`  SFX library: ${indexFiles} files in ${indexCats} categories`);

  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];

    // Tier 1: explicit override in script.json
    if (scene.sfx) {
      if (scene.sfx.name === "none") {
        log.info(`  scene ${scene.id}: SFX disabled (explicit "none")`);
        continue;
      }
      const sfxPath = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(sfxPath)) {
        sfxList.push({ path: sfxPath, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
        log.info(`  scene ${scene.id}: SFX override -> ${scene.sfx.name}.mp3`);
      } else {
        log.warn(`  scene ${scene.id}: explicit SFX not found, skipping: ${scene.sfx.name}.mp3`);
      }
      continue;
    }

    // Tier 2/3: smart selection by content + template
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: scene.templateData.template,
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) {
      log.warn(`  scene ${scene.id}: no SFX available (empty library?)`);
      continue;
    }

    const sfxPath = join(SFX_DIR, picked.relPath);
    const playback = defaultPlayback(picked);
    sfxList.push({ path: sfxPath, startSec: startSec + playback.offsetSec, volume: playback.volume });

    const why = picked.source === "semantic"
      ? `semantic match "${picked.matchedKeyword}"`
      : picked.source;
    log.info(`  scene ${scene.id}: SFX -> ${picked.relPath} (${why})`);
  }
  log.info(`  mixing ${sfxList.length} SFX into voice.mp3`);
  await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceMp3);

  const totalAudioSec = await getDurationSec(voiceMp3);
  log.info(`  voice.mp3 total: ${totalAudioSec.toFixed(2)}s`);
  if (totalAudioSec < DURATION_MIN_SEC || totalAudioSec > DURATION_MAX_SEC) {
    log.warn(`Total duration ${totalAudioSec.toFixed(1)}s outside [${DURATION_MIN_SEC}, ${DURATION_MAX_SEC}]s tolerance — proceeding anyway`);
  }

  // STEP 6 — Compose HTML + write hyperframes project files
  log.step(6, TOTAL_STEPS, "Compose HTML + project files");

  // Resolve TikTok avatar — download URL if provided, else copy bundled default
  // Bundled avatar can be jpg/jpeg/png/webp — pick whichever exists
  const findBundledAvatar = (): string => {
    const baseDir = join(__dirname, "..", "assets");
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const p = join(baseDir, `avatar.${ext}`);
      if (existsSync(p)) return p;
    }
    throw new Error(`No bundled avatar found. Place an image at assets/avatar.{jpg,png,webp}`);
  };
  const bundledAvatar = findBundledAvatar();
  const ttAvatarExt = bundledAvatar.split(".").pop()!.toLowerCase();
  const ttAvatarFile = `tiktok-avatar.${ttAvatarExt}`;
  const ttAvatarOut = join(outputDir, ttAvatarFile);
  if (cfg.tiktok.avatarUrl) {
    const r = await fetchImage(cfg.tiktok.avatarUrl, ttAvatarOut);
    if (!r.success) {
      log.warn(`TikTok avatar download failed: ${r.reason} → falling back to bundled default`);
      await copyFile(bundledAvatar, ttAvatarOut);
    }
  } else {
    await copyFile(bundledAvatar, ttAvatarOut);
  }

  const html = composeHtml({
    script,
    sceneAudio: sceneAudio.map((a) => ({ id: a.id, durationSec: a.durationSec })),
    gapSec: SCENE_GAP_SEC,
    bgImageRelPath,
    audioRelPath: "voice.mp3",
    tiktok: cfg.tiktok,
    tiktokAvatarRelPath: ttAvatarFile,
    outroHoldSec: cfg.outro.holdSec,
    showWatermark: cfg.watermark.enabled,
    watermark: cfg.watermark,
    outro: cfg.outro,
  });

  // hyperframes expects: index.html (NOT composition.html), hyperframes.json, meta.json in DIR
  await writeFile(join(outputDir, "index.html"), html);

  await writeFile(join(outputDir, "hyperframes.json"), JSON.stringify(HYPERFRAMES_CONFIG, null, 2));

  const slug = basename(outputDir);
  await writeFile(join(outputDir, "meta.json"), JSON.stringify({
    id: slug,
    name: script.metadata.title,
    createdAt: new Date().toISOString(),
  }, null, 2));

  // Copy templates next to the index.html so relative paths resolve.
  // base.html.tmpl + animations.js are shared across themes (structure/behavior);
  // only styles.<theme>.css differs (visual look), and always lands as "styles.css".
  const themeFile = cfg.videoTheme === "light-pro" ? "styles.light-pro.css" : "styles.css";
  await copyFile(join(TPL_DIR, themeFile),       join(outputDir, "styles.css"));
  await copyFile(join(TPL_DIR, "animations.js"), join(outputDir, "animations.js"));

  // STEP 7
  log.step(7, TOTAL_STEPS, "Render with hyperframes");
  const videoPath = join(outputDir, "video.mp4");
  await renderWithHyperframes({ compositionDir: outputDir, outputPath: videoPath });

  // STEP 8
  log.step(8, TOTAL_STEPS, "Thumbnail + Caption + Done");
  const thumbnailPath = join(outputDir, "thumbnail.jpg");
  try {
    await extractThumbnail(videoPath, thumbnailPath, 1.5);
    log.info(`  Thumbnail extracted: ${thumbnailPath}`);
  } catch (err: any) {
    log.warn(`  Failed to extract thumbnail: ${err?.message ?? err}`);
  }

  const captionPath = join(outputDir, "caption.txt");
  if (!existsSync(captionPath)) {
    await writeFile(captionPath, buildCaptionText(script), "utf8");
  }

  console.log("\n=== Result ===");
  console.log(`Video:     ${videoPath}`);
  console.log(`Thumbnail: ${thumbnailPath}`);
  console.log(`Audio:     ${voiceMp3}  (cho CapCut)`);
  console.log(`Script:    ${join(outputDir, "script.txt")}  (cho CapCut auto-caption)`);
  console.log(`Caption:   ${captionPath}  (Tiêu đề, mô tả & hashtag)`);
  console.log(`Tong thoi luong: ${totalAudioSec.toFixed(2)}s`);
}

