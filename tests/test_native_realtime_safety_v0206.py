from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_native_audio_callback_uses_snapshots_and_nonblocking_instance_locks():
    cpp = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    rack_render_start = cpp.index("    void render (float* output, ma_uint32 frames, uint64_t startFrame)")
    rack_render_end = cpp.index("    std::shared_ptr<const InstanceSnapshot> currentSnapshot", rack_render_start)
    rack_render = cpp[rack_render_start:rack_render_end]
    assert "currentSnapshot ()" in rack_render
    assert "std::lock_guard<std::mutex>" not in rack_render
    assert "std::atomic_load_explicit" in cpp

    host_render_start = cpp.index("    void render (float* output, ma_uint32 frameCount, uint64_t startFrame)")
    host_render_end = cpp.index("    bool drainPendingChanges", host_render_start)
    host_render = cpp[host_render_start:host_render_end]
    assert "std::try_to_lock" in host_render
    assert "skippedBlocks_.fetch_add (1)" in host_render

    drain_start = cpp.index("    bool drainPendingChanges")
    drain_end = cpp.index("    void clearProcessInputs", drain_start)
    drain = cpp[drain_start:drain_end]
    assert "std::unique_lock<std::mutex> lock (queueMutex_, std::try_to_lock)" in drain
    assert "if (!lock.owns_lock ()) return false;" in drain
    assert "std::lock_guard<std::mutex>" not in drain


def test_native_host_avoids_audio_thread_note_map_allocations_and_tracks_process_budget():
    cpp = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    assert "std::array<ActiveNoteId, 1024> activeNoteIds_" in cpp
    assert "std::unordered_map<int32, std::pair<int32, int16>> activeNoteIds_" not in cpp
    for metric in ["max_process_us", "process_overruns", "skipped_blocks"]:
        assert f'\\\"{metric}\\\"' in cpp
    assert "_mm_setcsr (_mm_getcsr () | 0x8040)" in cpp
    assert "config.wasapi.usage = ma_wasapi_usage_pro_audio" in cpp


def test_closed_editor_does_not_poll_the_windows_message_queue():
    editor = (ROOT / "native/vst3_host/src/plugin_editor_win32.cpp").read_text(encoding="utf-8")
    start = editor.index("void PluginEditorWin32::pumpMessages ()")
    end = editor.index("LRESULT CALLBACK", start)
    pump = editor[start:end]
    assert pump.index("if (!window_)") < pump.index("PeekMessageW")


def test_native_status_metrics_are_forwarded_to_diagnostics_ui():
    server = (ROOT / "server.py").read_text(encoding="utf-8")
    js = (ROOT / "web/vst3_runtime.js").read_text(encoding="utf-8")
    for metric in ["max_process_us", "process_overruns", "skipped_blocks"]:
        assert metric in server
        assert metric in js
