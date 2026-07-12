# import logging
# import os
# import pdfplumber
# import re

# logger = logging.getLogger('parser')


# def extract_scheme_data(pdf_path):
#     logger.info("extract_scheme_data — pdf_path=%s", pdf_path)
#     data = {}
#     fallback_name = os.path.splitext(os.path.basename(pdf_path))[0].replace('_', ' ').strip() or 'Unknown Scheme'

#     # Extract full text from PDF
#     try:
#         with pdfplumber.open(pdf_path) as pdf:
#             logger.info("PDF opened — pages=%d", len(pdf.pages))
#             text = ""
#             for i, page in enumerate(pdf.pages):
#                 extracted = page.extract_text()
#                 if extracted:
#                     text += extracted + "\n"
#                 else:
#                     logger.warning("Page %d returned no text", i)
#         logger.info("Text extraction complete — total chars=%d", len(text))
#     except Exception as exc:
#         logger.exception("pdfplumber failed to open/read PDF %s: %s", pdf_path, exc)
#         raise

#     # Fix encoding issues
#     text = text.replace("(cid:415)", "ti")

#     # Helper function
#     def safe_extract(pattern):
#         match = re.search(pattern, text, re.IGNORECASE)
#         return match.group(1).strip() if match else "NOT_FOUND"

#     # Basic fields
#     name = safe_extract(r"Scheme Name:\s*(.*)")
#     state = safe_extract(r"State:\s*(.*)")
#     category = safe_extract(r"Category:\s*(.*)")
#     data["name"] = fallback_name if name == "NOT_FOUND" else name
#     data["state"] = "Unknown State" if state == "NOT_FOUND" else state
#     data["category"] = "General" if category == "NOT_FOUND" else category
#     logger.info("Extracted — name=%r, state=%r, category=%r", data["name"], data["state"], data["category"])

#     # --------------------------
#     # Gender extraction (robust)
#     # --------------------------
#     lines = text.split("\n")
#     gender_value = "NOT_FOUND"

#     for i, line in enumerate(lines):
#         if "Gender" in line:
#             for j in range(i + 1, min(i + 4, len(lines))):
#                 raw = lines[j].strip()
#                 if not raw:
#                     continue
#                 low = raw.lower()
#                 if any(k in low for k in ('female', 'women', 'bride', 'girl')):
#                     gender_value = 'Female'
#                 elif any(k in low for k in ('male', 'men', 'boy', 'husband')):
#                     gender_value = 'Male'
#                 elif any(k in low for k in ('all', 'both', 'any')):
#                     gender_value = 'All'
#                 if gender_value != 'NOT_FOUND':
#                     break

#     data["gender"] = "All" if gender_value == "NOT_FOUND" else gender_value
#     logger.info("Extracted — gender=%r", data["gender"])

#     # --------------------------
#     # Income extraction
#     # --------------------------
#     income_match = re.search(r"income.*₹\s*([\d,]+)", text, re.IGNORECASE)
#     data["income_limit"] = int(income_match.group(1).replace(",", "")) if income_match else 0
#     logger.info("Extracted — income_limit=%s (match=%s)", data["income_limit"], bool(income_match))

#     # --------------------------
#     # Benefit extraction
#     # --------------------------
#     amounts = re.findall(r"₹\s*([\d,]+)", text)
#     amounts = [int(a.replace(",", "")) for a in amounts]
#     logger.info("All ₹ amounts found in text: %s", amounts)

#     benefit_value = 0
#     for amt in amounts:
#         if amt < 100000:  # ignore income values like 800000
#             benefit_value = max(benefit_value, amt)

#     data["benefit_amount"] = benefit_value
#     logger.info("Extracted — benefit_amount=%s", data["benefit_amount"])
#     logger.info("Final extracted data: %s", data)

#     return data


# # --------------------------
# # TEST BLOCK
# # --------------------------
# if __name__ == "__main__":
#     result = extract_scheme_data("pdfs/pm_kisan.pdf")
#     print("\n--- EXTRACTED DATA ---\n")
#     print(result)

import logging
import os
import pdfplumber
import re

logger = logging.getLogger('parser')


