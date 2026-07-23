import Capacitor
import Foundation

@objc(NativeCallNotificationsPlugin)
public final class NativeCallNotificationsPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "NativeCallNotificationsPlugin"
    public let jsName = "NativeCallNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPendingState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportCallEnded", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NativeCallCoordinator.shared.attach(plugin: self)
    }

    @objc public func getPendingState(_ call: CAPPluginCall) {
        call.resolve(NativeCallCoordinator.shared.pendingState())
    }

    @objc public func clearPendingState(_ call: CAPPluginCall) {
        NativeCallCoordinator.shared.clearPendingAction()
        call.resolve()
    }

    @objc public func reportCallEnded(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId"), !callId.isEmpty else {
            call.reject("callId est requis")
            return
        }
        let status = call.getString("status") ?? "ended"
        NativeCallCoordinator.shared.reportCallEnded(callId: callId, status: status)
        call.resolve()
    }

    func publishCallAction(_ detail: JSObject) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.notifyListeners("nativeCallAction", data: detail, retainUntilConsumed: true)
            self.publishWindowEvent(name: "secretclubhouse:native-call-action", detail: detail)
        }
    }

    func publishPushToken(_ detail: JSObject) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.notifyListeners("voipRegistration", data: detail, retainUntilConsumed: true)
            self.publishWindowEvent(name: "secretclubhouse:native-push-token", detail: detail)
        }
    }

    func publishAudioState(active: Bool, callId: String?) {
        var detail: JSObject = ["active": active]
        if let callId {
            detail["callId"] = callId
        }
        let payload = detail
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("nativeCallAudioState", data: payload)
        }
    }

    private func publishWindowEvent(name: String, detail: JSObject) {
        guard
            JSONSerialization.isValidJSONObject(detail),
            let data = try? JSONSerialization.data(withJSONObject: detail),
            let json = String(data: data, encoding: .utf8),
            let nameData = try? JSONSerialization.data(
                withJSONObject: name,
                options: .fragmentsAllowed
            ),
            let encodedName = String(data: nameData, encoding: .utf8)
        else {
            return
        }
        bridge?.eval(
            js: "window.dispatchEvent(new CustomEvent(\(encodedName), { detail: \(json) }));"
        )
    }
}
