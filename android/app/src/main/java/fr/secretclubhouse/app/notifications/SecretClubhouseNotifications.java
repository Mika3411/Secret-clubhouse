package fr.secretclubhouse.app.notifications;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import fr.secretclubhouse.app.MainActivity;
import fr.secretclubhouse.app.R;
import fr.secretclubhouse.app.nativecall.CallActionReceiver;
import fr.secretclubhouse.app.nativecall.IncomingCallActivity;
import fr.secretclubhouse.app.nativecall.NativeCallContract;
import fr.secretclubhouse.app.nativecall.NativeCallLocalState;
import fr.secretclubhouse.app.nativecall.NativeCallNotificationsPlugin;
import fr.secretclubhouse.app.nativecall.NativeTelecomManager;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

public final class SecretClubhouseNotifications {

    public static final String CHANNEL_MESSAGES = "clubhouse_messages_v1";
    public static final String CHANNEL_CONTACT_REQUESTS = "clubhouse_contact_requests_v1";
    public static final String CHANNEL_CALLS = "clubhouse_calls_v1";

    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private static final ConcurrentHashMap<String, Runnable> CALL_EXPIRATIONS = new ConcurrentHashMap<>();

    private SecretClubhouseNotifications() {}

    public static void handleRemoteMessage(Context context, RemoteMessage message) {
        Context appContext = context.getApplicationContext();
        ensureChannels(appContext);
        NativePushPayload payload = NativePushPayload.from(message);

        if (!payload.callId.isEmpty() && payload.isTerminalCallState()) {
            if (
                "accepted".equals(payload.status)
                    && NativeCallLocalState.ownsAcceptedCall(appContext, payload.callId)
            ) {
                // This is the accepting device. Silence its incoming UI while
                // preserving the active/self-managed Telecom connection. The
                // action receiver publishes "accept" after the server confirms
                // it; publishing "accepted" here could overwrite that pending
                // resume action before the WebView is ready.
                stopRingingOnly(appContext, payload.callId);
                return;
            }
            stopIncomingCall(appContext, payload.callId, payload.status.isEmpty() ? "ended" : payload.status);
            return;
        }

        if (payload.isIncomingCall() && !payload.callId.isEmpty()) {
            long expiresAt = payload.expiresAtMillis();
            if (expiresAt > 0L && expiresAt <= System.currentTimeMillis()) {
                stopIncomingCall(appContext, payload.callId, "missed");
                return;
            }
            showIncomingCall(appContext, payload, expiresAt);
            return;
        }

        showStandardNotification(appContext, payload);
    }

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        AudioAttributes notificationAudio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        AudioAttributes ringtoneAudio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        NotificationChannel messages = new NotificationChannel(
            CHANNEL_MESSAGES,
            "Messages discrets",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        messages.setDescription("Nouveaux messages et invitations à jouer");
        messages.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        messages.setSound(rawUri(context, R.raw.message_discreet), notificationAudio);
        messages.enableVibration(false);
        messages.enableLights(true);
        messages.setLightColor(Color.rgb(96, 231, 199));
        messages.setBypassDnd(false);

        NotificationChannel requests = new NotificationChannel(
            CHANNEL_CONTACT_REQUESTS,
            "Demandes de contact",
            NotificationManager.IMPORTANCE_HIGH
        );
        requests.setDescription("Demandes de contact à approuver dans l’espace parent");
        requests.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        requests.setSound(rawUri(context, R.raw.contact_gentle), notificationAudio);
        requests.enableVibration(true);
        requests.enableLights(true);
        requests.setLightColor(Color.rgb(139, 104, 246));
        requests.setBypassDnd(false);

        NotificationChannel calls = new NotificationChannel(
            CHANNEL_CALLS,
            "Appels audio et vidéo",
            NotificationManager.IMPORTANCE_HIGH
        );
        calls.setDescription("Sonnerie douce pour les appels entrants");
        calls.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        calls.setSound(rawUri(context, R.raw.incoming_call_soft), ringtoneAudio);
        calls.enableVibration(true);
        calls.enableLights(true);
        calls.setLightColor(Color.rgb(96, 231, 199));
        calls.setBypassDnd(false);

        manager.createNotificationChannel(messages);
        manager.createNotificationChannel(requests);
        manager.createNotificationChannel(calls);
    }

    public static void stopIncomingCall(Context context, String callId, String status) {
        stopIncomingCallInternal(context, callId, status, true);
    }

    public static void stopIncomingCallLocally(Context context, String callId, String status) {
        stopIncomingCallInternal(context, callId, status, false);
    }

    private static void stopIncomingCallInternal(Context context, String callId, String status, boolean emitState) {
        if (callId == null || callId.isEmpty()) return;
        NativeCallLocalState.clear(context, callId);
        cancelExpiration(callId);
        NotificationManagerCompat.from(context).cancel(
            NativeCallContract.notificationTag(callId),
            NativeCallContract.notificationId(callId)
        );
        NativeTelecomManager.endCall(callId, status);
        IncomingCallActivity.dismiss(callId);
        if (emitState) NativeCallNotificationsPlugin.emitCallState(context, callId, status);
    }

    public static void stopRingingOnly(Context context, String callId) {
        cancelExpiration(callId);
        NotificationManagerCompat.from(context).cancel(
            NativeCallContract.notificationTag(callId),
            NativeCallContract.notificationId(callId)
        );
    }

