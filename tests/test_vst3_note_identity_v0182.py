import shutil
import subprocess
from pathlib import Path

import pytest

from server import Vst3Bridge


ROOT = Path(__file__).resolve().parents[1]


def test_bridge_preserves_bounded_matching_note_ids(monkeypatch):
    bridge = Vst3Bridge()
    commands = []
    monkeypatch.setattr(bridge, "_command", lambda command: commands.append(command) or {"ok": True})
    bridge.note_on(60, 0.8, 0, "keys", 1234)
    bridge.note_off(60, 0, "keys", 1234)
    bridge.events([
        {"on": True, "note": 60, "velocity": 0.8, "channel": 0, "delay_ms": 0, "note_id": 12},
        {"on": False, "note": 60, "channel": 0, "delay_ms": 500, "note_id": 12},
    ], "keys")
    bridge.note_on(60, 0.8, 0, "keys", 2**40)
    assert commands[0] == "NOTE_ON\tkeys\t60\t0.800000\t0\t1234"
    assert commands[1] == "NOTE_OFF\tkeys\t60\t0\t1234"
    assert commands[2] == "BATCH\tkeys\t1,60,0.800000,0,0.000,12;0,60,0.000000,0,500.000,12"
    assert commands[3].endswith("\t2147483646")


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is unavailable")
def test_browser_allocates_independent_ids_for_overlapping_same_pitch():
    script = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('web/vst3_runtime.js','utf8');
const body=source.slice(source.indexOf('  let noteSerial=0;'),source.indexOf('  let catalog=[];'));
const ids=vm.runInNewContext(body+'; ({beginNote,endNote,forgetNotes})');
const first=ids.beginNote('keys',0,60),second=ids.beginNote('keys',0,60);
const other=ids.beginNote('bass',0,60);
assert(first>0&&second>first&&other>second);
assert.strictEqual(ids.endNote('keys',0,60),first);
assert.strictEqual(ids.endNote('keys',0,60),second);
assert.strictEqual(ids.endNote('bass',0,60),other);
assert.strictEqual(ids.endNote('keys',0,60),-1);
ids.beginNote('keys',0,60);ids.forgetNotes('keys');
assert.strictEqual(ids.endNote('keys',0,60),-1);
"""
    subprocess.run([shutil.which("node"), "-e", script], cwd=ROOT, check=True)


def test_native_host_forwards_note_id_to_both_vst3_events():
    source = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    assert "event.noteOn.noteId = note.noteId" in source
    assert "event.noteOff.noteId = note.noteId" in source
    assert "values.size () >= 6 ? std::stoi (values[5]) : -1" in source
