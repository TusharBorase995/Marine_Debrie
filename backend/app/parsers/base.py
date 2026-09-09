from abc import ABC, abstractmethod
from typing import Dict, Any

class SonarParser(ABC):
    """
    Abstract interface for Side-Scan Sonar File Parsers (.XTF, .JSF, .DAT).
    
    The file ingestion stage depends ONLY on this parser abstraction.
    When a real C++/Python XTF/JSF binary parser library is integrated later,
    it implements `RealSonarParser(SonarParser)` without changing the processing pipeline.
    """

    @abstractmethod
    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        Parses sonar log file metadata, pings, and transducer telemetry.
        
        :param file_path: Absolute filesystem path to uploaded sonar file.
        :return: Dictionary containing parsed sonar headers, pings count, and swath range.
        """
        pass
