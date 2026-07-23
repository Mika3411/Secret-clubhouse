const LOCAL_RTC_CONFIGURATION = { iceServers: [] };

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getChannelPolicy(schedule, channelKey, now = new Date()) {
  const channel = schedule?.[channelKey];
  if (!channel) return { allowed: false, reason: "Ce type de communication n’est pas configuré." };
  if (!schedule.enabled) return { allowed: true, detail: "Disponible à toute heure" };
  if (!channel.enabled) {
    const disabledReason = channelKey === "video"
      ? "Les appels visio sont désactivés par un parent."
      : channelKey === "calls"
        ? "Les appels audio sont désactivés par un parent."
        : "Les messages sont désactivés par un parent.";
    return {
      allowed: false,
      reason: disabledReason,
      detail: "Un parent peut modifier ce réglage dans Mode calme.",
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(channel.start);
  const endMinutes = timeToMinutes(channel.end);
  const isInsideWindow = startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  const readableWindow = `${channel.start.replace(":", " h ")}–${channel.end.replace(":", " h ")}`;

  return isInsideWindow
    ? { allowed: true, detail: `Autorisé aujourd’hui de ${readableWindow}` }
    : {
        allowed: false,
        reason: channelKey === "video"
          ? "La visio est fermée pour le moment."
          : channelKey === "calls"
            ? "Les appels audio sont fermés pour le moment."
            : "Le mode calme est actif pour les messages.",
        detail: `Horaire autorisé : ${readableWindow}`,
      };
}

export async function openCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Ce navigateur ne permet pas d’utiliser la caméra.");
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export async function openMicrophoneStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Ce navigateur ne permet pas d’utiliser le micro.");
  }

  return navigator.mediaDevices.getUserMedia({
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export async function createRemoteAudioPlaceholder() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio n’est pas disponible dans ce navigateur.");

  const context = new AudioContextConstructor();
  await context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const destination = context.createMediaStreamDestination();
  oscillator.type = "sine";
  oscillator.frequency.value = 220;
  gain.gain.value = 0;
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();

  return {
    stream: destination.stream,
    stop: () => {
      try { oscillator.stop(); } catch { /* L’oscillateur peut déjà être arrêté. */ }
      destination.stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => undefined);
    },
  };
}

export function createRemoteVideoPlaceholder(name, colors = ["#6d52dc", "#6fe6c5"]) {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext("2d");
  let animationFrame;
  let phase = 0;

  const draw = () => {
    phase += 0.008;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const glowX = canvas.width * (0.5 + Math.sin(phase) * 0.18);
    const glow = context.createRadialGradient(glowX, 180, 20, glowX, 180, 330);
    glow.addColorStop(0, "rgba(255,255,255,.26)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(8, 10, 58, .22)";
    context.beginPath();
    context.arc(canvas.width / 2, 220, 112, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 122px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name.slice(0, 1).toUpperCase(), canvas.width / 2, 220);
    context.font = "700 42px sans-serif";
    context.fillText(name, canvas.width / 2, 395);
    context.font = "600 24px sans-serif";
    context.fillStyle = "rgba(255,255,255,.82)";
    context.fillText("Connexion WebRTC sécurisée", canvas.width / 2, 440);
    animationFrame = requestAnimationFrame(draw);
  };

  draw();
  const stream = canvas.captureStream(15);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(animationFrame);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}

export async function createLocalWebRtcSession({ localStream, remoteSourceStream, onRemoteStream, onStateChange }) {
  if (!window.RTCPeerConnection) throw new Error("WebRTC n’est pas disponible dans ce navigateur.");

  const caller = new RTCPeerConnection(LOCAL_RTC_CONFIGURATION);
  const receiver = new RTCPeerConnection(LOCAL_RTC_CONFIGURATION);
  const receivedRemoteStream = new MediaStream();

  caller.onicecandidate = ({ candidate }) => {
    if (candidate) receiver.addIceCandidate(candidate).catch(() => undefined);
  };
  receiver.onicecandidate = ({ candidate }) => {
    if (candidate) caller.addIceCandidate(candidate).catch(() => undefined);
  };
  caller.onconnectionstatechange = () => onStateChange?.(caller.connectionState);
  caller.ontrack = ({ track }) => {
    receivedRemoteStream.addTrack(track);
    onRemoteStream(receivedRemoteStream);
  };

  localStream.getTracks().forEach((track) => caller.addTrack(track, localStream));
  remoteSourceStream.getTracks().forEach((track) => receiver.addTrack(track, remoteSourceStream));

  const offer = await caller.createOffer();
  await caller.setLocalDescription(offer);
  await receiver.setRemoteDescription(offer);
  const answer = await receiver.createAnswer();
  await receiver.setLocalDescription(answer);
  await caller.setRemoteDescription(answer);

  return {
    caller,
    receiver,
    close: () => {
      caller.onicecandidate = null;
      receiver.onicecandidate = null;
      caller.ontrack = null;
      caller.close();
      receiver.close();
    },
  };
}

export function stopMediaStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
