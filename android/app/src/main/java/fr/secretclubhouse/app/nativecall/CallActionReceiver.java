package fr.secretclubhouse.app.nativecall;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import fr.secretclubhouse.app.MainActivity;
import fr.secretclubhouse.app.notifications.SecretClubhouseNotifications;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CallActionReceiver extends BroadcastReceiver {

    private static final ExecutorService NETWORK_EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = NativeCallContract.actionName(intent.getAction());
        Bundle extras = intent.getExtras() == null ? new Bundle() : new Bundle(intent.getExtras());
        String callId = extras.getString(NativeCallContract.EXTRA_CALL_ID, "");
        if (action.isEmpty() || callId.isEmpty()) return;

        if ("accept".equals(action)) {
            // Persist before starting the request: an "accepted" push may race
            // the HTTP response and must not tear down this device's connection.
            NativeCallLocalState.markAccepting(context, callId);
            SecretClubhouseNotifications.stopRingingOnly(context, callId);
        } else {
            NativeCallLocalState.clear(context, callId);
            SecretClubhouseNotifications.stopIncomingCallLocally(
                context,
                callId,
                "decline".equals(action) ? "declined" : "ended"
            );
        }

        PendingResult pendingResult = goAsync();
        NETWORK_EXECUTOR.execute(() -> {
            try {
                boolean acceptedByServer = NativeCallActionClient.send(context.getApplicationContext(), extras, action);
                if (acceptedByServer) {
                    if ("accept".equals(action)) {
                        NativeCallLocalState.markActive(context, callId);
                        NativeTelecomManager.answerCall(callId);
                    }
                    NativeCallNotificationsPlugin.emitPendingAction(context, callId, action);
                    if ("accept".equals(action)) {
                        IncomingCallActivity.dismiss(callId);
                        openAcceptedCall(context, extras, callId, action);
                    }
                } else {
                    NativeCallLocalState.clear(context, callId);
                    NativeTelecomManager.endCall(callId, "cancelled");
                    IncomingCallActivity.dismiss(callId);
                    NativeCallNotificationsPlugin.emitPendingAction(context, callId, "action-failed");
                }
            } finally {
                pendingResult.finish();
            }
        });
    }

    private static void openAcceptedCall(Context context, Bundle extras, String callId, String action) {
        Intent openApp = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(NativeCallContract.EXTRA_CALL_ID, callId)
            .putExtra(NativeCallContract.EXTRA_CALL_TYPE, extras.getString(NativeCallContract.EXTRA_CALL_TYPE, "audio"))
            .putExtra(
                NativeCallContract.EXTRA_CONVERSATION_ID,
                extras.getString(NativeCallContract.EXTRA_CONVERSATION_ID, "")
            )
            .putExtra(NativeCallContract.EXTRA_NATIVE_ACTION, action);
        context.startActivity(openApp);
    }
}
