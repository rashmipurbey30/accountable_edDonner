import re

from backend.app.config import REPO_ROOT
from backend.app.stages import STAGE_NAMES, STAGES, USUAL_PROBABILITY


def test_frontend_stages_match_backend():
    source = (REPO_ROOT / "frontend" / "src" / "lib" / "stages.ts").read_text(encoding="utf-8")
    found = re.findall(r'\{ key: "(\w+)", name: "([^"]+)", probability: (\d+)', source)
    assert found == [(k, STAGE_NAMES[k], str(USUAL_PROBABILITY[k])) for k in STAGES]
