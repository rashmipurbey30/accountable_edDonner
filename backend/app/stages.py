"""The six pipeline stages. The frontend's src/lib/stages.ts must match (test_stages_match.py)."""

STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"]
OPEN_STAGES = ["new", "qualified", "proposal", "negotiation"]
CLOSED_STAGES = ["won", "lost"]

STAGE_NAMES = {
    "new": "New",
    "qualified": "Qualified",
    "proposal": "Proposal",
    "negotiation": "Negotiation",
    "won": "Won",
    "lost": "Lost",
}

USUAL_PROBABILITY = {
    "new": 10,
    "qualified": 25,
    "proposal": 50,
    "negotiation": 75,
    "won": 100,
    "lost": 0,
}

CONTACT_STATUSES = ["lead", "qualified", "customer"]
ACTIVITY_TYPES = ["note", "call", "email"]
