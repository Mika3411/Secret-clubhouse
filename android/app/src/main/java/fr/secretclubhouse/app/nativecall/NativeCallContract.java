package fr.secretclubhouse.app.nativecall;

public final class NativeCallContract {

    public static final String ACTION_ACCEPT = "fr.secretclubhouse.app.action.ACCEPT_CALL";
    public static final String ACTION_DECLINE = "fr.secretclubhouse.app.action.DECLINE_CALL";
    public static final String ACTION_HANGUP = "fr.secretclubhouse.app.action.HANGUP_CALL";

    public static final String EXTRA_CALL_ID = "secretclubhouse.callId";
    public static final String EXTRA_CALL_TYPE = "secretclubhouse.callType";
    public static final String EXTRA_CONVERSATION_ID = "secretclubhouse.conversationId";
    public static final String EXTRA_CALLER_NAME = "secretclubhouse.callerName";
    public static final String EXTRA_ACTION_URL = "secretclubhouse.callActionUrl";
    public static final String EXTRA_ACTION_TOKEN = "secretclubhouse.callActionToken";
    public static final String EXTRA_ACTION_METHOD = "secretclubhouse.callActionMethod";
    public static final String EXTRA_EXPIRES_AT = "secretclubhouse.expiresAt";
    public static final String EXTRA_NATIVE_ACTION = "secretclubhouse.nativeAction";
    public static final String EXTRA_NOTIFICATION_TYPE = "secretclubhouse.notificationType";
    public static final String EXTRA_STATUS = "secretclubhouse.status";

    private NativeCallContract() {}

    public static int notificationId(String callId) {
        return 0x43000000 | (callId == null ? 0 : callId.hashCode() & 0x00ffffff);
    }

    public static String notificationTag(String callId) {
        return "secret-clubhouse-call-" + (callId == null ? "unknown" : callId);
    }

    public static String actionName(String intentAction) {
        if (ACTION_ACCEPT.equals(intentAction)) return "accept";
        if (ACTION_DECLINE.equals(intentAction)) return "decline";
        if (ACTION_HANGUP.equals(intentAction)) return "hangup";
        return "";
    }
}
