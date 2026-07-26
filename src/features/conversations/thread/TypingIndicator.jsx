import { useEffect, useRef, useState } from "react";
import { api } from "../../../api";

export function useTypingIndicator(conversationId, enabled) {
  const [typingName, setTypingName] = useState(null);
  const lastSignalRef = useRef(0);
  const stopTimerRef = useRef(null);

  const stopTyping = () => {
    if (!enabled || !conversationId) return;
    window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    lastSignalRef.current = 0;
    void api.setTyping(conversationId, false).catch(() => {});
  };

  const notifyTyping = () => {
    if (!enabled || !conversationId) return;
    const now = Date.now();
    if (now - lastSignalRef.current > 2000) {
      lastSignalRef.current = now;
      void api.setTyping(conversationId, true).catch(() => {});
    }
    window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(stopTyping, 3500);
  };

  useEffect(() => {
    if (!enabled || !conversationId) {
      setTypingName(null);
      return undefined;
    }
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.typing(conversationId);
        if (active) setTypingName(result.typing ? result.name : null);
      } catch {
        if (active) setTypingName(null);
      }
    };
    void refresh();
    const pollTimer = window.setInterval(refresh, 1500);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearTimeout(stopTimerRef.current);
      void api.setTyping(conversationId, false).catch(() => {});
    };
  }, [conversationId, enabled]);

  return { typingName, notifyTyping, stopTyping };
}

export function TypingIndicator({ name }) {
  if (!name) return null;
  return <div className="typing-indicator" role="status" aria-live="polite"><span aria-hidden="true"><i /><i /><i /></span><small>{name} est en train d’écrire…</small></div>;
}
