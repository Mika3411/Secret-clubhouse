package fr.secretclubhouse.app.notifications;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

public class NativePushPayloadTest {

    @Test
    public void parsesIncomingCallDataAndRespondUrlAlias() {
        Map<String, String> data = new HashMap<>();
        data.put("notificationType", "incoming-call");
        data.put("title", "Cyrille vous appelle");
        data.put("callId", "11111111-1111-1111-1111-111111111111");
        data.put("callType", "video");
        data.put("conversationId", "22222222-2222-2222-2222-222222222222");
        data.put("respondUrl", "https://secret-clubhouse.onrender.com/api/native/calls/111/respond");
        data.put("callActionToken", "short-lived-token");
        data.put("expiresAt", "2026-07-23T18:10:45.000Z");

        NativePushPayload payload = NativePushPayload.fromData(data, "message-1", "", "");

        assertTrue(payload.isIncomingCall());
        assertFalse(payload.isTerminalCallState());
        assertEquals("video", payload.callType);
        assertEquals(
            "https://secret-clubhouse.onrender.com/api/native/calls/111/respond",
            payload.callActionUrl
        );
        assertTrue(payload.expiresAtMillis() > 0L);
    }

    @Test
    public void acceptedCallStateStopsRingingOnOtherInstallations() {
        Map<String, String> data = new HashMap<>();
        data.put("notificationType", "call-state");
        data.put("callId", "11111111-1111-1111-1111-111111111111");
        data.put("status", "accepted");

        NativePushPayload payload = NativePushPayload.fromData(data, "message-2", "", "");

        assertTrue(payload.isCallState());
        assertTrue(payload.isTerminalCallState());
    }

    @Test
    public void contactRequestUsesDedicatedCategory() {
        Map<String, String> data = new HashMap<>();
        data.put("notificationType", "contact-request");

        NativePushPayload payload = NativePushPayload.fromData(
            data,
            "message-3",
            "Nouvelle demande",
            "À approuver"
        );

        assertTrue(payload.isContactRequest());
        assertEquals("Nouvelle demande", payload.title);
        assertEquals("À approuver", payload.body);
    }
}
