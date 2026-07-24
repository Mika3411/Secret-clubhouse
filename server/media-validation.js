import { Worker } from "node:worker_threads";

export const maxVoiceDurationSeconds = 120;
export const mediaInspectionTimeoutMs = 15_000;

const supportedAudioMimeTypes = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);

const mimeAliases = new Map([
  ["audio/m4a", "audio/mp4"],
  ["audio/wave", "audio/wav"],
  ["audio/x-m4a", "audio/mp4"],
  ["audio/x-wav", "audio/wav"],
  ["image/jpg", "image/jpeg"],
]);

export class MediaValidationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "MediaValidationError";
    this.statusCode = statusCode;
  }
}

function canonicalMimeType(value) {
  const baseType = String(value ?? "").split(";", 1)[0].trim().toLowerCase();
  return mimeAliases.get(baseType) ?? baseType;
}

function mediaKind(mimeType) {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export function validateMediaInspection({
  declaredMime,
  detectedMime,
  durationSeconds,
}) {
  const declaredType = canonicalMimeType(declaredMime);
  const actualType = canonicalMimeType(detectedMime);
  const declaredKind = mediaKind(declaredType);
  const actualKind = mediaKind(actualType);

  if (!declaredKind || !actualKind || declaredKind !== actualKind || declaredType !== actualType) {
    throw new MediaValidationError(415, "Le type réel du média ne correspond pas au format annoncé.");
  }

  if (actualKind === "audio") {
    if (!supportedAudioMimeTypes.has(actualType)
      || !Number.isFinite(durationSeconds)
      || durationSeconds <= 0) {
      throw new MediaValidationError(415, "Ce message vocal ne peut pas être vérifié.");
    }
    if (durationSeconds > maxVoiceDurationSeconds) {
      throw new MediaValidationError(422, "Un message vocal est limité à deux minutes.");
    }
  }

  return {
    durationSeconds: actualKind === "audio" ? durationSeconds : null,
    kind: actualKind,
    mimeType: actualType,
  };
}

function inspectFilesInWorker(files, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./media-validation-worker.js", import.meta.url), {
      workerData: {
        files: files.map((file) => ({ path: file.path })),
      },
    });
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        worker.terminate().catch(() => undefined);
        reject(new MediaValidationError(415, "Le média n’a pas pu être vérifié. Essaie un autre fichier."));
      });
    }, timeoutMs);

    worker.once("message", (message) => {
      finish(() => {
        worker.terminate().catch(() => undefined);
        if (!message?.ok || !Array.isArray(message.inspections)) {
          reject(new MediaValidationError(415, "Le contenu du média n’est pas reconnu."));
          return;
        }
        resolve(message.inspections);
      });
    });
    worker.once("error", () => {
      finish(() => {
        reject(new MediaValidationError(415, "Le média n’a pas pu être vérifié. Essaie un autre fichier."));
      });
    });
    worker.once("exit", (code) => {
      if (code === 0) return;
      finish(() => {
        reject(new MediaValidationError(415, "Le média n’a pas pu être vérifié. Essaie un autre fichier."));
      });
    });
  });
}

export async function validateUploadedMediaFiles(files, {
  timeoutMs = mediaInspectionTimeoutMs,
} = {}) {
  if (!files.length) return [];
  const inspections = await inspectFilesInWorker(files, timeoutMs);
  if (inspections.length !== files.length) {
    throw new MediaValidationError(415, "Tous les médias n’ont pas pu être vérifiés.");
  }

  return files.map((file, index) => ({
    ...file,
    ...validateMediaInspection({
      declaredMime: file.mimetype,
      ...inspections[index],
    }),
    mimetype: canonicalMimeType(inspections[index].detectedMime),
  }));
}
