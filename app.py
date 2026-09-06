import os
import re
import html
import base64
import textwrap
from datetime import datetime

import pandas as pd
import streamlit as st
from PIL import Image, ImageOps
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from huggingface_hub import InferenceClient


# =========================================================
# PAGE CONFIG
# =========================================================

st.set_page_config(
    page_title="PETORA | Pets Beyond Borders",
    page_icon="🐾",
    layout="wide",
    initial_sidebar_state="collapsed",
)


# =========================================================
# PATHS
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")
IMAGE_DIR = os.path.join(BASE_DIR, "images")

INVENTORY_FILE = os.path.join(DATA_DIR, "puppies.csv")
ENQUIRY_FILE = os.path.join(DATA_DIR, "enquiries.csv")
INFO_FILE = os.path.join(DATA_DIR, "info.text")

LOGO_FILE = os.path.join(IMAGE_DIR, "petora-logo.png")


# =========================================================
# AI CONFIG
# =========================================================

HF_MODEL = "deepseek-ai/DeepSeek-V3-0324"

try:
    HF_TOKEN = st.secrets["HF_TOKEN"]
except Exception:
    HF_TOKEN = os.getenv("HF_TOKEN", "")


# =========================================================
# SESSION STATE
# =========================================================

if "selected_category" not in st.session_state:
    st.session_state["selected_category"] = "All"

if "selected_pet" not in st.session_state:
    st.session_state["selected_pet"] = None

if "selected_breed" not in st.session_state:
    st.session_state["selected_breed"] = None

if "detail_pet_id" not in st.session_state:
    st.session_state["detail_pet_id"] = None


# =========================================================
# HTML RENDER HELPER
# =========================================================

def render_html(content):
    """Render custom HTML safely."""
    st.html(
        textwrap.dedent(content).strip()
    )


# =========================================================
# GLOBAL CSS
# =========================================================

