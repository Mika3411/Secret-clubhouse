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

export function createWebRtcSession({
  localStream,
  iceServers = [],
  onIceCandidate,
  onRemoteStream,
  onStateChange,
}) {
  if (!window.RTCPeerConnection) throw new Error("WebRTC n’est pas disponible dans ce navigateur.");

  const peer = new RTCPeerConnection({ iceServers: Array.isArray(iceServers) ? iceServers : [] });
  const fallbackRemoteStream = new MediaStream();
  const pendingRemoteCandidates = [];

  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
  peer.onicecandidate = ({ candidate }) => {
    if (!candidate) return;
    Promise.resolve(onIceCandidate?.(candidate.toJSON())).catch(() => undefined);
  };
  peer.onconnectionstatechange = () => onStateChange?.(peer.connectionState);
  peer.ontrack = (event) => {
    const stream = event.streams?.[0];
    if (stream) {
      onRemoteStream?.(stream);
      return;
    }
    if (!fallbackRemoteStream.getTracks().some((track) => track.id === event.track.id)) {
      fallbackRemoteStream.addTrack(event.track);
    }
    onRemoteStream?.(fallbackRemoteStream);
  };

  const flushRemoteCandidates = async () => {
    while (pendingRemoteCandidates.length) {
      await peer.addIceCandidate(pendingRemoteCandidates.shift());
    }
  };

  return {
    peer,
    async createOffer() {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      return peer.localDescription.toJSON();
    },
    async acceptOffer(offer) {
      await peer.setRemoteDescription(offer);
      await flushRemoteCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      return peer.localDescription.toJSON();
    },
    async acceptAnswer(answer) {
      await peer.setRemoteDescription(answer);
      await flushRemoteCandidates();
    },
    async addRemoteCandidate(candidate) {
      if (!peer.remoteDescription) {
        pendingRemoteCandidates.push(candidate);
        return;
      }
      await peer.addIceCandidate(candidate);
    },
    close() {
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.ontrack = null;
      peer.close();
      fallbackRemoteStream.getTracks().forEach((track) => track.stop());
      pendingRemoteCandidates.length = 0;
    },
  };
}

export function stopMediaStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
