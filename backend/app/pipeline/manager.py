import asyncio
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

from ..parsers.mock_parser import MockXTFJSFParser
from ..ml.mock_provider import MockInferenceProvider
from ..georeferencing.service import GeoreferencingService
from ..services.validation_service import DetectionValidationService
from mock_data import db_mock

class ProcessingPipeline:
    """
    Modular processing pipeline manager executing:
    File Ingestion -> Parsing -> Metadata -> Preprocessing -> Inference -> Validation -> Georeferencing -> Result Store.
    """

    def __init__(self):
        self.parser = MockXTFJSFParser()
        self.inference_provider = MockInferenceProvider()  # ML integration point
        self.georeferencing_service = GeoreferencingService()
        self.validation_service = DetectionValidationService()

    async def run_job(self, job_id: str, survey: Dict[str, Any]):
        job = db_mock.jobs.get(job_id)
        if not job:
            return

        def add_event(stage: str, message: str):
            job["status"] = stage
            job["events"].append({
                "stage": stage,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        try:
            # Stage 1: Ingestion & Parsing
            add_event("parsing", f"Parsing sonar file '{survey['filename']}' using SonarParser interface...")
            await asyncio.sleep(0.8)
            parsed_meta = self.parser.parse(survey.get("file_path", ""))

            # Stage 2: Metadata Extraction
            add_event("metadata_extraction", f"Extracted {parsed_meta['ping_count']} pings, swath {parsed_meta['swath_width_m']}m, freq {parsed_meta['frequency_khz']}kHz.")
            await asyncio.sleep(0.8)

            # Stage 3: Preprocessing
            add_event("preprocessing", "Applying Lee despeckle filter & CLAHE contrast enhancement...")
            await asyncio.sleep(0.8)

            # Stage 4: ML Inference (Using InferenceProvider interface)
            add_event("ml_inference", "Running InferenceProvider pipeline (MockInferenceProvider standing in for YOLO26n-seg + U-Net)...")
            await asyncio.sleep(1.0)
            raw_detections = await self.inference_provider.infer({
                "survey_id": survey["survey_id"],
                "latitude": survey.get("latitude", 32.6500),
                "longitude": survey.get("longitude", -117.5500)
            })

            # Stage 5 & 6: Validation & Georeferencing
            add_event("validation_georeferencing", "Performing geometric shadow verification & slant-range georeferencing S_g = sqrt(R_s^2 - H^2)...")
            await asyncio.sleep(0.8)

            final_detections = []
            for det in raw_detections:
                det = self.georeferencing_service.georeference(det, parsed_meta)
                det = self.validation_service.validate(det)
                final_detections.append(det)

                # Store in db_mock
                db_mock.detections.insert(0, det)

            # Stage 7: Result Generation & Completion
            survey["status"] = "completed"
            survey["detection_count"] = len(final_detections)
            add_event("completed", f"Processing completed successfully. Generated {len(final_detections)} candidate target returns.")
            job["progress"] = 100

        except Exception as e:
            add_event("failed", f"Processing failed: {str(e)}")
            survey["status"] = "failed"

pipeline_manager = ProcessingPipeline()
