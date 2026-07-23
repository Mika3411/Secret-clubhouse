# Android native push and incoming calls

The Android client contains the FCM receiver, notification channels, lock-screen call UI,
and Telecom integration. A real Firebase configuration is intentionally not committed.

## Firebase client configuration

1. Create an Android app in the Firebase project with package name
   `fr.secretclubhouse.app`.
2. Download its real `google-services.json`.
3. Place it at `android/app/google-services.json`.
4. Run `npm run mobile:sync` before building the APK.

Do not put a Firebase service-account JSON file in the Android project or in the APK.
Server credentials belong only in Render secrets.

The Capacitor `PushNotifications.registration` event remains the canonical FCM token
source. The local `NativeCallNotifications` plugin also exposes:

- `getPendingState()`
- `clearPendingState()`
- `endNativeCall({ callId, status })`
- the `nativeCallAction` and `nativePushToken` plugin events
- the window events `secretclubhouse:native-call-action` and
  `secretclubhouse:native-push-token`

`getPendingState()` returns an opaque per-installation `deviceId`, the latest FCM token
when available, and any pending lock-screen call action.

## FCM payload

Production messages must be **data-only** FCM messages so the custom service receives
them whether the WebView is active, backgrounded, or stopped. All FCM `data` values
must be strings.

Incoming-call fields:

```json
{
  "notificationType": "incoming-call",
  "title": "Cyrille vous appelle",
  "body": "Appel audio entrant",
  "callId": "server-call-uuid",
  "callType": "audio",
  "conversationId": "server-conversation-uuid",
  "callActionToken": "short-lived-call-scoped-token",
  "callActionUrl": "https://secret-clubhouse.onrender.com/api/native/calls/server-call-uuid/respond",
  "expiresAt": "2026-07-23T18:10:45.000Z"
}
```

The action URL must use HTTPS, match the host in `native_api_origin`, and start with
`/api/native/calls/`. Accept and decline send:

```json
{ "action": "accept", "actionToken": "short-lived-call-scoped-token" }
```

The token is also sent as `X-Call-Action-Token` and as a Bearer token. It must never be
a normal account session token.

To stop ringing on every terminal state, send a high-priority data message containing
`notificationType: "call-state"`, the `callId`, and one of these `status` values:
`cancelled`, `declined`, `ended`, `missed`, or `timeout`.

## Channels and bundled sounds

- `clubhouse_messages_v1` → `message_discreet.wav`
- `clubhouse_contact_requests_v1` → `contact_gentle.wav`
- `clubhouse_calls_v1` → `incoming_call_soft.wav`

The small WAV files are generated deterministically by
`app/native-notification-sounds.gradle` during `preBuild`.

Android notification-channel sound settings are immutable after channel creation.
Changing a channel sound later therefore requires a new versioned channel ID.

## Lock-screen behavior

Android 14 and later can revoke full-screen intent access. The client checks
`NotificationManager.canUseFullScreenIntent()` before attaching the full-screen
activity. When access is unavailable, Android shows the high-priority `CallStyle`
notification with Accept and Decline actions instead.

The client never requests Do Not Disturb policy access and never bypasses the current
silent, Focus, or DND state. Telecom self-managed calls are used on API 26 and later;
API 24 and 25 keep the `CallStyle`/action notification fallback.
