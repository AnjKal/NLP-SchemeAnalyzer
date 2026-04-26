from neo4j import GraphDatabase
from parser import extract_scheme_data
import os

# # 🔴 REPLACE THESE WITH YOUR ACTUAL VALUES
uri = ""
user = ""
password = ""

driver = GraphDatabase.driver(uri, auth=(user, password))


def insert_scheme(tx, scheme):
    query = """
    MERGE (s:Scheme {name: $name})
    MERGE (st:State {name: $state})
    MERGE (c:Category {name: $category})
    MERGE (g:Gender {type: $gender})

    MERGE (s)-[:AVAILABLE_IN]->(st)
    MERGE (s)-[:HAS_CATEGORY]->(c)
    MERGE (s)-[:FOR_GENDER]->(g)

    // 🔥 IMPORTANT FIX
    SET s.income_limit = $income_limit,
        s.benefit_amount = $benefit_amount
    """
    tx.run(query, **scheme)


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
            session.execute_write(insert_scheme, data)

print("All schemes inserted successfully!")