render_html(
    """
    <style>

    @import url(
        'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap'
    );

    /* =====================================================
       GLOBAL
       ===================================================== */

    html,
    body,
    [class*="css"] {
        font-family: 'DM Sans', sans-serif;
    }

    .stApp {
        background:
            radial-gradient(
                circle at top right,
                rgba(225,239,222,0.60),
                transparent 30%
            ),
            #f8f6ef;
        color: #123b2b;
    }

    .block-container {
        max-width: 1380px;
        padding-top: 1rem;
        padding-bottom: 3rem;
    }

    #MainMenu {
        visibility: hidden;
    }

    footer {
        visibility: hidden;
    }

    header {
        background: transparent !important;
    }


    /* =====================================================
       HEADER
       ===================================================== */

    .petora-header {
        display: flex;
        align-items: center;
        justify-content: space-between;

        width: 100%;
        box-sizing: border-box;

        gap: 30px;

        padding: 16px 25px;

        background: rgba(255,255,255,0.97);

        border: 1px solid #e7e2d5;
        border-radius: 22px;

        box-shadow:
            0 10px 35px rgba(18,59,43,0.07);

        margin-bottom: 16px;
    }

    .petora-brand {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .petora-logo-small {
        width: 76px;
        height: 76px;
        object-fit: contain;
        border-radius: 12px;
        display: block;
    }

    .brand-title {
        font-family: 'Playfair Display', serif;

        font-size: 32px;
        font-weight: 700;

        line-height: 1;

        color: #0c4a32;
    }

    .brand-subtitle {
        margin-top: 7px;

        font-size: 11px;
        font-weight: 800;

        letter-spacing: 2.5px;

        color: #a37a17;

        text-transform: uppercase;
    }

    .header-tagline {
        text-align: right;

        color: #617165;

        font-size: 14px;

        line-height: 1.6;
    }


    /* =====================================================
       NAVIGATION
       ===================================================== */

    .nav-wrap {
        width: 100%;
        box-sizing: border-box;

        background: #0b4a30;

        border-radius: 17px;

        padding: 4px;

        margin-bottom: 28px;

        box-shadow:
            0 8px 24px rgba(11,74,48,0.18);
    }

    .nav-inner {
        display: flex;

        align-items: center;

        justify-content: center;

        gap: 4px;

        flex-wrap: wrap;

        padding: 7px;
    }

    .nav-item {
        color: white !important;

        text-decoration: none !important;

        font-size: 14px;

        font-weight: 600;

        padding: 10px 14px;

        border-radius: 11px;
    }

    .nav-item:hover {
        background: rgba(255,255,255,0.14);
    }


    /* =====================================================
       HERO
       ===================================================== */

    .hero {
        position: relative;

        overflow: hidden;

        min-height: 425px;

        padding: 58px 55px 50px;

        border-radius: 30px;

        border: 1px solid #e4ded0;

        background:
            radial-gradient(
                circle at 84% 43%,
                rgba(192,220,192,0.58),
                transparent 29%
            ),
            linear-gradient(
                135deg,
                #fffdf7 0%,
                #f4f8ef 100%
            );

        box-shadow:
            0 16px 50px rgba(18,59,43,0.08);

        margin-bottom: 31px;
    }

    .hero-content {
        max-width: 740px;

        position: relative;

        z-index: 3;
    }

    .hero-kicker {
        color: #a77a18;

        font-size: 13px;

        font-weight: 800;

        letter-spacing: 3px;

        text-transform: uppercase;

        margin-bottom: 15px;
    }

    .hero-title {
        font-family: 'Playfair Display', serif;

        color: #0a4831;

        font-size: clamp(43px,5vw,67px);

        line-height: 1.02;

        margin: 0;
    }

    .hero-title span {
        color: #ad831f;
    }

    .hero-lead {
        color: #5f6d64;

        font-size: 18px;

        line-height: 1.75;

        margin-top: 22px;

        max-width: 690px;
    }

    .hero-actions {
        display: flex;

        gap: 14px;

        flex-wrap: wrap;

        margin-top: 30px;
    }

    .hero-btn-primary,
    .hero-btn-secondary {
        display: inline-block;

        padding: 13px 22px;

        border-radius: 12px;

        font-weight: 700;

        text-decoration: none;
    }

    .hero-btn-primary {
        background: #0b4a30;

        color: white !important;
    }

    .hero-btn-secondary {
        background: white;

        color: #0b4a30 !important;

        border: 1px solid #d9ddcf;
    }

    .hero-orbit {
        position: absolute;

        right: -65px;
        top: 8px;

        width: 450px;
        height: 450px;

        border-radius: 50%;

        background:
            rgba(224,237,220,0.70);

        border:
            1px solid rgba(123,155,128,0.20);
    }

    .hero-orbit-inner {
        position: absolute;

        inset: 47px;

        border-radius: 50%;

        background:
            rgba(255,255,255,0.74);

        border:
            1px solid rgba(123,155,128,0.20);

        display: flex;
        align-items: center;
        justify-content: center;

        font-size: 105px;

        letter-spacing: -10px;
    }

    .hero-mini-card {
        position: absolute;

        right: 72px;
        bottom: 32px;

        background: white;

        padding: 11px 16px;

        border-radius: 12px;

        box-shadow:
            0 10px 25px rgba(15,52,36,0.12);

        font-weight: 700;

        color: #0b4a30;

        z-index: 4;
    }


    /* =====================================================
       SECTIONS
       ===================================================== */

    .section-label {
        color: #a77a18;

        font-size: 12px;

        letter-spacing: 2.5px;

        font-weight: 800;

        text-transform: uppercase;

        margin-bottom: 7px;
    }

    .section-title {
        color: #104a34;

        font-family: 'Playfair Display', serif;

        font-size: 31px;

        margin-bottom: 4px;
    }

    .section-copy {
        color: #6a766e;

        font-size: 14px;

        margin-bottom: 17px;
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    .search-section {
        background: white;

        border: 1px solid #e5e0d4;

        border-radius: 22px;

        padding: 23px 24px 9px;

        box-shadow:
            0 8px 28px rgba(18,59,43,0.05);

        margin-bottom: 25px;
    }


    /* =====================================================
       CATEGORY
       ===================================================== */

    .category-card {
        min-height: 155px;

        padding: 24px 15px;

        text-align: center;

        background: white;

        border: 1px solid #e6e1d5;

        border-radius: 20px;

        box-shadow:
            0 8px 28px rgba(18,59,43,0.05);

        box-sizing: border-box;
    }

    .category-card.active {
        border: 2px solid #0b4a30;

        background:
            linear-gradient(
                145deg,
                #f7fbf4,
                #edf5ea
            );

        box-shadow:
            0 12px 32px rgba(11,74,48,0.12);
    }

    .category-icon {
        font-size: 38px;
        margin-bottom: 11px;
    }

    .category-name {
        font-weight: 800;

        color: #164b36;

        font-size: 16px;
    }

    .category-copy {
        color: #768078;

        font-size: 12px;

        line-height: 1.5;

        margin-top: 6px;
    }


    /* =====================================================
       PET CARDS
       ===================================================== */

    .pet-body {
        background: white;

        padding: 18px;

        border:
            1px solid #e7e2d6;

        border-top: none;

        border-radius:
            0 0 20px 20px;

        margin-bottom: 8px;
    }

    .pet-breed {
        font-size: 21px;

        font-weight: 800;

        color: #104a34;
    }

    .pet-name {
        color: #68766c;

        font-size: 13px;

        font-weight: 600;

        margin-top: 3px;
    }

    .pet-id {
        color: #919991;

        font-size: 12px;

        margin-top: 4px;
    }

    .pet-meta {
        margin-top: 13px;

        display: flex;

        justify-content: space-between;

        gap: 10px;

        color: #69756d;

        font-size: 13px;
    }

    .pet-price {
        font-size: 23px;

        font-weight: 800;

        color: #aa7c16;

        margin-top: 13px;
    }

    .available-badge {
        display: inline-block;

        margin-top: 10px;

        padding: 5px 9px;

        border-radius: 999px;

        background: #e9f5ec;

        color: #176038;

        font-size: 11px;

        font-weight: 800;
    }


    /* =====================================================
       PET DETAIL
       ===================================================== */

    .detail-shell {
        background: white;

        border:
            1px solid #e5e0d4;

        border-radius: 26px;

        padding: 28px;

        box-shadow:
            0 15px 45px rgba(18,59,43,0.08);

        margin-top: 15px;

        margin-bottom: 35px;
    }

    .detail-kicker {
        color: #a77a18;

        font-size: 12px;

        font-weight: 800;

        letter-spacing: 2.5px;

        text-transform: uppercase;

        margin-bottom: 8px;
    }

    .detail-title {
        color: #104a34;

        font-family: 'Playfair Display', serif;

        font-size: 40px;

        line-height: 1.1;

        margin: 0;
    }

    .detail-subtitle {
        color: #768078;

        font-size: 15px;

        margin-top: 8px;
    }

    .detail-price {
        color: #aa7c16;

        font-size: 32px;

        font-weight: 800;

        margin-top: 18px;
    }

    .detail-grid {
        display: grid;

        grid-template-columns:
            repeat(2,1fr);

        gap: 10px;

        margin-top: 24px;
    }

    .detail-stat {
        background: #f5f8f1;

        border:
            1px solid #e2eadf;

        border-radius: 13px;

        padding: 13px 15px;
    }

    .detail-stat-label {
        font-size: 10px;

        font-weight: 800;

        letter-spacing: 1.3px;

        color: #819087;

        text-transform: uppercase;
    }

    .detail-stat-value {
        margin-top: 4px;

        color: #164b36;

        font-size: 14px;

        font-weight: 700;
    }

    .detail-description {
        background:
            linear-gradient(
                135deg,
                #fffdf7,
                #f5f8f1
            );

        border:
            1px solid #e7e1d5;

        border-radius: 15px;

        padding: 17px;

        margin-top: 22px;

        color: #5f6d64;

        font-size: 14px;

        line-height: 1.7;
    }


    /* =====================================================
       AI
       ===================================================== */

    .ai-panel {
        background:
            linear-gradient(
                145deg,
                #0a4a31,
                #093b29
            );

        border-radius: 24px;

        padding: 28px;

        color: white;

        box-shadow:
            0 15px 45px rgba(9,59,41,0.20);

        min-height: 325px;

        box-sizing: border-box;
    }

    .ai-badge {
        display: inline-block;

        background:
            rgba(255,255,255,0.12);

        padding: 6px 10px;

        border-radius: 999px;

        font-size: 11px;

        font-weight: 800;

        letter-spacing: 1px;

        margin-bottom: 13px;
    }

    .ai-title {
        font-family: 'Playfair Display', serif;

        font-size: 33px;

        margin-bottom: 10px;
    }

    .ai-copy {
        color: rgba(255,255,255,0.76);

        font-size: 14px;

        line-height: 1.7;
    }


    /* =====================================================
       SMART SEARCH RESULT
       ===================================================== */

    .smart-result {
        background:
            linear-gradient(
                135deg,
                #f2f8ef,
                #ffffff
            );

        border:
            1px solid #dfe9dc;

        border-radius: 16px;

        padding: 15px 18px;

        margin-top: 15px;

        color: #315640;

        font-size: 14px;

        line-height: 1.7;
    }


    /* =====================================================
       TRUST
       ===================================================== */

    .trust-bar {
        display: grid;

        grid-template-columns:
            repeat(4,1fr);

        gap: 10px;

        margin: 38px 0;
    }

    .trust-item {
        background: white;

        border:
            1px solid #e7e1d6;

        padding: 20px 15px;

        text-align: center;

        border-radius: 16px;
    }

    .trust-icon {
        font-size: 22px;
    }

    .trust-title {
        margin-top: 8px;

        font-weight: 800;

        color: #155039;

        font-size: 14px;
    }

    .trust-copy {
        margin-top: 4px;

        font-size: 11px;

        color: #858e87;
    }


    /* =====================================================
       FOOTER
       ===================================================== */

    .footer-box {
        margin-top: 45px;

        background: #0a3f2b;

        color: rgba(255,255,255,0.80);

        border-radius: 24px;

        padding: 30px;

        box-sizing: border-box;
    }

    .footer-brand {
        color: white;

        font-family: 'Playfair Display', serif;

        font-size: 29px;

        font-weight: 700;
    }

    .footer-copy {
        margin-top: 7px;

        font-size: 13px;

        line-height: 1.7;
    }

    .footer-bottom {
        border-top:
            1px solid rgba(255,255,255,0.12);

        margin-top: 25px;

        padding-top: 18px;

        font-size: 11px;

        color: rgba(255,255,255,0.55);
    }


    /* =====================================================
       BUTTONS
       ===================================================== */

    .stButton > button {
        border-radius: 11px;

        min-height: 42px;

        font-weight: 700;
    }


    /* =====================================================
       MOBILE
       ===================================================== */

    @media (max-width: 900px) {

        .petora-header {
            padding: 16px;
        }

        .header-tagline {
            display: none;
        }

        .hero {
            padding: 35px 28px;

            min-height: 560px;
        }

        .hero-orbit {
            right: -125px;

            top: 245px;
        }

        .hero-mini-card {
            right: 25px;

            bottom: 20px;
        }

        .trust-bar {
            grid-template-columns:
                repeat(2,1fr);
        }

        .detail-grid {
            grid-template-columns:
                1fr;
        }
    }

    </style>
    """
)


