import Capacitor
import Foundation

private enum NativeSessionMemoryVault {
    private static let lock = NSLock()
    private static var sessionToken: String?

    static func read() -> String {
        lock.lock()
        defer { lock.unlock() }
        return sessionToken ?? ""
    }

    static func write(_ token: String) {
        lock.lock()
        sessionToken = token
        lock.unlock()
    }

    static func clear() {
        lock.lock()
        sessionToken = nil
        lock.unlock()
    }
}

@objc(NativeSessionMemoryPlugin)
public final class NativeSessionMemoryPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "NativeSessionMemoryPlugin"
    public let jsName = "NativeSessionMemory"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private let tokenPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9_-]{43}$")

    @objc public func get(_ call: CAPPluginCall) {
        call.resolve(["token": NativeSessionMemoryVault.read()])
    }

    @objc public func set(_ call: CAPPluginCall) {
        guard let token = call.getString("token")?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            call.reject("Session native invalide.")
            return
        }
        let range = NSRange(token.startIndex..<token.endIndex, in: token)
        guard tokenPattern.firstMatch(in: token, range: range) != nil else {
            call.reject("Session native invalide.")
            return
        }
        NativeSessionMemoryVault.write(token)
        call.resolve()
    }

    @objc public func clear(_ call: CAPPluginCall) {
        NativeSessionMemoryVault.clear()
        call.resolve()
    }
}
