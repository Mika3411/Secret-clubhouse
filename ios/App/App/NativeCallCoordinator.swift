import AVFoundation
import CallKit
import Capacitor
import Foundation
import PushKit
import Security
import UIKit
import UserNotifications

enum NativeNotificationContract {
    static let messageCategory = "CLUBHOUSE_MESSAGE"
    static let contactRequestCategory = "CLUBHOUSE_CONTACT_REQUEST"
    static let incomingCallCategory = "CLUBHOUSE_INCOMING_CALL"

    static let messageSound = "message_discreet.caf"
    static let contactRequestSound = "contact_gentle.caf"
    static let callRingtone = "call_soft.caf"
}

private final class NativeCallContext {
    enum Phase {
        case ringing
        case answering
        case accepted
        case ending
    }

    let uuid: UUID
    let callId: String
    let callType: String
    let conversationId: String?
    let actionToken: String?
    let actionURL: URL?
    let acceptURL: URL?
    let declineURL: URL?
    let endURL: URL?
    let statusURL: URL?
    let expiresAt: Date
    var phase: Phase = .ringing
    var statusTimer: DispatchSourceTimer?
    var expirationWorkItem: DispatchWorkItem?

    init(
        uuid: UUID,
        callId: String,
        callType: String,
        conversationId: String?,
        actionToken: String?,
        actionURL: URL?,
        acceptURL: URL?,
        declineURL: URL?,
        endURL: URL?,
        statusURL: URL?,
        expiresAt: Date
    ) {
        self.uuid = uuid
        self.callId = callId
        self.callType = callType
        self.conversationId = conversationId
        self.actionToken = actionToken
        self.actionURL = actionURL
        self.acceptURL = acceptURL
        self.declineURL = declineURL
        self.endURL = endURL
        self.statusURL = statusURL
        self.expiresAt = expiresAt
    }

    func url(for action: String) -> URL? {
        switch action {
        case "accept":
            return acceptURL ?? actionURL
        case "decline":
            return declineURL ?? actionURL
        case "hangup":
            return endURL ?? actionURL
        default:
            return actionURL
        }
    }
}

final class NativeCallCoordinator: NSObject {
    static let shared = NativeCallCoordinator()

    private enum DefaultsKey {
        static let voipToken = "secretclubhouse.native.voip-token"
        static let pendingCallId = "secretclubhouse.native.pending-call-id"
        static let pendingAction = "secretclubhouse.native.pending-action"
    }

    private let networkQueue = DispatchQueue(label: "fr.secretclubhouse.native-calls.network")
    private let defaults = UserDefaults.standard
    private let callProvider: CXProvider
    private var pushRegistry: PKPushRegistry?
    private var contextsByUUID: [UUID: NativeCallContext] = [:]
    private var uuidByCallId: [String: UUID] = [:]
    private weak var plugin: NativeCallNotificationsPlugin?
    private var started = false

    private override init() {
        let configuration = CXProviderConfiguration(localizedName: "Secret Clubhouse")
        configuration.supportsVideo = true
        configuration.supportedHandleTypes = [.generic]
        configuration.maximumCallGroups = 1
        configuration.maximumCallsPerCallGroup = 1
        configuration.includesCallsInRecents = false
        configuration.ringtoneSound = NativeNotificationContract.callRingtone
        callProvider = CXProvider(configuration: configuration)
        super.init()
        callProvider.setDelegate(self, queue: DispatchQueue.main)
    }