# =========================================================
# GENERAL HELPERS
# =========================================================

def safe_text(value):
    return html.escape(
        str(value)
    )


def format_price(value):
    try:
        return f"₹{float(value):,.0f}"
    except Exception:
        return str(value)


def image_to_base64(path):
    try:

        with open(
            path,
            "rb",
        ) as image_file:

            return base64.b64encode(
                image_file.read()
            ).decode("utf-8")

    except Exception:

        return ""


def prepare_image(path):
    try:

        image = Image.open(
            path
        ).convert("RGB")

        return ImageOps.fit(
            image,
            (800,600),
            method=Image.Resampling.LANCZOS,
            centering=(0.5,0.5),
        )

    except Exception:

        return None


# =========================================================
# INVENTORY
# =========================================================

def load_inventory():

    if not os.path.exists(
        INVENTORY_FILE
    ):

        return pd.DataFrame()

    try:

        df = pd.read_csv(
            INVENTORY_FILE
        )

        required_columns = [
            "pet_id",
            "category",
            "breed",
            "name",
            "gender",
            "age",
            "price",
            "status",
            "vaccinated",
            "location",
            "photo",
        ]

        for column in required_columns:

            if column not in df.columns:

                df[column] = ""

        return df[
            required_columns
        ].copy()

    except Exception as exc:

        st.error(
            f"Could not load inventory: {exc}"
        )

        return pd.DataFrame()


inventory = load_inventory()


# =========================================================
# ENQUIRY
# =========================================================

def save_enquiry(
    name,
    phone,
    pet_id,
    breed,
    message,
):

    new_row = pd.DataFrame(
        [
            {
                "date": datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "name": name,
                "phone": phone,
                "pet_id": pet_id,
                "breed": breed,
                "message": message,
                "status": "New",
            }
        ]
    )

    if os.path.exists(
        ENQUIRY_FILE
    ):

        try:

            existing = pd.read_csv(
                ENQUIRY_FILE
            )

        except Exception:

            existing = pd.DataFrame()

    else:

        existing = pd.DataFrame()

    result = pd.concat(
        [
            existing,
            new_row,
        ],
        ignore_index=True,
    )

    os.makedirs(
        DATA_DIR,
        exist_ok=True,
    )

    result.to_csv(
        ENQUIRY_FILE,
        index=False,
    )


# =========================================================
# RAG
# =========================================================

@st.cache_resource
def get_embedding_model():

    return SentenceTransformer(
        "all-MiniLM-L6-v2"
    )


@st.cache_data
def load_knowledge_chunks():

    if not os.path.exists(
        INFO_FILE
    ):

        return []

    try:

        with open(
            INFO_FILE,
            "r",
            encoding="utf-8",
        ) as file:

            text = file.read()

    except Exception:

        return []

    text = re.sub(
        r"\s+",
        " ",
        text,
    ).strip()

    if not text:

        return []

    chunk_size = 500

    chunks = []

    for index in range(
        0,
        len(text),
        chunk_size,
    ):

        chunk = text[
            index:index + chunk_size
        ].strip()

        if chunk:

            chunks.append(
                chunk
            )

    return chunks


@st.cache_data
def build_knowledge_embeddings(
    chunks
):

    if not chunks:

        return None

    model = get_embedding_model()

    return model.encode(
        chunks
    )


def rag_search(
    question,
    top_k=3,
):

    chunks = load_knowledge_chunks()

    if not chunks:

        return ""

    embeddings = (
        build_knowledge_embeddings(
            chunks
        )
    )

    if embeddings is None:

        return ""

    model = get_embedding_model()

    question_embedding = (
        model.encode(
            [question]
        )
    )

    scores = cosine_similarity(
        question_embedding,
        embeddings,
    )[0]

    best_indexes = (
        scores
        .argsort()[-top_k:][::-1]
    )

    selected = []

    for index in best_indexes:

        if scores[index] > 0.20:

            selected.append(
                chunks[index]
            )

    return "\n\n".join(
        selected
    )


