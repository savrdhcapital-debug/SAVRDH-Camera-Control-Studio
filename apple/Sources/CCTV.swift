#if os(macOS)
import Foundation
import CryptoKit
import Security
import Darwin

struct CCTVEntry: Codable, Sendable {
    var id: String
    var name: String
    var kind: String
    var url: String
}
struct CCTVLogin: Codable, Sendable {
    var username: String
    var password: String
    static func load(_ id: String) -> CCTVLogin {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.savrdh.camera-studio.cctv.\(id)", kSecReturnData as String: true]
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess, let data = value as? Data,
              let login = try? JSONDecoder().decode(Self.self, from: data) else { return Self(username: "", password: "") }
        return login
    }
    func save(_ id: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.savrdh.camera-studio.cctv.\(id)"]
        let data = try JSONEncoder().encode(self)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query; item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw CameraFailure(message: "Could not save CCTV login in Keychain.") }
        } else if status != errSecSuccess { throw CameraFailure(message: "Could not save CCTV login.") }
    }
    static func remove(_ id: String) {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.savrdh.camera-studio.cctv.\(id)"] as CFDictionary)
    }
}
func validCCTVURL(_ url: URL, schemes: [String] = ["rtsp", "http", "https"]) -> Bool {
    schemes.contains(url.scheme ?? "") && url.host.map(CameraAddress.isPrivate) == true && url.user == nil && url.password == nil && url.fragment == nil && (1...65535).contains(url.port ?? 80)
}

final class CCTVHTTP: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    let host: String
    let login: CCTVLogin
    init(host: String, login: CCTVLogin) { self.host = host; self.login = login }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.host == host, challenge.previousFailureCount == 0, !login.username.isEmpty,
              [NSURLAuthenticationMethodHTTPBasic, NSURLAuthenticationMethodHTTPDigest].contains(challenge.protectionSpace.authenticationMethod) else { completionHandler(.performDefaultHandling, nil); return }
        completionHandler(.useCredential, URLCredential(user: login.username, password: login.password, persistence: .none))
    }
    func request(_ url: URL, soap: String? = nil) async throws -> Data {
        guard validCCTVURL(url, schemes: ["http", "https"]), url.host == host else { throw CameraFailure(message: "The camera returned an untrusted address.") }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 6
        configuration.timeoutIntervalForResource = 10
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: url)
        if let soap { request.httpMethod = "POST"; request.httpBody = soap.data(using: .utf8); request.setValue("application/soap+xml; charset=utf-8", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw CameraFailure(message: "Camera rejected the request. Check its local username, password, and ONVIF setting.") }
        guard data.count <= 8 * 1024 * 1024 else { throw CameraFailure(message: "The camera response was too large.") }
        return data
    }
}

final class ONVIFXML: NSObject, XMLParserDelegate {
    var stack: [String] = []
    var values: [(String, String)] = []
    var tokens: [String] = []
    var buffer = ""
    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        let name = elementName.split(separator: ":").last.map(String.init) ?? elementName
        stack.append(name); buffer = ""
        if name == "Profiles", let token = attributeDict["token"] { tokens.append(token) }
    }
    func parser(_ parser: XMLParser, foundCharacters string: String) { buffer += string }
    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        let value = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        if !value.isEmpty { values.append((stack.joined(separator: "/"), value)) }
        if !stack.isEmpty { stack.removeLast() }; buffer = ""
    }
    func parser(_ parser: XMLParser, foundInternalEntityDeclarationWithName name: String, value: String?) { parser.abortParsing() }
    func parser(_ parser: XMLParser, foundExternalEntityDeclarationWithName name: String, publicID: String?, systemID: String?) { parser.abortParsing() }
    static func parse(_ data: Data) throws -> ONVIFXML {
        guard data.count <= 1024 * 1024, data.range(of: Data("<!DOCTYPE".utf8)) == nil, data.range(of: Data("<!ENTITY".utf8)) == nil else { throw CameraFailure(message: "Invalid ONVIF reply.") }
        let result = ONVIFXML(); let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false; parser.delegate = result
        guard parser.parse() else { throw CameraFailure(message: "This address did not return an ONVIF response.") }
        return result
    }
    func first(_ ending: String) -> String? { values.first { $0.0.hasSuffix(ending) }?.1 }
}

