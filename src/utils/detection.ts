export interface Detection {
  label: string;
  /** All coords normalised to [0, 1] */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// PaliGemma format: <locYYYY><locXXXX><locYYYY><locXXXX> CLASS_NAME
// Coords are integers in [0, 1024], order: y1 x1 y2 x2
const PALI_TOKEN_RE  = /<loc(\d{4})>/g;
const PALI_CHUNK_RE  = /(<loc\d{4}>){4}\s+\S+/g;

function parsePaliGemma(output: string): Detection[] {
  const results: Detection[] = [];

  const chunks = output.split(/\s*;\s*|\n/);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!/^(<loc\d{4}>){4}/.test(trimmed)) continue;

    const locs: number[] = [];
    PALI_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PALI_TOKEN_RE.exec(trimmed)) !== null) {
      locs.push(parseInt(m[1], 10) / 1024);
      if (locs.length === 4) break;
    }
    if (locs.length < 4) continue;

    const label = trimmed.replace(/^(<loc\d{4}>){4}\s*/, "").trim();
    if (!label) continue;

    const [y1, x1, y2, x2] = locs;
    results.push({ label, y1, x1, y2, x2 });
  }

  // Fallback: scan whole output for any matching chunks
  if (results.length === 0) {
    PALI_CHUNK_RE.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = PALI_CHUNK_RE.exec(output)) !== null) {
      const chunk = cm[0];
      const locs: number[] = [];
      PALI_TOKEN_RE.lastIndex = 0;
      let lm: RegExpExecArray | null;
      while ((lm = PALI_TOKEN_RE.exec(chunk)) !== null) {
        locs.push(parseInt(lm[1], 10) / 1024);
        if (locs.length === 4) break;
      }
      if (locs.length < 4) continue;
      const label = chunk.replace(/^(<loc\d{4}>){4}\s*/, "").trim();
      if (!label) continue;
      const [y1, x1, y2, x2] = locs;
      results.push({ label, y1, x1, y2, x2 });
    }
  }

  return results;
}

// Gemma 4 format (JSON): [{"box_2d": [y1, x1, y2, x2], "label": "..."}, ...]
// Coords in [0, 1000]; may be wrapped in a markdown code block
function parseGemma4(output: string): Detection[] {
  const stripped = output.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const arrayMatch = stripped.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (!arrayMatch) return [];

  try {
    const parsed = JSON.parse(arrayMatch[0]) as Array<{
      box_2d?: number[];
      label?: string;
    }>;

    return parsed
      .filter((d) => Array.isArray(d.box_2d) && d.box_2d.length >= 4 && d.label)
      .map((d) => {
        const [y1, x1, y2, x2] = d.box_2d!.map((v) => v / 1000);
        return { label: d.label!, y1, x1, y2, x2 };
      });
  } catch {
    return [];
  }
}

export type ModelFamily = "paligemma" | "gemma4" | "nano" | string;

export function parseDetections(output: string, family: ModelFamily): Detection[] {
  if (family === "gemma4") return parseGemma4(output);
  return parsePaliGemma(output);
}

/**
 * Gemini Nano returns box_2d as [y1, x1, y2, x2] in 0-1000 scale, BUT the
 * coordinates are relative to a square-padded version of the image that Chrome
 * creates internally before inference (letterbox / pillarbox padding).
 *
 * For a landscape image (W > H): Chrome pads top/bottom → square side = W.
 *   pad_y = (W - H) / 2;  effective y in padded space = raw_y * W/1000
 *   actual y in original = (effective_y - pad_y) / H
 *   actual x in original = (raw_x * W/1000) / W = raw_x / 1000
 *
 * For a portrait image (H > W): Chrome pads left/right → square side = H.
 *   pad_x = (H - W) / 2;  actual y = raw_y / 1000
 *   actual x = (raw_x * H/1000 - pad_x) / W
 *
 * Falls back to plain /1000 when dims are not available (square images or
 * unknown size).
 */
export function parseNanoDetections(
  output: string,
  imgW: number,
  imgH: number
): Detection[] {
  const stripped = output.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const arrayMatch = stripped.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (!arrayMatch) return [];

  try {
    const parsed = JSON.parse(arrayMatch[0]) as Array<{
      box_2d?: number[];
      label?: string;
    }>;

    const clamp = (v: number) => Math.min(1, Math.max(0, v));

    return parsed
      .filter(d => Array.isArray(d.box_2d) && d.box_2d.length >= 4 && d.label)
      .map(d => {
        const [raw_y1, raw_x1, raw_y2, raw_x2] = d.box_2d!;

        let y1: number, x1: number, y2: number, x2: number;

        if (!imgW || !imgH || imgW === 1000 || imgH === 1000) {
          // No dims available — plain 0-1000 normalisation
          y1 = raw_y1 / 1000; x1 = raw_x1 / 1000;
          y2 = raw_y2 / 1000; x2 = raw_x2 / 1000;
        } else if (imgW >= imgH) {
          // Landscape / square: square side = W, vertical padding
          const side  = imgW;
          const pad_y = (side - imgH) / 2;
          y1 = (raw_y1 * side / 1000 - pad_y) / imgH;
          y2 = (raw_y2 * side / 1000 - pad_y) / imgH;
          x1 =  raw_x1 / 1000;
          x2 =  raw_x2 / 1000;
        } else {
          // Portrait: square side = H, horizontal padding
          const side  = imgH;
          const pad_x = (side - imgW) / 2;
          y1 =  raw_y1 / 1000;
          y2 =  raw_y2 / 1000;
          x1 = (raw_x1 * side / 1000 - pad_x) / imgW;
          x2 = (raw_x2 * side / 1000 - pad_x) / imgW;
        }

        return {
          label: d.label!,
          y1: clamp(y1), x1: clamp(x1),
          y2: clamp(y2), x2: clamp(x2),
        };
      });
  } catch {
    return [];
  }
}

export function isDetectionOutput(output: string, family: ModelFamily): boolean {
  if (family === "gemma4" || family === "nano") {
    return /\[\s*\{/.test(output.replace(/```(?:json)?/gi, ""));
  }
  return /(<loc\d{4}>){4}/.test(output);
}
