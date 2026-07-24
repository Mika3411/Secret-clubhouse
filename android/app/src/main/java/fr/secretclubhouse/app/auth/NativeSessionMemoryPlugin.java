package fr.secretclubhouse.app.auth;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeSessionMemory")
public final class NativeSessionMemoryPlugin extends Plugin {
    private static final Pattern SESSION_TOKEN_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static volatile String sessionToken;

    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("token", sessionToken == null ? "" : sessionToken);
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String token = call.getString("token", "").trim();
        if (!SESSION_TOKEN_PATTERN.matcher(token).matches()) {
            call.reject("Session native invalide.");
            return;
        }
        sessionToken = token;
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        sessionToken = null;
        call.resolve();
    }
}