    func start() {
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.started else { return }
            self.started = true
            self.registerNotificationCategories()

            let registry = PKPushRegistry(queue: DispatchQueue.main)
            registry.delegate = self
            registry.desiredPushTypes = [.voIP]
            self.pushRegistry = registry
        }
    }

    func attach(plugin: NativeCallNotificationsPlugin) {
        DispatchQueue.main.async { [weak self, weak plugin] in
            guard let self, let plugin else { return }
            self.plugin = plugin
            self.replayPendingState()
        }
    }

    func bridgeDidAppear() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.replayPendingState()
        }
    }

    func pendingState() -> JSObject {
        var result: JSObject = [
            "platform": "ios",
            "tokenKind": "apns_voip",
            "environment": apnsEnvironment(),
            "topic": voipTopic()
        ]
        if let callId = defaults.string(forKey: DefaultsKey.pendingCallId) {
            result["callId"] = callId
        } else {
            result["callId"] = NSNull()
        }
        if let action = defaults.string(forKey: DefaultsKey.pendingAction) {
            result["action"] = action
        } else {
            result["action"] = NSNull()
        }
        if let token = defaults.string(forKey: DefaultsKey.voipToken) {
            result["voipToken"] = token
        } else {
            result["voipToken"] = NSNull()
        }
        if let deviceId = UIDevice.current.identifierForVendor?.uuidString {
            result["deviceId"] = deviceId
        } else {
            result["deviceId"] = NSNull()
        }
        return result
    }

    func clearPendingAction() {
        defaults.removeObject(forKey: DefaultsKey.pendingCallId)
        defaults.removeObject(forKey: DefaultsKey.pendingAction)
    }

    func reportCallEnded(callId: String, status: String) {
        DispatchQueue.main.async { [weak self] in
            self?.endCallFromRemote(callId: callId, status: status)
        }
    }

    func handleRemoteNotification(
        _ userInfo: [AnyHashable: Any],
        completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        let payload = normalizedDictionary(userInfo)
        guard
            stringValue(in: payload, keys: ["notificationType", "notification_type"]) == "call-state",
            let callId = stringValue(in: payload, keys: ["callId", "call_id"]),
            let status = stringValue(in: payload, keys: ["status", "callStatus", "call_status"])
        else {
            completionHandler(.noData)
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.handleRemoteCallState(callId: callId, status: status)
            completionHandler(.newData)
        }
    }

    private func registerNotificationCategories() {
        let message = UNNotificationCategory(
            identifier: NativeNotificationContract.messageCategory,
            actions: [],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Nouveau message Secret Clubhouse",
            options: []
        )
        let contactRequest = UNNotificationCategory(
            identifier: NativeNotificationContract.contactRequestCategory,
            actions: [],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Nouvelle demande de contact",
            options: []
        )
        let incomingCall = UNNotificationCategory(
            identifier: NativeNotificationContract.incomingCallCategory,
            actions: [],
            intentIdentifiers: [],
            hiddenPreviewsBodyPlaceholder: "Appel Secret Clubhouse",
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([
            message,
            contactRequest,
            incomingCall
        ])
    }

    private func receiveIncomingCall(payload rawPayload: [AnyHashable: Any], completion: @escaping () -> Void) {
        let payload = normalizedDictionary(rawPayload)
        guard let callId = stringValue(in: payload, keys: ["callId", "call_id"]), !callId.isEmpty else {
            completion()
            return
        }
        if uuidByCallId[callId] != nil {
            completion()
            return
        }

        let uuid = UUID(uuidString: callId)
            ?? stringValue(in: payload, keys: ["callUUID", "call_uuid"]).flatMap(UUID.init(uuidString:))
            ?? UUID()
        let callType = stringValue(in: payload, keys: ["callType", "call_type"]) == "video" ? "video" : "audio"
        let callerName = callerDisplayName(in: payload)
        let conversationId = stringValue(in: payload, keys: ["conversationId", "conversation_id"])
        let actionToken = stringValue(in: payload, keys: ["callActionToken", "call_action_token", "actionToken"])
        let actions = payload["actions"] as? [String: Any] ?? [:]
        let context = NativeCallContext(
            uuid: uuid,
            callId: callId,
            callType: callType,
            conversationId: conversationId,
            actionToken: actionToken,
            actionURL: secureURL(
                stringValue(
                    in: payload,
                    keys: ["respondUrl", "respondURL", "respond_url", "actionUrl", "actionURL", "action_url"]
                )
            ),
            acceptURL: secureURL(
                stringValue(in: payload, keys: ["acceptUrl", "acceptURL", "accept_url"])
                    ?? stringValue(in: actions, keys: ["accept", "acceptUrl"])
            ),
            declineURL: secureURL(
                stringValue(in: payload, keys: ["declineUrl", "declineURL", "decline_url"])
                    ?? stringValue(in: actions, keys: ["decline", "declineUrl"])
            ),
            endURL: secureURL(
                stringValue(in: payload, keys: ["endUrl", "endURL", "end_url", "hangupUrl"])
                    ?? stringValue(in: actions, keys: ["end", "hangup", "endUrl"])
            ),
            statusURL: secureURL(
                stringValue(in: payload, keys: ["statusUrl", "statusURL", "status_url"])
                    ?? stringValue(in: actions, keys: ["status", "statusUrl"])
            ),
            expiresAt: expirationDate(in: payload)
        )

        contextsByUUID[uuid] = context
        uuidByCallId[callId] = uuid

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: conversationId ?? callId)
        update.localizedCallerName = callerName
        update.hasVideo = callType == "video"
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsDTMF = false

        callProvider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            DispatchQueue.main.async {
                guard let self else {
                    completion()
                    return
                }
                if error != nil {
                    self.cleanup(context)
                } else {
                    self.startStatusMonitoring(context)
                    self.scheduleExpiration(context)
                }
                completion()
            }
        }
    }

    private func performServerAction(
        _ action: String,
        context: NativeCallContext,
        completion: @escaping (Bool) -> Void
    ) {
        guard
            let url = context.url(for: action),
            let token = context.actionToken,
            !token.isEmpty
        else {
            completion(false)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 6
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(token, forHTTPHeaderField: "X-Call-Action-Token")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "action": action,
            "callId": context.callId,
            "actionToken": token
        ])

        URLSession.shared.dataTask(with: request) { data, response, _ in
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let responseStatus = Self.status(from: data)
            let actionAlreadyApplied = action == "accept" && responseStatus == "accepted"
                || action == "decline" && responseStatus == "declined"
                || action == "hangup" && ["cancelled", "ended"].contains(responseStatus ?? "")
            let acceptLostRace = action == "accept"
                && responseStatus.map(Self.terminalStatuses.contains) == true
            let httpSucceeded = (200...299).contains(statusCode) && !acceptLostRace
            completion(httpSucceeded || actionAlreadyApplied)
        }.resume()
    }

    private func performServerActionInBackground(
        _ action: String,
        context: NativeCallContext,
        attemptsRemaining: Int = 3
    ) {
        performServerAction(action, context: context) { [weak self] succeeded in
            guard
                !succeeded,
                attemptsRemaining > 1,
                let self
            else {
                return
            }
            self.networkQueue.asyncAfter(deadline: .now() + 1) {
                self.performServerActionInBackground(
                    action,
                    context: context,
                    attemptsRemaining: attemptsRemaining - 1
                )
            }
        }
    }

    private func configureAudioSession(for context: NativeCallContext) throws {
        let session = AVAudioSession.sharedInstance()
        let mode: AVAudioSession.Mode = context.callType == "video" ? .videoChat : .voiceChat
        var options: AVAudioSession.CategoryOptions = [.allowBluetooth]
        if context.callType == "video" {
            options.insert(.defaultToSpeaker)
        }
        try session.setCategory(.playAndRecord, mode: mode, options: options)
    }

    private func startStatusMonitoring(_ context: NativeCallContext) {
        guard context.statusURL != nil, context.actionToken != nil else { return }
        let timer = DispatchSource.makeTimerSource(queue: networkQueue)
        timer.schedule(deadline: .now() + 1, repeating: 1.25, leeway: .milliseconds(250))
        timer.setEventHandler { [weak self, weak context] in
            guard let self, let context else { return }
            self.pollStatus(context)
        }
        context.statusTimer = timer
        timer.resume()
    }

    private func pollStatus(_ context: NativeCallContext) {
        guard let url = context.statusURL, let token = context.actionToken else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(token, forHTTPHeaderField: "X-Call-Action-Token")

        URLSession.shared.dataTask(with: request) { [weak self, weak context] data, response, _ in
            guard
                let self,
                let context,
                let httpResponse = response as? HTTPURLResponse,
                (200...299).contains(httpResponse.statusCode),
                let status = Self.status(from: data)
            else {
                return
            }

            DispatchQueue.main.async {
                guard self.contextsByUUID[context.uuid] === context else { return }
                if status == "accepted" || Self.terminalStatuses.contains(status) {
                    self.handleRemoteCallState(callId: context.callId, status: status)
                }
            }
        }.resume()
    }

    private func scheduleExpiration(_ context: NativeCallContext) {
        let workItem = DispatchWorkItem { [weak self, weak context] in
            guard
                let self,
                let context,
                context.phase == .ringing || context.phase == .answering,
                self.contextsByUUID[context.uuid] === context
            else {
                return
            }
            self.callProvider.reportCall(with: context.uuid, endedAt: Date(), reason: .unanswered)
            self.storeAndPublishAction(callId: context.callId, action: "missed")
            self.cleanup(context)
        }
        context.expirationWorkItem = workItem
        DispatchQueue.main.asyncAfter(
            deadline: .now() + max(0.5, context.expiresAt.timeIntervalSinceNow),
            execute: workItem
        )
    }

    private func endCallFromRemote(callId: String, status: String) {
        guard
            let uuid = uuidByCallId[callId],
            let context = contextsByUUID[uuid]
        else {
            return
        }

        let reason: CXCallEndedReason
        switch status {
        case "missed":
            reason = .unanswered
        case "failed":
            reason = .failed
        default:
            reason = .remoteEnded
        }
        callProvider.reportCall(with: uuid, endedAt: Date(), reason: reason)
        storeAndPublishAction(callId: callId, action: status)
        cleanup(context)
    }

    private func handleRemoteCallState(callId: String, status: String) {
        guard
            let uuid = uuidByCallId[callId],
            let context = contextsByUUID[uuid]
        else {
            return
        }
        if status == "accepted" {
            // The APNs state update can arrive before the lock-screen accept
            // request finishes. Keep this device's active CallKit session, but
            // stop any other installation that is still only ringing.
            if context.phase == .answering || context.phase == .accepted {
                return
            }
            callProvider.reportCall(
                with: context.uuid,
                endedAt: Date(),
                reason: .answeredElsewhere
            )
            storeAndPublishAction(callId: callId, action: "answered-elsewhere")
            cleanup(context)
            return
        }
        if Self.terminalStatuses.contains(status) {
            endCallFromRemote(callId: callId, status: status)
        }
    }

    private func cleanup(_ context: NativeCallContext) {
        context.expirationWorkItem?.cancel()
        context.expirationWorkItem = nil
        context.statusTimer?.setEventHandler {}
        context.statusTimer?.cancel()
        context.statusTimer = nil
        contextsByUUID.removeValue(forKey: context.uuid)
        uuidByCallId.removeValue(forKey: context.callId)
    }

    private func storeAndPublishAction(callId: String, action: String) {
        defaults.set(callId, forKey: DefaultsKey.pendingCallId)
        defaults.set(action, forKey: DefaultsKey.pendingAction)
        plugin?.publishCallAction([
            "callId": callId,
            "action": action
        ])
    }

    private func replayPendingState() {
        if let token = defaults.string(forKey: DefaultsKey.voipToken) {
            plugin?.publishPushToken(pushTokenDetail(token: token))
        }
        if
            let callId = defaults.string(forKey: DefaultsKey.pendingCallId),
            let action = defaults.string(forKey: DefaultsKey.pendingAction)
        {
            plugin?.publishCallAction([
                "callId": callId,
                "action": action
            ])
        }
    }

    private func pushTokenDetail(token: String) -> JSObject {
        [
            "token": token,
            "platform": "ios",
            "tokenKind": "apns_voip",
            "environment": apnsEnvironment(),
            "topic": voipTopic()
        ]
    }

    private func apnsEnvironment() -> String {
        guard
            let task = SecTaskCreateFromSelf(nil),
            let value = SecTaskCopyValueForEntitlement(
                task,
                "aps-environment" as CFString,
                nil
            ) as? String
        else {
            #if DEBUG
            return "sandbox"
            #else
            return "production"
            #endif
        }
        return value == "development" ? "sandbox" : "production"
    }

    private func voipTopic() -> String {
        "\(Bundle.main.bundleIdentifier ?? "fr.secretclubhouse.app").voip"
    }

    private static let terminalStatuses = Set([
        "declined",
        "cancelled",
        "ended",
        "missed",
        "failed"
    ])

    private static func status(from data: Data?) -> String? {
        guard
            let data,
            let decoded = try? JSONSerialization.jsonObject(with: data),
            let object = decoded as? [String: Any]
        else {
            return nil
        }
        if let status = object["status"] as? String {
            return status
        }
        return (object["call"] as? [String: Any])?["status"] as? String
    }

    private func normalizedDictionary(_ source: [AnyHashable: Any]) -> [String: Any] {
        var result: [String: Any] = [:]
        source.forEach { key, value in
            if let stringKey = key as? String {
                result[stringKey] = value
            }
        }
        for nestedKey in ["data", "custom"] {
            if let nested = result[nestedKey] as? [String: Any] {
                nested.forEach { key, value in
                    result[key] = value
                }
            }
        }
        return result
    }

    private func stringValue(in source: [String: Any], keys: [String]) -> String? {
        for key in keys {
            if let value = source[key] as? String, !value.isEmpty {
                return value
            }
        }
        return nil
    }

    private func secureURL(_ value: String?) -> URL? {
        guard
            let value,
            let url = URL(string: value),
            url.scheme?.lowercased() == "https",
            url.host != nil
        else {
            return nil
        }
        return url
    }

    private func expirationDate(in payload: [String: Any]) -> Date {
        for key in ["expiresAt", "expires_at"] {
            if let text = payload[key] as? String {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = formatter.date(from: text) {
                    return date
                }
                formatter.formatOptions = [.withInternetDateTime]
                if let date = formatter.date(from: text) {
                    return date
                }
            }
            if let number = payload[key] as? NSNumber {
                let rawValue = number.doubleValue
                return Date(timeIntervalSince1970: rawValue > 10_000_000_000 ? rawValue / 1000 : rawValue)
            }
        }
        return Date().addingTimeInterval(45)
    }

    private func callerDisplayName(in payload: [String: Any]) -> String {
        if let callerName = stringValue(
            in: payload,
            keys: ["callerName", "caller_name", "displayName", "display_name"]
        ) {
            return callerName
        }
        if
            let aps = payload["aps"] as? [String: Any],
            let alert = aps["alert"] as? [String: Any],
            let title = alert["title"] as? String,
            !title.isEmpty
        {
            return title.replacingOccurrences(of: " vous appelle", with: "")
        }
        return "Contact Secret Clubhouse"
    }
}

