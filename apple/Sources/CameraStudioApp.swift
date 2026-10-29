import SwiftUI
import WebKit
import Network
import Security
import Darwin

private let studioOrigin = "https://camera-control-studio.vercel.app"
private let studioHost = "camera-control-studio.vercel.app"

struct CameraFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct CameraAddress {
    static func isPrivate(_ host: String) -> Bool {
        let components = host.split(separator: ".", omittingEmptySubsequences: false)
        guard components.count == 4, components.allSatisfy({ !$0.isEmpty && $0.allSatisfy({ $0 >= "0" && $0 <= "9" }) }) else { return false }
        let p = components.compactMap { Int($0) }
        guard p.count == 4, p.allSatisfy({ (0...255).contains($0) }), zip(components, p).allSatisfy({ String($0.1) == String($0.0) }) else { return false }
        return p[0] == 10 || (p[0] == 192 && p[1] == 168) || (p[0] == 172 && (16...31).contains(p[1]))
    }
    static func validate(_ url: URL) -> Bool {
        guard ["http", "https"].contains(url.scheme ?? ""), let host = url.host,
              isPrivate(host), url.user == nil, url.password == nil,
              (1...65535).contains(url.port ?? (url.scheme == "https" ? 443 : 80)) else { return false }
        return true
    }
    static func prefixes() -> [String] {
        var pointer: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&pointer) == 0, let first = pointer else { return [] }
        defer { freeifaddrs(pointer) }
        var results = Set<String>()
        var current: UnsafeMutablePointer<ifaddrs>? = first
        while let p = current {
            defer { current = p.pointee.ifa_next }
            let item = p.pointee
            guard let address = item.ifa_addr, address.pointee.sa_family == UInt8(AF_INET),
                  item.ifa_flags & UInt32(IFF_UP) != 0,
                  item.ifa_flags & UInt32(IFF_LOOPBACK) == 0 else { continue }
            let name = String(cString: item.ifa_name)
            guard name.hasPrefix("en") || name.hasPrefix("bridge") else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(address, socklen_t(address.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                let ip = String(cString: host)
                if isPrivate(ip) { results.insert(ip.split(separator: ".").dropLast().joined(separator: ".")) }
            }
        }
        return Array(results.sorted().prefix(4))
    }
}

