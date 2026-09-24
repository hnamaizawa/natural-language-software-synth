from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_each_track_picks_an_independent_scanned_vst3_plugin():
    html = read("web/index.html")
    track = read("web/multitrack_runtime.js")
    router = read("web/vst3_runtime.js")
    assert 'id="trackVstPluginSelect"' in html
    assert 'id="trackVstScanBtn"' in html
    assert 'plugins.find(item=>item.id===id)' in track
    assert 'track.source={type:"vst3",plugin_id:plugin.id' in track
    assert 'window.addEventListener("vst3-catalog-changed",()=>{renderTrackList();renderTrackSoundPanel();})' in track
    assert 'function scannedPlugins()' in router
    assert 'window.dispatchEvent(new Event("vst3-catalog-changed"))' in router


def test_lookahead_limits_synchronous_work_and_batches_shared_vst_events():
    track = read("web/multitrack_runtime.js")
    router = read("web/vst3_runtime.js")
    assert 'horizon=now+.45' in track
    assert 'while(cursor<queue.length&&cycleStart+queue[cursor].startBeat*secondsPerBeat<=horizon)' in track
    assert 'playbackTimer=setTimeout(pump,Math.max(25,Math.min(100,untilNext)))' in track
    assert 'clearTimeout(playbackTimer)' in track
    assert 'window.vst3Router?.trackEventsBatch?.(vstEvents)' in track
    assert 'const target=trackInstances.get(trackId)' in router
    assert 'groups.get(target.instanceId)||[]' in router
    assert 'events.slice(i,i+1024)' in router
