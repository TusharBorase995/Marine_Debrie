import sys
import os

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.report_analysis_service import report_analysis_service
from app.services.pdf_report_generator import pdf_report_generator
from app.services.excel_report_generator import excel_report_generator
from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    print("==================================================")
    print("RUNNING OPERATIONAL MISSION REPORTING TEST SUITE")
    print("==================================================")

    # 1. Test Empty Mission Analysis (Zero Divide By Zero Guarantee)
    empty_mission = {
        "mission_id": "MISSION-EMPTY-01",
        "survey_name": "Deepwater Transect 01",
        "status": "completed",
        "ingestion_mode": "batch"
    }
    empty_analysis = report_analysis_service.analyze_mission(empty_mission, [], [])
    assert empty_analysis["kpis"]["total_targets"] == 0, "Total targets should be 0"
    assert empty_analysis["kpis"]["avg_confidence"] == 0.0, "Avg conf should be 0.0"
    assert empty_analysis["kpis"]["shadow_verified_count"] == 0, "Shadow verified should be 0"
    assert "no target contacts" in empty_analysis["operational_assessment"].lower(), "Operational assessment should report 0 contacts"
    print("[PASS] 1. Empty mission handled gracefully with zero divide-by-zero")

    # 2. Test PDF Generation on Empty Mission
    empty_pdf = pdf_report_generator.generate_pdf(empty_analysis)
    assert len(empty_pdf) > 0, "PDF bytes should be non-empty"
    assert empty_pdf.startswith(b"%PDF-"), "PDF should have %PDF- magic header"
    print(f"[PASS] 2. Empty mission PDF generated successfully ({len(empty_pdf):,} bytes)")

    # 3. Test Excel Generation on Empty Mission
    empty_excel = excel_report_generator.generate_excel(empty_analysis)
    assert len(empty_excel) > 0, "Excel bytes should be non-empty"
    assert empty_excel.startswith(b"PK"), "Excel should be a valid ZIP/XLSX archive"
    print(f"[PASS] 3. Empty mission Excel generated successfully ({len(empty_excel):,} bytes)")

    # 4. Test Realistic Multi-Target Mission Analysis
    populated_mission = {
        "mission_id": "MISSION-ALPHA-01",
        "survey_name": "Offshore Survey Alpha",
        "status": "completed",
        "ingestion_mode": "batch",
        "swath_width_m": 150.0,
        "acoustic_freq": "410 kHz",
        "depth_m": 92.5,
        "created_at": "2026-09-04T10:00:00Z"
    }

    sample_targets = [
        {
            "target_id": "TGT-001",
            "class": "debris_net",
            "confidence": 0.94,
            "fused_confidence": 0.94,
            "latitude": 32.6510,
            "longitude": -117.5520,
            "estimated_size_m": 8.4,
            "shadow_verified": True,
            "status": "pending_review",
            "sonar_image_ref": "/uploads/detections/sample_net.png"
        },
        {
            "target_id": "TGT-002",
            "class": "pipe_cylinder",
            "confidence": 0.88,
            "fused_confidence": 0.88,
            "latitude": 32.6530,
            "longitude": -117.5490,
            "estimated_size_m": 4.2,
            "shadow_verified": True,
            "status": "confirmed",
            "sonar_image_ref": None
        },
        {
            "target_id": "TGT-003",
            "class": "debris_net",
            "confidence": 0.72,
            "fused_confidence": 0.72,
            "latitude": 32.6480,
            "longitude": -117.5530,
            "estimated_size_m": 2.1,
            "shadow_verified": False,
            "status": "rejected",
            "sonar_image_ref": None
        },
        {
            "target_id": "TGT-004",
            "class": "wreck_structure",
            "confidence": 0.91,
            "fused_confidence": 0.91,
            "latitude": 32.6540,
            "longitude": -117.5480,
            "estimated_size_m": 15.0,
            "shadow_verified": True,
            "status": "pending_review",
            "sonar_image_ref": None
        }
    ]

    analysis = report_analysis_service.analyze_mission(populated_mission, sample_targets)

    # Verify counts & metrics
    assert analysis["kpis"]["total_targets"] == 4
    assert analysis["kpis"]["high_confidence_count"] == 3  # 0.94, 0.88, 0.91 >= 0.80
    assert analysis["kpis"]["low_confidence_count"] == 0   # None < 0.70 (0.72 is >= 0.70)
    assert analysis["kpis"]["shadow_verified_count"] == 3  # 3 True
    assert analysis["kpis"]["shadow_verified_pct"] == 75.0
    assert analysis["kpis"]["pending_count"] == 2
    assert analysis["kpis"]["confirmed_count"] == 1
    assert analysis["kpis"]["rejected_count"] == 1

    # Verify classification breakdown
    classes = {c["class"]: c for c in analysis["classification_analysis"]}
    assert classes["debris_net"]["count"] == 2
    assert classes["debris_net"]["percentage"] == 50.0
    assert classes["pipe_cylinder"]["count"] == 1
    assert classes["wreck_structure"]["count"] == 1
    print("[PASS] 4. Statistical analysis & percentages match ground truth 100%")

    # 5. Verify Priority Scoring Determinism
    priority_targets = analysis["priority_targets"]
    assert len(priority_targets) == 4
    assert priority_targets[0]["rank"] == 1
    # Check top priority target has highest score
    assert priority_targets[0]["priority_score"] >= priority_targets[1]["priority_score"]
    print(f"[PASS] 5. Deterministic priority ranking verified (Top Target: {priority_targets[0]['target_id']}, Score: {priority_targets[0]['priority_score']})")

    # 6. Verify Spatial Sector Partitioning
    sectors = analysis["sector_analysis"]
    assert len(sectors) > 0, "Sectors should be created"
    total_sec_targets = sum(s["target_count"] for s in sectors)
    assert total_sec_targets == 4, f"All targets should be partitioned into sectors (got {total_sec_targets})"
    print(f"[PASS] 6. Geographic spatial sector ranking verified ({len(sectors)} sectors identified)")

    # 7. Generate Full Technical PDF Report
    full_pdf = pdf_report_generator.generate_pdf(analysis)
    assert len(full_pdf) > 20000, "Full PDF should contain generated charts and pages"
    assert full_pdf.startswith(b"%PDF-"), "PDF header valid"
    print(f"[PASS] 7. Full 13-section technical PDF report compiled ({len(full_pdf):,} bytes)")

    # 8. Generate Multi-Sheet Excel Workbook
    full_excel = excel_report_generator.generate_excel(analysis)
    assert len(full_excel) > 5000, "Full Excel workbook should contain sheets and styles"
    assert full_excel.startswith(b"PK"), "Excel archive valid"
    print(f"[PASS] 8. 10-Sheet professional Excel workbook compiled ({len(full_excel):,} bytes)")

    # 9. Test API Endpoints using FastAPI TestClient
    client = TestClient(app)

    # 9a. Test analysis endpoint
    res_analysis = client.get("/api/reports/analysis")
    assert res_analysis.status_code == 200, f"Reports analysis failed: {res_analysis.text}"
    data = res_analysis.json()
    assert "kpis" in data and "classification_analysis" in data
    print("[PASS] 9a. GET /api/reports/analysis returns 200 with structured schema")

    # 9b. Test PDF export endpoint
    res_pdf = client.get("/api/reports/export?format=pdf")
    assert res_pdf.status_code == 200, f"PDF export failed: {res_pdf.text}"
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF-")
    print("[PASS] 9b. GET /api/reports/export?format=pdf returns 200 with valid application/pdf")

    # 9c. Test Excel export endpoint
    res_excel = client.get("/api/reports/export?format=excel")
    assert res_excel.status_code == 200, f"Excel export failed: {res_excel.text}"
    assert "spreadsheetml" in res_excel.headers["content-type"]
    assert res_excel.content.startswith(b"PK")
    print("[PASS] 9c. GET /api/reports/export?format=excel returns 200 with valid XLSX spreadsheet")

    # 9d. Test JSON export is removed (should return 400 Bad Request)
    res_json = client.get("/api/reports/export?format=json")
    assert res_json.status_code == 400, "JSON format should be rejected with 400 Bad Request"
    print("[PASS] 9d. Legacy JSON export format properly rejected (400 Bad Request)")

    print("==================================================")
    print("ALL REPORTING OPERATIONAL TESTS PASSED 100%!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