# =========================================================
# HUGGING FACE AI
# =========================================================

def ask_ai(
    question,
    context,
):

    if not HF_TOKEN:

        return (
            "PETORA AI is not configured yet. "
            "Please add HF_TOKEN to Streamlit secrets."
        )

    try:

        client = InferenceClient(
            provider="auto",
            api_key=HF_TOKEN,
        )

        system_prompt = """
You are PETORA AI, a friendly pet marketplace assistant.

Help customers understand:
- pets
- breeds
- basic pet information
- responsible pet ownership
- PETORA services

Use the supplied context when relevant.

Never invent inventory information.

Exact inventory information is handled by the application.

Be concise, friendly, professional and helpful.

Do not claim that PETORA guarantees health,
delivery, availability or legality unless
that information is explicitly provided.
"""

        messages = [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": (
                    f"Context:\n{context}\n\n"
                    f"Customer question:\n{question}"
                ),
            },
        ]

        response = client.chat_completion(
            messages=messages,
            model=HF_MODEL,
            max_tokens=350,
            temperature=0.5,
        )

        return (
            response
            .choices[0]
            .message
            .content
            .strip()
        )

    except Exception as exc:

        return (
            "PETORA AI is temporarily "
            f"unavailable: {exc}"
        )


# =========================================================
# AI SMART SEARCH
# =========================================================

def smart_search_inventory(
    question,
    inventory_df,
):
    """
    Interpret a natural-language pet search and filter
    the actual inventory dataframe.

    AI is NOT used to invent listings.
    """

    if inventory_df.empty:

        return inventory_df.copy()

    result = inventory_df.copy()

    q = question.lower().strip()


    # -----------------------------------------------------
    # AVAILABLE
    # -----------------------------------------------------

    result = result[
        result["status"]
        .astype(str)
        .str.lower()
        .str.strip()
        == "available"
    ]


    # -----------------------------------------------------
    # GENDER
    # -----------------------------------------------------

    if re.search(
        r"\bfemale\b",
        q,
    ):

        result = result[
            result["gender"]
            .astype(str)
            .str.lower()
            .str.strip()
            == "female"
        ]

    elif re.search(
        r"\bmale\b",
        q,
    ):

        result = result[
            result["gender"]
            .astype(str)
            .str.lower()
            .str.strip()
            == "male"
        ]


    # -----------------------------------------------------
    # CATEGORY
    # -----------------------------------------------------

    category_terms = {
        "dogs": "Dogs",
        "dog": "Dogs",
        "puppies": "Dogs",
        "puppy": "Dogs",

        "cats": "Cats",
        "cat": "Cats",

        "aquatics": "Aquatics",
        "aquatic": "Aquatics",
        "fish": "Aquatics",

        "reptiles": "Reptiles",
        "reptile": "Reptiles",

        "exotic pets": "Exotic Pets",
        "exotic": "Exotic Pets",
    }

    detected_category = None

    # Check longer phrases first
    category_keys = sorted(
        category_terms.keys(),
        key=len,
        reverse=True,
    )

    for term in category_keys:

        if re.search(
            rf"\b{re.escape(term)}\b",
            q,
        ):

            detected_category = (
                category_terms[term]
            )

            break

    if detected_category:

        result = result[
            result["category"]
            .astype(str)
            .str.lower()
            .str.strip()
            ==
            detected_category.lower()
        ]


    # -----------------------------------------------------
    # BREED
    # -----------------------------------------------------

    if "breed" in result.columns:

        all_breeds = (
            inventory_df["breed"]
            .dropna()
            .astype(str)
            .str.strip()
            .unique()
        )

        # Longer breed names first
        breeds_sorted = sorted(
            all_breeds,
            key=len,
            reverse=True,
        )

        for breed in breeds_sorted:

            if not breed:
                continue

            if breed.lower() in q:

                result = result[
                    result["breed"]
                    .astype(str)
                    .str.lower()
                    .str.strip()
                    ==
                    breed.lower()
                ]

                break


    # -----------------------------------------------------
    # PET NAME
    # -----------------------------------------------------

    if "name" in result.columns:

        all_names = (
            inventory_df["name"]
            .dropna()
            .astype(str)
            .str.strip()
            .unique()
        )

        for pet_name in all_names:

            if (
                pet_name
                and pet_name.lower() in q
            ):

                result = result[
                    result["name"]
                    .astype(str)
                    .str.lower()
                    .str.strip()
                    ==
                    pet_name.lower()
                ]

                break


    # -----------------------------------------------------
    # LOCATION
    # -----------------------------------------------------

    if "location" in result.columns:

        all_locations = (
            inventory_df["location"]
            .dropna()
            .astype(str)
            .str.strip()
            .unique()
        )

        for location in all_locations:

            if (
                location
                and location.lower() in q
            ):

                result = result[
                    result["location"]
                    .astype(str)
                    .str.lower()
                    .str.strip()
                    ==
                    location.lower()
                ]

                break


    # -----------------------------------------------------
    # MAXIMUM PRICE
    # -----------------------------------------------------

    price_patterns = [

        r"under\s*[₹rs.]?\s*([\d,]+)",

        r"below\s*[₹rs.]?\s*([\d,]+)",

        r"less\s+than\s*[₹rs.]?\s*([\d,]+)",

        r"upto\s*[₹rs.]?\s*([\d,]+)",

        r"up\s+to\s*[₹rs.]?\s*([\d,]+)",

        r"within\s*[₹rs.]?\s*([\d,]+)",

        r"maximum\s*[₹rs.]?\s*([\d,]+)",

        r"max\s*[₹rs.]?\s*([\d,]+)",

    ]

    max_price = None

    for pattern in price_patterns:

        match = re.search(
            pattern,
            q,
        )

        if match:

            try:

                max_price = float(
                    match.group(1)
                    .replace(",", "")
                )

            except ValueError:

                max_price = None

            break


    if max_price is not None:

        numeric_prices = pd.to_numeric(
            result["price"],
            errors="coerce",
        )

        result = result[
            numeric_prices
            <= max_price
        ]


    return result.reset_index(
        drop=True
    )


