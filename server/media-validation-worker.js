import { parentPort, workerData } from "node:worker_threads";
import { createReadStream } from "node:fs";
import { detectAv } from "@file-type/av";
import { fileTypeFromFile } from "file-type";
import { createFile as createMp4File } from "mp4box";
import { parseFile } from "music-metadata";
import { Decoder, Reader } from "ts-ebml";

async function readWebmDuration(filePath) {
  const decoder = new Decoder();
  const reader = new Reader();
  reader.logging = false;

  for await (const chunk of createReadStream(filePath)) {
    const elements = decoder.decode(chunk);
    for (const element of elements) reader.read(element);
  }
  reader.stop();

  const seconds = reader.duration * reader.timestampScale / 1_000_000_000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function readMp4Duration(filePath) {
  const mp4File = createMp4File();
  let fileStart = 0;

  for await (const chunk of createReadStream(filePath)) {
    const arrayBuffer = chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength,
    );
    arrayBuffer.fileStart = fileStart;
    mp4File.appendBuffer(arrayBuffer);
    fileStart += chunk.byteLength;
  }
  mp4File.flush();

  const info = mp4File.getInfo();
  if (!info.audioTracks?.length || info.videoTracks?.length) return null;
  const trackDurations = info.audioTracks.map((track) => (
    Number(track.samples_duration) / Number(track.timescale)
  ));
  const fragmentDuration = Number(info.fragment_duration?.num)
    / Number(info.fragment_duration?.den);
  const movieDuration = Number(info.duration) / Number(info.timescale);
  const seconds = Math.max(fragmentDuration, movieDuration, ...trackDurations);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function inspectFile(file) {
  const detected = await fileTypeFromFile(file.path, {
    customDetectors: [detectAv],
  });
  if (!detected?.mime) throw new Error("unsupported-media");

  const detectedMime = String(detected.mime).toLowerCase();
  let durationSeconds = null;
  if (detectedMime.startsWith("audio/")) {
    if (detectedMime === "audio/webm") {
      durationSeconds = await readWebmDuration(file.path);
    } else if (detectedMime === "audio/mp4") {
      durationSeconds = await readMp4Duration(file.path);
    } else {
      const metadata = await parseFile(file.path, {
        duration: true,
        skipCovers: true,
      });
      durationSeconds = Number(metadata.format.duration);
    }
  }

  return {
    detectedMime,
    durationSeconds,
  };
}

try {
  const inspections = [];
  for (const file of workerData.files) {
    inspections.push(await inspectFile(file));
  }
  parentPort.postMessage({ ok: true, inspections });
} catch {
  parentPort.postMessage({ ok: false });
}
