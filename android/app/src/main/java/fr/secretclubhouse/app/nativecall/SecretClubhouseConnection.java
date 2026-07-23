package fr.secretclubhouse.app.nativecall;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.DisconnectCause;
import android.telecom.TelecomManager;
import android.telecom.VideoProfile;
import androidx.annotation.RequiresApi;

@RequiresApi(26)
final class SecretClubhouseConnection extends Connection {

    private final Context context;
    private final Bundle extras;
    private final String callId;
    private boolean closed;

    SecretClubhouseConnection(Context context, Bundle sourceExtras) {
        this.context = context.getApplicationContext();
        this.extras = sourceExtras == null ? new Bundle() : new Bundle(sourceExtras);
        this.callId = extras.getString(NativeCallContract.EXTRA_CALL_ID, "");
        String callerName = extras.getString(NativeCallContract.EXTRA_CALLER_NAME, "Un contact autorisé");
        String callType = extras.getString(NativeCallContract.EXTRA_CALL_TYPE, "audio");

        setAddress(Uri.parse("sip:" + callId + "@secret.clubhouse.invalid"), TelecomManager.PRESENTATION_ALLOWED);
        setCallerDisplayName(callerName.replace(" vous appelle", ""), TelecomManager.PRESENTATION_ALLOWED);
        setConnectionProperties(Connection.PROPERTY_SELF_MANAGED);
        setConnectionCapabilities(Connection.CAPABILITY_MUTE);
        setAudioModeIsVoip(true);
        setVideoState("video".equals(callType) ? VideoProfile.STATE_BIDIRECTIONAL : VideoProfile.STATE_AUDIO_ONLY);
        setRinging();
    }

    @Override
    public void onAnswer() {
        markActiveFromApp();
        dispatch(NativeCallContract.ACTION_ACCEPT);
    }

    @Override
    public void onAnswer(int videoState) {
        setVideoState(videoState);
        onAnswer();
    }

    @Override
    public void onReject() {
        dispatch(NativeCallContract.ACTION_DECLINE);
        closeFromApp(DisconnectCause.REJECTED);
    }

    @Override
    public void onReject(int rejectReason) {
        onReject();
    }

    @Override
    public void onReject(String replyMessage) {
        onReject();
    }

    @Override
    public void onDisconnect() {
        dispatch(NativeCallContract.ACTION_HANGUP);
        closeFromApp(DisconnectCause.LOCAL);
    }

    void markActiveFromApp() {
        if (!closed) setActive();
    }

    void closeFromApp(int disconnectCode) {
        if (closed) return;
        closed = true;
        setDisconnected(new DisconnectCause(disconnectCode));
        destroy();
        NativeTelecomManager.removeConnection(callId, this);
    }

    private void dispatch(String action) {
        Intent response = new Intent(context, CallActionReceiver.class)
            .setAction(action)
            .putExtras(extras);
        context.sendBroadcast(response);
    }
}
