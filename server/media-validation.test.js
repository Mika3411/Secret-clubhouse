import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  MediaValidationError,
  maxVoiceDurationSeconds,
  validateMediaInspection,
  validateUploadedMediaFiles,
} from "./media-validation.js";

function createPcmWave(durationSeconds) {
  const sampleRate = 8_000;
  const channelCount = 1;
  const bitsPerSample = 8;
  const bytesPerSample = channelCount * (bitsPerSample / 8);
  const dataLength = Math.round(durationSeconds * sampleRate * bytesPerSample);
  const wave = Buffer.alloc(44 + dataLength, 128);

  wave.write("RIFF", 0, "ascii");
  wave.writeUInt32LE(36 + dataLength, 4);
  wave.write("WAVE", 8, "ascii");
  wave.write("fmt ", 12, "ascii");
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(channelCount, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wave.writeUInt16LE(bytesPerSample, 32);
  wave.writeUInt16LE(bitsPerSample, 34);
  wave.write("data", 36, "ascii");
  wave.writeUInt32LE(dataLength, 40);
  return wave;
}

test("la politique média refuse un MIME mensonger et une durée vocale supérieure à deux minutes", () => {
  assert.throws(
    () => validateMediaInspection({
      declaredMime: "audio/webm",
      detectedMime: "image/png",
      durationSeconds: null,
    }),
    (error) => error instanceof MediaValidationError && error.statusCode === 415,
  );

  assert.deepEqual(
    validateMediaInspection({
      declaredMime: "audio/webm;codecs=opus",
      detectedMime: "audio/webm",
      durationSeconds: maxVoiceDurationSeconds,
    }),
    {
      durationSeconds: maxVoiceDurationSeconds,
      kind: "audio",
      mimeType: "audio/webm",
    },
  );

  assert.throws(
    () => validateMediaInspection({
      declaredMime: "audio/webm",
      detectedMime: "audio/webm",
      durationSeconds: maxVoiceDurationSeconds + 0.001,
    }),
    (error) => error instanceof MediaValidationError
      && error.statusCode === 422
      && /deux minutes/u.test(error.message),
  );
});

test("l’analyse du fichier temporaire mesure les octets WAV au lieu de croire le formulaire", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "secret-clubhouse-media-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const shortPath = path.join(directory, "short");
  const longPath = path.join(directory, "long");
  const fakePath = path.join(directory, "fake");
  const shortWave = createPcmWave(2);
  const longWave = createPcmWave(121);
  await Promise.all([
    fs.writeFile(shortPath, shortWave),
    fs.writeFile(longPath, longWave),
    fs.writeFile(fakePath, Buffer.from("ceci n'est pas un fichier audio", "utf8")),
  ]);

  const [validated] = await validateUploadedMediaFiles([{
    path: shortPath,
    mimetype: "audio/wav",
    originalname: "message-vocal.wav",
    size: shortWave.length,
  }]);
  assert.equal(validated.kind, "audio");
  assert.equal(validated.mimetype, "audio/wav");
  assert.equal(validated.durationSeconds, 2);

  await assert.rejects(
    validateUploadedMediaFiles([{
      path: shortPath,
      mimetype: "audio/webm",
      originalname: "faux.webm",
      size: shortWave.length,
    }]),
    (error) => error instanceof MediaValidationError && error.statusCode === 415,
  );

  await assert.rejects(
    validateUploadedMediaFiles([{
      path: longPath,
      mimetype: "audio/wav",
      originalname: "trop-long.wav",
      size: longWave.length,
    }]),
    (error) => error instanceof MediaValidationError
      && error.statusCode === 422
      && /deux minutes/u.test(error.message),
  );

  await assert.rejects(
    validateUploadedMediaFiles([{
      path: fakePath,
      mimetype: "audio/wav",
      originalname: "faux.wav",
      size: 32,
    }]),
    (error) => error instanceof MediaValidationError && error.statusCode === 415,
  );
});
