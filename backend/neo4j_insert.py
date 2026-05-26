from neo4j import GraphDatabase
from parser import extract_scheme_data
from query import insert_scheme
import os
from dotenv import load_dotenv

# Load environment variables from .env.local (not committed)
load_dotenv('.env.local')

uri = os.getenv("NEO4J_URI")
user = os.getenv("NEO4J_USER")
password = os.getenv("NEO4J_PASSWORD")

if not (uri and user and password):
    raise RuntimeError("NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD must be set in .env.local or environment")

driver = GraphDatabase.driver(uri, auth=(user, password))


# Folder containing PDFs
pdf_folder = "pdfs"

with driver.session() as session:
    for file in os.listdir(pdf_folder):
        if file.endswith(".pdf"):
            path = os.path.join(pdf_folder, file)

            # Extract data
            data = extract_scheme_data(path)

            # Debug print
            print("Inserting:", data)

            # Insert into Neo4j
            session.execute_write(insert_scheme, data, path)

print("All schemes inserted successfully!")