import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "@phosphor-icons/react/Check";
import { Checks } from "@phosphor-icons/react/Checks";
import { Clock } from "@phosphor-icons/react/Clock";
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
import { Eye } from "@phosphor-icons/react/Eye";
import { Microphone } from "@phosphor-icons/react/Microphone";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Waveform } from "@phosphor-icons/react/Waveform";
import { X } from "@phosphor-icons/react/X";
import { api } from "../../../api";

export function MessageStatus({ status = "sent" }) {
  const receiptStatus = status === "seen" || status === "received" ? status : "sent";
  const isSeen = receiptStatus === "seen";
  const isReceived = receiptStatus === "received";
  const StatusIcon = isSeen ? Checks : isReceived ? Check : Clock;
  const label = isSeen ? "Vu" : isReceived ? "Reçu" : "Envoyé";
  return (
    <span className={`message-status message-status--${receiptStatus}`} aria-label={label} title={label}>
      <StatusIcon size={16} weight="bold" aria-hidden="true" />
      <span className="message-status__label">{label}</span>
    </span>
  );
}

export function ConversationMediaMessage({ message, parent = false }) {
  const [mediaUrl, setMediaUrl] = useState(message.url ?? "");
  const [loadError, setLoadError] = useState("");
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [mediaShape, setMediaShape] = useState("unknown");
  const isReceived = message.direction === "received";
  const isVideo = message.type === "video";

  useEffect(() => {
    setMediaShape("unknown");
    if (message.url) {
      setMediaUrl(message.url);
      setLoadError("");
      return undefined;
    }
    let isCurrent = true;
    let objectUrl = "";
    setMediaUrl("");
    setLoadError("");
    api.media(message.id)
      .then((url) => {
        objectUrl = url;
        if (isCurrent) setMediaUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || "Média indisponible.");
      });
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.url]);

  useEffect(() => {
    if (!isMediaOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsMediaOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMediaOpen]);

  const rememberMediaShape = (width, height) => {
    if (!width || !height) return;
    const ratio = width / height;
    setMediaShape(ratio > 1.15 ? "landscape" : ratio < 0.86 ? "portrait" : "square");
  };

  const className = parent
    ? `parent-media-message ${isReceived ? "parent-media-message--received" : ""}`
    : `media-message ${isReceived ? "media-message--received" : ""}`;
  const placeholderClassName = parent ? "parent-media-message__placeholder" : "media-message__placeholder";
  const description = `${isVideo ? "Vidéo" : "Photo"} ${isReceived ? "reçue" : "envoyée"}`;

  return (
    <>
      <figure className={`${className} media-message--${mediaShape}`}>
        {mediaUrl ? (
          <>
            <div className="media-message__preview">
              {isVideo
                ? <video src={mediaUrl} controls preload="metadata" playsInline onLoadedMetadata={(event) => rememberMediaShape(event.currentTarget.videoWidth, event.currentTarget.videoHeight)} aria-label={`${description} : ${message.name || "vidéo"}`} />
                : <button type="button" className="media-message__photo-button" onClick={() => setIsMediaOpen(true)} aria-label="Ouvrir la photo en grand">
                  <img src={mediaUrl} alt={`${description} : ${message.name || "photo"}`} onLoad={(event) => rememberMediaShape(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
                </button>}
            </div>
            <div className="media-message__toolbar" aria-label={`Actions pour la ${isVideo ? "vidéo" : "photo"}`}>
              <button type="button" className="media-message__action media-message__action--expand" onClick={() => setIsMediaOpen(true)} aria-label={`Ouvrir la ${isVideo ? "vidéo" : "photo"} en grand`}>
                <Eye size={20} weight="bold" />
                <span>Agrandir</span>
              </button>
              <a className="media-message__action media-message__action--download" href={mediaUrl} download={message.name || (isVideo ? "video" : "photo")} onClick={(event) => event.stopPropagation()} aria-label={`Télécharger la ${isVideo ? "vidéo" : "photo"}`}>
                <DownloadSimple size={20} weight="bold" />
                <span>Télécharger</span>
              </a>
            </div>
          </>
        ) : (
          <div className={`${placeholderClassName} ${loadError ? "has-error" : ""}`} role={loadError ? "alert" : "status"}>
            {loadError || `Chargement de la ${isVideo ? "vidéo" : "photo"}…`}
          </div>
        )}
        <figcaption>
          <span>{description}{message.time ? ` · ${message.time}` : ""}</span>
          {!isReceived && <MessageStatus status={message.status ?? "sent"} />}
        </figcaption>
      </figure>
      {isMediaOpen && createPortal((
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`${isVideo ? "Vidéo" : "Photo"} en plein écran`} onClick={() => setIsMediaOpen(false)}>
          <button type="button" className="photo-lightbox__close" onClick={() => setIsMediaOpen(false)} aria-label={`Fermer la ${isVideo ? "vidéo" : "photo"}`}>
            <X size={28} weight="bold" />
          </button>
          <a className="photo-lightbox__download" href={mediaUrl} download={message.name || (isVideo ? "video" : "photo")} onClick={(event) => event.stopPropagation()} aria-label={`Enregistrer la ${isVideo ? "vidéo" : "photo"}`}>
            <DownloadSimple size={24} weight="bold" />
            <span>Enregistrer</span>
          </a>
          {isVideo
            ? <video src={mediaUrl} controls autoPlay playsInline aria-label={`${description} : ${message.name || "vidéo"}`} onClick={(event) => event.stopPropagation()} />
            : <img src={mediaUrl} alt={`${description} : ${message.name || "photo"}`} onClick={(event) => event.stopPropagation()} />}
        </div>
      ), document.body)}
    </>
  );
}

export function ConversationVoiceMessage({ message, parent = false }) {
  const [mediaUrl, setMediaUrl] = useState(message.url ?? "");
  const [loadError, setLoadError] = useState("");
  const isReceived = message.direction === "received";

  useEffect(() => {
    if (message.url) {
      setMediaUrl(message.url);
      setLoadError("");
      return undefined;
    }
    let isCurrent = true;
    let objectUrl = "";
    setMediaUrl("");
    setLoadError("");
    api.media(message.id)
      .then((url) => {
        objectUrl = url;
        if (isCurrent) setMediaUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || "Message vocal indisponible.");
      });
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.id, message.url]);

  if (!mediaUrl) {
    return <div className={`voice-message-loading ${parent ? "voice-message-loading--parent" : ""} ${isReceived ? "is-received" : ""}`} role={loadError ? "alert" : "status"}>{loadError || "Chargement du message vocal…"}</div>;
  }

  return (
    <div className={`conversation-voice-message ${parent ? "conversation-voice-message--parent" : ""} ${isReceived ? "is-received" : "is-sent"}`}>
      <VoiceMessage url={mediaUrl} duration={message.duration} status={isReceived ? null : message.status ?? "sent"} parent={parent} />
      {message.time && <time>{message.time}</time>}
    </div>
  );
}