def extract_scheme_data(pdf_path):
    logger.info("extract_scheme_data — pdf_path=%s", pdf_path)
    data = {}
    fallback_name = os.path.splitext(os.path.basename(pdf_path))[0].replace('_', ' ').strip() or 'Unknown Scheme'

    # Extract full text from PDF
    try:
        with pdfplumber.open(pdf_path) as pdf:
            logger.info("PDF opened — pages=%d", len(pdf.pages))
            text = ""
            for i, page in enumerate(pdf.pages):
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                else:
                    logger.warning("Page %d returned no text", i)
        logger.info("Text extraction complete — total chars=%d", len(text))
    except Exception as exc:
        logger.exception("pdfplumber failed to open/read PDF %s: %s", pdf_path, exc)
        raise

    # Fix encoding issues
    text = text.replace("(cid:415)", "ti")

    # Helper function
    def safe_extract(pattern):
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(1).strip() if match else "NOT_FOUND"

    # --------------------------
    # Section-block extraction (used for Application Process / Documents
    # Required, which can span multiple lines/bullets until the next
    # known section header).
    # --------------------------
    _SECTION_HEADERS = [
        "Scheme Name", "Type", "State", "Category", "Benefits",
        "Eligibility", "Objective", "Application Process",
        "Documents Required", "Gender",
    ]

    def _extract_section_block(header):
        """Grab everything under `header` up to the next known section
        header (or end of document)."""
        others = [h for h in _SECTION_HEADERS if h != header]
        stop_pattern = "|".join(re.escape(h) for h in others)
        pattern = rf"{re.escape(header)}\s*\n(.*?)(?=(?:{stop_pattern})\s*\n|\Z)"
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            return ""
        return match.group(1).strip()

    def _clean_block_lines(block):
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        lines = [re.sub(r'^[•\-\*]\s*', '• ', l) for l in lines]
        return "\n".join(lines)

    # Basic fields
    name = safe_extract(r"Scheme Name:\s*(.*)")
    state = safe_extract(r"State:\s*(.*)")
    category = safe_extract(r"Category:\s*(.*)")
    data["name"] = fallback_name if name == "NOT_FOUND" else name
    data["state"] = "Unknown State" if state == "NOT_FOUND" else state
    data["category"] = "General" if category == "NOT_FOUND" else category
    logger.info("Extracted — name=%r, state=%r, category=%r", data["name"], data["state"], data["category"])

    # --------------------------
    # Gender extraction (robust)
    # --------------------------
    lines = text.split("\n")
    gender_value = "NOT_FOUND"

    for i, line in enumerate(lines):
        if "Gender" in line:
            for j in range(i + 1, min(i + 4, len(lines))):
                raw = lines[j].strip()
                if not raw:
                    continue
                low = raw.lower()
                if any(k in low for k in ('female', 'women', 'bride', 'girl')):
                    gender_value = 'Female'
                elif any(k in low for k in ('male', 'men', 'boy', 'husband')):
                    gender_value = 'Male'
                elif any(k in low for k in ('all', 'both', 'any')):
                    gender_value = 'All'
                if gender_value != 'NOT_FOUND':
                    break

    data["gender"] = "All" if gender_value == "NOT_FOUND" else gender_value
    logger.info("Extracted — gender=%r", data["gender"])

    # --------------------------
    # Income extraction
    # --------------------------
    income_match = re.search(r"income.*₹\s*([\d,]+)", text, re.IGNORECASE)
    data["income_limit"] = int(income_match.group(1).replace(",", "")) if income_match else 0
    logger.info("Extracted — income_limit=%s (match=%s)", data["income_limit"], bool(income_match))

    # --------------------------
    # Benefit extraction
    # --------------------------
    amounts = re.findall(r"₹\s*([\d,]+)", text)
    amounts = [int(a.replace(",", "")) for a in amounts]
    logger.info("All ₹ amounts found in text: %s", amounts)

    benefit_value = 0
    for amt in amounts:
        if amt < 100000:  # ignore income values like 800000
            benefit_value = max(benefit_value, amt)

    data["benefit_amount"] = benefit_value
    logger.info("Extracted — benefit_amount=%s", data["benefit_amount"])

    # --------------------------
    # Application Process / Documents Required extraction
    # --------------------------
    application_process_raw = _extract_section_block("Application Process")
    documents_required_raw = _extract_section_block("Documents Required")

    data["applicationProcess"] = _clean_block_lines(application_process_raw)
    data["documentsRequired"] = _clean_block_lines(documents_required_raw)

    logger.info("Extracted — applicationProcess=%r", data["applicationProcess"])
    logger.info("Extracted — documentsRequired=%r", data["documentsRequired"])

    logger.info("Final extracted data: %s", data)

    return data


# --------------------------
# TEST BLOCK
# --------------------------
if __name__ == "__main__":
    result = extract_scheme_data("pdfs/pm_kisan.pdf")
    print("\n--- EXTRACTED DATA ---\n")
    print(result)