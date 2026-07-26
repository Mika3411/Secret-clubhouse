import Capacitor
import Foundation
import Security

private enum NativeSessionMemoryVault {
    private static let service = "fr.secretclubhouse.app.native-session"
    private static let account = "opaque-session-token"

    static func read() -> String {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return ""
        }
        return token
    }

    static func write(_ token: String) -> Bool {
        let query = baseQuery()
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = Data(token.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    static func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
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
        guard NativeSessionMemoryVault.write(token) else {
            call.reject("La session native n’a pas pu être protégée.")
            return
        }
        call.resolve()
    }

    @objc public func clear(_ call: CAPPluginCall) {
        NativeSessionMemoryVault.clear()
        call.resolve()
    }
}
