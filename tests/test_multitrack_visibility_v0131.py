from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_static_assets_disable_browser_cache_after_pull():
    server = read("server.py")
    assert '"Cache-Control", "no-store, no-cache, must-revalidate, max-age=0"' in server
    assert '"Pragma", "no-cache"' in server
    assert '"Expires", "0"' in server


def test_multitrack_assets_are_cache_busted_and_runtime_reports_ready():
    html = read("web/index.html")
    runtime = read("web/multitrack_runtime.js")
    assert '/multitrack.css?v=0.13.1' in html
    assert '/multitrack_runtime.js?v=0.13.1' in html
    assert 'data-runtime-state="loading"' in html
    assert 'projectStatus.dataset.runtimeState="ready"' in runtime


def test_seven_parts_and_sequence_surfaces_remain_in_main_ui():
    html = read("web/index.html")
    runtime = read("web/multitrack_runtime.js")
    for role in ["drums", "bass", "keyboard", "guitar", "melody", "chorus", "pad"]:
        assert f'["{role}"' in runtime
    for element_id in ["trackList", "arrangementTimeline", "projectPianoRoll", "clipFromSampleBtn"]:
        assert f'id="{element_id}"' in html


def test_blueprint_prevents_stale_ui_after_pull():
    blueprint = read("harness/app_blueprint.yaml")
    assert "- static_ui_assets_must_not_be_served_stale_after_pull" in blueprint
