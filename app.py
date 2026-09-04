import os
import re
from datetime import datetime

import pandas as pd
import streamlit as st
from PIL import Image, ImageOps
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from huggingface_hub import InferenceClient


# ==================================================
# PAGE CONFIG
# ==================================================

st.set_page_config(
    page_title="Pet Business AI Assistant",
    page_icon="🐶",
    layout="wide"
)


# ==================================================
# PATHS
# ==================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

PUPPY_FILE = os.path.join(
    DATA_DIR,
    "puppies.csv"
)

KNOWLEDGE_FILE = os.path.join(
    DATA_DIR,
    "info.text"
)

ENQUIRY_FILE = os.path.join(
    DATA_DIR,
    "enquiries.csv"
)


# ==================================================
# HEADER
# ==================================================

st.title("🐶 Pet Business AI Assistant")

st.caption(
    "Find puppies, check availability, ask questions "
    "and send an enquiry."
)


# ==================================================
# HUGGING FACE CLIENT
# ==================================================

try:

    HF_TOKEN = st.secrets["HF_TOKEN"]

    hf_client = InferenceClient(
        api_key=HF_TOKEN,
        provider="auto"
    )

except Exception:

    HF_TOKEN = None
    hf_client = None


# ==================================================
# EMBEDDING MODEL
# ==================================================

@st.cache_resource
def load_embedding_model():

    return SentenceTransformer(
        "all-MiniLM-L6-v2"
    )


model = load_embedding_model()


# ==================================================
# KNOWLEDGE BASE
# ==================================================