# =========================================================
# PET CARD FUNCTION
# =========================================================

def render_pet_cards(
    pet_dataframe,
    prefix="pet",
):
    """
    Render inventory records as PETORA cards.
    """

    if pet_dataframe.empty:

        st.info(
            "No pets found."
        )

        return


    pet_rows = pet_dataframe.head(
        12
    )


    for start_index in range(
        0,
        len(pet_rows),
        3,
    ):

        current_row = pet_rows.iloc[
            start_index:start_index + 3
        ]

        columns = st.columns(3)


        for column, (
            _,
            pet,
        ) in zip(
            columns,
            current_row.iterrows(),
        ):

            with column:

                # -------------------------------------------------
                # IMAGE
                # -------------------------------------------------

                photo = str(
                    pet.get(
                        "photo",
                        "",
                    )
                ).strip()

                photo_path = ""

                if photo:

                    if os.path.isabs(
                        photo
                    ):

                        photo_path = photo

                    else:

                        photo_path = os.path.join(
                            BASE_DIR,
                            photo,
                        )

                image = None

                if (
                    photo_path
                    and os.path.exists(
                        photo_path
                    )
                ):

                    image = prepare_image(
                        photo_path
                    )


                if image is not None:

                    st.image(
                        image,
                        use_container_width=True,
                    )

                else:

                    render_html(
                        """
                        <div
                            style="
                                height:260px;
                                background:#edf1ea;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                font-size:70px;
                                border-radius:20px 20px 0 0;
                            "
                        >
                            🐾
                        </div>
                        """
                    )


                # -------------------------------------------------
                # DETAILS
                # -------------------------------------------------

                pet_id = safe_text(
                    pet.get(
                        "pet_id",
                        "",
                    )
                )

                breed = safe_text(
                    pet.get(
                        "breed",
                        "",
                    )
                )

                name = safe_text(
                    pet.get(
                        "name",
                        "",
                    )
                )

                gender = safe_text(
                    pet.get(
                        "gender",
                        "",
                    )
                )

                age = safe_text(
                    pet.get(
                        "age",
                        "",
                    )
                )

                location = safe_text(
                    pet.get(
                        "location",
                        "",
                    )
                )

                vaccinated = safe_text(
                    pet.get(
                        "vaccinated",
                        "",
                    )
                )

                category = safe_text(
                    pet.get(
                        "category",
                        "",
                    )
                )

                price = format_price(
                    pet.get(
                        "price",
                        "",
                    )
                )


                render_html(
                    f"""
                    <div class="pet-body">

                        <div class="pet-breed">
                            {breed}
                        </div>

                        <div class="pet-name">
                            {name}
                        </div>

                        <div class="pet-id">
                            ID: {pet_id}
                        </div>

                        <div class="pet-meta">

                            <span>
                                👤 {gender}
                            </span>

                            <span>
                                📅 {age}
                            </span>

                        </div>

                        <div class="pet-meta">

                            <span>
                                📍 {location}
                            </span>

                            <span>
                                💉 {vaccinated}
                            </span>

                        </div>

                        <div class="pet-price">
                            {price}
                        </div>

                        <div class="available-badge">
                            ✓ Available · {category}
                        </div>

                    </div>
                    """
                )


                # -------------------------------------------------
                # VIEW DETAILS
                # -------------------------------------------------

                if st.button(
                    "View Details",
                    key=(
                        f"{prefix}_details_"
                        f"{pet['pet_id']}"
                    ),
                    use_container_width=True,
                ):

                    st.session_state[
                        "detail_pet_id"
                    ] = str(
                        pet["pet_id"]
                    )

                    st.rerun()


                # -------------------------------------------------
                # INTEREST
                # -------------------------------------------------

                if st.button(
                    "I'm Interested",
                    key=(
                        f"{prefix}_interest_"
                        f"{pet['pet_id']}"
                    ),
                    use_container_width=True,
                ):

                    st.session_state[
                        "selected_pet"
                    ] = str(
                        pet["pet_id"]
                    )

                    st.session_state[
                        "selected_breed"
                    ] = str(
                        pet["breed"]
                    )

                    st.session_state[
                        "detail_pet_id"
                    ] = None

                    st.rerun()


# =========================================================
# HEADER
# =========================================================

logo_b64 = ""

if os.path.exists(
    LOGO_FILE
):

    logo_b64 = image_to_base64(
        LOGO_FILE
    )


if logo_b64:

    render_html(
        f"""
        <div class="petora-header">

            <div class="petora-brand">

                <img
                    src="data:image/png;base64,{logo_b64}"
                    class="petora-logo-small"
                    alt="PETORA"
                >

                <div>

                    <div class="brand-title">
                        PETORA
                    </div>

                    <div class="brand-subtitle">
                        Pets Beyond Borders
                    </div>

                </div>

            </div>

            <div class="header-tagline">
                Different Pets.<br>
                Same Love. 🐾
            </div>

        </div>
        """
    )

else:

    render_html(
        """
        <div class="petora-header">

            <div>

                <div class="brand-title">
                    PETORA
                </div>

                <div class="brand-subtitle">
                    Pets Beyond Borders
                </div>

            </div>

            <div class="header-tagline">
                Different Pets.<br>
                Same Love. 🐾
            </div>

        </div>
        """
    )


# =========================================================
# NAVIGATION
# =========================================================

render_html(
    """
    <div class="nav-wrap">

        <div class="nav-inner">

            <a
                class="nav-item"
                href="#home"
            >
                🏠 Home
            </a>

            <a
                class="nav-item"
                href="#categories"
            >
                🐾 Pets
            </a>

            <a
                class="nav-item"
                href="#featured-pets"
            >
                ⭐ Featured
            </a>

            <a
                class="nav-item"
                href="#ai-assistant"
            >
                🤖 AI Assistant
            </a>

            <a
                class="nav-item"
                href="#about"
            >
                ℹ️ About
            </a>

        </div>

    </div>
    """
)


# =========================================================
# HERO
# =========================================================