    private static void showIncomingCall(Context context, NativePushPayload payload, long expiresAt) {
        NativeTelecomManager.reportIncomingCall(context, payload.callExtras());
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED
        ) {
            return;
        }

        Intent fullScreenIntent = new Intent(context, IncomingCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtras(payload.callExtras());
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            NativeCallContract.notificationId(payload.callId),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent acceptIntent = callActionPendingIntent(context, payload, NativeCallContract.ACTION_ACCEPT, 1);
        PendingIntent declineIntent = callActionPendingIntent(context, payload, NativeCallContract.ACTION_DECLINE, 2);

        String callerName = payload.title.isEmpty() ? "Un contact autorisé" : payload.title.replace(" vous appelle", "");
        String callDescription = "video".equals(payload.callType)
            ? "Appel vidéo entrant"
            : "Appel audio entrant";
        Person caller = new Person.Builder().setName(callerName).setImportant(true).build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_CALLS)
            .setSmallIcon(R.drawable.ic_stat_clubhouse)
            .setColor(Color.rgb(96, 231, 199))
            .setContentTitle(callerName)
            .setContentText(callDescription)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenPendingIntent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, acceptIntent));
        } else {
            builder
                .addAction(R.drawable.ic_call_decline, "Refuser", declineIntent)
                .addAction(R.drawable.ic_call_accept, "Accepter", acceptIntent);
        }

        long remaining = expiresAt > 0L ? Math.max(1_000L, expiresAt - System.currentTimeMillis()) : 45_000L;
        builder.setTimeoutAfter(Math.min(remaining, 120_000L));
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder
                .setSound(rawUri(context, R.raw.incoming_call_soft))
                .setVibrate(new long[] { 0L, 350L, 250L, 350L });
        }
        if (canUseFullScreenIntent(context)) {
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
        }

        try {
            NotificationManagerCompat.from(context).notify(
                NativeCallContract.notificationTag(payload.callId),
                NativeCallContract.notificationId(payload.callId),
                builder.build()
            );
        } catch (SecurityException ignored) {
            return;
        }
        scheduleExpiration(context, payload.callId, remaining);
    }

    private static void showStandardNotification(Context context, NativePushPayload payload) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED
        ) {
            return;
        }
        String channelId = payload.isContactRequest() ? CHANNEL_CONTACT_REQUESTS : CHANNEL_MESSAGES;
        String title = payload.title.isEmpty() ? "Secret Clubhouse" : payload.title;
        String body = payload.body.isEmpty() ? "Vous avez une nouvelle activité." : payload.body;

        Intent openIntent = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("google.message_id", payload.messageId.isEmpty() ? "native-" + System.currentTimeMillis() : payload.messageId)
            .putExtra("notificationType", payload.notificationType)
            .putExtra("conversationId", payload.conversationId);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            stableId(payload.tag + payload.messageId),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_clubhouse)
            .setColor(Color.rgb(96, 231, 199))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(payload.isContactRequest() ? NotificationCompat.CATEGORY_SOCIAL : NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(payload.isContactRequest() ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(
                rawUri(context, payload.isContactRequest() ? R.raw.contact_gentle : R.raw.message_discreet)
            );
        }

        String tag = payload.tag.isEmpty()
            ? "secret-clubhouse-" + payload.notificationType
            : payload.tag;
        try {
            NotificationManagerCompat.from(context).notify(tag, stableId(tag + payload.messageId), builder.build());
        } catch (SecurityException ignored) {
            // Permission may have been revoked between the explicit check and posting.
        }
    }

    private static PendingIntent callActionPendingIntent(
        Context context,
        NativePushPayload payload,
        String action,
        int offset
    ) {
        if (NativeCallContract.ACTION_ACCEPT.equals(action)) {
            Intent acceptActivity = new Intent(context, IncomingCallActivity.class)
                .setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(NativeCallContract.EXTRA_NATIVE_ACTION, "accept")
                .putExtras(payload.callExtras());
            return PendingIntent.getActivity(
                context,
                NativeCallContract.notificationId(payload.callId) + offset,
                acceptActivity,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }
        Intent intent = new Intent(context, CallActionReceiver.class)
            .setAction(action)
            .putExtras(payload.callExtras());
        return PendingIntent.getBroadcast(
            context,
            NativeCallContract.notificationId(payload.callId) + offset,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static boolean canUseFullScreenIntent(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.canUseFullScreenIntent();
    }

    private static Uri rawUri(Context context, int resourceId) {
        return Uri.parse("android.resource://" + context.getPackageName() + "/" + resourceId);
    }

    private static int stableId(String source) {
        return 0x42000000 | (source == null ? 0 : source.hashCode() & 0x00ffffff);
    }

    private static void scheduleExpiration(Context context, String callId, long remaining) {
        cancelExpiration(callId);
        Runnable expiration = () -> stopIncomingCall(context.getApplicationContext(), callId, "missed");
        CALL_EXPIRATIONS.put(callId, expiration);
        MAIN_HANDLER.postDelayed(expiration, Math.max(1_000L, Math.min(remaining, 120_000L)));
    }

    private static void cancelExpiration(String callId) {
        Runnable expiration = CALL_EXPIRATIONS.remove(callId);
        if (expiration != null) MAIN_HANDLER.removeCallbacks(expiration);
    }
}