@st.cache_data
def load_knowledge():

    if not os.path.exists(KNOWLEDGE_FILE):
        return []

    with open(
        KNOWLEDGE_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        content = f.read()

    chunks = [
        chunk.strip()
        for chunk in content.split(".")
        if chunk.strip()
    ]

    return chunks


chunks = load_knowledge()


if chunks:

    knowledge_embeddings = model.encode(
        chunks
    )

else:

    knowledge_embeddings = None


# ==================================================
# LOAD INVENTORY
# ==================================================

@st.cache_data
def load_inventory():

    if not os.path.exists(PUPPY_FILE):
        return pd.DataFrame()

    return pd.read_csv(
        PUPPY_FILE
    )


inventory = load_inventory()


if inventory.empty:

    st.error(
        "data/puppies.csv is missing or empty."
    )

    st.stop()


# ==================================================
# ENSURE COLUMNS
# ==================================================

required_columns = [
    "puppy_id",
    "breed",
    "gender",
    "age_weeks",
    "price",
    "status",
    "vaccinated",
    "location",
    "photo"
]


for column in required_columns:

    if column not in inventory.columns:

        inventory[column] = ""


# ==================================================
# CLEAN INVENTORY
# ==================================================

for column in [
    "puppy_id",
    "breed",
    "gender",
    "status",
    "vaccinated",
    "location",
    "photo"
]:

    inventory[column] = (
        inventory[column]
        .fillna("")
        .astype(str)
        .str.strip()
    )


inventory["price"] = pd.to_numeric(
    inventory["price"],
    errors="coerce"
).fillna(0)


inventory["age_weeks"] = pd.to_numeric(
    inventory["age_weeks"],
    errors="coerce"
).fillna(0)


# ==================================================
# ENQUIRY FILE
# ==================================================

def ensure_enquiry_file():

    if not os.path.exists(ENQUIRY_FILE):

        pd.DataFrame(
            columns=[
                "date",
                "name",
                "phone",
                "puppy_id",
                "breed",
                "message",
                "status"
            ]
        ).to_csv(
            ENQUIRY_FILE,
            index=False
        )


ensure_enquiry_file()


# ==================================================
# SAVE ENQUIRY
# ==================================================

def save_enquiry(
    name,
    phone,
    puppy_id,
    breed,
    message
):

    new_row = pd.DataFrame(
        [
            {
                "date": datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "name": name,
                "phone": phone,
                "puppy_id": puppy_id,
                "breed": breed,
                "message": message,
                "status": "New"
            }
        ]
    )

    new_row.to_csv(
        ENQUIRY_FILE,
        mode="a",
        header=False,
        index=False
    )


# ==================================================
# FIND PUPPY ID
# ==================================================

def find_puppy_id(text):

    match = re.search(
        r"\b[A-Za-z]{2}\d{3}\b",
        text
    )

    if match:

        return match.group(0).upper()

    return ""


# ==================================================
# FIND PUPPY
# ==================================================

def find_puppy(puppy_id):

    if not puppy_id:
        return None

    matches = inventory[
        inventory["puppy_id"]
        .str.upper()
        .eq(
            puppy_id.upper()
        )
    ]

    if len(matches) > 0:

        return matches.iloc[0]

    return None


# ==================================================
# BUYING INTENT
# ==================================================

def detect_buying_intent(text):

    keywords = [
        "interested",
        "buy",
        "buying",
        "purchase",
        "book",
        "booking",
        "reserve",
        "reservation",
        "want this puppy",
        "want to buy",
        "i want",
        "i would like"
    ]

    text = text.lower()

    return any(
        keyword in text
        for keyword in keywords
    )


# ==================================================
# SESSION STATE
# ==================================================

if "messages" not in st.session_state:

    st.session_state.messages = []


if "lead_request" not in st.session_state:

    st.session_state.lead_request = None


# ==================================================
# AVAILABLE PUPPIES
# ==================================================

st.subheader(
    "🐾 Available Puppies"
)


available = inventory[
    inventory["status"]
    .str.lower()
    .eq("available")
].copy()


if len(available) == 0:

    st.info(
        "No puppies are currently available."
    )

else:

    columns = st.columns(3)

    for i, (_, puppy) in enumerate(
        available.iterrows()
    ):

        with columns[i % 3]:

            # ------------------------------------------
            # IMAGE
            # ------------------------------------------

            photo_name = str(
                puppy["photo"]
            ).strip()

            if (
                photo_name
                and photo_name.lower() != "nan"
            ):

                photo_name = photo_name.lstrip(
                    "/"
                )

                image_path = os.path.join(
                    BASE_DIR,
                    photo_name
                )

            else:

                image_path = ""


            if (
                image_path
                and os.path.isfile(image_path)
            ):

                try:

                    image = Image.open(
                        image_path
                    ).convert("RGB")

                    # Identical image dimensions
                    image = ImageOps.fit(
                        image,
                        (600, 450),
                        method=Image.Resampling.LANCZOS,
                        centering=(0.5, 0.5)
                    )

                    st.image(
                        image,
                        width="stretch"
                    )

                except Exception:

                    st.warning(
                        "Could not load image."
                    )

            else:

                placeholder = Image.new(
                    "RGB",
                    (600, 450),
                    "lightgray"
                )

                st.image(
                    placeholder,
                    width="stretch"
                )


            # ------------------------------------------
            # DETAILS
            # ------------------------------------------

            st.subheader(
                f"🐶 {puppy['breed']}"
            )

            st.write(
                f"**Puppy ID:** {puppy['puppy_id']}"
            )

            st.write(
                f"**Gender:** {puppy['gender']}"
            )

            st.write(
                f"**Age:** "
                f"{int(puppy['age_weeks'])} weeks"
            )

            st.markdown(
                f"### ₹{puppy['price']:,.0f}"
            )

            st.success(
                "✅ Available"
            )

            st.write(
                f"Vaccinated: "
                f"{puppy['vaccinated']}"
            )

            st.write(
                f"Location: "
                f"{puppy['location']}"
            )


            # ------------------------------------------
            # INTEREST BUTTON
            # ------------------------------------------

            if st.button(
                "📞 I'm Interested",
                key=(
                    f"interest_"
                    f"{puppy['puppy_id']}"
                )
            ):

                st.session_state.lead_request = {
                    "puppy_id": str(
                        puppy["puppy_id"]
                    ),
                    "message": (
                        "Customer is interested in "
                        f"{puppy['puppy_id']}"
                    )
                }

                st.rerun()


st.divider()


# ==================================================
# DISPLAY CHAT HISTORY
# ==================================================

for message in st.session_state.messages:

    with st.chat_message(
        message["role"]
    ):

        st.markdown(
            message["content"]
        )


# ==================================================
# CHAT INPUT
# ==================================================

query = st.chat_input(
    "Ask about puppies, prices or availability..."
)


if query:

    st.session_state.messages.append(
        {
            "role": "user",
            "content": query
        }
    )


    with st.chat_message("user"):

        st.write(query)


    # ----------------------------------------------
    # EXACT PUPPY ID
    # ----------------------------------------------

    puppy_id = find_puppy_id(
        query
    )

    puppy = find_puppy(
        puppy_id
    )


    # ----------------------------------------------
    # BUYING INTENT
    # ----------------------------------------------

    if detect_buying_intent(query):

        st.session_state.lead_request = {
            "puppy_id": puppy_id,
            "message": query
        }


    # ----------------------------------------------
    # EXACT INVENTORY RESPONSE
    # ----------------------------------------------

    if puppy_id and puppy is not None:

        status = str(
            puppy["status"]
        )

        if status.lower() == "available":

            answer = (
                f"**{puppy_id} is available.**\n\n"
                f"Breed: {puppy['breed']}\n\n"
                f"Gender: {puppy['gender']}\n\n"
                f"Age: {int(puppy['age_weeks'])} weeks\n\n"
                f"Price: ₹{puppy['price']:,.0f}\n\n"
                f"Vaccinated: {puppy['vaccinated']}\n\n"
                f"Location: {puppy['location']}"
            )

        else:

            answer = (
                f"**{puppy_id}** is currently "
                f"{status.lower()}."
            )


        with st.chat_message(
            "assistant"
        ):

            st.markdown(
                answer
            )


        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": answer
            }
        )


    else:

        # ------------------------------------------
        # BUILD RAG CONTEXT
        # ------------------------------------------

        inventory_keywords = [
            "price",
            "puppy",
            "puppies",
            "available",
            "availability",
            "breed",
            "male",
            "female",
            "vaccinated",
            "sold",
            "age",
            "inventory",
            "location"
        ]


        if any(
            word in query.lower()
            for word in inventory_keywords
        ):

            context = (
                "Current puppy inventory:\n\n"
                + inventory.to_string(
                    index=False
                )
            )

        elif knowledge_embeddings is not None:

            query_embedding = model.encode(
                [query]
            )

            similarities = cosine_similarity(
                query_embedding,
                knowledge_embeddings
            )[0]

            top_indices = similarities.argsort()[
                -3:
            ][::-1]

            context = "\n".join(
                chunks[index]
                for index in top_indices
            )

        else:

            context = ""


        # ------------------------------------------
        # HUGGING FACE CHAT
        # ------------------------------------------

        if hf_client is None:

            answer = (
                "The AI service is not configured. "
                "Please check the HF_TOKEN secret "
                "in Streamlit."
            )

        else:

            try:

                completion = (
                    hf_client.chat.completions.create(
                        model=(
                            "Qwen/"
                            "Qwen2.5-7B-Instruct-1M"
                        ),
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You are a helpful "
                                    "pet business assistant. "
                                    "Use ONLY the provided "
                                    "context. "
                                    "Never invent prices, "
                                    "availability, ages, "
                                    "breeds, vaccination "
                                    "information or other "
                                    "business facts. "
                                    "If the answer is not "
                                    "in the context, say: "
                                    "'I don't know based on "
                                    "the available information.'"
                                )
                            },
                            {
                                "role": "user",
                                "content": f"""
Context:

{context}

Question:

{query}
"""
                            }
                        ],
                        max_tokens=300,
                        temperature=0.2
                    )
                )

                answer = (
                    completion.choices[0]
                    .message
                    .content
                )

            except Exception as error:

                answer = (
                    "Sorry, the cloud AI service "
                    "could not answer right now.\n\n"
                    f"Error: {error}"
                )


        with st.chat_message(
            "assistant"
        ):

            st.markdown(
                answer
            )


        st.session_state.messages.append(
            {
                "role": "assistant",
                "content": answer
            }
        )