final class CameraTransport: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    static let shared = CameraTransport()
    override init() { super.init(); _ = session }
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 25
        configuration.httpMaximumConnectionsPerHost = 4
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        // Camera endpoints may never redirect traffic or credentials to another host.
        completionHandler(nil)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        let method = challenge.protectionSpace.authenticationMethod
        guard [NSURLAuthenticationMethodHTTPBasic, NSURLAuthenticationMethodHTTPDigest].contains(method),
              CameraAddress.isPrivate(challenge.protectionSpace.host), challenge.previousFailureCount == 0,
              let credentials = CameraCredentials.load(), credentials.host == challenge.protectionSpace.host, !credentials.username.isEmpty else {
            completionHandler(.performDefaultHandling, nil); return
        }
        completionHandler(.useCredential, URLCredential(user: credentials.username, password: credentials.password, persistence: .none))
    }
    func request(_ url: URL, method: String = "GET", body: Data? = nil, timeout: TimeInterval = 15) async throws -> (Data, HTTPURLResponse) {
        guard CameraAddress.validate(url), url.path == "/ccapi" || url.path.hasPrefix("/ccapi/") else {
            throw CameraFailure(message: "Only a private-network Canon camera address is allowed.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = timeout
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw CameraFailure(message: "Invalid camera response.") }
        guard data.count <= 32 * 1024 * 1024 else { throw CameraFailure(message: "This file is too large for preview. Transfer large recordings from the camera separately.") }
        return (data, response)
    }
    func probe(_ host: String) async -> [String: Any]? {
        guard let url = URL(string: "http://\(host):8080/ccapi") else { return nil }
        do {
            let (data, response) = try await request(url, timeout: 1.2)
            if response.statusCode == 401 {
                return ["ip": host, "port": 8080, "name": "Canon camera (authentication required)", "demo": false, "authenticationRequired": true]
            }
            guard response.statusCode == 200,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  root.keys.contains(where: { $0.hasPrefix("ver") }) else { return nil }
            var result: [String: Any] = ["ip": host, "port": 8080, "name": "Canon camera", "demo": false]
            let infoURL = URL(string: "http://\(host):8080/ccapi/ver100/deviceinformation")!
            if let (infoData, infoResponse) = try? await request(infoURL, timeout: 1.5), infoResponse.statusCode == 200,
               let info = try? JSONSerialization.jsonObject(with: infoData) as? [String: Any] {
                result["name"] = info["productname"] as? String ?? "Canon camera"
                result["serial"] = info["serialnumber"] as? String ?? ""
            }
            return result
        } catch { return nil }
    }
    func discover(subnet: String?) async throws -> [String: Any] {
        let prefixes: [String]
        if let subnet, !subnet.isEmpty {
            guard subnet.split(separator: ".").count == 3, CameraAddress.isPrivate(subnet + ".1") else {
                throw CameraFailure(message: "Enter a private subnet such as 192.168.1.")
            }
            prefixes = [subnet]
        } else { prefixes = CameraAddress.prefixes() }
        guard !prefixes.isEmpty else {
            throw CameraFailure(message: "No local IPv4 network found. Join the camera Wi-Fi or the same router, and allow Local Network access in Settings.")
        }
        var hosts = prefixes.flatMap { prefix in (1...254).map { "\(prefix).\($0)" } }
        if let saved = UserDefaults.standard.string(forKey: "lastCameraHost"),
           prefixes.contains(saved.split(separator: ".").dropLast().joined(separator: ".")) {
            hosts.removeAll { $0 == saved }; hosts.insert(saved, at: 0)
        }
        var cameras = [[String: Any]]()
        // Bound scanning to connected private /24 networks and 24 concurrent probes.
        for start in stride(from: 0, to: hosts.count, by: 24) {
            try Task.checkCancellation()
            let slice = Array(hosts[start..<min(start + 24, hosts.count)])
            let found = await withTaskGroup(of: CameraProbe.self) { group in
                for host in slice { group.addTask { CameraProbe(value: await self.probe(host)) } }
                var found = [[String: Any]]()
                for await candidate in group { if let value = candidate.value { found.append(value) } }
                return CameraProbeList(values: found)
            }
            cameras.append(contentsOf: found.values)
        }
        return ["cameras": cameras.sorted { ($0["ip"] as? String ?? "") < ($1["ip"] as? String ?? "") }, "scanned": hosts.count]
    }
}
private struct CameraProbe: @unchecked Sendable { let value: [String: Any]? }
private struct CameraProbeList: @unchecked Sendable { let values: [[String: Any]] }

struct CameraCredentials: Codable {
    let host: String
    let username: String
    let password: String
    static let service = "com.savrdh.camera-studio.camera-access"
    static func load() -> CameraCredentials? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(CameraCredentials.self, from: data)
    }
    func save() throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Self.service]
        let data = try JSONEncoder().encode(self)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw CameraFailure(message: "Could not save camera credentials in Keychain.") }
        } else if status != errSecSuccess { throw CameraFailure(message: "Could not update camera credentials in Keychain.") }
    }
}