extension NativeCallCoordinator: PKPushRegistryDelegate {
    func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        defaults.set(token, forKey: DefaultsKey.voipToken)
        plugin?.publishPushToken(pushTokenDetail(token: token))
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        guard type == .voIP else { return }
        defaults.removeObject(forKey: DefaultsKey.voipToken)
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }
        receiveIncomingCall(payload: payload.dictionaryPayload, completion: completion)
    }
}

extension NativeCallCoordinator: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) {
        Array(contextsByUUID.values).forEach(cleanup)
        contextsByUUID.removeAll()
        uuidByCallId.removeAll()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let context = contextsByUUID[action.callUUID], context.phase == .ringing else {
            action.fail()
            return
        }
        do {
            try configureAudioSession(for: context)
        } catch {
            action.fail()
            callProvider.reportCall(
                with: action.callUUID,
                endedAt: Date(),
                reason: .failed
            )
            cleanup(context)
            return
        }
        context.phase = .answering
        performServerAction("accept", context: context) { [weak self, weak context] succeeded in
            DispatchQueue.main.async {
                guard let self, let context else {
                    action.fail()
                    return
                }
                guard succeeded, self.contextsByUUID[context.uuid] === context else {
                    action.fail()
                    self.callProvider.reportCall(
                        with: action.callUUID,
                        endedAt: Date(),
                        reason: .failed
                    )
                    self.cleanup(context)
                    return
                }
                context.phase = .accepted
                context.expirationWorkItem?.cancel()
                context.expirationWorkItem = nil
                self.storeAndPublishAction(callId: context.callId, action: "accept")
                action.fulfill()
            }
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        guard let context = contextsByUUID[action.callUUID] else {
            action.fulfill()
            return
        }
        if context.phase == .accepted {
            context.phase = .ending
            performServerActionInBackground("hangup", context: context)
            storeAndPublishAction(callId: context.callId, action: "hangup")
            cleanup(context)
            action.fulfill()
            return
        }

        let serverAction = "decline"
        context.phase = .ending
        performServerActionInBackground(serverAction, context: context)
        storeAndPublishAction(callId: context.callId, action: serverAction)
        cleanup(context)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, timedOutPerforming action: CXAction) {
        action.fail()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        let activeCallId = contextsByUUID.values.first(where: { $0.phase == .accepted })?.callId
        plugin?.publishAudioState(active: true, callId: activeCallId)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        plugin?.publishAudioState(active: false, callId: nil)
    }
}
