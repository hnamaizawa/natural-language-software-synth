from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "AGENTS.md", "HARNESS.md", "README.md", "server.py", "pyproject.toml",
    "setup_windows.cmd", "start_synth.cmd", "check_harness.cmd",
    "harness/app_blueprint.yaml", "src/ai_synth/patch.py", "src/ai_synth/prompt_engine.py",
    "web/index.html", "web/app.js", "web/patch_editor_runtime.js", "web/guitar_runtime.js",
    "web/piano_runtime.js", "web/instrument_performance_runtime.js", "web/performance_library_runtime.js",
    "web/output_level_runtime.js", "web/performance_editor.css", "web/style.css",
]


def fail(msg: str):
    print(f"[FAIL] {msg}")
    raise SystemExit(1)


def ok(msg: str):
    print(f"[ OK ] {msg}")


def main():
    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    if missing:
        fail(f"required files missing: {missing}")
    ok("required files")

    blueprint = (ROOT / "harness/app_blueprint.yaml").read_text(encoding="utf-8")
    required_invariants = [
        "generated_text_must_never_be_executed_as_code",
        "generated_patch_must_be_schema_validated_and_clamped",
        "graphical_parameter_edits_must_be_validated_and_clamped",
        "graphical_slider_input_must_not_rebuild_control_during_drag",
        "all_engines_must_share_single_audio_context",
        "master_gain_must_be_hard_limited",
        "output_level_normalization_must_not_bypass_master_gain_limit",
        "output_level_runtime_must_use_existing_audio_context",
        "instrument_level_trim_must_be_bounded",
        "jazz_chord_samples_must_use_quartal_voicing",
        "polyphony_must_be_bounded",
        "sequencer_must_use_same_note_on_note_off_contract_as_live_playing",
        "sample_performance_must_use_same_note_on_note_off_contract_as_live_playing",
        "sample_performance_must_match_explicit_instrument_model",
        "expanded_sample_library_must_use_note_event_contract",
        "custom_sample_phrases_must_remain_local_browser_data",
        "custom_sample_phrase_values_must_be_bounded",
        "custom_sample_phrases_must_not_execute_user_text",
        "guitar_detection_must_require_explicit_electric_guitar_model",
        "guitar_chord_sample_performance_must_apply_strum_timing",
        "drum_patch_must_keep_drum_surface_and_drum_keymap",
        "pcm_sampler_must_use_audio_buffer_source_nodes",
        "pcm_factory_buffers_must_not_embed_third_party_artist_recordings",
        "guitar_pcm_must_use_existing_audio_context",
        "guitar_amp_parameters_must_be_schema_validated_and_clamped",
        "guitar_sample_performance_must_use_note_event_contract",
        "grand_piano_pcm_must_use_existing_audio_context",
        "grand_piano_parameters_must_be_schema_validated_and_clamped",
        "pcm_and_fm_parameters_must_be_schema_validated_and_clamped",
        "eval_and_dynamic_script_injection_forbidden",
    ]
    for item in required_invariants:
        if item not in blueprint:
            fail(f"blueprint invariant missing: {item}")
    ok("non-negotiable multi-engine invariants")

    patch_py = (ROOT / "src/ai_synth/patch.py").read_text(encoding="utf-8")
    if "0.35" not in patch_py or "min(16" not in patch_py:
        fail("master gain/polyphony clamps not found")
    for token in [
        'ENGINE_TYPES = {"synth", "sampler", "drum", "fm"}',
        '"electric_guitar"', '"grand_piano"', "GUITAR_AMP_MODELS", "GUITAR_DEMO_STYLES",
        "finger_noise_mix", "slide_amount", "mwah_amount",
        "guitar_amp_drive", "guitar_amp_presence", "guitar_cabinet_mix", "guitar_palm_mute",
        "piano_tone", "piano_hammer_mix", "piano_resonance", "piano_damper_noise",
        "piano_softness", "piano_sustain", "piano_velocity_curve", "piano_room_mix",
        "kick_tune_hz", "drum_room_mix", "fm_mod_index", "fm_ratio_1", "fm_chorus_mix",
    ]:
        if token not in patch_py:
            fail(f"multi-engine patch schema missing: {token}")
    ok("hard audio, sampler, guitar, piano, drum, and FM parameter bounds")

    js = (ROOT / "web/app.js").read_text(encoding="utf-8")
    runtime_js = (ROOT / "web/patch_editor_runtime.js").read_text(encoding="utf-8")
    guitar_js = (ROOT / "web/guitar_runtime.js").read_text(encoding="utf-8")
    piano_js = (ROOT / "web/piano_runtime.js").read_text(encoding="utf-8")
    instrument_js = (ROOT / "web/instrument_performance_runtime.js").read_text(encoding="utf-8")
    library_js = (ROOT / "web/performance_library_runtime.js").read_text(encoding="utf-8")
    output_js = (ROOT / "web/output_level_runtime.js").read_text(encoding="utf-8")
    all_code = "\n".join(
        p.read_text(encoding="utf-8", errors="ignore")
        for p in [
            ROOT / "server.py", ROOT / "src/ai_synth/prompt_engine.py", ROOT / "web/app.js",
            ROOT / "web/patch_editor_runtime.js", ROOT / "web/guitar_runtime.js", ROOT / "web/piano_runtime.js",
            ROOT / "web/instrument_performance_runtime.js", ROOT / "web/performance_library_runtime.js",
            ROOT / "web/output_level_runtime.js",
        ]
    )
    for token in ["eval(", "new Function(", "exec("]:
        if token in all_code:
            fail(f"forbidden executable generation token found: {token}")
    ok("generated and registered text cannot enter executable path")

    for contract in ["noteOn(midiNote", "noteOff(midiNote", "setPatch(raw)"]:
        if contract not in js:
            fail(f"sequencer/live contract missing: {contract}")
    audio_context_token = "new (window.AudioContext||window.webkitAudioContext)()"
    if js.count(audio_context_token) != 1:
        fail("base engine must contain exactly one audio context creation path")
    for extension_name, extension_js in [
        ("guitar", guitar_js), ("piano", piano_js), ("instrument performance", instrument_js),
        ("performance library", library_js), ("output level", output_js),
    ]:
        if "new AudioContext" in extension_js or "new (window.AudioContext" in extension_js:
            fail(f"{extension_name} runtime must not create its own audio context")
    ok("single audio context and stable note event contract")

    html = (ROOT / "web/index.html").read_text(encoding="utf-8")
    for control in [
        "sampleSelect", "samplePlayBtn", "sampleStopBtn", "params", "resetParamsBtn",
        "customSampleInstrument", "customSampleBpm", "customSampleName", "customSampleSteps",
        "customSampleSaveBtn", "customSampleDeleteBtn", "customSampleStatus",
    ]:
        if f'id="{control}"' not in html:
            fail(f"required UI control missing: {control}")
    scripts = [
        "/patch_editor_runtime.js", "/guitar_runtime.js", "/piano_runtime.js",
        "/instrument_performance_runtime.js", "/performance_library_runtime.js", "/output_level_runtime.js",
    ]
    for script in scripts:
        if f'src="{script}"' not in html:
            fail(f"required browser runtime is not loaded: {script}")
    if not (
        html.index('/guitar_runtime.js') < html.index('/piano_runtime.js')
        < html.index('/instrument_performance_runtime.js') < html.index('/performance_library_runtime.js')
        < html.index('/output_level_runtime.js')
    ):
        fail("extension runtime load order is invalid")
    ok("adaptive UI, piano runtime, and custom sample controls")

    # Keep v0.4.x explicit routing guards intact.
    for token in [
        'p.instrument_model === "electric_guitar"', "delete sanitized.guitar_amp_model",
        "instrumentKey(currentPatch)", 'p.instrument_model === "studio_drums" || p.engine_type === "drum"',
        'document.getElementById("keyboardWrap").hidden=drum', 'document.getElementById("drumKitWrap").hidden=!drum',
        "isDrumPatch(currentPatch) ? DRUM_KEY_MAP : SYNTH_KEY_MAP", "oldPlayButton.replaceWith(playButton)",
    ]:
        if token not in instrument_js:
            fail(f"instrument routing guard missing: {token}")
    ok("legacy instrument routing guards retained")

    for token in [
        "ジャズ・シンセリード", "ジャズ・ウォーキングベース", "ジャズ・エレピ・4度堆積ボイシング",
        "ジャズ・スウィング", "ジャズ・4度堆積コンピング",
    ]:
        if token not in instrument_js:
            fail(f"instrument jazz sample performance missing: {token}")
    if "function quartalVoicing(root,size=4)" not in instrument_js or "root+index*5" not in instrument_js:
        fail("jazz chord voicings are not explicit stacked-fourth voicings")
    ok("quartal jazz voicing guard retained")

    for token in [
        "LEVEL_TRIMS", "grand_piano:1.03", "perceivedLevelTrim", "createDynamicsCompressor()",
        "leveler.threshold.value=-18", "leveler.ratio.value=2.5", "this.master.disconnect(this.analyser)",
        "this.master.connect(leveler)", "leveler.connect(this.analyser)", "normalizedVelocity=clamp",
        "clamp(trim,.82,1.22)", "baseNoteOn(midiNote,normalizedVelocity,whenSeconds)",
    ]:
        if token not in output_js:
            fail(f"output normalization capability missing: {token}")
    if "createGain()" in output_js or "this.master.gain" in output_js:
        fail("output normalization must not add a makeup-gain stage or bypass the master gain clamp")
    ok("bounded perceived output-level normalization")

    for token in [
        "createFactoryFretlessPCM", "FRETLESS_REGIONS", "createBufferSource()",
        'playFretlessArticulation("attack"', 'playFretlessArticulation("release"', 'playFretlessArticulation("slide"',
    ]:
        if token not in js:
            fail(f"PCM fretless capability missing: {token}")
    prompt_py = (ROOT / "src/ai_synth/prompt_engine.py").read_text(encoding="utf-8")
    for token in ["finger_noise_mix=0.68", "finger_noise_mix=max(p.finger_noise_mix, 0.82)", "sample_attack_mix=max(p.sample_attack_mix, 0.60)"]:
        if token not in prompt_py:
            fail(f"enhanced fretless finger articulation missing: {token}")
    ok("PCM fretless articulation with stronger finger noise")

    for token in [
        "createFactoryGuitarPCM", "GUITAR_ROOTS", "createBufferSource()", "playGuitarPCM",
        "createWaveShaper()", "makeDistortionCurve", "guitar_amp_drive", "guitar_amp_model",
        "guitar_amp_tone", "guitar_amp_presence", "guitar_cabinet_mix", "GUITAR_PARAM_DEFS",
    ]:
        if token not in guitar_js:
            fail(f"PCM guitar/amp capability missing: {token}")
    if ".wav" in guitar_js.lower() or ".mp3" in guitar_js.lower() or "fetch(" in guitar_js:
        fail("factory guitar runtime must not fetch or embed external audio assets")
    ok("PCM electric guitar and bounded amp distortion")

    for token in [
        "PIANO_ROOTS", "createFactoryPianoPCM", "createBufferSource()", "playGrandPianoPCM",
        "piano_hammer_mix", "piano_resonance", "piano_damper_noise", 'playPianoNoise("hammer"',
        'playPianoNoise("damper"', "engine.setPatchWithRender(validatePianoExtras",
    ]:
        if token not in piano_js:
            fail(f"PCM grand piano capability missing: {token}")
    if ".wav" in piano_js.lower() or ".mp3" in piano_js.lower() or "fetch(" in piano_js:
        fail("factory piano runtime must not fetch or embed external audio assets")
    ok("PCM grand piano with hammer, damper, and resonance layers")

    for token in [
        'CUSTOM_STORAGE_KEY="nlss.customSamplePhrases.v1"', "MAX_CUSTOM_PHRASES=50", "MAX_CUSTOM_STEPS=128",
        "localStorage.getItem", "localStorage.setItem", "parseCustomSteps", "noteTokenToMidi",
        "saveCustomPhrase", "deleteCustomPhrase", "engine.noteOn(", "engine.noteOff(",
    ]:
        if token not in library_js:
            fail(f"custom sample phrase capability missing: {token}")
    if "fetch(" in library_js or "createOscillator" in library_js:
        fail("custom/expanded sample library must remain local and use the note event contract")
    for token in ["bpm<40||bpm>240", "beats<.125||beats>8", "velocity<.05||velocity>1", "midi>=0&&midi<=127"]:
        if token not in library_js:
            fail(f"custom sample phrase bound missing: {token}")
    ok("local-only bounded user sample phrase registration")

    for token in [
        "function guitarStrumInterval()", 'style==="acoustic"?.028', 'style==="rock"?.018', 'style==="fusion"?.016',
        "orderGuitarEvents", "offset=index*interval", "engine.noteOn(note,clamp(Number(e.velocity??.84),.05,1),offset)",
        "engine.noteOff(note,offset)", 'strum:"down"', 'strum:"up"',
    ]:
        if token not in library_js:
            fail(f"guitar strum timing capability missing: {token}")
    ok("guitar chord sample performance applies staggered pick timing")

    for token in [
        "ポップ・アルペジオ", "EDM・シーケンス", "アンビエント・コード", "ファンク・ベース",
        "フュージョン・フレットレス", "シティポップ・エレピ", "クラシック・アルペジオ",
        "ブギウギ・ピアノ", "ロック・ドラム", "ファンク・ドラム", "ボサノバ・ドラム",
        "ブルース・ギター", "ファンク・カッティング", "ポップ・ストローク", "ボサノバ・ギター",
    ]:
        if token not in library_js:
            fail(f"expanded sample genre missing: {token}")
    ok("expanded built-in sample performance genres")

    for token in ["playDrumPCM(midiNote", "createFactoryDrumPCM", "DRUM_REGIONS", "canonicalDrumNote", "drum_shuffle"]:
        if token not in js:
            fail(f"PCM drum capability missing: {token}")
    ok("PCM drum engine")

    for token in ["playFM(midiNote", "fm_mod_index", "fm_ratio_1", "mg.connect(c.frequency)", "fm_chorus_mix"]:
        if token not in js:
            fail(f"FM electric piano capability missing: {token}")
    ok("FM electric piano engine")

    css = (ROOT / "web/style.css").read_text(encoding="utf-8")
    custom_css = (ROOT / "web/performance_editor.css").read_text(encoding="utf-8")
    for token in ["const PARAM_DEFS", 'input.type="range"', "function applyParam("]:
        if token not in js:
            fail(f"graphical patch editor capability missing: {token}")
    for token in [
        "engine.setPatchWithRender({...currentPatch,[key]:value},false)", "this.patch=validatePatch(raw)", "if(render)renderPatch()",
    ]:
        if token not in runtime_js:
            fail(f"continuous graphical edit guard missing: {token}")
    if "engine.setPatchWithRender(validateGuitarExtras" not in guitar_js:
        fail("guitar graphical edits do not pass through validation/clamp")
    if "engine.setPatchWithRender(validatePianoExtras" not in piano_js:
        fail("piano graphical edits do not pass through validation/clamp")
    if ".param-dial" not in css or "conic-gradient" not in css or ".custom-sample-editor" not in custom_css:
        fail("graphical parameter/custom phrase visualization missing")
    ok("continuous graphical parameter and custom phrase editor")

    for token in [
        "フレットレス", "ジャコ", 'engine_type="sampler"', "ロザーナー", "ポーカロ", 'engine_type="drum"',
        "dx-7", 'engine_type="fm"', "グランドピアノ", 'instrument_model="grand_piano"',
        "エレキギター", 'instrument_model="electric_guitar"', "guitar_amp_drive", "フュージョン", "アコースティック",
    ]:
        if token not in prompt_py:
            fail(f"multi-engine prompt recognition missing: {token}")
    ok("fretless, piano, guitar, drum, and DX-style prompt recognition")

    print("\nRunning pytest...")
    result = subprocess.run([sys.executable, "-m", "pytest", "tests/"], cwd=ROOT)
    if result.returncode:
        fail("pytest failed")
    ok("pytest")
    print("\nHARNESS PASS")


if __name__ == "__main__":
    main()
