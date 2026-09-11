import os
import io
import logging
from typing import Optional
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

logger = logging.getLogger("sonar_s3_storage")
logging.basicConfig(level=logging.INFO)

def _load_env_files():
    for env_candidate in [
        os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"),
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env.local"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
        os.path.join(os.getcwd(), ".env.local"),
        os.path.join(os.getcwd(), ".env")
    ]:
        if os.path.exists(env_candidate):
            try:
                with open(env_candidate, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            if k.strip() not in os.environ:
                                os.environ[k.strip()] = v.strip().strip("'\"")
            except Exception:
                pass

_load_env_files()

class NeonS3Storage:
    """
    S3-compatible storage service for Neon Object Storage.
    Handles storing and retrieving sonar evidence images in the private 'sagar-images' bucket.
    """

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            _load_env_files()
            endpoint_url = os.getenv("AWS_ENDPOINT_URL_S3") or os.getenv("AWS_ENDPOINT_URL")
            access_key = os.getenv("AWS_ACCESS_KEY_ID")
            secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
            region = os.getenv("AWS_REGION", "us-east-2")
            bucket = os.getenv("NEON_OBJECT_STORAGE_BUCKET", "sagar-images")

            self.endpoint_url = endpoint_url
            self.access_key = access_key
            self.secret_key = secret_key
            self.region = region
            self.bucket = bucket

            if not self.endpoint_url or not self.access_key or not self.secret_key:
                logger.warning("Neon S3 credentials not fully configured in environment.")
                return None
            try:
                self._client = boto3.client(
                    "s3",
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region,
                    config=Config(s3={"addressing_style": "path"})
                )
            except Exception as e:
                logger.error(f"Failed to initialize boto3 S3 client: {e}")
                return None
        return self._client

    def upload_file(self, data: bytes, key: str, mime_type: str = "image/png") -> Optional[str]:
        """
        Uploads binary image data to the private Neon Object Storage bucket ('sagar-images').
        Returns the object key upon success, or None on failure.
        """
        client = self._get_client()
        if not client:
            logger.error("Cannot upload: S3 client is unavailable.")
            return None

        try:
            client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=mime_type,
            )
            logger.info(f"Successfully uploaded {len(data)} bytes to Neon Object Storage: {self.bucket}/{key}")
            return key
        except Exception as e:
            logger.error(f"Failed to upload to Neon Object Storage ({self.bucket}/{key}): {e}")
            return None

    def download_file(self, key: str) -> Optional[bytes]:
        """
        Retrieves binary image data from the private Neon Object Storage bucket.
        """
        client = self._get_client()
        if not client:
            logger.error("Cannot download: S3 client is unavailable.")
            return None

        try:
            response = client.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "NoSuchKey":
                logger.warning(f"Key not found in {self.bucket}: {key}")
            else:
                logger.error(f"ClientError reading from {self.bucket}/{key}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error downloading from {self.bucket}/{key}: {e}")
            return None

    def delete_file(self, key: str) -> bool:
        """Deletes an object from the Neon Object Storage bucket."""
        client = self._get_client()
        if not client:
            return False
        try:
            client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"Failed to delete {key} from {self.bucket}: {e}")
            return False

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        """Generates a secure temporary presigned URL for authorized image access."""
        client = self._get_client()
        if not client:
            return None
        try:
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in
            )
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {key}: {e}")
            return None


s3_storage = NeonS3Storage()