# ==================================================
# LEAD CAPTURE FORM
# ==================================================

if st.session_state.lead_request:

    st.divider()

    st.subheader(
        "📞 Interested in This Puppy?"
    )


    puppy_id = (
        st.session_state.lead_request[
            "puppy_id"
        ]
    )

    original_message = (
        st.session_state.lead_request[
            "message"
        ]
    )

    puppy = find_puppy(
        puppy_id
    )


    if puppy is not None:

        breed = str(
            puppy["breed"]
        )

        st.write(
            f"Enquiry for **{puppy_id} "
            f"({breed})**"
        )

    else:

        breed = ""

        st.write(
            "Please tell us which puppy "
            "you are interested in."
        )


    with st.form(
        "lead_capture_form"
    ):

        customer_name = st.text_input(
            "Your Name"
        )

        customer_phone = st.text_input(
            "Phone Number"
        )

        submitted = st.form_submit_button(
            "Submit Enquiry"
        )


        if submitted:

            if not customer_name.strip():

                st.error(
                    "Please enter your name."
                )

            elif not customer_phone.strip():

                st.error(
                    "Please enter your phone number."
                )

            else:

                save_enquiry(
                    customer_name.strip(),
                    customer_phone.strip(),
                    puppy_id,
                    breed,
                    original_message
                )

                st.success(
                    "✅ Your enquiry has been submitted!"
                )

                st.session_state.lead_request = None

                st.rerun()