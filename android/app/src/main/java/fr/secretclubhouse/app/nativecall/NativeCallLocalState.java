package fr.secretclubhouse.app.nativecall;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Persists only the local call lifecycle marker, never the call action token.
 *
 * The marker lets an "accepted" state push stop the other signed-in devices
 * without tearing down the Telecom connection on the device that accepted.
 */
public final class NativeCallLocalState {

    private static final String PREFERENCES = "secret_clubhouse_native_call_state";
    private static final String STATE_PREFIX = "state.";
    private static final String UPDATED_PREFIX = "updated.";
    private static final String ACCEPTING = "accepting";
    private static final String ACTIVE = "active";
    private static final long ACCEPTING_TTL_MILLIS = 2L * 60L * 1000L;
    private static final long ACTIVE_TTL_MILLIS = 12L * 60L * 60L * 1000L;

    private NativeCallLocalState() {}

    public static void markAccepting(Context context, String callId) {
        write(context, callId, ACCEPTING);
    }

    public static void markActive(Context context, String callId) {
        write(context, callId, ACTIVE);
    }

    public static boolean ownsAcceptedCall(Context context, String callId) {
        if (context == null || callId == null || callId.isEmpty()) return false;
        SharedPreferences stored = preferences(context);
        String state = stored.getString(STATE_PREFIX + callId, "");
        long updatedAt = stored.getLong(UPDATED_PREFIX + callId, 0L);
        long age = Math.max(0L, System.currentTimeMillis() - updatedAt);
        boolean current = (ACCEPTING.equals(state) && age <= ACCEPTING_TTL_MILLIS)
            || (ACTIVE.equals(state) && age <= ACTIVE_TTL_MILLIS);
        if (!current && !state.isEmpty()) clear(context, callId);
        return current;
    }

    public static void clear(Context context, String callId) {
        if (context == null || callId == null || callId.isEmpty()) return;
        preferences(context)
            .edit()
            .remove(STATE_PREFIX + callId)
            .remove(UPDATED_PREFIX + callId)
            .apply();
    }

    private static void write(Context context, String callId, String state) {
        if (context == null || callId == null || callId.isEmpty()) return;
        preferences(context)
            .edit()
            .putString(STATE_PREFIX + callId, state)
            .putLong(UPDATED_PREFIX + callId, System.currentTimeMillis())
            .apply();
    }

    private static SharedPreferences preferences(Context context) {
        return context
            .getApplicationContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }
}
