package fr.secretclubhouse.app.nativecall;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;
import fr.secretclubhouse.app.notifications.SecretClubhouseNotifications;
import java.lang.ref.WeakReference;
import java.util.UUID;

@CapacitorPlugin(name = "NativeCallNotifications")
public class NativeCallNotificationsPlugin extends Plugin {

    private static final String PREFERENCES = "secret_clubhouse_native_notifications";
    private static final String KEY_CALL_ID = "pending_call_id";
    private static final String KEY_ACTION = "pending_action";
    private static final String KEY_FCM_TOKEN = "fcm_token";
    private static final String KEY_DEVICE_ID = "device_id";
    private static WeakReference<NativeCallNotificationsPlugin> activePlugin = new WeakReference<>(null);

    @Override
    public void load() {
        activePlugin = new WeakReference<>(this);
        emitPendingStateIfPresent();
        emitStoredToken();
        try {
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                if (token != null && !token.isEmpty()) saveFcmToken(getContext(), token);
            });
        } catch (IllegalStateException ignored) {
            // A locally built APK can run before its real google-services.json
            // is supplied; FCM registration simply remains unavailable.
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        captureIntent(getContext(), intent);
    }

    @PluginMethod
    public void getPendingState(PluginCall call) {
        JSObject state = readState(getContext());
        String token = preferences(getContext()).getString(KEY_FCM_TOKEN, "");
        if (!token.isEmpty()) {
            state.put("token", token);
            call.resolve(state);
            return;
        }

        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null) {
                    String refreshedToken = task.getResult();
                    saveFcmToken(getContext(), refreshedToken);
                    state.put("token", refreshedToken);
                }
                call.resolve(state);
            });
        } catch (IllegalStateException ignored) {
            call.resolve(state);
        }
    }

    @PluginMethod
    public void clearPendingState(PluginCall call) {
        preferences(getContext())
            .edit()
            .remove(KEY_CALL_ID)
            .remove(KEY_ACTION)
            .apply();
        call.resolve();
    }

    @PluginMethod
    public void endNativeCall(PluginCall call) {
        String callId = call.getString("callId", "");
        String status = call.getString("status", "ended");
        if (callId.isEmpty()) {
            call.reject("callId is required");
            return;
        }
        SecretClubhouseNotifications.stopIncomingCall(getContext(), callId, status);
        call.resolve();
    }

    public static void captureIntent(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String callId = intent.getStringExtra(NativeCallContract.EXTRA_CALL_ID);
        String action = intent.getStringExtra(NativeCallContract.EXTRA_NATIVE_ACTION);
        if (callId == null || callId.isEmpty() || action == null || action.isEmpty()) return;
        emitPendingAction(context, callId, action);
    }

    public static void emitPendingAction(Context context, String callId, String action) {
        if (context == null || callId == null || callId.isEmpty()) return;
        preferences(context)
            .edit()
            .putString(KEY_CALL_ID, callId)
            .putString(KEY_ACTION, action == null ? "" : action)
            .apply();
        NativeCallNotificationsPlugin plugin = activePlugin.get();
        if (plugin != null) plugin.emitPendingStateIfPresent();
    }

    public static void emitCallState(Context context, String callId, String status) {
        emitPendingAction(context, callId, status == null || status.isEmpty() ? "ended" : status);
    }

    public static void saveFcmToken(Context context, String token) {
        if (context == null || token == null || token.isEmpty()) return;
        preferences(context).edit().putString(KEY_FCM_TOKEN, token).apply();

        PushNotificationsPlugin pushPlugin = PushNotificationsPlugin.getPushNotificationsInstance();
        if (pushPlugin != null) pushPlugin.sendToken(token);

        NativeCallNotificationsPlugin plugin = activePlugin.get();
        if (plugin != null) plugin.emitToken(token);
    }

    private void emitPendingStateIfPresent() {
        JSObject state = readState(getContext());
        if (state.getString("callId", "").isEmpty()) return;
        notifyListeners("nativeCallAction", state, true);
        String detail = new JSObject()
            .put("callId", state.getString("callId", ""))
            .put("action", state.getString("action", ""))
            .toString();
        if (bridge != null) {
            bridge.eval(
                "window.dispatchEvent(new CustomEvent('secretclubhouse:native-call-action',{detail:" + detail + "}));",
                null
            );
        }
    }

    private void emitStoredToken() {
        String token = preferences(getContext()).getString(KEY_FCM_TOKEN, "");
        if (!token.isEmpty()) {
            PushNotificationsPlugin pushPlugin = PushNotificationsPlugin.getPushNotificationsInstance();
            if (pushPlugin != null) pushPlugin.sendToken(token);
            emitToken(token);
        }
    }

    private void emitToken(String token) {
        JSObject state = new JSObject()
            .put("token", token)
            .put("platform", "android")
            .put("tokenKind", "fcm")
            .put("deviceId", deviceId(getContext()));
        notifyListeners("nativePushToken", state, true);
        if (bridge != null) {
            bridge.eval(
                "window.dispatchEvent(new CustomEvent('secretclubhouse:native-push-token',{detail:" + state + "}));",
                null
            );
        }
    }

    private static JSObject readState(Context context) {
        SharedPreferences stored = preferences(context);
        return new JSObject()
            .put("callId", stored.getString(KEY_CALL_ID, ""))
            .put("action", stored.getString(KEY_ACTION, ""))
            .put("platform", "android")
            .put("tokenKind", "fcm")
            .put("deviceId", deviceId(context));
    }

    private static String deviceId(Context context) {
        SharedPreferences stored = preferences(context);
        String value = stored.getString(KEY_DEVICE_ID, "");
        if (!value.isEmpty()) return value;
        value = "android-" + UUID.randomUUID();
        stored.edit().putString(KEY_DEVICE_ID, value).apply();
        return value;
    }

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }
}
