package fr.secretclubhouse.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import fr.secretclubhouse.app.nativecall.NativeCallNotificationsPlugin;
import fr.secretclubhouse.app.nativecall.NativeTelecomManager;
import fr.secretclubhouse.app.notifications.SecretClubhouseNotifications;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeCallNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        SecretClubhouseNotifications.ensureChannels(this);
        NativeTelecomManager.registerPhoneAccount(this);
        NativeCallNotificationsPlugin.captureIntent(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        NativeCallNotificationsPlugin.captureIntent(this, intent);
    }
}