export function formatVoiceDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function VoiceMessage({ url, duration, status, parent = false, preview = false }) {
  return (
    <div className={`voice-message ${parent ? "voice-message--parent" : ""} ${preview ? "voice-message--preview" : ""}`}>
      <span className="voice-message__icon" aria-hidden="true"><Waveform size={22} weight="fill" /></span>
      <div className="voice-message__player">
        <audio src={url} controls preload="metadata" aria-label={preview ? "Écouter l’aperçu du message vocal" : "Lire le message vocal envoyé"} />
        <small>{preview ? "Aperçu" : "Message vocal"} · {formatVoiceDuration(duration)}</small>
      </div>
      {status && <MessageStatus status={status} />}
    </div>
  );
}

export function VoiceRecorder({ disabled = false, onSend, parent = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const discardRef = useRef(false);
  const previewUrlRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
  };

  useEffect(() => () => {
    discardRef.current = true;
    clearTimer();
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    releaseMicrophone();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const startRecording = async () => {
    if (disabled || isRecording) return;
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setError("L’enregistrement audio n’est pas disponible sur cet appareil.");
      return;
    }

    try {
      clearPreview();
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => window.MediaRecorder.isTypeSupported?.(type));
      const recorder = supportedType ? new window.MediaRecorder(stream, { mimeType: supportedType }) : new window.MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearTimer();
        releaseMicrophone();
        setIsRecording(false);
        const duration = Math.max(1, Math.min(120, Math.round((Date.now() - startedAtRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm" });
        if (discardRef.current || !blob.size) {
          setElapsed(0);
          return;
        }
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreview({ blob, url, duration });
        setElapsed(duration);
      };

      recorder.start(250);
      setElapsed(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.min(120, Math.floor((Date.now() - startedAtRef.current) / 1000));
        setElapsed(seconds);
        if (seconds >= 120 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch (recordingError) {
      clearTimer();
      releaseMicrophone();
      setIsRecording(false);
      setError(recordingError?.name === "NotAllowedError"
        ? "Le micro est fermé pour le moment. Demande de l’aide à un adulte, puis réessaie."
        : "Impossible d’utiliser le micro pour le moment.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state !== "recording") return;
    discardRef.current = false;
    recorderRef.current.stop();
  };

  const cancelRecording = () => {
    discardRef.current = true;
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else releaseMicrophone();
    setIsRecording(false);
    setElapsed(0);
    clearPreview();
    setError("");
  };

  const sendRecording = async () => {
    if (!preview || isSending) return;
    setError("");
    setIsSending(true);
    try {
      await onSend(preview.blob, preview.duration);
      clearPreview();
      setElapsed(0);
    } catch (sendError) {
      setError(parent
        ? sendError?.message || "Le message vocal n’a pas pu être envoyé."
        : "Ton message vocal n’est pas parti. Vérifie ta connexion, puis réessaie.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`voice-recorder-slot ${parent ? "voice-recorder-slot--parent" : ""}`}>
      <button
        type="button"
        className={`voice-record-button ${isRecording ? "is-recording" : ""}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        aria-label={isRecording ? "Arrêter l’enregistrement vocal" : "Enregistrer un message vocal"}
        aria-pressed={isRecording}
      >
        <Microphone size={20} weight="fill" />
      </button>
      {isRecording && (
        <div className="voice-recorder-panel voice-recorder-panel--recording" role="status" aria-live="polite">
          <span className="voice-recorder-pulse" aria-hidden="true" />
          <span><strong>Enregistrement</strong><small>{formatVoiceDuration(elapsed)} / 2:00</small></span>
          <button type="button" className="voice-recorder-cancel" onClick={cancelRecording} aria-label="Annuler l’enregistrement"><X size={18} weight="bold" /></button>
          <button type="button" className="voice-recorder-stop" onClick={stopRecording} aria-label="Terminer l’enregistrement"><span aria-hidden="true" /></button>
        </div>
      )}
      {preview && (
        <div className="voice-recorder-panel voice-recorder-panel--preview">
          <VoiceMessage url={preview.url} duration={preview.duration} parent={parent} preview />
          <button type="button" className="voice-recorder-cancel" onClick={cancelRecording} aria-label="Supprimer le message vocal"><X size={18} weight="bold" /></button>
          <button type="button" className="voice-recorder-send" onClick={sendRecording} aria-label="Envoyer le message vocal" disabled={isSending}><PaperPlaneTilt size={18} weight="fill" /></button>
        </div>
      )}
      {error && <div className="voice-recorder-error" role="alert">{error}</div>}
    </div>
  );
}
