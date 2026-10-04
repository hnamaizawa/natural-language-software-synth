"use strict";

// Convert corrected humming note events into bounded, editable sequencer clips.
// Only note numbers, durations and velocities cross this boundary; microphone PCM does not.
(() => {
  function makeClips(steps, captureBpm, projectBpm, startBeat, songBeats) {
    if (!Array.isArray(steps) || !steps.length || steps.length > 512) throw new Error("補正済みの鼻歌ノートがありません。");
    if (![captureBpm, projectBpm, startBeat, songBeats].every(Number.isFinite) || captureBpm < 40 || captureBpm > 240 || projectBpm < 40 || projectBpm > 240 || startBeat < 0 || songBeats > 256) throw new Error("曲のテンポまたは配置位置が不正です。");
    const ratio = projectBpm / captureBpm, notes = [];
    let cursor = 0;
    for (const step of steps) {
      const beats = Number(step.beats);
      if (!Number.isFinite(beats) || beats <= 0 || beats > 8) throw new Error("鼻歌の音価が範囲外です。");
      const duration = Math.max(1 / 32, Math.round(beats * ratio * 32) / 32);
      if (step.notes?.length) {
        if (step.notes.length !== 1 || !Number.isInteger(step.notes[0]) || step.notes[0] < 0 || step.notes[0] > 127) throw new Error("鼻歌の音高が不正です。");
        notes.push({note: step.notes[0], start: cursor, duration, velocity: Math.min(1, Math.max(.01, Number(step.velocity) || .8))});
      }
      cursor += duration;
    }
    if (!notes.length) throw new Error("補正済みの鼻歌ノートがありません。");
    if (startBeat + cursor > songBeats + 1e-8) throw new Error("鼻歌が曲長を超えます。曲長を延ばすか、開始小節を早めてください。");
    const count = Math.ceil(cursor / 16);
    if (count > 64) throw new Error("クリップ数の上限を超えます。");
    return Array.from({length: count}, (_, index) => {
      const offset = index * 16, length = Math.min(16, cursor - offset);
      const clipNotes = [];
      for (const note of notes) {
        if (note.start >= offset + length || note.start + note.duration <= offset) continue;
        let position = Math.max(note.start, offset);
        const end = Math.min(note.start + note.duration, offset + length);
        while (position < end - 1e-8) {
          const part = Math.min(8, end - position);
          clipNotes.push({note: note.note, start_beats: position - offset, duration_beats: part, velocity: note.velocity});
          position += part;
        }
      }
      if (clipNotes.length > 512) throw new Error("1クリップのノート数の上限を超えます。");
      return {start_beats: startBeat + offset, length_beats: Math.max(.25, length), notes: clipNotes};
    });
  }
  window.hummingClipBridge = {makeClips};
})();
