from pathlib import Path

from server import Vst3Bridge

ROOT = Path(__file__).resolve().parents[1]


def test_vst3_ui_and_router_are_loaded_last():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for control_id in [
        "vst3ScanBtn", "vst3PluginSelect", "vst3LoadBtn", "vst3UnloadBtn",
        "vst3TestToneBtn", "vst3DiagBtn", "vst3RouteEnabled", "vst3Parameters", "vst3Status",
    ]:
        assert f'id="{control_id}"' in html
    assert 'src="/vst3_runtime.js"' in html
    assert html.index('/humming_runtime.js') < html.index('/vst3_runtime.js')


def test_browser_never_loads_vst3_binary_directly():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert ".vst3" not in js.lower()
    assert "WebAssembly" not in js
    assert "fetch(path,options)" in js
    for endpoint in [
        "/api/vst3/scan", "/api/vst3/load", "/api/vst3/note-on", "/api/vst3/note-off",
        "/api/vst3/parameters", "/api/vst3/parameter", "/api/vst3/test-tone", "/api/vst3/diagnostics",
        "/api/vst3/unload",
    ]:
        assert endpoint in js or endpoint in (ROOT / "server.py").read_text(encoding="utf-8")


def test_vst3_router_wraps_final_note_contract_and_preserves_scheduling():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert "const baseNoteOn=engine.noteOn.bind(engine)" in js
    assert "baseNoteOff=engine.noteOff.bind(engine)" in js
    assert "engine.noteOn=function(midiNote,velocity,whenSeconds=0)" in js
    assert "engine.noteOff=function(midiNote,whenSeconds=0)" in js
    assert "scheduleNative" in js
    assert "whenSeconds" in js
    assert "if(route.checked&&loaded)" in js
    assert 'engine.patch?.engine_type==="drum"?9:0' in js
    assert '{note,velocity:clamp(velocity,.001,1),channel}' in js
    assert '{note,channel}' in js


def test_python_bridge_is_loopback_only_and_scans_standard_windows_paths():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert 'HOST = "127.0.0.1"' in server
    assert "class Vst3Bridge" in server
    assert 'os.environ.get("COMMONPROGRAMFILES")' in server
    assert 'Path(common) / "VST3"' in server
    assert 'Path(local) / "Programs" / "Common" / "VST3"' in server
    assert 'os.environ.get("NLSS_VST3_PATHS"' in server
    assert 'os.environ.get("NLSS_VST3_HOST"' in server
    assert 'payload.get("scan_paths", [])' in server
    assert 'requested or [])[:16]' in server
    assert 'endswith((".dll", ".exe"))' in server


def test_plugin_load_is_limited_to_scanned_ids_and_values_are_bounded():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert "self._plugins.get(plugin_id)" in server
    assert "Unknown VST3 plug-in id" in server
    assert "midi_note = max(0, min(127" in server
    assert "velocity = max(0.0, min(1.0" in server
    assert "channel = max(0, min(15" in server
    assert "parameter_id = max(0, min(0x7FFFFFFF" in server
    assert "value = max(0.0, min(1.0" in server


def test_vst3_control_decoder_accepts_clean_prefixed_and_noisy_json():
    assert Vst3Bridge._decode_control_line('{"ok":true,"loaded":true}') == {"ok": True, "loaded": True}
    assert Vst3Bridge._decode_control_line('NLSS_JSON\t{"ok":true,"pong":true}') == {"ok": True, "pong": True}
    assert Vst3Bridge._decode_control_line('OB-Xf diagnostic: init {"ok":true,"name":"OB-Xf"}') == {
        "ok": True,
        "name": "OB-Xf",
    }
    assert Vst3Bridge._decode_control_line("OB-Xf diagnostic only") is None


def test_python_bridge_skips_plugin_stdout_until_control_json():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert "MAX_PROTOCOL_LINES = 64" in server
    assert "_read_host_response" in server
    assert "ignored non-protocol stdout" in server
    assert "json.JSONDecoder()" in server


