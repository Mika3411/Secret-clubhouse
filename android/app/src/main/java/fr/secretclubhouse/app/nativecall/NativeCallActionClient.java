package fr.secretclubhouse.app.nativecall;

import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import fr.secretclubhouse.app.R;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class NativeCallActionClient {

    private NativeCallActionClient() {}

    static boolean send(Context context, Bundle extras, String action) {
        String callId = extras.getString(NativeCallContract.EXTRA_CALL_ID, "");
        String actionToken = extras.getString(NativeCallContract.EXTRA_ACTION_TOKEN, "");
        if (callId.isEmpty() || actionToken.isEmpty()) return false;

        String configuredOrigin = context.getString(R.string.native_api_origin);
        String actionUrl = extras.getString(NativeCallContract.EXTRA_ACTION_URL, "");
        if (actionUrl.isEmpty()) {
            actionUrl = configuredOrigin + "/api/native/calls/" + Uri.encode(callId) + "/respond";
        }
        if (!isTrustedHttpsUrl(configuredOrigin, actionUrl)) return false;

        HttpURLConnection connection = null;
        try {
            JSONObject payload = new JSONObject()
                .put("action", action)
                .put("actionToken", actionToken);
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);

            connection = (HttpURLConnection) new URL(actionUrl).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(3_000);
            connection.setReadTimeout(3_000);
            connection.setDoOutput(true);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Authorization", "Bearer " + actionToken);
            connection.setRequestProperty("X-Call-Action-Token", actionToken);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }

            int status = connection.getResponseCode();
            drain(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
            return status >= 200 && status < 300;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static boolean isTrustedHttpsUrl(String configuredOrigin, String candidate) {
        try {
            Uri origin = Uri.parse(configuredOrigin);
            Uri target = Uri.parse(candidate);
            if (!"https".equalsIgnoreCase(target.getScheme())) return false;
            if (origin.getHost() == null || !origin.getHost().equalsIgnoreCase(target.getHost())) return false;
            int originPort = origin.getPort() == -1 ? 443 : origin.getPort();
            int targetPort = target.getPort() == -1 ? 443 : target.getPort();
            return originPort == targetPort && target.getPath() != null && target.getPath().startsWith("/api/native/calls/");
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void drain(InputStream input) throws IOException {
        if (input == null) return;
        try (InputStream stream = input) {
            byte[] buffer = new byte[512];
            while (stream.read(buffer) != -1) {
                // Response bodies contain no client state needed by the lock-screen action.
            }
        }
    }
}
