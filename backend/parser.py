# import pdfplumber
# import re

# def extract_scheme_data(pdf_path):
#     data = {}

#     # Extract full text from PDF
#     with pdfplumber.open(pdf_path) as pdf:
#         text = ""
#         for page in pdf.pages:
#             extracted = page.extract_text()
#             if extracted:
#                 text += extracted + "\n"
#     text = text.replace("(cid:415)", "ti")

#     # Helper function for safe extraction
#     def safe_extract(pattern):
#         match = re.search(pattern, text, re.IGNORECASE)
#         return match.group(1).strip() if match else "NOT_FOUND"

#     # Basic fields
#     data["name"] = safe_extract(r"Scheme Name:\s*(.*)")
#     data["state"] = safe_extract(r"State:\s*(.*)")
#     data["category"] = safe_extract(r"Category:\s*(.*)")

#     # ✅ FIXED: Gender extraction (handles next line + bullet)
#     # gender_match = re.search(r"Gender\s*\n[^\n]*\n??\s*(.*)", text, re.IGNORECASE)
#     # data["gender"] = gender_match.group(1).strip() if gender_match else "NOT_FOUND"
#     lines = text.split("\n")

#     gender_value = "NOT_FOUND"
#     for i, line in enumerate(lines):
#         if "Gender" in line:
#         # Check next few lines for actual value
#             for j in range(i+1, min(i+4, len(lines))):
#                 if lines[j].strip() and "" in lines[j]:
#                     gender_value = lines[j].replace("", "").strip()
#                     break

#     data["gender"] = gender_value

#     # ✅ FIXED: Income extraction (specifically from eligibility line)
#     income_match = re.search(r"income.*₹\s*([\d,]+)", text, re.IGNORECASE)
#     data["income_limit"] = int(income_match.group(1).replace(",", "")) if income_match else 0

#     return data


# # ✅ TEST BLOCK
# if __name__ == "__main__":
#     result = extract_scheme_data("pdfs/pm_kisan.pdf")
#     print("\n--- EXTRACTED DATA ---\n")
#     print(result)

import pdfplumber
import re

def extract_scheme_data(pdf_path):
    data = {}

    # Extract full text from PDF
    with pdfplumber.open(pdf_path) as pdf:
        text = ""
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

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

    # --------------------------
    # Gender extraction (robust)
    # --------------------------
    lines = text.split("\n")
    gender_value = "NOT_FOUND"

    for i, line in enumerate(lines):
        if "Gender" in line:
            for j in range(i+1, min(i+4, len(lines))):
                if lines[j].strip() and "" in lines[j]:
                    gender_value = lines[j].replace("", "").strip()
                    break

    data["gender"] = gender_value

    # --------------------------
    # Income extraction
    # --------------------------
    income_match = re.search(r"income.*₹\s*([\d,]+)", text, re.IGNORECASE)
    data["income_limit"] = int(income_match.group(1).replace(",", "")) if income_match else 0

    # --------------------------
    # NEW: Benefit extraction
    # --------------------------
    amounts = re.findall(r"₹\s*([\d,]+)", text)
    amounts = [int(a.replace(",", "")) for a in amounts]

    benefit_value = 0
    for amt in amounts:
        if amt < 100000:  # ignore income values like 800000
            benefit_value = max(benefit_value, amt)

    data["benefit_amount"] = benefit_value

    return data


# --------------------------
# TEST BLOCK
# --------------------------
if __name__ == "__main__":
    result = extract_scheme_data("pdfs/pm_kisan.pdf")
    print("\n--- EXTRACTED DATA ---\n")
    print(result)