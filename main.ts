// ai-excited-01 entry: "The Octopus in the Rice Paddy".
//
// The artwork ships in this repository as entry.png beside this file (the
// name stays entry.png; the bytes are a JPEG, which the gate accepts — it
// tells PNG and JPEG apart by their first bytes). This program validates
// the image against the gate's limits, copies it to the output directory
// as entry.png, and then reads the copy back to prove the judge will see
// exactly the bytes that were validated. The program is deterministic:
// every run writes byte-identical output.
//
// Node 22, standard library only, no network. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// `node main.ts --check` validates the image and reports, without writing
// any output file.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1_048_576; // the gate's 1 MiB limit
const MAX_WIDTH = 1024; // the gate's pixel limits
const MAX_HEIGHT = 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Structured exit codes, so a caller can tell why a run failed without
// parsing the message: 0 ok, 2 bad input, 3 filesystem failure, 4 the
// written copy did not match the validated bytes.
const EXIT_OK = 0;
const EXIT_VALIDATION = 2;
const EXIT_IO = 3;
const EXIT_VERIFICATION = 4;

function die(message, code = EXIT_VALIDATION) {
  console.error(`entry: error: ${message}`);
  process.exit(code);
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// The gate tells the two formats apart by magic bytes; mirror that here so
// a corrupt or wrong file fails loudly instead of reaching the judge.
function detectFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'JPEG';
  }
  if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return 'PNG';
  }
  return null;
}

// Pixel dimensions, read from the image header: a PNG's IHDR chunk, or a
// JPEG's start-of-frame segment. Returns null when no header parses, so a
// truncated file fails as unreadable rather than slipping through.
function readDimensions(bytes, format) {
  if (format === 'PNG') {
    if (bytes.length < 24) return null;
    // A real PNG opens with a 13-byte IHDR chunk: length 13 at offset 8,
    // then the chunk type "IHDR" at offset 12. Anything else is not a PNG
    // the gate would accept, even if the magic bytes matched.
    if (bytes.readUInt32BE(8) !== 13) return null;
    if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
      return null;
    }
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: walk the marker segments after the SOI marker (FF D8). Most
  // markers are followed by a 2-byte length that counts itself; the
  // standalone ones (TEM, RST0-7, SOI, EOI) carry no segment at all.
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd9) return null; // EOI: no frame header was found
    const standalone =
      marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);
    if (standalone) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset + 2);
    // A segment length counts itself, so it is at least 2; a smaller value
    // means a corrupt header, not a JPEG the gate would accept.
    if (segmentLength < 2) return null;
    // Start-of-frame markers are C0-CF except C4 (DHT), C8 (JPG) and CC
    // (DAC); their segment opens with precision, height, then width.
    // Baseline and extended JPEGs use 8-bit samples; anything else is
    // not a file this entry is expected to carry.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (offset + 8 >= bytes.length) return null;
      if (bytes[offset + 4] !== 8) return null;
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== '--check');
  if (unknown.length > 0) {
    die(`unknown argument: ${unknown.join(' ')} (usage: node main.ts [--check])`);
  }
  const checkOnly = args.includes('--check');

  const sourcePath = fileURLToPath(new URL('./entry.png', import.meta.url));
  if (!existsSync(sourcePath)) {
    die(`image not found beside the program: ${sourcePath}`);
  }

  const image = readFileSync(sourcePath);
  if (image.length === 0) {
    die('entry.png is empty');
  }
  if (image.length > MAX_BYTES) {
    die(`entry.png is ${image.length} bytes, over the 1 MiB gate limit of ${MAX_BYTES}`);
  }
  const format = detectFormat(image);
  if (format === null) {
    die('entry.png starts with neither the JPEG nor the PNG signature');
  }
  // A complete JPEG ends with the end-of-image marker (FF D9); a file
  // without it is truncated even if its frame header parsed cleanly.
  if (
    format === 'JPEG' &&
    (image.length < 2 || image[image.length - 2] !== 0xff || image[image.length - 1] !== 0xd9)
  ) {
    die('entry.png is a truncated JPEG: missing the end-of-image marker');
  }
  const dimensions = readDimensions(image, format);
  if (dimensions === null || dimensions.width === 0 || dimensions.height === 0) {
    die(`could not read pixel dimensions from the ${format} header; the file may be truncated`);
  }
  if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) {
    die(
      `entry.png is ${dimensions.width}x${dimensions.height} pixels, over the ` +
      `${MAX_WIDTH}x${MAX_HEIGHT} gate limit`,
    );
  }

  // Verify-only mode: validate everything above and report, without
  // writing any output file.
  if (checkOnly) {
    console.log(
      `entry: check passed (${format}, ${dimensions.width}x${dimensions.height}, ` +
      `${image.length} bytes, sha256 ${sha256Hex(image)})`,
    );
    return;
  }

  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    die(`cannot create output directory ${outputDir}: ${error.message}`, EXIT_IO);
  }
  const targetPath = join(outputDir, 'entry.png');
  // Atomic write: write to a temp file in the same directory, then rename
  // over the target, so a crash mid-write can never leave a partial
  // entry.png behind for the judge. The temp file is removed on failure.
  const tempPath = join(outputDir, `.entry.png.tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  try {
    writeFileSync(tempPath, image);
    renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // Temp file already gone; the original error is what matters.
    }
    die(`cannot write ${targetPath}: ${error.message}`, EXIT_IO);
  }

  // Read the copy back and compare digests: the run only succeeds when the
  // bytes on disk in the output are exactly the bytes that were validated.
  const copied = readFileSync(targetPath);
  if (copied.length !== image.length || sha256Hex(copied) !== sha256Hex(image)) {
    die(`copy verification failed: ${targetPath} differs from the source image`, EXIT_VERIFICATION);
  }

  console.log(
    `entry: wrote ${targetPath} (${format}, ${dimensions.width}x${dimensions.height}, ` +
    `${image.length} bytes, sha256 ${sha256Hex(image)})`,
  );
}

try {
  main();
} catch (error) {
  // Filesystem failures (missing source, unreadable copy) are I/O errors,
  // not validation failures, so they get the I/O exit code.
  const code =
    error instanceof Error && typeof error.code === 'string' && error.code.startsWith('E')
      ? EXIT_IO
      : EXIT_VALIDATION;
  die(error instanceof Error ? error.message : String(error), code);
}
