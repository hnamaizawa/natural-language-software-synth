from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# v0.6.0 non-negotiable invariant set. v0.7.0 must add to this set, never replace it.
V060_INVARIANTS = {
    "generated_text_must_never_be_executed_as_code",
    "generated_patch_must_be_schema_validated_and_clamped",
    "graphical_parameter_edits_must_be_validated_and_clamped",
    "graphical_slider_input_must_not_rebuild_control_during_drag",
    "audio_context_must_start_only_after_user_gesture",
    "all_engines_must_share_single_audio_context",
    "microphone_capture_must_use_existing_audio_context",
    "microphone_audio_must_not_be_persisted_or_uploaded",
    "humming_capture_must_be_monophonic_and_bounded",
    "humming_preview_must_use_same_note_on_note_off_contract",
    "humming_note_data_must_be_quantized_to_bounded_custom_phrase_values",
    "master_gain_must_be_hard_limited",
    "output_level_normalization_must_not_bypass_master_gain_limit",
    "output_level_runtime_must_use_existing_audio_context",
    "instrument_level_trim_must_be_bounded",
    "jazz_chord_samples_must_use_quartal_voicing",
    "polyphony_must_be_bounded",
    "oscillator_frequency_must_be_derived_from_valid_midi_note",
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
    "drum_pad_and_sample_must_use_note_event_contract",
    "pcm_and_fm_parameters_must_be_schema_validated_and_clamped",
    "saved_user_patches_must_not_be_copied_into_generated_apps",
    "external_llm_credentials_must_not_be_required_for_offline_mode",
    "eval_and_dynamic_script_injection_forbidden",
}

V070_ADDITIONS = {
    "humming_pitch_correction_must_snap_only_to_inferred_or_selected_scale",
    "humming_timing_quantization_must_be_bounded",
    "humming_score_must_be_derived_from_corrected_note_events",
    "vst3_binary_must_never_be_loaded_in_browser_process",
    "vst3_bridge_must_bind_through_existing_local_http_server",
    "vst3_plugin_load_must_be_limited_to_scanned_local_plugin_ids",
    "vst3_note_values_must_be_bounded",
    "vst3_parameter_values_must_be_normalized_and_bounded",
    "vst3_native_host_must_run_as_separate_process",
    "vst3_dependencies_must_be_pinned",
}


def test_v070_blueprint_preserves_every_v060_non_negotiable_invariant():
    blueprint = (ROOT / "harness" / "app_blueprint.yaml").read_text(encoding="utf-8")
    missing = sorted(item for item in V060_INVARIANTS if f"- {item}" not in blueprint)
    assert not missing, f"v0.6.0 invariants were removed: {missing}"


def test_v070_blueprint_adds_humming_assist_and_vst3_invariants():
    blueprint = (ROOT / "harness" / "app_blueprint.yaml").read_text(encoding="utf-8")
    missing = sorted(item for item in V070_ADDITIONS if f"- {item}" not in blueprint)
    assert not missing, f"v0.7.0 invariants missing: {missing}"


def test_v070_blueprint_keeps_stable_note_event_contract():
    blueprint = (ROOT / "harness" / "app_blueprint.yaml").read_text(encoding="utf-8")
    assert 'note_on: "noteOn(midiNote, velocity, whenSeconds=0)"' in blueprint
    assert 'note_off: "noteOff(midiNote, whenSeconds=0)"' in blueprint
    assert 'set_patch: "setPatch(validatedPatch)"' in blueprint
