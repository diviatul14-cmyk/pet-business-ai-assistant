import os
import pandas as pd
import streamlit as st


# --------------------------------------------------
# PAGE SETTINGS
# --------------------------------------------------

st.set_page_config(
    page_title="Pet Business Analytics",
    page_icon="📊",
    layout="wide"
)

st.title("📊 Pet Business Analytics Dashboard")
st.caption(
    "Sales, Puppy Inventory and Customer Enquiry Analytics"
)


# --------------------------------------------------
# FILE PATHS
# --------------------------------------------------

PUPPY_FILE = "data/puppies.csv"
ENQUIRY_FILE = "data/enquiries.csv"


# --------------------------------------------------
# LOAD PUPPY INVENTORY
# --------------------------------------------------

try:
    puppies = pd.read_csv(PUPPY_FILE)
except FileNotFoundError:
    st.error("puppies.csv was not found inside the data folder.")
    st.stop()


# --------------------------------------------------
# LOAD ENQUIRIES
# --------------------------------------------------

if os.path.exists(ENQUIRY_FILE):

    enquiries = pd.read_csv(ENQUIRY_FILE)

else:

    enquiries = pd.DataFrame(
        columns=[
            "date",
            "name",
            "phone",
            "puppy_id",
            "breed",
            "message",
            "status"
        ]
    )


# --------------------------------------------------
# MAKE SURE REQUIRED COLUMNS EXIST
# --------------------------------------------------

required_puppy_columns = [
    "puppy_id",
    "breed",
    "gender",
    "age_weeks",
    "price",
    "status",
    "vaccinated",
    "location"
]

required_enquiry_columns = [
    "date",
    "name",
    "phone",
    "puppy_id",
    "breed",
    "message",
    "status"
]


for column in required_puppy_columns:

    if column not in puppies.columns:
        puppies[column] = ""


for column in required_enquiry_columns:

    if column not in enquiries.columns:
        enquiries[column] = ""


# --------------------------------------------------
# CLEAN PUPPY DATA
# --------------------------------------------------

puppies["price"] = pd.to_numeric(
    puppies["price"],
    errors="coerce"
)

puppies["age_weeks"] = pd.to_numeric(
    puppies["age_weeks"],
    errors="coerce"
)

puppies["status"] = (
    puppies["status"]
    .fillna("")
    .astype(str)
    .str.strip()
)

puppies["breed"] = (
    puppies["breed"]
    .fillna("")
    .astype(str)
    .str.strip()
)


# --------------------------------------------------
# CLEAN ENQUIRY DATA
# --------------------------------------------------

enquiries["status"] = (
    enquiries["status"]
    .fillna("")
    .astype(str)
    .str.strip()
)

enquiries["breed"] = (
    enquiries["breed"]
    .fillna("")
    .astype(str)
    .str.strip()
)

enquiries["puppy_id"] = (
    enquiries["puppy_id"]
    .fillna("")
    .astype(str)
    .str.strip()
)

enquiries["phone"] = (
    enquiries["phone"]
    .fillna("")
    .astype(str)
    .str.strip()
)

enquiries["date"] = pd.to_datetime(
    enquiries["date"],
    errors="coerce"
)


# --------------------------------------------------
# BASIC COUNTS
# --------------------------------------------------

total_puppies = len(puppies)

available_puppies = (
    puppies["status"]
    .str.lower()
    .eq("available")
    .sum()
)

sold_puppies = (
    puppies["status"]
    .str.lower()
    .eq("sold")
    .sum()
)

total_enquiries = len(enquiries)

new_enquiries = (
    enquiries["status"]
    .str.lower()
    .eq("new")
    .sum()
)

contacted_enquiries = (
    enquiries["status"]
    .str.lower()
    .eq("contacted")
    .sum()
)

unique_customers = (
    enquiries.loc[
        enquiries["phone"] != "",
        "phone"
    ]
    .nunique()
)


# --------------------------------------------------
# INVENTORY VALUE
# --------------------------------------------------

available_mask = (
    puppies["status"]
    .str.lower()
    .eq("available")
)

inventory_value = (
    puppies.loc[
        available_mask,
        "price"
    ]
    .fillna(0)
    .sum()
)


# --------------------------------------------------
# AVERAGE PRICE
# --------------------------------------------------

average_price = puppies["price"].mean()

if pd.isna(average_price):
    average_price = 0


# --------------------------------------------------
# SELL-THROUGH RATE
# --------------------------------------------------

if total_puppies > 0:

    sell_through_rate = (
        sold_puppies / total_puppies
    ) * 100

else:

    sell_through_rate = 0


# --------------------------------------------------
# MOST ENQUIRED BREED
# --------------------------------------------------

