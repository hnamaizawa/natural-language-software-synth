from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_native_callback_uses_single_block_and_reuses_event_buffers():
    native = (ROOT / "native/vst3_host/src/main.cpp").read_text(encoding="utf-8")
    assert "constexpr uint32_t kBlockSize = 1024;" in native
    assert "config.periodSizeInFrames = kBlockSize;" in native
    assert "setup.maxSamplesPerBlock = static_cast<int32> (kBlockSize);" in native
    assert "dueNotes_.reserve (1024);" in native
    assert "dueParams_.reserve (1024);" in native
    assert "pendingNotes_.erase (std::remove_if (pendingNotes_.begin (), pendingNotes_.end ()," in native
    assert "note.delayFrames -= static_cast<uint64_t> (chunkFrames);" in native
    assert "event.sampleOffset = static_cast<int32> (note.delayFrames);" in native
    assert "std::stable_partition (pendingNotes_" not in native
