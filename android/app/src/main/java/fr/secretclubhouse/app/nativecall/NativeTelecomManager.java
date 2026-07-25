package fr.secretclubhouse.app.nativecall;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.telecom.VideoProfile;
import androidx.annotation.RequiresApi;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;

public final class NativeTelecomManager {

    private static final String PHONE_ACCOUNT_ID = "secret-clubhouse-voip";
    private static final String FEATURE_TELECOM = "android.software.telecom";
    private static final ConcurrentHashMap<String, SecretClubhouseConnection> CONNECTIONS = new ConcurrentHashMap<>();

    private NativeTelecomManager() {}

    public static boolean isSupported(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && context.getPackageManager().hasSystemFeature(FEATURE_TELECOM);
    }

    public static void registerPhoneAccount(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isSupported(context)) return;
        registerPhoneAccountFromO(context);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static void registerPhoneAccountFromO(Context context) {
        TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
        if (telecom == null) return;
        try {
            PhoneAccount account = PhoneAccount.builder(handle(context), "Secret Clubhouse")
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED | PhoneAccount.CAPABILITY_VIDEO_CALLING)
                .setSupportedUriSchemes(Collections.singletonList(PhoneAccount.SCHEME_SIP))
                .build();
            telecom.registerPhoneAccount(account);
        } catch (SecurityException | IllegalArgumentException ignored) {
            // The high-priority CallStyle notification remains the API 24+ fallback.
        }
    }

    public static void reportIncomingCall(Context context, Bundle callExtras) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isSupported(context)) return;
        reportIncomingCallFromO(context, callExtras);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static void reportIncomingCallFromO(Context context, Bundle callExtras) {
        registerPhoneAccountFromO(context);
        TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
        if (telecom == null) return;

        String callId = callExtras.getString(NativeCallContract.EXTRA_CALL_ID, "");
        if (callId.isEmpty()) return;
        Bundle extras = new Bundle(callExtras);
        extras.putParcelable(
            TelecomManager.EXTRA_INCOMING_CALL_ADDRESS,
            Uri.parse("sip:" + callId + "@secret.clubhouse.invalid")
        );
        extras.putInt(
            TelecomManager.EXTRA_INCOMING_VIDEO_STATE,
            "video".equals(callExtras.getString(NativeCallContract.EXTRA_CALL_TYPE))
                ? VideoProfile.STATE_BIDIRECTIONAL
                : VideoProfile.STATE_AUDIO_ONLY
        );
        try {
            telecom.addNewIncomingCall(handle(context), extras);
        } catch (SecurityException | IllegalArgumentException ignored) {
            // Notification UI remains available when an OEM does not expose Telecom.
        }
    }

    public static void answerCall(String callId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        answerCallFromO(callId);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static void answerCallFromO(String callId) {
        SecretClubhouseConnection connection = CONNECTIONS.get(callId);
        if (connection != null) connection.markActiveFromApp();
    }

    public static void endCall(String callId, String status) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        endCallFromO(callId, status);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static void endCallFromO(String callId, String status) {
        SecretClubhouseConnection connection = CONNECTIONS.remove(callId);
        if (connection == null) return;
        int code = "declined".equals(status)
            ? DisconnectCause.REJECTED
            : ("missed".equals(status) ? DisconnectCause.MISSED : DisconnectCause.CANCELED);
        connection.closeFromApp(code);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    static void registerConnection(String callId, SecretClubhouseConnection connection) {
        if (callId != null && !callId.isEmpty()) CONNECTIONS.put(callId, connection);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    static void removeConnection(String callId, SecretClubhouseConnection connection) {
        if (callId != null) CONNECTIONS.remove(callId, connection);
    }

    @RequiresApi(Build.VERSION_CODES.O)
    static PhoneAccountHandle handle(Context context) {
        return new PhoneAccountHandle(
            new ComponentName(context, SecretClubhouseConnectionService.class),
            PHONE_ACCOUNT_ID
        );
    }
}