render_html(
    """
    <section
        class="hero"
        id="home"
    >

        <div class="hero-content">

            <div class="hero-kicker">
                Welcome to PETORA
            </div>

            <h1 class="hero-title">
                Your Complete<br>
                <span>Pet Companion</span>
            </h1>

            <div class="hero-lead">
                Discover puppies today and explore
                a growing world of pets tomorrow —
                from dogs and cats to aquatics,
                reptiles and exotic pets.
            </div>

            <div class="hero-actions">

                <a
                    class="hero-btn-primary"
                    href="#featured-pets"
                >
                    Explore Pets →
                </a>

                <a
                    class="hero-btn-secondary"
                    href="#ai-assistant"
                >
                    Ask PETORA AI
                </a>

            </div>

        </div>


        <div class="hero-orbit">

            <div class="hero-orbit-inner">
                🐶 🐱
            </div>

        </div>


        <div class="hero-mini-card">
            🐾 Smart Pet Discovery
        </div>

    </section>
    """
)


# =========================================================
# SEARCH / MANUAL FILTERS
# =========================================================

render_html(
    """
    <div class="search-section">

        <div class="section-label">
            Find Your Match
        </div>

        <div class="section-title">
            Search Available Pets
        </div>

        <div class="section-copy">
            Search by pet ID, name, breed,
            category, gender and budget.
        </div>

    </div>
    """
)


filter_col1, filter_col2, filter_col3, filter_col4 = st.columns(
    [2.3, 1.4, 1.0, 1.3]
)


with filter_col1:

    search_term = st.text_input(
        "Search",
        placeholder=(
            "Try Shih Tzu, Lucky or ST001..."
        ),
    )


with filter_col2:

    if (
        not inventory.empty
        and "breed" in inventory.columns
    ):

        breed_options = (
            ["All Breeds"]
            +
            sorted(
                inventory["breed"]
                .dropna()
                .astype(str)
                .unique()
                .tolist()
            )
        )

    else:

        breed_options = [
            "All Breeds"
        ]

    breed_filter = st.selectbox(
        "Breed",
        breed_options,
    )


with filter_col3:

    gender_filter = st.selectbox(
        "Gender",
        [
            "All",
            "Male",
            "Female",
        ],
    )


with filter_col4:

    budget_filter = st.selectbox(
        "Budget",
        [
            "Any Budget",
            "Under ₹20,000",
            "Under ₹25,000",
            "Under ₹30,000",
        ],
    )


# =========================================================
# CATEGORY
# =========================================================

render_html(
    """
    <div
        id="categories"
        style="height:1px;"
    ></div>

    <div
        style="
            margin-top:35px;
            margin-bottom:16px;
        "
    >

        <div class="section-label">
            Explore PETORA
        </div>

        <div class="section-title">
            Shop by Category
        </div>

        <div class="section-copy">
            Choose a category to instantly
            filter available listings.
        </div>

    </div>
    """
)


categories = [
    (
        "All",
        "🐾",
        "All Pets",
        "Browse everything",
    ),
    (
        "Dogs",
        "🐶",
        "Dogs",
        "Puppies & companions",
    ),
    (
        "Cats",
        "🐱",
        "Cats",
        "Feline companions",
    ),
    (
        "Aquatics",
        "🐟",
        "Aquatics",
        "Fish & aquatic pets",
    ),
    (
        "Reptiles",
        "🐍",
        "Reptiles",
        "Terrarium pets",
    ),
    (
        "Exotic Pets",
        "🦜",
        "Exotic Pets",
        "Unique companions",
    ),
]


category_columns = st.columns(
    len(categories)
)


for column, (
    category_value,
    icon,
    name,
    description,
) in zip(
    category_columns,
    categories,
):

    with column:

        is_active = (
            st.session_state[
                "selected_category"
            ]
            == category_value
        )

        active_class = (
            "active"
            if is_active
            else ""
        )

        render_html(
            f"""
            <div class="category-card {active_class}">

                <div class="category-icon">
                    {safe_text(icon)}
                </div>

                <div class="category-name">
                    {safe_text(name)}
                </div>

                <div class="category-copy">
                    {safe_text(description)}
                </div>

            </div>
            """
        )

        if st.button(
            f"View {name}",
            key=f"category_{category_value}",
            use_container_width=True,
        ):

            st.session_state[
                "selected_category"
            ] = category_value

            st.session_state[
                "detail_pet_id"
            ] = None

            st.session_state[
                "selected_pet"
            ] = None

            st.rerun()


# =========================================================
# FILTER INVENTORY
# =========================================================

filtered_inventory = inventory.copy()


# Category
selected_category = (
    st.session_state[
        "selected_category"
    ]
)

if (
    selected_category != "All"
    and not filtered_inventory.empty
):

    filtered_inventory = (
        filtered_inventory[
            filtered_inventory[
                "category"
            ]
            .astype(str)
            .str.strip()
            .str.lower()
            ==
            selected_category.lower()
        ]
    )


# Search
if (
    search_term.strip()
    and not filtered_inventory.empty
):

    search_value = (
        search_term
        .strip()
        .lower()
    )

    search_columns = [
        "pet_id",
        "category",
        "breed",
        "name",
        "location",
    ]

    search_mask = pd.Series(
        False,
        index=filtered_inventory.index,
    )

    for column in search_columns:

        search_mask = (
            search_mask
            |
            filtered_inventory[column]
            .astype(str)
            .str.lower()
            .str.contains(
                search_value,
                na=False,
                regex=False,
            )
        )

    filtered_inventory = (
        filtered_inventory[
            search_mask
        ]
    )


# Breed
if (
    breed_filter != "All Breeds"
    and not filtered_inventory.empty
):

    filtered_inventory = (
        filtered_inventory[
            filtered_inventory[
                "breed"
            ]
            .astype(str)
            == breed_filter
        ]
    )


# Gender
if (
    gender_filter != "All"
    and not filtered_inventory.empty
):

    filtered_inventory = (
        filtered_inventory[
            filtered_inventory[
                "gender"
            ]
            .astype(str)
            .str.lower()
            ==
            gender_filter.lower()
        ]
    )


# Budget
if (
    budget_filter != "Any Budget"
    and not filtered_inventory.empty
):

    budget_limits = {
        "Under ₹20,000": 20000,
        "Under ₹25,000": 25000,
        "Under ₹30,000": 30000,
    }

    selected_limit = budget_limits[
        budget_filter
    ]

    numeric_prices = pd.to_numeric(
        filtered_inventory[
            "price"
        ],
        errors="coerce",
    )

    filtered_inventory = (
        filtered_inventory[
            numeric_prices
            <= selected_limit
        ]
    )


