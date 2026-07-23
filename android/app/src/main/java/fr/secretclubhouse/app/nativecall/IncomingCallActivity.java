package fr.secretclubhouse.app.nativecall;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Space;
import android.widget.TextView;
import androidx.core.content.ContextCompat;
import fr.secretclubhouse.app.R;
import fr.secretclubhouse.app.notifications.SecretClubhouseNotifications;
import java.lang.ref.WeakReference;
import java.util.Locale;

public class IncomingCallActivity extends Activity {

    private static WeakReference<IncomingCallActivity> currentActivity = new WeakReference<>(null);
    private String callId = "";
    private boolean actionStarted;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentActivity = new WeakReference<>(this);
        SecretClubhouseNotifications.ensureChannels(this);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        render(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        render(intent);
    }

    @Override
    protected void onDestroy() {
        IncomingCallActivity current = currentActivity.get();
        if (current == this) currentActivity = new WeakReference<>(null);
        super.onDestroy();
    }

    private void render(Intent intent) {
        String nextCallId = intent.getStringExtra(NativeCallContract.EXTRA_CALL_ID);
        if (nextCallId == null || nextCallId.isEmpty()) {
            finish();
            return;
        }
        if (!nextCallId.equals(callId)) actionStarted = false;
        callId = nextCallId;

        String rawCallerName = intent.getStringExtra(NativeCallContract.EXTRA_CALLER_NAME);
        String callerName = rawCallerName == null || rawCallerName.isEmpty()
            ? "Un contact autorisé"
            : rawCallerName.replace(" vous appelle", "");
        String callType = intent.getStringExtra(NativeCallContract.EXTRA_CALL_TYPE);
        boolean video = "video".equals(callType);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(28), dp(48), dp(28), dp(36));
        root.setBackgroundColor(ContextCompat.getColor(this, R.color.clubhouse_indigo));

        TextView eyebrow = text("MODE SÉCURISÉ • APPEL ENTRANT", 13, Color.rgb(96, 231, 199));
        eyebrow.setLetterSpacing(0.08f);
        root.addView(eyebrow, wrap());

        Space topSpace = new Space(this);
        root.addView(topSpace, new LinearLayout.LayoutParams(1, 0, 1f));

        TextView avatar = text(initials(callerName), 34, ContextCompat.getColor(this, R.color.clubhouse_indigo));
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(round(Color.rgb(191, 228, 255), 56));
        root.addView(avatar, new LinearLayout.LayoutParams(dp(112), dp(112)));

        TextView name = text(callerName, 30, Color.WHITE);
        name.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams nameLayout = wrap();
        nameLayout.topMargin = dp(24);
        root.addView(name, nameLayout);

        TextView kind = text(video ? "Appel vidéo entrant" : "Appel audio entrant", 17, Color.rgb(220, 217, 255));
        kind.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams kindLayout = wrap();
        kindLayout.topMargin = dp(8);
        root.addView(kind, kindLayout);

        TextView hint = text("Répondez ici, même lorsque l’application était fermée.", 14, Color.rgb(191, 188, 232));
        hint.setGravity(Gravity.CENTER);
        hint.setMaxWidth(dp(320));
        LinearLayout.LayoutParams hintLayout = wrap();
        hintLayout.topMargin = dp(18);
        root.addView(hint, hintLayout);

        Space bottomSpace = new Space(this);
        root.addView(bottomSpace, new LinearLayout.LayoutParams(1, 0, 1f));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);

        Button decline = actionButton("Refuser", ContextCompat.getColor(this, R.color.clubhouse_decline));
        decline.setOnClickListener(view -> performAction(NativeCallContract.ACTION_DECLINE));
        LinearLayout.LayoutParams declineLayout = new LinearLayout.LayoutParams(0, dp(64), 1f);
        declineLayout.setMarginEnd(dp(10));
        actions.addView(decline, declineLayout);

        Button accept = actionButton("Accepter", ContextCompat.getColor(this, R.color.clubhouse_mint));
        accept.setTextColor(ContextCompat.getColor(this, R.color.clubhouse_text));
        accept.setOnClickListener(view -> performAction(NativeCallContract.ACTION_ACCEPT));
        LinearLayout.LayoutParams acceptLayout = new LinearLayout.LayoutParams(0, dp(64), 1f);
        acceptLayout.setMarginStart(dp(10));
        actions.addView(accept, acceptLayout);

        root.addView(actions, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64)));
        setContentView(root);

        String requestedAction = NativeCallContract.actionName(intent.getAction());
        if (requestedAction.isEmpty()) {
            requestedAction = intent.getStringExtra(NativeCallContract.EXTRA_NATIVE_ACTION);
        }
        if ("accept".equals(requestedAction) && !actionStarted) {
            root.post(() -> performAction(NativeCallContract.ACTION_ACCEPT));
        }
    }

    private void performAction(String action) {
        if (actionStarted) return;
        actionStarted = true;
        Intent response = new Intent(this, CallActionReceiver.class)
            .setAction(action)
            .putExtras(getIntent());
        sendBroadcast(response);
        if (NativeCallContract.ACTION_ACCEPT.equals(action)) {
            renderConnecting();
        } else {
            finishAndRemoveTask();
        }
    }

    private void renderConnecting() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(32), dp(48), dp(32), dp(48));
        root.setBackgroundColor(ContextCompat.getColor(this, R.color.clubhouse_indigo));

        ProgressBar progress = new ProgressBar(this);
        progress.setIndeterminateTintList(ColorStateList.valueOf(ContextCompat.getColor(this, R.color.clubhouse_mint)));
        root.addView(progress, new LinearLayout.LayoutParams(dp(58), dp(58)));

        TextView title = text("Connexion sécurisée…", 24, Color.WHITE);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleLayout = wrap();
        titleLayout.topMargin = dp(24);
        root.addView(title, titleLayout);

        TextView detail = text("Vérification de l’appel avant d’ouvrir le micro ou la caméra.", 15, Color.rgb(220, 217, 255));
        detail.setGravity(Gravity.CENTER);
        detail.setMaxWidth(dp(320));
        LinearLayout.LayoutParams detailLayout = wrap();
        detailLayout.topMargin = dp(12);
        root.addView(detail, detailLayout);
        setContentView(root);
    }

    private Button actionButton(String label, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(16);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setBackgroundTintList(ColorStateList.valueOf(color));
        button.setMinHeight(dp(56));
        button.setContentDescription(label + " l’appel");
        return button;
    }

    private TextView text(String value, int sizeSp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        return view;
    }

    private GradientDrawable round(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static String initials(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) return "SC";
        String[] parts = trimmed.split("\\s+");
        if (parts.length == 1) {
            return parts[0].substring(0, Math.min(1, parts[0].length())).toUpperCase(Locale.ROOT);
        }
        return (
            parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)
        ).toUpperCase(Locale.ROOT);
    }

    public static void dismiss(String callId) {
        IncomingCallActivity activity = currentActivity.get();
        if (activity == null) return;
        if (callId == null || callId.equals(activity.callId)) {
            activity.runOnUiThread(activity::finishAndRemoveTask);
        }
    }
}
