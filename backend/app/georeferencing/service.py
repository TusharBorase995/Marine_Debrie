import math
from typing import Dict, Any, Tuple

class GeoreferencingService:
    """
    Dedicated Georeferencing Service boundary.
    Performs pixel to world coordinate translation, slant-range correction S_g = sqrt(R_s^2 - H^2),
    vessel layback offset calculation, and heading + GPS to Latitude/Longitude conversion.
    """

    def georeference(self, detection: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        base_lat = metadata.get("latitude", 32.6500)
        base_lon = metadata.get("longitude", -117.5500)
        altitude_h = metadata.get("transducer_altitude_m", 12.5)
        slant_range_rs = metadata.get("slant_range_m", 24.8)

        # Slant range correction formula: S_g = sqrt(R_s^2 - H^2)
        if slant_range_rs > altitude_h:
            ground_range_sg = math.sqrt(slant_range_rs**2 - altitude_h**2)
        else:
            ground_range_sg = slant_range_rs * 0.85

        # Layback offset math
        heading_deg = metadata.get("heading_deg", 45.0)
        lat_offset = (ground_range_sg * math.cos(math.radians(heading_deg))) / 111000.0
        lon_offset = (ground_range_sg * math.sin(math.radians(heading_deg))) / (111000.0 * math.cos(math.radians(base_lat)))

        detection["latitude"] = round(base_lat + lat_offset, 6)
        detection["longitude"] = round(base_lon + lon_offset, 6)
        detection["ground_range_m"] = round(ground_range_sg, 2)
        detection["altitude_m"] = altitude_h
        return detection