# Available only
if not filtered_inventory.empty:

    filtered_inventory = (
        filtered_inventory[
            filtered_inventory[
                "status"
            ]
            .astype(str)
            .str.lower()
            .str.strip()
            ==
            "available"
        ]
    )


# =========================================================
# PET DETAIL VIEW
# =========================================================

detail_pet_id = (
    st.session_state[
        "detail_pet_id"
    ]
)


if detail_pet_id:

    detail_match = inventory[
        inventory[
            "pet_id"
        ]
        .astype(str)
        ==
        str(detail_pet_id)
    ]

    if not detail_match.empty:

        pet = detail_match.iloc[0]

        photo = str(
            pet.get(
                "photo",
                "",
            )
        ).strip()

        photo_path = ""

        if photo:

            if os.path.isabs(
                photo
            ):

                photo_path = photo

            else:

                photo_path = os.path.join(
                    BASE_DIR,
                    photo,
                )

        detail_image = None

        if (
            photo_path
            and os.path.exists(
                photo_path
            )
        ):

            detail_image = prepare_image(
                photo_path
            )


        render_html(
            """
            <div
                id="pet-details"
                style="
                    height:1px;
                    margin-top:25px;
                "
            ></div>

            <div
                style="
                    margin-top:35px;
                    margin-bottom:15px;
                "
            >

                <div class="section-label">
                    Pet Profile
                </div>

                <div class="section-title">
                    Meet Your Match
                </div>

            </div>
            """
        )


        detail_left, detail_right = st.columns(
            [1.08, 1]
        )


        with detail_left:

            if detail_image is not None:

                st.image(
                    detail_image,
                    use_container_width=True,
                )

            else:

                render_html(
                    """
                    <div
                        style="
                            min-height:450px;
                            background:#edf1ea;
                            border-radius:20px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:90px;
                        "
                    >
                        🐾
                    </div>
                    """
                )


        with detail_right:

            render_html(
                f"""
                <div class="detail-shell">

                    <div class="detail-kicker">
                        {safe_text(pet["category"])}
                    </div>

                    <div class="detail-title">
                        {safe_text(pet["breed"])}
                    </div>

                    <div class="detail-subtitle">
                        {safe_text(pet["name"])}
                        · ID {safe_text(pet["pet_id"])}
                    </div>

                    <div class="detail-price">
                        {format_price(pet["price"])}
                    </div>

                    <div class="detail-grid">

                        <div class="detail-stat">

                            <div class="detail-stat-label">
                                Gender
                            </div>

                            <div class="detail-stat-value">
                                {safe_text(pet["gender"])}
                            </div>

                        </div>


                        <div class="detail-stat">

                            <div class="detail-stat-label">
                                Age
                            </div>

                            <div class="detail-stat-value">
                                {safe_text(pet["age"])}
                            </div>

                        </div>


                        <div class="detail-stat">

                            <div class="detail-stat-label">
                                Vaccination
                            </div>

                            <div class="detail-stat-value">
                                {safe_text(pet["vaccinated"])}
                            </div>

                        </div>


                        <div class="detail-stat">

                            <div class="detail-stat-label">
                                Location
                            </div>

                            <div class="detail-stat-value">
                                {safe_text(pet["location"])}
                            </div>

                        </div>

                    </div>


                    <div class="detail-description">

                        A {safe_text(pet["breed"])}
                        named {safe_text(pet["name"])}
                        is listed in the PETORA marketplace.

                        <br><br>

                        Please contact PETORA to confirm
                        current availability and the latest
                        listing details before making a decision.

                    </div>

                </div>
                """
            )


            if st.button(
                "❤️ Enquire About This Pet",
                key="detail_enquire",
                use_container_width=True,
            ):

                st.session_state[
                    "selected_pet"
                ] = str(
                    pet["pet_id"]
                )

                st.session_state[
                    "selected_breed"
                ] = str(
                    pet["breed"]
                )

                st.session_state[
                    "detail_pet_id"
                ] = None

                st.rerun()


            if st.button(
                "✕ Close Details",
                key="close_details",
                use_container_width=True,
            ):

                st.session_state[
                    "detail_pet_id"
                ] = None

                st.rerun()


# =========================================================
# FEATURED LISTINGS
# =========================================================

category_label = (
    "All Pets"
    if selected_category == "All"
    else selected_category
)


render_html(
    f"""
    <div
        id="featured-pets"
        style="
            height:1px;
            margin-top:25px;
        "
    ></div>

    <div
        style="
            display:flex;
            align-items:end;
            justify-content:space-between;
            gap:20px;
            margin-bottom:18px;
        "
    >

        <div>

            <div class="section-label">
                Featured Listings
            </div>

            <div class="section-title">
                {safe_text(category_label)}
            </div>

            <div class="section-copy">
                Available pets matching your filters.
            </div>

        </div>

        <div
            style="
                background:#edf5ec;
                color:#155039;
                padding:9px 14px;
                border-radius:999px;
                font-size:12px;
                font-weight:800;
            "
        >
            {len(filtered_inventory)} Available
        </div>

    </div>
    """
)


render_pet_cards(
    filtered_inventory,
    prefix="featured",
)


# =========================================================
# AI ASSISTANT
# =========================================================

render_html(
    """
    <div
        id="ai-assistant"
        style="
            height:1px;
            margin-top:40px;
        "
    ></div>
    """
)


ai_left, ai_right = st.columns(
    [1,1.55]
)


with ai_left:

    render_html(
        """
        <div class="ai-panel">

            <div class="ai-badge">
                PETORA INTELLIGENCE
            </div>

            <div class="ai-title">
                Meet PETORA AI
            </div>

            <div class="ai-copy">
                Search our real inventory using
                normal language. PETORA can understand
                breed, gender, budget, location and
                category preferences.
            </div>

            <br>

            <div
                style="
                    color:white;
                    font-size:13px;
                    line-height:1.9;
                "
            >

                <strong>
                    Try:
                </strong>

                <br>

                • Show female Shih Tzu under ₹20,000

                <br>

                • Find German Shepherds in Patna

                <br>

                • Show dogs under ₹25,000

                <br>

                • What does PETORA offer?

            </div>

        </div>
        """
    )


