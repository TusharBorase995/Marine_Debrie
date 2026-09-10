import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.repository import repo, init_tables

def run_tests():
    print("==================================================")
    print(f"Testing Database Engine: {engine.url}")
    print("==================================================")

    # 1. Init tables
    init_tables()
    print("[PASS] Schema creation / migration")

    # 2. Reset / clean state for test run
    repo.clear_all()
    print("[PASS] Database clear / reset")

    # 3. Create test mission
    test_mission = repo.create_or_update_mission({
        "mission_id": "MISSION-DBTEST",
        "survey_name": "Database Unit Test Survey",
        "description": "Automated persistence verification",
        "ingestion_mode": "batch"
    })
    print(f"[PASS] Created test mission '{test_mission['mission_id']}'")

    # 4. Query missions
    missions = repo.get_all_missions()
    print(f"[PASS] Query missions: found {len(missions)} mission(s)")
    assert any(m["mission_id"] == "MISSION-DBTEST" for m in missions), "Test mission not found"

    # 5. Insert new detection
    new_det = {
        "target_id": "TGT-TEST-01",
        "id": "det_test_01",
        "class": "debris_net",
        "confidence": 0.94,
        "latitude": 32.6500,
        "longitude": -117.5500,
        "estimated_size_m": 8.5,
        "shadow_verified": True,
        "status": "pending_review",
        "mission_id": "MISSION-DBTEST"
    }
    insert_res = repo.insert_detection(new_det)
    print(f"[PASS] Insert detection: created target '{insert_res['target']['target_id']}' with observation '{insert_res['detection']['id']}'")

    # 6. Query targets
    targets = repo.get_consolidated_targets()
    print(f"[PASS] Query targets: found {len(targets)} consolidated physical target(s)")
    assert any(t["target_id"] == "TGT-TEST-01" for t in targets), "Test target not found"

    # 7. Review target
    reviewed = repo.review_target("TGT-TEST-01", "confirmed")
    assert reviewed, "Target review failed"
    targets_after = repo.get_consolidated_targets()
    test_tgt = next((t for t in targets_after if t["target_id"] == "TGT-TEST-01"), None)
    assert test_tgt and test_tgt["status"] == "confirmed", "Status not updated to confirmed"
    print("[PASS] Review target to 'confirmed'")

    # 8. Clear database
    clear_res = repo.clear_all()
    repo.delete_mission("MISSION-DBTEST")
    print(f"[PASS] Clear all: {clear_res['message']}")
    assert len(repo.get_consolidated_targets()) == 0, "Targets not cleared"

    print("==================================================")
    print("ALL 8 DATABASE PERSISTENCE TESTS PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