struct ONVIF {
    static func escaped(_ text: String) -> String { text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;").replacingOccurrences(of: "'", with: "&apos;") }
    static func envelope(_ body: String, login: CCTVLogin) -> String {
        var header = ""
        if !login.username.isEmpty {
            let nonce = Data((0..<20).map { _ in UInt8.random(in: 0...255) })
            let created = ISO8601DateFormatter().string(from: Date())
            let digest = Data(Insecure.SHA1.hash(data: nonce + Data(created.utf8) + Data(login.password.utf8))).base64EncodedString()
            header = "<s:Header><wsse:Security s:mustUnderstand=\"1\"><wsse:UsernameToken><wsse:Username>\(escaped(login.username))</wsse:Username><wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\">\(digest)</wsse:Password><wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">\(nonce.base64EncodedString())</wsse:Nonce><wsu:Created>\(created)</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header>"
        }
        return "<?xml version=\"1.0\"?><s:Envelope xmlns:s=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:tds=\"http://www.onvif.org/ver10/device/wsdl\" xmlns:trt=\"http://www.onvif.org/ver10/media/wsdl\" xmlns:tt=\"http://www.onvif.org/ver10/schema\" xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">\(header)<s:Body>\(body)</s:Body></s:Envelope>"
    }
    static func stream(service: URL, login: CCTVLogin) async throws -> URL {
        guard validCCTVURL(service, schemes: ["http", "https"]), let host = service.host else { throw CameraFailure(message: "Enter a private ONVIF service address.") }
        let client = CCTVHTTP(host: host, login: login)
        let capabilities = try ONVIFXML.parse(await client.request(service, soap: envelope("<tds:GetCapabilities><tds:Category>Media</tds:Category></tds:GetCapabilities>", login: login)))
        guard let address = capabilities.first("Media/XAddr"), let media = URL(string: address), media.host == host, validCCTVURL(media, schemes: ["http", "https"]) else { throw CameraFailure(message: "ONVIF Media service is unavailable. Use the camera’s RTSP URL instead.") }
        let profiles = try ONVIFXML.parse(await client.request(media, soap: envelope("<trt:GetProfiles/>", login: login)))
        guard let token = profiles.tokens.first else { throw CameraFailure(message: "No ONVIF video profiles were returned.") }
        let body = "<trt:GetStreamUri><trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport></trt:StreamSetup><trt:ProfileToken>\(escaped(token))</trt:ProfileToken></trt:GetStreamUri>"
        let streams = try ONVIFXML.parse(await client.request(media, soap: envelope(body, login: login)))
        guard let value = streams.first("MediaUri/Uri"), var uri = URLComponents(string: value), uri.host == host else { throw CameraFailure(message: "The camera did not return a usable local RTSP address.") }
        uri.user = nil; uri.password = nil
        guard let result = uri.url, validCCTVURL(result, schemes: ["rtsp"]) else { throw CameraFailure(message: "The camera returned an unsupported stream address.") }
        return result
    }
    static func discover() -> [[String: String]] {
        let fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
        guard fd >= 0 else { return [] }; defer { close(fd) }
        var timeout = timeval(tv_sec: 1, tv_usec: 0)
        setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        var local = sockaddr_in(); local.sin_family = sa_family_t(AF_INET); local.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        let bound = withUnsafePointer(to: &local) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
        guard bound == 0 else { return [] }
        var target = sockaddr_in(); target.sin_family = sa_family_t(AF_INET); target.sin_len = UInt8(MemoryLayout<sockaddr_in>.size); target.sin_port = UInt16(3702).bigEndian
        inet_pton(AF_INET, "239.255.255.250", &target.sin_addr)
        let probe = "<e:Envelope xmlns:e=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:w=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/04/discovery\" xmlns:dn=\"http://www.onvif.org/ver10/network/wsdl\"><e:Header><w:MessageID>urn:uuid:\(UUID().uuidString)</w:MessageID><w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>"
        let data = Data(probe.utf8)
        data.withUnsafeBytes { bytes in withUnsafePointer(to: &target) { p in p.withMemoryRebound(to: sockaddr.self, capacity: 1) { _ = sendto(fd, bytes.baseAddress, data.count, 0, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } } }
        var found: [String: [String: String]] = [:]
        let end = Date().addingTimeInterval(4)
        while Date() < end {
            var buffer = [UInt8](repeating: 0, count: 65536)
            let size = recv(fd, &buffer, buffer.count, 0)
            if size <= 0 { continue }
            guard let xml = try? ONVIFXML.parse(Data(buffer.prefix(size))), let addresses = xml.first("XAddrs") else { continue }
            for address in addresses.split(whereSeparator: { $0.isWhitespace }) {
                if let url = URL(string: String(address)), validCCTVURL(url, schemes: ["http", "https"]) {
                    found[url.host!] = ["ip": url.host!, "url": url.absoluteString, "name": "ONVIF camera (\(url.host!))"]
                }
            }
        }
        return found.values.sorted { $0["ip"]! < $1["ip"]! }
    }
}

final class CCTVDecoder: @unchecked Sendable {
    private let process = Process()
    private let pipe = Pipe()
    private let errors = Pipe()
    private let lock = NSLock()
    private var buffer = Data()
    private var latest: Data?
    private var failure: String?
    private var stopped = false
    func start(url: URL, login: CCTVLogin) throws {
        guard let executable = Bundle.main.url(forResource: "ffmpeg", withExtension: nil) else { throw CameraFailure(message: "The CCTV decoder is missing from this app build.") }
        var source = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        if !login.username.isEmpty { source.user = login.username; source.password = login.password }
        process.executableURL = executable
        process.arguments = ["-hide_banner", "-loglevel", "error", "-nostdin", "-rtsp_transport", "tcp", "-rw_timeout", "8000000", "-i", source.string!, "-an", "-vf", "fps=4,scale=960:-2", "-f", "image2pipe", "-c:v", "mjpeg", "-q:v", "5", "pipe:1"]
        process.standardOutput = pipe; process.standardError = errors
        pipe.fileHandleForReading.readabilityHandler = { [weak self] file in
            let data = file.availableData
            guard !data.isEmpty else { file.readabilityHandler = nil; return }
            self?.consume(data)
        }
        errors.fileHandleForReading.readabilityHandler = { file in if file.availableData.isEmpty { file.readabilityHandler = nil } } // Never retain camera credentials from decoder logs.
        process.terminationHandler = { [weak self] process in
            guard let self else { return }; self.lock.lock(); defer { self.lock.unlock() }
            if !self.stopped { self.failure = "Preview stopped. Check camera address, local login, RTSP access and Wi-Fi." }
        }
        try process.run()
    }
    private func consume(_ data: Data) {
        lock.lock(); defer { lock.unlock() }
        buffer.append(data)
        if buffer.count > 8 * 1024 * 1024 { buffer.removeAll(keepingCapacity: true) }
        let start = Data([0xff, 0xd8]), end = Data([0xff, 0xd9])
        while let a = buffer.range(of: start), let b = buffer.range(of: end, in: a.upperBound..<buffer.endIndex) {
            latest = Data(buffer[a.lowerBound..<b.upperBound]); buffer.removeSubrange(buffer.startIndex..<b.upperBound)
        }
    }
    func frame() throws -> Data {
        lock.lock(); defer { lock.unlock() }
        if let failure { throw CameraFailure(message: failure) }
        guard let latest else { throw CameraFailure(message: "Waiting for the first CCTV frame…") }; return latest
    }
    func stop() {
        lock.lock(); stopped = true; lock.unlock()
        pipe.fileHandleForReading.readabilityHandler = nil; errors.fileHandleForReading.readabilityHandler = nil
        if process.isRunning { process.terminate() }
    }
    deinit { stop() }
}

actor CCTVManager {
    static let shared = CCTVManager()
    private var decoders: [String: CCTVDecoder] = [:]
    private var cameras: [CCTVEntry] = []
    private let file: URL
    init() {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("SAVRDH Camera Studio", isDirectory: true)
        file = directory.appendingPathComponent("cctv.json")
        cameras = (try? JSONDecoder().decode([CCTVEntry].self, from: Data(contentsOf: file))) ?? []
    }
    private func persist() throws {
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try JSONEncoder().encode(cameras).write(to: file, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }
    func list() -> [[String: Any]] { cameras.map { ["id": $0.id, "name": $0.name, "kind": $0.kind, "url": $0.url] } }
    func save(_ body: [String: Any]) async throws -> [[String: Any]] {
        let name = String((body["name"] as? String ?? "").prefix(80)).trimmingCharacters(in: .whitespacesAndNewlines)
        let kind = body["kind"] as? String ?? "rtsp"
        guard name.count >= 2, let raw = body["url"] as? String, raw.count <= 2000, let input = URL(string: raw), validCCTVURL(input), ["rtsp", "snapshot", "onvif"].contains(kind) else { throw CameraFailure(message: "Enter a camera name and private RTSP, HTTP snapshot, or ONVIF address. Put credentials in the separate fields.") }
        let login = CCTVLogin(username: body["username"] as? String ?? "", password: body["password"] as? String ?? "")
        let url: URL
        if kind == "onvif" { url = try await ONVIF.stream(service: input, login: login) }
        else { url = input }
        guard kind != "rtsp" || url.scheme == "rtsp", kind != "snapshot" || ["http", "https"].contains(url.scheme ?? "") else { throw CameraFailure(message: "Select the matching connection type.") }
        guard cameras.count < 32 else { throw CameraFailure(message: "A maximum of 32 saved CCTV cameras is supported.") }
        let id = UUID().uuidString
        try login.save(id)
        cameras.append(CCTVEntry(id: id, name: name, kind: kind == "onvif" ? "rtsp" : kind, url: url.absoluteString))
        do { try persist() } catch { cameras.removeAll { $0.id == id }; CCTVLogin.remove(id); throw error }
        return list()
    }
    func remove(_ id: String) throws -> [[String: Any]] {
        decoders.removeValue(forKey: id)?.stop()
        let previous = cameras; cameras.removeAll { $0.id == id }
        do { try persist() } catch { cameras = previous; throw error }
        CCTVLogin.remove(id); return list()
    }
    func stop(_ id: String) { decoders.removeValue(forKey: id)?.stop() }
    func stopAll() { for decoder in decoders.values { decoder.stop() }; decoders.removeAll() }
    func frame(_ id: String) async throws -> Data {
        guard let camera = cameras.first(where: { $0.id == id }), let url = URL(string: camera.url) else { throw CameraFailure(message: "CCTV camera not found.") }
        guard validCCTVURL(url) else { throw CameraFailure(message: "Saved camera address is not a private network endpoint.") }
        let login = CCTVLogin.load(id)
        if camera.kind == "snapshot" {
            let data = try await CCTVHTTP(host: url.host!, login: login).request(url)
            guard data.starts(with: [0xff, 0xd8]) || data.starts(with: [0x89, 0x50, 0x4e, 0x47]) else { throw CameraFailure(message: "This URL did not return a JPEG or PNG snapshot.") }
            return data
        }
        if decoders[id] == nil {
            guard decoders.count < 4 else { throw CameraFailure(message: "Preview up to four CCTV streams at once. Stop another preview first.") }
            let decoder = CCTVDecoder(); try decoder.start(url: url, login: login); decoders[id] = decoder
        }
        return try decoders[id]!.frame()
    }
}
#endif