with ai_right:

    st.subheader(
        "🤖 Ask PETORA AI"
    )


    smart_question = st.text_input(
        "Smart Search",
        placeholder=(
            "Example: Show female Shih Tzu under ₹20,000 in Patna"
        ),
        key="smart_search_question",
    )


    smart_search_button = st.button(
        "🔎 Search with PETORA AI",
        use_container_width=True,
        key="smart_search_button",
    )


    if smart_search_button:

        if not smart_question.strip():

            st.warning(
                "Please describe the pet you are looking for."
            )

        else:

            smart_results = (
                smart_search_inventory(
                    smart_question,
                    inventory,
                )
            )


            if not smart_results.empty:

                render_html(
                    f"""
                    <div class="smart-result">

                        <strong>
                            🔎 PETORA found
                            {len(smart_results)}
                            matching pet(s).
                        </strong>

                        <br>

                        Showing real inventory
                        matching your request.

                    </div>
                    """
                )

                render_pet_cards(
                    smart_results,
                    prefix="smart",
                )


            else:

                st.warning(
                    "I couldn't find a matching pet "
                    "in the current inventory."
                )

                st.markdown(
                    "You can try a different breed, "
                    "gender, location or budget."
                )


    # -----------------------------------------------------
    # GENERAL AI QUESTION
    # -----------------------------------------------------

    st.markdown(
        "<hr>",
        unsafe_allow_html=True,
    )

    st.subheader(
        "💬 Ask a General Question"
    )


    general_question = st.text_input(
        "Your Question",
        placeholder=(
            "Ask about breeds, pet care or PETORA..."
        ),
        key="general_question",
    )


    general_button = st.button(
        "Ask PETORA AI",
        use_container_width=True,
        key="general_ai_button",
    )


    if general_button:

        if not general_question.strip():

            st.warning(
                "Please enter a question."
            )

        else:

            # Exact pet ID lookup
            matched_pet = None

            question_lower = (
                general_question.lower()
            )


            if not inventory.empty:

                for _, pet in inventory.iterrows():

                    current_id = (
                        str(
                            pet["pet_id"]
                        )
                        .lower()
                        .strip()
                    )

                    if (
                        current_id
                        and current_id
                        in question_lower
                    ):

                        matched_pet = pet

                        break


            if matched_pet is not None:

                answer = (
                    f"**{matched_pet['breed']}** "
                    f"({matched_pet['pet_id']}) "
                    f"is currently "
                    f"**{matched_pet['status']}**.\n\n"

                    f"Name: "
                    f"**{matched_pet['name']}**\n\n"

                    f"Price: "
                    f"**{format_price(matched_pet['price'])}**\n\n"

                    f"Gender: "
                    f"**{matched_pet['gender']}**\n\n"

                    f"Age: "
                    f"**{matched_pet['age']}**\n\n"

                    f"Category: "
                    f"**{matched_pet['category']}**\n\n"

                    f"Location: "
                    f"**{matched_pet['location']}**\n\n"

                    f"Vaccinated: "
                    f"**{matched_pet['vaccinated']}**"
                )

            else:

                context = rag_search(
                    general_question
                )

                answer = ask_ai(
                    general_question,
                    context,
                )


            st.markdown(
                "### PETORA AI"
            )

            st.markdown(
                answer
            )


# =========================================================
# ENQUIRY FORM
# =========================================================

if st.session_state.get(
    "selected_pet"
):

    selected_pet_id = (
        st.session_state[
            "selected_pet"
        ]
    )

    selected_breed = (
        st.session_state[
            "selected_breed"
        ]
    )


    render_html(
        """
        <div
            style="
                margin-top:40px;
                margin-bottom:15px;
            "
        >

            <div class="section-label">
                Enquiry
            </div>

            <div class="section-title">
                Tell Us You're Interested
            </div>

        </div>
        """
    )


    st.info(
        f"You are enquiring about "
        f"{selected_breed} "
        f"({selected_pet_id})."
    )


    with st.form(
        "enquiry_form"
    ):

        form_col1, form_col2 = st.columns(
            2
        )


        with form_col1:

            customer_name = st.text_input(
                "Your Name"
            )


        with form_col2:

            customer_phone = st.text_input(
                "Phone Number"
            )


        customer_message = st.text_area(
            "Message",
            placeholder=(
                "Tell us what you would like to know..."
            ),
        )


        submitted = (
            st.form_submit_button(
                "Send Enquiry",
                use_container_width=True,
            )
        )


        if submitted:

            clean_name = (
                customer_name.strip()
            )

            clean_phone = (
                customer_phone.strip()
            )

            clean_message = (
                customer_message.strip()
            )


            if not clean_name:

                st.error(
                    "Please enter your name."
                )

            elif not clean_phone:

                st.error(
                    "Please enter your phone number."
                )

            else:

                save_enquiry(
                    clean_name,
                    clean_phone,
                    selected_pet_id,
                    selected_breed,
                    clean_message,
                )

                st.success(
                    "Your enquiry has been submitted "
                    "successfully. PETORA will contact "
                    "you soon."
                )


# =========================================================
# TRUST BAR
# =========================================================

render_html(
    """
    <div class="trust-bar">

        <div class="trust-item">

            <div class="trust-icon">
                ✅
            </div>

            <div class="trust-title">
                Clear Listings
            </div>

            <div class="trust-copy">
                Simple pet information
            </div>

        </div>


        <div class="trust-item">

            <div class="trust-icon">
                💉
            </div>

            <div class="trust-title">
                Vaccination Info
            </div>

            <div class="trust-copy">
                Details shown on listings
            </div>

        </div>


        <div class="trust-item">

            <div class="trust-icon">
                📍
            </div>

            <div class="trust-title">
                Local Discovery
            </div>

            <div class="trust-copy">
                Starting with Patna
            </div>

        </div>


        <div class="trust-item">

            <div class="trust-icon">
                🤖
            </div>

            <div class="trust-title">
                AI Assistance
            </div>

            <div class="trust-copy">
                Smarter pet discovery
            </div>

        </div>

    </div>
    """
)


# =========================================================
# FOOTER
# =========================================================

render_html(
    """
    <div
        id="about"
        style="height:1px;"
    ></div>

    <div class="footer-box">

        <div class="footer-brand">
            PETORA
        </div>

        <div class="footer-copy">

            <strong>
                Pets Beyond Borders
            </strong>

            <br>

            Different Pets. Same Love.

            <br><br>

            PETORA is being designed as
            a modern pet discovery platform
            where customers can explore pets,
            compare listings and connect
            through an AI-assisted experience.

        </div>

        <div class="footer-bottom">
            © 2026 PETORA. All rights reserved.
        </div>

    </div>
    """
)