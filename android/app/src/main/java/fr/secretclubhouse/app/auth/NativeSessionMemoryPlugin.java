package fr.secretclubhouse.app.auth;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "NativeSessionMemory")
public final class NativeSessionMemoryPlugin extends Plugin {
    private static final Pattern SESSION_TOKEN_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "secret_clubhouse_native_session_v1";
    private static final String PREFERENCES = "secret_clubhouse_secure_session";
    private static final String CIPHERTEXT_KEY = "ciphertext";
    private static final String IV_KEY = "iv";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("token", readToken());
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String token = call.getString("token", "").trim();
        if (!SESSION_TOKEN_PATTERN.matcher(token).matches()) {
            call.reject("Session native invalide.");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            boolean stored = preferences()
                .edit()
                .putString(CIPHERTEXT_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(IV_KEY, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .commit();
            if (!stored) {
                call.reject("La session native n’a pas pu être protégée.");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("La session native n’a pas pu être protégée.");
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        preferences().edit().remove(CIPHERTEXT_KEY).remove(IV_KEY).commit();
        call.resolve();
    }

    private String readToken() {
        String encryptedValue = preferences().getString(CIPHERTEXT_KEY, "");
        String ivValue = preferences().getString(IV_KEY, "");
        if (encryptedValue.isEmpty() || ivValue.isEmpty()) return "";
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP))
            );
            String token = new String(
                cipher.doFinal(Base64.decode(encryptedValue, Base64.NO_WRAP)),
                StandardCharsets.UTF_8
            );
            if (SESSION_TOKEN_PATTERN.matcher(token).matches()) return token;
        } catch (Exception ignored) {
            // Une donnée devenue illisible ne doit jamais être utilisée comme session.
        }
        preferences().edit().remove(CIPHERTEXT_KEY).remove(IV_KEY).commit();
        return "";
    }

    private synchronized SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    private SharedPreferences preferences() {
        return getContext()
            .getApplicationContext()
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }
}