def test_vst3_audio_diagnostics_and_native_output_test_are_exposed():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    for token in ["DIAGNOSTICS", "TEST_TONE", '"/api/vst3/diagnostics"', '"/api/vst3/test-tone"']:
        assert token in server
    assert 'api("/api/vst3/test-tone",{})' in js
    assert 'api("/api/vst3/diagnostics")' in js
    assert "max_output_peak" in js
    assert "process_failures" in js
    assert "note_on_queued" in js


def test_native_vst3_dependencies_are_pinned():
    cmake = (ROOT / "native" / "vst3_host" / "CMakeLists.txt").read_text(encoding="utf-8")
    assert "3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96" in cmake
    assert "9634bedb5b5a2ca38c1ee7108a9358a4e233f14d" in cmake
    assert "sdk_hosting" in cmake
    assert "cxx_std_17" in cmake
    assert "VERSION 0.7.2" in cmake


def test_native_host_uses_vst3_processing_events_parameters_and_audio_device():
    cpp = (ROOT / "native" / "vst3_host" / "src" / "main.cpp").read_text(encoding="utf-8")
    for token in [
        "VST3::Hosting::Module::create", "PlugProvider", "IAudioProcessor", "setupProcessing",
        "setProcessing (true)", "Event::kNoteOnEvent", "Event::kNoteOffEvent", "ParameterChanges",
        "getParameterCount", "setParamNormalized", "ma_device_init", "ma_device_start",
        'parts[0] == "LOAD"', 'parts[0] == "NOTE_ON"', 'parts[0] == "NOTE_OFF"', 'parts[0] == "PARAMS"',
    ]:
        assert token in cpp
    assert "event.noteOn.channel = note.channel" in cpp
    assert "event.noteOff.channel = note.channel" in cpp
    assert "std::min (15, channel)" in cpp


def test_vst3_scan_ui_accepts_extra_local_folder_and_explains_vst2_files():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert 'id="vst3ExtraScanPaths"' in html
    assert "C:\\Program Files\\Kawai" in html
    assert 'split(";")' in js
    assert "{scan_paths:paths}" in js
    assert "VST2は非対応" in js


def test_vst3_midi_channel_can_be_switched_for_ssd5_and_zero_peak_is_explained():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert 'id="vst3MidiChannel"' in html
    assert 'value="0">チャンネル1（SSD5推奨候補）' in html
    assert 'value="9">チャンネル10（GMドラム）' in html
    assert "function routedChannel()" in js
    assert "const channel=routedChannel()" in js
    assert "MIDIイベントは到達していますが音声出力が0です" in js
    assert "キット／Presetのロード" in js


def test_native_host_negotiates_bus_arrangements_before_activation_and_marks_live_notes():
    cpp = (ROOT / "native" / "vst3_host" / "src" / "main.cpp").read_text(encoding="utf-8")
    for token in [
        "configureBusArrangements ();", "processor_->setBusArrangements", "chooseBus (kAudio, kOutput, true)",
        "chooseBus (kEvent, kInput, true)", "activateBuses (kEvent, kInput, mainEventInputBus_)",
        "processData_.prepare", "processor_->setupProcessing", "component_->setActive (true)",
        "processor_->setProcessing (true)", "event.busIndex = mainEventInputBus_", "Event::kIsLive",
        "mainOutputBus_", "clearProcessOutputs", "copyOutputs", "maxOutputPeak_", "processFailures_",
    ]:
        assert token in cpp
    assert cpp.index("processData_.prepare") < cpp.index("processor_->setupProcessing")
    assert cpp.index("processor_->setupProcessing") < cpp.index("component_->setActive (true)")
    assert cpp.index("component_->setActive (true)") < cpp.index("processor_->setProcessing (true)")


def test_vst3_build_helper_exists_and_uses_release_binary_path():
    cmd = (ROOT / "build_vst3_host.cmd").read_text(encoding="utf-8")
    assert 'Visual Studio 17 2022' in cmd
    assert "cmake --build" in cmd
    assert "Release\\nlss_vst3_host.exe" in cmd