@MainActor final class StudioController: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, WKDownloadDelegate {
    @Published var loading = true
    @Published var showAccess = false
    @Published var error: String?
    private var authorizedUntil = Date.distantPast
    private var authorizationCookieFingerprint = ""
    private var hostWebView: WKWebView?
    private(set) var webView: WKWebView!
    override init() {
        super.init()
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "camera")
        configuration.userContentController.addUserScript(WKUserScript(source: Self.bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #if os(iOS)
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        #endif
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = nil
        hostWebView = webView
        openStudio()
    }
    func openStudio() { webView.load(URLRequest(url: URL(string: studioOrigin + "/connection")!)) }
    func openCCTV() { webView.load(URLRequest(url: URL(string: studioOrigin + "/cctv")!)) }
    func reload() { authorizedUntil = .distantPast; webView.reload() }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        #if os(macOS)
        Task { await CCTVManager.shared.stopAll() }
        #endif
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false; error = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loading = false; self.error = "Cannot load Camera Studio. Connect to the internet for sign-in. Camera Wi-Fi must also be reachable from this device."
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload && url.absoluteString.hasPrefix("blob:" + studioOrigin + "/") { decisionHandler(.download); return }
        if url.scheme == "https" && url.host == studioHost && (url.port ?? 443) == 443 { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated, url.scheme == "https", ["savrdhtechnologies.com", "www.savrdhtechnologies.com"].contains(url.host ?? "") {
            #if os(macOS)
            NSWorkspace.shared.open(url)
            #else
            UIApplication.shared.open(url)
            #endif
        }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        #if os(macOS)
        let panel = NSSavePanel()
        panel.nameFieldStringValue = URL(fileURLWithPath: suggestedFilename).lastPathComponent
        panel.begin { result in completionHandler(result == .OK ? panel.url : nil) }
        #else
        completionHandler(nil)
        #endif
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        #if os(macOS)
        guard frame.securityOrigin.host == studioHost else { completionHandler(false); return }
        let alert = NSAlert(); alert.messageText = "Camera Studio"; alert.informativeText = message
        alert.addButton(withTitle: "Confirm"); alert.addButton(withTitle: "Cancel")
        if let window = webView.window { alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) } }
        else { completionHandler(alert.runModal() == .alertFirstButtonReturn) }
        #else
        completionHandler(false)
        #endif
    }
    private func checkAccess() async throws {
        guard let webView, webView.url?.host == studioHost else { throw CameraFailure(message: "Open the trusted Camera Studio application first.") }
        let cookies = await webView.configuration.websiteDataStore.httpCookieStore.allCookies()
        let allowed = cookies.filter { $0.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")) == studioHost }
        let cookie = HTTPCookie.requestHeaderFields(with: allowed)["Cookie"] ?? ""
        if Date() < authorizedUntil && cookie == authorizationCookieFingerprint { return }
        var request = URLRequest(url: URL(string: studioOrigin + "/api/customer/access")!)
        request.setValue(cookie, forHTTPHeaderField: "Cookie")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 12
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200,
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any], body["active"] as? Bool == true else {
            authorizedUntil = .distantPast
            throw CameraFailure(message: "Sign in with an approved trial, active subscription, or Camera Studio administrator account before connecting hardware.")
        }
        authorizationCookieFingerprint = cookie
        authorizedUntil = Date().addingTimeInterval(20)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == studioHost,
              message.frameInfo.securityOrigin.protocol == "https", [0, 443].contains(message.frameInfo.securityOrigin.port), let input = message.body as? [String: Any],
              let path = input["url"] as? String, path.utf8.count < 8192,
              let parsed = URLComponents(string: path), parsed.host == nil, parsed.scheme == nil,
              let method = input["method"] as? String, ["GET", "POST", "PUT", "DELETE", "HEAD"].contains(method) else {
            replyHandler(nil, "Camera request rejected."); return
        }
        Task { @MainActor in
            do {
                do { try await checkAccess() } catch {
                    #if os(macOS)
                    await CCTVManager.shared.stopAll()
                    #endif
                    throw error
                }
                let result: [String: Any]
                #if os(macOS)
                if parsed.path == "/api/cctv" || parsed.path.hasPrefix("/api/cctv/") {
                    replyHandler(try await cctvRequest(parsed, method: method, input: input), nil)
                    return
                }
                #endif
                if parsed.path == "/api/discover" && method == "POST" {
                    let raw = (input["body"] as? String ?? "{}").data(using: .utf8)!
                    let body = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any] ?? [:]
                    let data = try await CameraTransport.shared.discover(subnet: body["subnet"] as? String)
                    result = try Self.jsonReply(data)
                } else if parsed.path.hasPrefix("/api/ccapi/ccapi/") {
                    let queries = parsed.queryItems ?? []
                    guard let base = queries.first(where: { $0.name == "__base" })?.value,
                          let baseURL = URL(string: base), CameraAddress.validate(baseURL),
                          baseURL.path.isEmpty || baseURL.path == "/", baseURL.query == nil, baseURL.fragment == nil else {
                        throw CameraFailure(message: "Enter the private IP address shown in the camera CCAPI screen.")
                    }
                    var target = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
                    target.path = String(parsed.path.dropFirst("/api/ccapi".count))
                    target.queryItems = queries.filter { $0.name != "__base" }
                    guard let url = target.url, !target.path.contains("..") else { throw CameraFailure(message: "Invalid camera path.") }
                    let (data, response) = try await CameraTransport.shared.request(url, method: method, body: (input["body"] as? String)?.data(using: .utf8))
                    if response.statusCode == 200 && target.path.hasSuffix("/deviceinformation") { UserDefaults.standard.set(url.host, forKey: "lastCameraHost") }
                    if response.statusCode == 401 {
                        result = try Self.jsonReply(["message": "The camera requires authentication. Enter its CCAPI username and password using Camera Access in the app toolbar."], status: 401)
                    } else {
                        result = ["status": response.statusCode, "body": data.base64EncodedString(), "headers": ["content-type": response.value(forHTTPHeaderField: "Content-Type") ?? "application/octet-stream"]]
                    }
                } else { throw CameraFailure(message: "Unsupported native camera operation.") }
                replyHandler(result, nil)
            } catch {
                replyHandler(try? Self.jsonReply(["message": error.localizedDescription], status: 502), nil)
            }
        }
    }
    #if os(macOS)
    private func cctvRequest(_ parsed: URLComponents, method: String, input: [String: Any]) async throws -> [String: Any] {
        let parts = parsed.path.split(separator: "/").map(String.init)
        if parsed.path == "/api/cctv/discover" && method == "POST" {
            let devices = await Task.detached { ONVIF.discover() }.value
            return try Self.jsonReply(["cameras": devices])
        }
        if parts == ["api", "cctv"] {
            if method == "GET" { return try Self.jsonReply(["cameras": await CCTVManager.shared.list()]) }
            if method == "POST" {
                let raw = (input["body"] as? String ?? "{}").data(using: .utf8)!
                guard raw.count <= 8192, let body = try JSONSerialization.jsonObject(with: raw) as? [String: Any] else { throw CameraFailure(message: "Invalid CCTV settings.") }
                return try Self.jsonReply(["cameras": await CCTVManager.shared.save(body)])
            }
        }
        if parts.count >= 3, UUID(uuidString: parts[2]) != nil {
            let id = parts[2]
            if parts.count == 3 && method == "DELETE" { return try Self.jsonReply(["cameras": await CCTVManager.shared.remove(id)]) }
            if parts.count == 4 && parts[3] == "preview" && method == "DELETE" { await CCTVManager.shared.stop(id); return try Self.jsonReply(["ok": true]) }
            if parts.count == 4 && parts[3] == "frame" && method == "GET" {
                let data = try await CCTVManager.shared.frame(id)
                return ["status": 200, "body": data.base64EncodedString(), "headers": ["content-type": data.starts(with: [0xff,0xd8]) ? "image/jpeg" : "image/png"]]
            }
        }
        throw CameraFailure(message: "Unsupported CCTV operation.")
    }
    #endif
    private static func jsonReply(_ body: [String: Any], status: Int = 200) throws -> [String: Any] {
        ["status": status, "body": try JSONSerialization.data(withJSONObject: body).base64EncodedString(), "headers": ["content-type": "application/json"]]
    }
    private static let bridge = #"""
    (() => {
      if (location.origin !== 'https://camera-control-studio.vercel.app') return;
      Object.defineProperty(window, 'savrdhNative', {value: {platform: 'apple', localCamera: true}, writable: false});
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, options = {}) => {
        const request = new Request(input, options);
        const url = new URL(request.url);
        if (url.origin !== location.origin || !(url.pathname === '/api/discover' || url.pathname.startsWith('/api/ccapi/ccapi/') || url.pathname === '/api/cctv' || url.pathname.startsWith('/api/cctv/'))) return originalFetch(input, options);
        // The demo remains on the web server; actual camera traffic stays on this device.
        if (url.searchParams.get('__base') === 'mock') return originalFetch(input, options);
        const method = request.method.toUpperCase();
        const body = ['GET','HEAD'].includes(method) ? null : await request.text();
        const result = await window.webkit.messageHandlers.camera.postMessage({url:url.pathname + url.search, method, body});
        const data = Uint8Array.from(atob(result.body || ''), c => c.charCodeAt(0));
        return new Response([204,205,304].includes(result.status) || method === 'HEAD' ? null : data, {status:result.status,headers:result.headers});
      };
    })();
    """#
}

#if os(macOS)
struct StudioWebView: NSViewRepresentable {
    @ObservedObject var controller: StudioController
    func makeNSView(context: Context) -> WKWebView { controller.webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
#else
struct StudioWebView: UIViewRepresentable {
    @ObservedObject var controller: StudioController
    func makeUIView(context: Context) -> WKWebView { controller.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
#endif

@MainActor final class CameraCredentialEditor: ObservableObject {
    @Published var host = CameraCredentials.load()?.host ?? UserDefaults.standard.string(forKey: "lastCameraHost") ?? ""
    @Published var username = CameraCredentials.load()?.username ?? ""
    @Published var password = CameraCredentials.load()?.password ?? ""
    @Published var error = ""
}
struct CameraAccessView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var editor = CameraCredentialEditor()
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Camera Wi-Fi access").font(.title2.bold())
            Text("Use the CCAPI credentials configured on your camera, if it requests authentication. These are different from your Studio account. Stored only in this device’s Keychain.").font(.callout)
            TextField("Camera IP address", text: $editor.host).textFieldStyle(.roundedBorder)
            TextField("Camera username", text: $editor.username).textFieldStyle(.roundedBorder)
            SecureField("Camera password", text: $editor.password).textFieldStyle(.roundedBorder)
            Text("On the EOS R50, enable Camera Control API and join the same Wi-Fi router. Keep the camera awake. Allow Local Network access when Apple asks.").font(.callout)
            if !editor.error.isEmpty { Text(editor.error).foregroundStyle(.red) }
            HStack { Button("Cancel") { dismiss() }; Spacer(); Button("Save on this device") { do { guard CameraAddress.isPrivate(editor.host) else { throw CameraFailure(message: "Enter the camera’s private IPv4 address.") }; try CameraCredentials(host: editor.host, username: editor.username, password: editor.password).save(); dismiss() } catch { editor.error = error.localizedDescription } }.buttonStyle(.borderedProminent) }
        }.padding(24).frame(minWidth: 320, idealWidth: 480)
    }
}

@main struct CameraStudioApp: App {
    @StateObject private var controller = StudioController()
    init() {
        if CommandLine.arguments.contains("--self-test") {
            let permitted = ["192.168.0.1", "10.10.2.3", "172.16.0.1", "172.31.255.254"]
            let rejected = ["127.0.0.1", "169.254.169.254", "8.8.8.8", "172.32.0.1", "192.168.1.300", "192.168.1", "localhost", "192.168.1.1.example.com", "::1"]
            for host in permitted { precondition(CameraAddress.isPrivate(host), host) }
            for host in rejected { precondition(!CameraAddress.isPrivate(host), host) }
            precondition(!CameraAddress.validate(URL(string: "http://user:password@192.168.1.2/ccapi")!))
            precondition(!CameraAddress.validate(URL(string: "file:///ccapi")!))
            #if os(macOS)
            precondition(validCCTVURL(URL(string: "rtsp://192.168.1.3:554/live")!))
            precondition(validCCTVURL(URL(string: "http://10.0.0.3/snapshot.jpg")!))
            precondition(!validCCTVURL(URL(string: "rtsp://8.8.8.8/live")!))
            precondition(!validCCTVURL(URL(string: "rtsp://user:pass@192.168.1.3/live")!))
            precondition(!validCCTVURL(URL(string: "file:///etc/passwd")!))
            precondition(!validCCTVURL(URL(string: "http://192.168.1.3.example.com/image.jpg")!))
            let fixture = Data("<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope'><s:Body><Capabilities><Media><XAddr>http://192.168.1.3/onvif/media</XAddr></Media></Capabilities><Profiles token='Profile1'/><MediaUri><Uri>rtsp://192.168.1.3/live</Uri></MediaUri></s:Body></s:Envelope>".utf8)
            let xml = try! ONVIFXML.parse(fixture)
            precondition(xml.first("Media/XAddr") == "http://192.168.1.3/onvif/media")
            precondition(xml.tokens == ["Profile1"])
            precondition(xml.first("MediaUri/Uri") == "rtsp://192.168.1.3/live")
            precondition((try? ONVIFXML.parse(Data("<!DOCTYPE test [<!ENTITY x 'entity'>]><test>&x;</test>".utf8))) == nil)
            #endif
            print("Native camera checks passed: 25 address/XML cases. No hardware requests were sent.")
            exit(0)
        }
    }
    var body: some Scene {
        WindowGroup("SAVRDH Camera Studio") {
            VStack(spacing: 0) {
                if let error = controller.error { HStack { Text(error).font(.callout); Button("Retry") { controller.openStudio() } }.padding().background(.orange.opacity(0.15)) }
                StudioWebView(controller: controller)
            }
            .toolbar {
                ToolbarItemGroup {
                    Button { controller.openStudio() } label: { Label("Find camera", systemImage: "wifi") }
                    Button { controller.openCCTV() } label: { Label("CCTV", systemImage: "video") }
                    Button { controller.showAccess = true } label: { Label("Camera Access", systemImage: "key") }
                    Button { controller.reload() } label: { Label("Reload", systemImage: "arrow.clockwise") }
                }
            }
            .sheet(isPresented: $controller.showAccess) { CameraAccessView() }
            #if os(macOS)
            .frame(minWidth: 1000, minHeight: 680)
            #endif
        }
    }
}
