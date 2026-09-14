from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_vst3_ui_and_router_are_loaded_last():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    for control_id in [
        "vst3ScanBtn", "vst3PluginSelect", "vst3LoadBtn", "vst3UnloadBtn",
        "vst3RouteEnabled", "vst3Parameters", "vst3Status",
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
        "/api/vst3/parameters", "/api/vst3/parameter", "/api/vst3/unload",
    ]:
        assert endpoint in js


def test_vst3_router_wraps_final_note_contract_and_preserves_scheduling():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert "const baseNoteOn=engine.noteOn.bind(engine)" in js
    assert "baseNoteOff=engine.noteOff.bind(engine)" in js
    assert "engine.noteOn=function(midiNote,velocity,whenSeconds=0)" in js
    assert "engine.noteOff=function(midiNote,whenSeconds=0)" in js
    assert "scheduleNative" in js
    assert "whenSeconds" in js
    assert "if(route.checked&&loaded)" in js


def test_python_bridge_is_loopback_only_and_scans_standard_windows_paths():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert 'HOST = "127.0.0.1"' in server
    assert "class Vst3Bridge" in server
    assert 'os.environ.get("COMMONPROGRAMFILES")' in server
    assert 'Path(common) / "VST3"' in server
    assert 'Path(local) / "Programs" / "Common" / "VST3"' in server
    assert 'os.environ.get("NLSS_VST3_PATHS"' in server
    assert 'os.environ.get("NLSS_VST3_HOST"' in server


def test_plugin_load_is_limited_to_scanned_ids_and_values_are_bounded():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    assert "self._plugins.get(plugin_id)" in server
    assert "Unknown VST3 plug-in id" in server
    assert "midi_note = max(0, min(127" in server
    assert "velocity = max(0.0, min(1.0" in server
    assert "parameter_id = max(0, min(0x7FFFFFFF" in server
    assert "value = max(0.0, min(1.0" in server


def test_native_vst3_dependencies_are_pinned():
    cmake = (ROOT / "native" / "vst3_host" / "CMakeLists.txt").read_text(encoding="utf-8")
    assert "3cdf9ca5d1f5b1b21e0a86832aa4abe55607bd96" in cmake
    assert "9634bedb5b5a2ca38c1ee7108a9358a4e233f14d" in cmake
    assert "sdk_hosting" in cmake
    assert "cxx_std_17" in cmake


def test_native_host_uses_vst3_processing_events_parameters_and_audio_device():
    cpp = (ROOT / "native" / "vst3_host" / "src" / "main.cpp").read_text(encoding="utf-8")
    for token in [
        "VST3::Hosting::Module::create", "PlugProvider", "IAudioProcessor", "setupProcessing",
        "setProcessing (true)", "Event::kNoteOnEvent", "Event::kNoteOffEvent", "ParameterChanges",
        "getParameterCount", "setParamNormalized", "ma_device_init", "ma_device_start",
        'parts[0] == "LOAD"', 'parts[0] == "NOTE_ON"', 'parts[0] == "NOTE_OFF"', 'parts[0] == "PARAMS"',
    ]:
        assert token in cpp


def test_vst3_build_helper_exists_and_uses_release_binary_path():
    cmd = (ROOT / "build_vst3_host.cmd").read_text(encoding="utf-8")
    assert 'Visual Studio 17 2022' in cmd
    assert "cmake --build" in cmd
    assert "Release\\nlss_vst3_host.exe" in cmd
