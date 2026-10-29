import Foundation

@main struct ONVIFIntegration {
    static func main() async {
        let env = ProcessInfo.processInfo.environment
        guard let base = env["ONVIF_FIXTURE_URL"] else { fatalError("Fixture URL required") }
        let login = CCTVLogin(username: "fixture-user", password: "fixture-password")
        do {
            let stream = try await ONVIF.stream(service: URL(string: base + "/device")!, login: login)
            precondition(stream.absoluteString == base.replacingOccurrences(of: "http://", with: "rtsp://") + "/live")
            for path in ["denied", "fault", "external"] {
                do {
                    _ = try await ONVIF.stream(service: URL(string: base + "/" + path)!, login: login)
                    fatalError("Unsafe or denied response accepted: \(path)")
                } catch {
                    precondition(!error.localizedDescription.contains("fixture-password"))
                    if path == "denied" { precondition(error.localizedDescription.contains("401")) }
                    if path == "fault" { precondition(error.localizedDescription.contains("authentication")) }
                    if path == "external" { precondition(error.localizedDescription.contains("unavailable")) }
                }
            }
            print("ONVIF integration passed: camera-clock digest, capabilities, profiles, stream URL, denied login, SOAP fault and external-address rejection.")
        } catch { print("ONVIF integration failed: \(error.localizedDescription)"); exit(1) }
    }
}