breed_counts = (
    enquiries["breed"]
    .replace("", pd.NA)
    .dropna()
    .value_counts()
)

if len(breed_counts) > 0:

    top_breed = breed_counts.idxmax()

else:

    top_breed = "N/A"


# --------------------------------------------------
# MOST ENQUIRED PUPPY
# --------------------------------------------------

puppy_counts = (
    enquiries["puppy_id"]
    .replace("", pd.NA)
    .dropna()
    .value_counts()
)

if len(puppy_counts) > 0:

    top_puppy = puppy_counts.idxmax()

else:

    top_puppy = "N/A"


# --------------------------------------------------
# FIRST KPI ROW
# --------------------------------------------------

col1, col2, col3, col4 = st.columns(4)


with col1:

    st.metric(
        "Available Puppies",
        available_puppies
    )


with col2:

    st.metric(
        "Inventory Value",
        f"₹{inventory_value:,.0f}"
    )


with col3:

    st.metric(
        "Average Puppy Price",
        f"₹{average_price:,.0f}"
    )


with col4:

    st.metric(
        "Total Enquiries",
        total_enquiries
    )


# --------------------------------------------------
# SECOND KPI ROW
# --------------------------------------------------

col5, col6, col7, col8 = st.columns(4)


with col5:

    st.metric(
        "New Enquiries",
        new_enquiries
    )


with col6:

    st.metric(
        "Unique Customers",
        unique_customers
    )


with col7:

    st.metric(
        "Most Enquired Breed",
        top_breed
    )


with col8:

    st.metric(
        "Sell-Through Rate",
        f"{sell_through_rate:.1f}%"
    )


st.divider()


# --------------------------------------------------
# AVAILABLE PUPPIES BY BREED
# --------------------------------------------------

st.subheader("🐾 Available Puppies by Breed")


available_data = puppies[
    puppies["status"]
    .str.lower()
    .eq("available")
]


available_by_breed = (
    available_data["breed"]
    .replace("", pd.NA)
    .dropna()
    .value_counts()
)


if len(available_by_breed) > 0:

    st.bar_chart(
        available_by_breed
    )

else:

    st.info(
        "No available puppies found."
    )


# --------------------------------------------------
# ENQUIRIES BY BREED
# --------------------------------------------------

st.subheader("📩 Enquiries by Breed")


if len(breed_counts) > 0:

    st.bar_chart(
        breed_counts
    )

else:

    st.info(
        "No enquiry data available."
    )


# --------------------------------------------------
# ENQUIRIES BY STATUS
# --------------------------------------------------

st.subheader("📌 Enquiries by Status")


status_counts = (
    enquiries["status"]
    .replace("", "Unknown")
    .value_counts()
)


if len(status_counts) > 0:

    st.bar_chart(
        status_counts
    )

else:

    st.info(
        "No status data available."
    )


# --------------------------------------------------
# ENQUIRIES BY PUPPY
# --------------------------------------------------

st.subheader("🐶 Enquiries by Puppy")


if len(puppy_counts) > 0:

    st.bar_chart(
        puppy_counts
    )

else:

    st.info(
        "No puppy enquiry data available."
    )


# --------------------------------------------------
# AVERAGE PRICE BY BREED
# --------------------------------------------------

st.subheader("💰 Average Price by Breed")


price_by_breed = (
    puppies
    .groupby("breed")["price"]
    .mean()
    .sort_values(ascending=False)
)


if len(price_by_breed) > 0:

    st.bar_chart(
        price_by_breed
    )

else:

    st.info(
        "No price data available."
    )


# --------------------------------------------------
# PUPPY INVENTORY TABLE
# --------------------------------------------------

st.subheader("🐾 Puppy Inventory")


st.dataframe(
    puppies,
    width="stretch",
    hide_index=True
)


# --------------------------------------------------
# CUSTOMER ENQUIRY TABLE
# --------------------------------------------------

st.subheader("📞 Customer Enquiries")


if len(enquiries) > 0:

    display_enquiries = enquiries.sort_values(
        "date",
        ascending=False
    )

    st.dataframe(
        display_enquiries,
        width="stretch",
        hide_index=True
    )

else:

    st.info(
        "No customer enquiries recorded yet."
    )


# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

st.divider()

st.subheader("📈 Business Summary")

st.write(
    f"""
    There are **{available_puppies} available puppies**
    out of **{total_puppies} total puppies**.

    The current available inventory is valued at
    **₹{inventory_value:,.0f}**.

    The business has received **{total_enquiries} enquiries**
    from **{unique_customers} unique customers**.

    The most enquired breed is **{top_breed}**.

    The current sell-through rate is
    **{sell_through_rate:.1f}%**.
    """
)