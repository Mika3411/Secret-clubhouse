package fr.secretclubhouse.app.notifications;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import fr.secretclubhouse.app.nativecall.NativeCallNotificationsPlugin;

/**
 * Keeps Capacitor's normal PushNotifications events while adding Android-native
 * channel routing and the lock-screen call experience. Production FCM messages
 * should be data-only to ensure this service receives them in every app state.
 */
public class SecretClubhouseMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        SecretClubhouseNotifications.handleRemoteMessage(getApplicationContext(), remoteMessage);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        NativeCallNotificationsPlugin.saveFcmToken(getApplicationContext(), token);
        super.onNewToken(token);
    }
}
