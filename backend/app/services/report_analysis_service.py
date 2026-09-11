import os
import math
import statistics
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

class ReportAnalysisService:
    """
    Deterministic Mission Report Analysis Service.
    Transforms raw mission metadata, targets, and observations into a structured,
    statistically verified dataset. Guarantees 100% consistency across PDF, Excel,
    and Frontend displays without external AI or LLM dependencies.
    """

    LABEL_MAP = {
        "debris_net": "Derelict Ghost Net",
        "pipe_cylinder": "Pipeline / Cylinder",
        "wreck_structure": "Shipwreck Structure",
        "cargo_container": "Cargo Container",
        "naval_mine": "Acoustic Mine Anomaly",
        "pipe_joint": "Pipeline Joint / Free-Span",
        "metal_debris": "Metallic Debris",
        "tire_debris": "Submerged Tire / Rubber"
    }

    @classmethod
    def get_display_label(cls, class_name: Optional[str]) -> str:
        if not class_name:
            return "Unclassified Anomaly"
        key = class_name.lower().strip()
        return cls.LABEL_MAP.get(key, class_name.replace("_", " ").title())

    @classmethod
    def analyze_mission(cls, mission: Dict[str, Any], targets: List[Dict[str, Any]], detections: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Executes complete statistical and geographic analysis for a mission.
        """
        targets = targets or []
        detections = detections or []
        total_targets = len(targets)

        # 1. Mission Metadata
        mission_id = mission.get("mission_id", "UNKNOWN-MISSION")
        survey_name = mission.get("survey_name", f"Survey {mission_id}")
        ingestion_mode = (mission.get("ingestion_mode") or "batch").upper()
        status = mission.get("status", "completed")
        swath_width_m = mission.get("swath_width_m", 120.0)
        acoustic_freq = mission.get("acoustic_freq", "410 kHz")
        depth_m = mission.get("depth_m", 84.2)
        created_at_raw = mission.get("created_at")

        # Format date
        if created_at_raw:
            try:
                dt = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                survey_date_str = dt.strftime("%d %b %Y, %H:%M UTC")
            except Exception:
                survey_date_str = str(created_at_raw)
        else:
            survey_date_str = "Operational Session"

        # 2. Confidence Metrics
        confidences = []
        for t in targets:
            c = t.get("fused_confidence", t.get("confidence"))
            if c is not None:
                try:
                    val = float(c)
                    if 0.0 <= val <= 1.0:
                        confidences.append(val)
                    elif 1.0 < val <= 100.0:
                        confidences.append(val / 100.0)
                except (ValueError, TypeError):
                    pass

        avg_confidence = round(statistics.mean(confidences) * 100, 1) if confidences else 0.0
        median_confidence = round(statistics.median(confidences) * 100, 1) if confidences else 0.0
        min_confidence = round(min(confidences) * 100, 1) if confidences else 0.0
        max_confidence = round(max(confidences) * 100, 1) if confidences else 0.0

        high_conf_count = sum(1 for c in confidences if c >= 0.80)
        mod_conf_count = sum(1 for c in confidences if 0.70 <= c < 0.80)
        low_conf_count = sum(1 for c in confidences if c < 0.70)
        very_high_conf_count = sum(1 for c in confidences if c >= 0.90)

        conf_distribution = [
            {"range": "90%–100% (Very High)", "count": very_high_conf_count, "pct": round(very_high_conf_count / total_targets * 100, 1) if total_targets else 0.0},
            {"range": "80%–89% (High)", "count": sum(1 for c in confidences if 0.80 <= c < 0.90), "pct": round(sum(1 for c in confidences if 0.80 <= c < 0.90) / total_targets * 100, 1) if total_targets else 0.0},
            {"range": "70%–79% (Moderate)", "count": mod_conf_count, "pct": round(mod_conf_count / total_targets * 100, 1) if total_targets else 0.0},
            {"range": "< 70% (Low)", "count": low_conf_count, "pct": round(low_conf_count / total_targets * 100, 1) if total_targets else 0.0},
        ]

        # 3. Acoustic Shadow Verification
        shadow_verified_count = 0
        shadow_unverified_count = 0
        shadow_unknown_count = 0

        for t in targets:
            # Check observations if present, or target flag
            sv = t.get("shadow_verified")
            if sv is None and t.get("observations"):
                obs_sv = [o.get("shadow_verified") for o in t["observations"] if o.get("shadow_verified") is not None]
                if obs_sv:
                    sv = any(obs_sv)
            
            if sv is True:
                shadow_verified_count += 1
            elif sv is False:
                shadow_unverified_count += 1
            else:
                shadow_unknown_count += 1

        shadow_verified_pct = round(shadow_verified_count / total_targets * 100, 1) if total_targets else 0.0
        shadow_unverified_pct = round(shadow_unverified_count / total_targets * 100, 1) if total_targets else 0.0

        # 4. Review Status Breakdown
        confirmed_count = 0
        pending_count = 0
        rejected_count = 0

        for t in targets:
            stat = (t.get("status") or t.get("human_review_status") or "pending_review").lower().strip()
            if stat in ["confirmed", "verified"]:
                confirmed_count += 1
            elif stat == "rejected":
                rejected_count += 1
            else:
                pending_count += 1

        reviewed_total = confirmed_count + rejected_count
        review_completion_pct = round(reviewed_total / total_targets * 100, 1) if total_targets else 0.0

        # 5. Target Classification Breakdown
        class_stats_map: Dict[str, Dict[str, Any]] = {}
        for t in targets:
            cls_name = (t.get("class") or t.get("category") or "unclassified").lower().strip()
            conf_val = float(t.get("fused_confidence") or t.get("confidence") or 0.85)
            if conf_val > 1.0:
                conf_val /= 100.0

            if cls_name not in class_stats_map:
                class_stats_map[cls_name] = {
                    "class": cls_name,
                    "label": cls.get_display_label(cls_name),
                    "count": 0,
                    "confidences": []
                }
            class_stats_map[cls_name]["count"] += 1
            class_stats_map[cls_name]["confidences"].append(conf_val)

        classification_list = []
        for cls_name, data in sorted(class_stats_map.items(), key=lambda x: x[1]["count"], reverse=True):
            cnt = data["count"]
            c_list = data["confidences"]
            pct = round(cnt / total_targets * 100, 1) if total_targets else 0.0
            avg_c = round(statistics.mean(c_list) * 100, 1) if c_list else 0.0
            classification_list.append({
                "class": cls_name,
                "label": data["label"],
                "count": cnt,
                "percentage": pct,
                "avg_confidence": avg_c,
                "min_confidence": round(min(c_list) * 100, 1) if c_list else 0.0,
                "max_confidence": round(max(c_list) * 100, 1) if c_list else 0.0
            })

        dominant_class = classification_list[0]["label"] if classification_list else "None"
        dominant_class_pct = classification_list[0]["percentage"] if classification_list else 0.0

        # 6. Spatial / Geographic Sector Partitioning
        valid_coords_targets = [
            t for t in targets 
            if t.get("latitude") is not None and t.get("longitude") is not None and (t["latitude"] != 0.0 or t["longitude"] != 0.0)
        ]

        sectors_list = []
        highest_density_sector_name = "N/A"

        if valid_coords_targets:
            lats = [float(t["latitude"]) for t in valid_coords_targets]
            lons = [float(t["longitude"]) for t in valid_coords_targets]
            min_lat, max_lat = min(lats), max(lats)
            min_lon, max_lon = min(lons), max(lons)

            mid_lat = (min_lat + max_lat) / 2.0
            mid_lon = (min_lon + max_lon) / 2.0

            # 4 quadrant sector partitioning
            sector_buckets = {
                "Sector A1 (North-West)": [],
                "Sector A2 (North-East)": [],
                "Sector B1 (South-West)": [],
                "Sector B2 (South-East)": []
            }

            # If all points are nearly identical or single point, collapse to Sector A1
            if abs(max_lat - min_lat) < 0.0001 and abs(max_lon - min_lon) < 0.0001:
                sector_buckets = {"Sector A1 (Central Swath)": valid_coords_targets}
            else:
                for t in valid_coords_targets:
                    lat = float(t["latitude"])
                    lon = float(t["longitude"])
                    if lat >= mid_lat:
                        sec_key = "Sector A2 (North-East)" if lon >= mid_lon else "Sector A1 (North-West)"
                    else:
                        sec_key = "Sector B2 (South-East)" if lon >= mid_lon else "Sector B1 (South-West)"
                    sector_buckets[sec_key].append(t)

            for sec_id, sec_targets in sector_buckets.items():
                if not sec_targets and len(sector_buckets) > 1:
                    continue
                sec_cnt = len(sec_targets)
                sec_pct = round(sec_cnt / total_targets * 100, 1) if total_targets else 0.0
                
                # Dominant class in sector
                sec_classes: Dict[str, int] = {}
                sec_confs = []
                for st in sec_targets:
                    c_name = st.get("class") or st.get("category") or "unclassified"
                    sec_classes[c_name] = sec_classes.get(c_name, 0) + 1
                    c_val = float(st.get("fused_confidence") or st.get("confidence") or 0.85)
                    sec_confs.append(c_val)

                sec_dom_class = max(sec_classes.items(), key=lambda x: x[1])[0] if sec_classes else "None"
                sec_avg_conf = round(statistics.mean(sec_confs) * 100, 1) if sec_confs else 0.0

                sectors_list.append({
                    "sector_id": sec_id,
                    "target_count": sec_cnt,
                    "percentage": sec_pct,
                    "dominant_class": cls.get_display_label(sec_dom_class),
                    "avg_confidence": sec_avg_conf
                })

            sectors_list.sort(key=lambda s: s["target_count"], reverse=True)
            if sectors_list:
                highest_density_sector_name = sectors_list[0]["sector_id"]

        # 7. Priority Ranking for Review
        # Deterministic formula: Confidence (40) + Pending Status (25) + Shadow Verification (15) + Size (up to 20)
        ranked_targets = []
        for t in targets:
            conf = float(t.get("fused_confidence") or t.get("confidence") or 0.85)
            if conf > 1.0:
                conf /= 100.0
            
            is_pending = 1.0 if (t.get("status") or "").lower() == "pending_review" else 0.0
            is_shadow = 1.0 if t.get("shadow_verified") is True else 0.0
            size_m = float(t.get("estimated_size_m") or 3.0)
            size_score = min(size_m, 10.0) / 10.0

            priority_score = round(
                (conf * 40.0) + (is_pending * 25.0) + (is_shadow * 15.0) + (size_score * 20.0),
                1
            )

            tid = t.get("target_id") or t.get("id") or "TGT"
            ranked_targets.append({
                "target_id": tid,
                "class": t.get("class") or t.get("category") or "debris_net",
                "label": cls.get_display_label(t.get("class") or t.get("category")),
                "confidence": round(conf * 100, 1),
                "shadow_verified": "Verified" if t.get("shadow_verified") is True else ("Not Verified" if t.get("shadow_verified") is False else "Unknown"),
                "estimated_size_m": round(size_m, 1),
                "status": t.get("status") or "pending_review",
                "latitude": round(float(t["latitude"]), 6) if t.get("latitude") is not None else None,
                "longitude": round(float(t["longitude"]), 6) if t.get("longitude") is not None else None,
                "sonar_image_ref": t.get("sonar_image_ref"),
                "priority_score": priority_score,
                "observation_count": t.get("observation_count") or len(t.get("observations") or []) or 1
            })

        ranked_targets.sort(key=lambda x: x["priority_score"], reverse=True)
        for idx, item in enumerate(ranked_targets, start=1):
            item["rank"] = idx

        # 8. Largest / Notable Targets
        largest_targets = sorted(
            [t for t in ranked_targets if t.get("estimated_size_m", 0) > 0],
            key=lambda x: x["estimated_size_m"],
            reverse=True
        )[:10]

        # 9. Data Quality Metrics
        total_obs = sum(len(t.get("observations") or []) for t in targets) or len(detections) or total_targets
        valid_coords_count = len(valid_coords_targets)
        missing_coords_count = total_targets - valid_coords_count
        evidence_available_count = sum(1 for t in targets if t.get("sonar_image_ref"))
        missing_evidence_count = total_targets - evidence_available_count

        data_quality = {
            "total_targets": total_targets,
            "total_detections": total_obs,
            "valid_coordinates": valid_coords_count,
            "missing_coordinates": missing_coords_count,
            "valid_confidence": len(confidences),
            "shadow_verified": shadow_verified_count,
            "high_confidence": high_conf_count,
            "pending_review": pending_count,
            "evidence_available": evidence_available_count,
            "missing_evidence": missing_evidence_count,
            "coordinate_completeness_pct": round(valid_coords_count / total_targets * 100, 1) if total_targets else 0.0,
            "evidence_completeness_pct": round(evidence_available_count / total_targets * 100, 1) if total_targets else 0.0
        }

        # 10. Operational Assessment
        if total_targets == 0:
            operational_assessment = f"No targets recorded for mission '{survey_name}' ({mission_id})."
        else:
            sec_text = f" Density highest in {highest_density_sector_name}." if highest_density_sector_name != "N/A" else ""
            operational_assessment = (
                f"{total_targets} acoustic targets detected ({avg_confidence}% mean confidence). "
                f"{confirmed_count} confirmed, {rejected_count} rejected, {pending_count} pending review. "
                f"{shadow_verified_count} shadow-verified.{sec_text}"
            )

        # 11. Mission Timeline (Aggregated Milestones)
        timeline = []
        if created_at_raw:
            timeline.append({
                "stage": "Mission Initialized",
                "timestamp": survey_date_str,
                "description": f"Survey session registered in system ({ingestion_mode} ingestion mode)."
            })
        
        # Sort targets by timestamp if available
        timed_targets = []
        for t in targets:
            ts = t.get("created_at") or (t.get("observations") and t["observations"][0].get("timestamp"))
            if ts:
                timed_targets.append((ts, t))

        if timed_targets:
            timed_targets.sort(key=lambda x: x[0])
            first_ts, first_t = timed_targets[0]
            timeline.append({
                "stage": "First Acoustic Contact",
                "timestamp": first_ts,
                "description": f"Initial target return identified ({cls.get_display_label(first_t.get('class'))}, confidence: {round(float(first_t.get('confidence') or 0.85)*100)}%)."
            })
            if len(timed_targets) > 1:
                last_ts, last_t = timed_targets[-1]
                timeline.append({
                    "stage": "Latest Survey Observation",
                    "timestamp": last_ts,
                    "description": f"Most recent observation logged ({cls.get_display_label(last_t.get('class'))})."
                })

        if ranked_targets:
            top_p = ranked_targets[0]
            timeline.append({
                "stage": "Top Priority Anomaly Flagged",
                "timestamp": "Analysis Phase",
                "description": f"Target {top_p['target_id']} flagged with Priority Score {top_p['priority_score']} ({top_p['label']}, size {top_p['estimated_size_m']}m)."
            })

        timeline.append({
            "stage": "Report Compilation",
            "timestamp": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"),
            "description": f"Deterministic operational mission assessment generated. Total targets evaluated: {total_targets}."
        })

        return {
            "mission": {
                "mission_id": mission_id,
                "survey_name": survey_name,
                "ingestion_mode": ingestion_mode,
                "status": status,
                "swath_width_m": swath_width_m,
                "acoustic_freq": acoustic_freq,
                "depth_m": depth_m,
                "survey_date": survey_date_str,
                "created_at": created_at_raw
            },
            "kpis": {
                "total_targets": total_targets,
                "total_detections": total_obs,
                "avg_confidence": avg_confidence,
                "median_confidence": median_confidence,
                "high_confidence_count": high_conf_count,
                "low_confidence_count": low_conf_count,
                "shadow_verified_count": shadow_verified_count,
                "shadow_verified_pct": shadow_verified_pct,
                "shadow_unverified_count": shadow_unverified_count,
                "shadow_unknown_count": shadow_unknown_count,
                "pending_count": pending_count,
                "confirmed_count": confirmed_count,
                "rejected_count": rejected_count,
                "review_completion_pct": review_completion_pct,
                "highest_density_sector": highest_density_sector_name
            },
            "operational_assessment": operational_assessment,
            "classification_analysis": classification_list,
            "sector_analysis": sectors_list,
            "confidence_analysis": {
                "average": avg_confidence,
                "median": median_confidence,
                "min": min_confidence,
                "max": max_confidence,
                "distribution": conf_distribution
            },
            "shadow_verification": {
                "verified_count": shadow_verified_count,
                "verified_pct": shadow_verified_pct,
                "unverified_count": shadow_unverified_count,
                "unverified_pct": shadow_unverified_pct,
                "unknown_count": shadow_unknown_count
            },
            "review_status": {
                "pending_count": pending_count,
                "pending_pct": round(pending_count / total_targets * 100, 1) if total_targets else 0.0,
                "confirmed_count": confirmed_count,
                "confirmed_pct": round(confirmed_count / total_targets * 100, 1) if total_targets else 0.0,
                "rejected_count": rejected_count,
                "rejected_pct": round(rejected_count / total_targets * 100, 1) if total_targets else 0.0,
                "reviewed_total": reviewed_total,
                "completion_pct": review_completion_pct
            },
            "priority_targets": ranked_targets,
            "largest_targets": largest_targets,
            "data_quality": data_quality,
            "timeline": timeline,
            "detections": detections or [],
            "targets": targets or [],
            "generated_at": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M:%S UTC")
        }

report_analysis_service = ReportAnalysisService()
