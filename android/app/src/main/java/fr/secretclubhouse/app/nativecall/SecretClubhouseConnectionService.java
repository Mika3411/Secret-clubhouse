package fr.secretclubhouse.app.nativecall;

import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import fr.secretclubhouse.app.notifications.SecretClubhouseNotifications;

public class SecretClubhouseConnectionService extends ConnectionService {

    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request == null || request.getExtras() == null
            ? new Bundle()
            : new Bundle(request.getExtras());
        Bundle nested = extras.getBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS);
        if (nested != null) extras.putAll(nested);

        String callId = extras.getString(NativeCallContract.EXTRA_CALL_ID, "");
        if (callId.isEmpty()) {
            return Connection.createFailedConnection(new DisconnectCause(DisconnectCause.ERROR));
        }
        SecretClubhouseConnection connection = new SecretClubhouseConnection(this, extras);
        NativeTelecomManager.registerConnection(callId, connection);
        return connection;
    }

    @Override
    public Connection onCreateOutgoingConnection(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        return Connection.createFailedConnection(new DisconnectCause(DisconnectCause.ERROR));
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request == null ? null : request.getExtras();
        if (extras == null) return;
        Bundle nested = extras.getBundle(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS);
        if (nested != null) extras = nested;
        String callId = extras.getString(NativeCallContract.EXTRA_CALL_ID, "");
        if (!callId.isEmpty()) SecretClubhouseNotifications.stopIncomingCall(this, callId, "cancelled");
    }
}
