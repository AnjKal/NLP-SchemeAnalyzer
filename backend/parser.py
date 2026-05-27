import logging
import pdfplumber
import re

logger = logging.getLogger('parser')


def extract_scheme_data(pdf_path):
    logger.info("extract_scheme_data — pdf_path=%s", pdf_path)
    data = {}

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

    # Basic fields
    data["name"] = safe_extract(r"Scheme Name:\s*(.*)")
    data["state"] = safe_extract(r"State:\s*(.*)")
    data["category"] = safe_extract(r"Category:\s*(.*)")
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

    data["gender"] = gender_value
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
    logger.info("Final extracted data: %s", data)

    return data


# --------------------------
# TEST BLOCK
# --------------------------
if __name__ == "__main__":
    result = extract_scheme_data("pdfs/pm_kisan.pdf")
    print("\n--- EXTRACTED DATA ---\n")
    print(result)
