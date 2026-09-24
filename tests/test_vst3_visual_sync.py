from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_vst3_routed_notes_keep_performance_visualization_in_sync():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    for token in [
        "function setRoutedVisual(note,on)",
        'typeof setPerformanceActive==="function"',
        "setPerformanceActive(bounded,on)",
        "function clearRoutedVisuals()",
        "scheduleNative(\"/api/vst3/note-on\"",
        "()=>setRoutedVisual(note,true)",
        "()=>setRoutedVisual(note,false)",
        "scheduleNative(\"/api/vst3/note-off\"",
    ]:
        assert token in js


def test_vst3_visual_timing_uses_same_scheduled_fire_as_native_note_event():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert "function scheduleNative(path,payload,whenSeconds=0,onFire=null,onFailure=null)" in js
    assert "if(onFire)onFire();" in js
    assert "if(delay<2){fire();return;}" in js
    assert "scheduledQueue.push({due:performance.now()+delay,fire})" in js
    assert "function armScheduledQueue()" in js


def test_vst3_visuals_are_cleared_when_routing_stops_or_plugin_unloads():
    js = (ROOT / "web" / "vst3_runtime.js").read_text(encoding="utf-8")
    assert "cancelScheduled();route.checked=false;route.disabled=true" in js
    assert "if(!route.checked)clearRoutedVisuals()" in js
    assert "scheduledQueue=[];clearRoutedVisuals();" in js
