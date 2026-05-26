import logging
import os
import sys
import tempfile

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
from dotenv import load_dotenv

# Load env vars from the project root .env.local
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

sys.path.insert(0, os.path.dirname(__file__))
from parser import extract_scheme_data
from query import fetch_scheme_graph, get_driver, insert_scheme

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)
logger = logging.getLogger('server')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AUTHORITIES_BUCKET = os.getenv("AUTHORITIES_S3_BUCKET")

logger.info(
    "Server startup — AWS_REGION=%s, AUTHORITIES_S3_BUCKET=%s, "
    "AWS_ACCESS_KEY_ID=%s, AWS_SECRET_ACCESS_KEY=%s",
    AWS_REGION,
    AUTHORITIES_BUCKET or "NOT SET",
    "SET" if AWS_ACCESS_KEY_ID else "NOT SET",
    "SET" if AWS_SECRET_ACCESS_KEY else "NOT SET",
)

s3 = boto3.client(
    's3',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)


class GenerateGraphRequest(BaseModel):
    s3_key: str


@app.get("/health")
async def health():
    return {"status": "ok", "bucket": AUTHORITIES_BUCKET}


@app.post("/generate-graph")
async def generate_graph(req: GenerateGraphRequest):
    logger.info("generate_graph called — s3_key=%s", req.s3_key)

    if not AUTHORITIES_BUCKET:
        logger.error("AUTHORITIES_S3_BUCKET env var is not set — aborting")
        raise HTTPException(status_code=500, detail="AUTHORITIES_S3_BUCKET env var not set")

    # Download PDF from S3 (non-fatal — fall back to filename-only graph if unavailable)
    pdf_bytes = None
    logger.info("Attempting S3 download — bucket=%s, key=%s", AUTHORITIES_BUCKET, req.s3_key)
    try:
        response = s3.get_object(Bucket=AUTHORITIES_BUCKET, Key=req.s3_key)
        pdf_bytes = response["Body"].read()
        logger.info("S3 download succeeded — %d bytes", len(pdf_bytes))
    except Exception as exc:
        logger.warning("S3 fetch failed (bucket=%s, key=%s): %s", AUTHORITIES_BUCKET, req.s3_key, exc)

    # Parse PDF if we got it; otherwise build a minimal graph from the filename
    data: dict = {}
    if pdf_bytes is not None:
        tmp_path = None
        logger.info("Writing PDF to temp file for parsing")
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(pdf_bytes)
                tmp_path = tmp.name
            logger.info("Calling extract_scheme_data — tmp_path=%s", tmp_path)
            data = extract_scheme_data(tmp_path)
            logger.info("PDF parsed successfully — extracted data: %s", data)
        except Exception as exc:
            logger.exception("PDF parsing failed: %s", exc)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
                logger.debug("Removed temp file %s", tmp_path)
    else:
        logger.warning("No PDF bytes available — skipping PDF parse, will use filename fallback")

    # Insert into Neo4j if credentials are configured
    if data:
        logger.info("Attempting Neo4j insert for scheme: %s", data.get('name'))
        try:
            driver = get_driver()
            if driver is not None:
                with driver.session() as session:
                    session.execute_write(insert_scheme, data, req.s3_key)
                logger.info("Neo4j insert OK — scheme=%s", data.get('name'))
            else:
                logger.warning("Neo4j driver is None (credentials missing?) — skipping insert")
        except Exception as exc:
            logger.warning("Neo4j insert skipped (non-fatal): %s", exc)
    else:
        logger.warning("No parsed data — skipping Neo4j insert entirely")

    scheme_name = data.get("name") if data else ""
    if not scheme_name or scheme_name == "NOT_FOUND":
        scheme_name = req.s3_key.split("/")[-1].replace(".pdf", "")
        logger.info("Scheme name from PDF was %r — using filename fallback: %r", data.get('name') if data else None, scheme_name)
    else:
        logger.info("Using parsed scheme name: %r", scheme_name)

    # Build graph response from Neo4j when possible; otherwise use the fallback layout.
    logger.info("Calling fetch_scheme_graph — scheme_name=%r, s3_key=%s", scheme_name, req.s3_key)
    graph = fetch_scheme_graph(scheme_name, fallback_data=data, s3_key=req.s3_key)
    logger.info(
        "fetch_scheme_graph returned — nodes=%d, edges=%d",
        len(graph.get('nodes', [])),
        len(graph.get('edges', [])),
    )
    return graph
