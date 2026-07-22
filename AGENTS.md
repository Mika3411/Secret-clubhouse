# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable product direction

- The selected visual source is `.design-reference/secret-clubhouse-source.png`.
- Keep the "Secret Clubhouse" indigo, mint, and violet visual language.
- The audience is children ages 6–13 on phones and tablets; touch targets must remain large, friendly, and readable without feeling babyish.
- Accounts use parent-managed usernames and QR friend codes, never child phone numbers or public search.
- The parent area is separated from the child experience by a four-digit parent code and focuses on contact approval, safety settings, and high-level activity rather than exposing message contents.
- A parent can create and manage multiple child profiles (ages 6–13) under one family account. Each child keeps separate contacts and safety settings, and the selected profile becomes the child space shown on the device.
- The public entry point is parent-first authentication with separate sign-in and registration forms plus a clearly labeled fake demo account. Registration opens an empty family and immediately offers first-child creation.
- Demo family data is isolated to explicit demo sessions and must never seed, overwrite, or appear in an authenticated production family.
- The "Mode calme" safety row opens a per-child schedule editor with separate allowed time windows for messages, audio calls, and video calls.
- Every child profile has a parent-managed private username and password so the child can sign in independently without a phone number; children can never self-register.
- The protected parent inbox clearly separates direct family conversations with the parent’s own children from adult conversations with parents of approved or pending child contacts. It never exposes the children’s conversations with friends.
- A parent can directly open and persist a conversation with any child in their own family without a friend request or approval. Entering the child’s exact contact ID opens that family conversation instead of showing an error.
- Every family member, including the parent and each child, owns a distinct opaque contact ID. No public contact link is shown; usernames are never used to route discussions, and adding an exact ID only creates a parent-approved request.
- The parent messaging inbox includes an "Ajouter un contact" action. Entering an exact private ID for an external contact creates a pending approval request; entering the ID of one of the parent’s own children opens the family conversation immediately.
- Each child contact modal displays a real scannable QR code containing the app URL and exact private contact ID. Scanning it opens the parent contact-request form prefilled; the parent still confirms sending the request.
- Audio and video calls use WebRTC, are limited to approved contacts, and obey each child’s parent-managed permissions and allowed hours. Camera, microphone, speaker, and hang-up controls must remain obvious.
- Parents can configure one neutral automatic reply for messages and audio/video call attempts received outside allowed hours. It must not reveal schedules or personal details, and automatic messages must never trigger another automatic reply.
- Sent messages and media show delivery state consistently in child and parent chats: one check means received and a colored double check means seen.
- Child and parent conversations support recorded voice messages with microphone permission requested on demand, a two-minute limit, preview, cancel, send, playback, and received/seen status.
- The child Clubhouse is an interactive activity hub with filterable creative challenges and mini-games, private progress, earned stars, daily streaks, and replayable activities.
- The child profile uses one centered 300 px card column: contact ID, protection, notifications, and parent access share consistent widths, radii, icon proportions, and spacing on phones and tablets.
- Children can send images, photos, and videos only when the parent has enabled media sharing for that child; media remains limited to approved contacts and allowed messaging hours.
- The protected parent inbox supports parent-to-child and parent-to-parent conversations; adult parent-to-parent threads also support audio/video calls and photo, image, and video attachments.
- Production persistence uses only a Render Node.js web service and Render PostgreSQL; do not introduce Supabase or another external backend/storage provider. Accounts, messages, and media must use the server API and PostgreSQL as their source of truth.
- Online/offline presence is server-backed: authenticated clients heartbeat periodically, PostgreSQL stores last activity, and contacts become offline after the presence timeout.
- New messages and media use standards-based Web Push through the Render service, with subscriptions stored in PostgreSQL. On locked devices the operating system controls notification sound; never promise a custom continuous ringtone from the web app.
- The production clients are native IPA and APK packages built with Capacitor. Native push uses APNs on iOS and FCM on Android; Render/PostgreSQL remains the only application backend and source of truth.
- Native notification sounds may use an app-bundled sound through APNs and an Android notification channel. iOS custom alert sounds must remain under 30 seconds; critical-alert behavior is not assumed without Apple entitlement.
- Provide three native notification categories/channels: discreet message alerts, a longer soft ringtone for incoming audio/video calls, and a distinct gentle contact-request sound. Incoming-call ringing stops immediately on accept, decline, cancellation, or timeout. Respect parent quiet-mode schedules and all OS silent/focus settings.
- The intended incoming-call experience uses CallKit on iOS and ConnectionService/Telecom with a high-priority lock-screen call notification on Android, with clear Accept and Decline actions. Do not use or request Apple's critical-alert entitlement for this social app.
- Incoming calls must be answerable or rejectable directly from the native lock-screen call UI. Answering wakes/foregrounds the native client as needed and connects the authorized WebRTC session; the user must never have to manually find and open the app before answering.
- Rejecting an incoming call, from either the lock screen or the app, immediately stops ringing, shows the caller an "Appel refusé" state, and sends one neutral automatic chat message such as "Je ne peux pas répondre pour le moment." The message must not disclose why the call was declined and must never trigger another automatic reply.
- Every child QR modal exposes a real scannable URL carrying only the opaque contact ID; opening that URL prefills the parent contact-request form and still requires explicit parent confirmation.
- The child “Ajouter un ami” action opens identifier entry first, keeps “Mon QR” as a separate tab, and always hands the request to an authenticated parent before submission.
