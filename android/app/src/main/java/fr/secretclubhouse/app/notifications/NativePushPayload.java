package fr.secretclubhouse.app.notifications;

import android.os.Bundle;
import com.google.firebase.messaging.RemoteMessage;
import fr.secretclubhouse.app.nativecall.NativeCallContract;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

final class NativePushPayload {

    final String messageId;
    final String notificationType;
    final String title;
    final String body;
    final String tag;
    final String conversationId;
    final String callId;
    final String callType;
    final String callActionUrl;
    final String callActionToken;
    final String callActionMethod;
    final String expiresAt;
    final String status;

    private NativePushPayload(
        String messageId,
        String notificationType,
        String title,
        String body,
        String tag,
        String conversationId,
        String callId,
        String callType,
        String callActionUrl,
        String callActionToken,
        String callActionMethod,
        String expiresAt,
        String status
    ) {
        this.messageId = messageId;
        this.notificationType = notificationType;
        this.title = title;
        this.body = body;
        this.tag = tag;
        this.conversationId = conversationId;
        this.callId = callId;
        this.callType = callType;
        this.callActionUrl = callActionUrl;
        this.callActionToken = callActionToken;
        this.callActionMethod = callActionMethod;
        this.expiresAt = expiresAt;
        this.status = status;
    }

    static NativePushPayload from(RemoteMessage message) {
        Map<String, String> data = message.getData();
        RemoteMessage.Notification notification = message.getNotification();
        return fromData(
            data,
            value(message.getMessageId()),
            notification == null ? "" : value(notification.getTitle()),
            notification == null ? "" : value(notification.getBody())
        );
    }

    static NativePushPayload fromData(
        Map<String, String> data,
        String messageId,
        String fallbackTitle,
        String fallbackBody
    ) {
        String type = first(data, "notificationType", "notification_type", "type").toLowerCase(Locale.ROOT);
        String title = first(data, "title");
        String body = first(data, "body");
        String callerName = first(data, "callerName", "caller_name");
        if (!callerName.isEmpty() && ("incoming-call".equals(type) || "call-state".equals(type))) {
            title = callerName;
        }
        if (title.isEmpty()) title = value(fallbackTitle);
        if (body.isEmpty()) body = value(fallbackBody);
        return new NativePushPayload(
            value(messageId),
            type,
            title,
            body,
            first(data, "tag"),
            first(data, "conversationId", "conversation_id"),
            first(data, "callId", "call_id"),
            first(data, "callType", "call_type"),
            first(data, "callActionUrl", "respondUrl", "actionUrl", "call_action_url", "respond_url"),
            first(data, "callActionToken", "actionToken", "call_action_token"),
            first(data, "callActionMethod", "actionMethod", "call_action_method"),
            first(data, "expiresAt", "expires_at"),
            first(data, "status", "callStatus", "call_status").toLowerCase(Locale.ROOT)
        );
    }

    boolean isIncomingCall() {
        return "incoming-call".equals(notificationType) || ("call-state".equals(notificationType) && "ringing".equals(status));
    }

    boolean isCallState() {
        return "call-state".equals(notificationType)
            || "call-cancelled".equals(notificationType)
            || "call-ended".equals(notificationType)
            || "call-declined".equals(notificationType)
            || "call-missed".equals(notificationType);
    }

    boolean isTerminalCallState() {
        return isCallState() && (
            "cancelled".equals(status)
                || "accepted".equals(status)
                || "ended".equals(status)
                || "declined".equals(status)
                || "missed".equals(status)
                || "timeout".equals(status)
                || notificationType.startsWith("call-")
        );
    }

    boolean isContactRequest() {
        return "contact-request".equals(notificationType);
    }

    long expiresAtMillis() {
        if (expiresAt == null || expiresAt.isEmpty()) return 0L;
        try {
            long numeric = Long.parseLong(expiresAt);
            return numeric < 10_000_000_000L ? numeric * 1000L : numeric;
        } catch (NumberFormatException ignored) {
            // ISO-8601 values are handled below for API 24 compatibility.
        }

        String[] patterns = {
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.US);
                formatter.setLenient(false);
                formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = formatter.parse(expiresAt);
                if (parsed != null) return parsed.getTime();
            } catch (ParseException ignored) {
                // Try the next accepted server representation.
            }
        }
        return 0L;
    }

    Bundle callExtras() {
        Bundle extras = new Bundle();
        extras.putString(NativeCallContract.EXTRA_CALL_ID, callId);
        extras.putString(NativeCallContract.EXTRA_CALL_TYPE, callType);
        extras.putString(NativeCallContract.EXTRA_CONVERSATION_ID, conversationId);
        extras.putString(NativeCallContract.EXTRA_CALLER_NAME, title);
        extras.putString(NativeCallContract.EXTRA_ACTION_URL, callActionUrl);
        extras.putString(NativeCallContract.EXTRA_ACTION_TOKEN, callActionToken);
        extras.putString(NativeCallContract.EXTRA_ACTION_METHOD, callActionMethod);
        extras.putString(NativeCallContract.EXTRA_EXPIRES_AT, expiresAt);
        extras.putString(NativeCallContract.EXTRA_NOTIFICATION_TYPE, notificationType);
        extras.putString(NativeCallContract.EXTRA_STATUS, status);
        return extras;
    }

    private static String first(Map<String, String> data, String... keys) {
        for (String key : keys) {
            String found = data.get(key);
            if (found != null && !found.trim().isEmpty()) return found.trim();
        }
        return "";
    }

    private static String value(String input) {
        return input == null ? "" : input;
    }
}
