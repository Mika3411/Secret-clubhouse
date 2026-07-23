import Darwin
import Foundation

struct Note {
    let start: Double
    let end: Double
    let frequency: Double
}

private let sampleRate = 8_000.0

private func appendBigEndian<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
    var encoded = value.bigEndian
    Swift.withUnsafeBytes(of: &encoded) { data.append(contentsOf: $0) }
}

private func appendLittleEndian<T: FixedWidthInteger>(_ value: T, to data: inout Data) {
    var encoded = value.littleEndian
    Swift.withUnsafeBytes(of: &encoded) { data.append(contentsOf: $0) }
}

private func appendASCII(_ value: String, to data: inout Data) {
    data.append(value.data(using: .ascii)!)
}

private func makeCAF(duration: Double, amplitude: Double, notes: [Note]) -> Data {
    let sampleCount = Int((duration * sampleRate).rounded())
    var samples = Data(capacity: sampleCount * MemoryLayout<Int16>.size)

    for index in 0..<sampleCount {
        let time = Double(index) / sampleRate
        let value: Double
        if let note = notes.first(where: { time >= $0.start && time < $0.end }) {
            let attack = min(1, max(0, (time - note.start) / 0.025))
            let release = min(1, max(0, (note.end - time) / 0.055))
            let envelope = min(attack, release)
            value = sin(2 * .pi * note.frequency * time) * amplitude * envelope
        } else {
            value = 0
        }
        appendLittleEndian(Int16((value * Double(Int16.max)).rounded()), to: &samples)
    }

    var caf = Data()
    appendASCII("caff", to: &caf)
    appendBigEndian(UInt16(1), to: &caf)
    appendBigEndian(UInt16(0), to: &caf)

    appendASCII("desc", to: &caf)
    appendBigEndian(UInt64(32), to: &caf)
    appendBigEndian(sampleRate.bitPattern, to: &caf)
    appendASCII("lpcm", to: &caf)
    appendBigEndian(UInt32(12), to: &caf) // signed integer, packed, little-endian
    appendBigEndian(UInt32(2), to: &caf)
    appendBigEndian(UInt32(1), to: &caf)
    appendBigEndian(UInt32(1), to: &caf)
    appendBigEndian(UInt32(16), to: &caf)

    appendASCII("data", to: &caf)
    appendBigEndian(UInt64(samples.count + 4), to: &caf)
    appendBigEndian(UInt32(0), to: &caf)
    caf.append(samples)
    return caf
}

if CommandLine.arguments.count != 2 {
    fputs("Usage: GenerateNotificationSounds.swift OUTPUT_DIRECTORY\n", stderr)
    exit(64)
}

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(
    at: outputDirectory,
    withIntermediateDirectories: true
)

let sounds: [(name: String, duration: Double, amplitude: Double, notes: [Note])] = [
    (
        "message_discreet.caf",
        0.24,
        0.13,
        [Note(start: 0.02, end: 0.20, frequency: 784)]
    ),
    (
        "contact_gentle.caf",
        0.65,
        0.14,
        [
            Note(start: 0.02, end: 0.24, frequency: 523.25),
            Note(start: 0.31, end: 0.57, frequency: 659.25)
        ]
    ),
    (
        "call_soft.caf",
        2.40,
        0.12,
        [
            Note(start: 0.02, end: 0.43, frequency: 440),
            Note(start: 0.56, end: 0.98, frequency: 554.37),
            Note(start: 1.11, end: 1.53, frequency: 659.25),
            Note(start: 1.66, end: 2.08, frequency: 554.37)
        ]
    )
]

for sound in sounds {
    let data = makeCAF(
        duration: sound.duration,
        amplitude: sound.amplitude,
        notes: sound.notes
    )
    try data.write(
        to: outputDirectory.appendingPathComponent(sound.name),
        options: .atomic
    )
}
