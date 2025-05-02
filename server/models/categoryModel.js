import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "Sofas & Couches",
        "Coffee Tables",
        "TV Stands",
        "Accent Chairs",
        "Side Tables",
        "Beds & Mattresses",
        "Dressers",
        "Nightstands",
        "Wardrobes",
        "Vanities",
        "Dining Tables",
        "Dining Chairs",
        "Buffets & Sideboards",
        "Bar Stools",
        "Wine Racks",
        "Desks",
        "Office Chairs",
        "Bookcases",
        "Filing Cabinets",
        "Desk Lamps",
        "Kitchen Islands",
        "Bar Carts",
        "Kitchen Storage",
        "Breakfast Nooks",
        "Bathroom Vanities",
        "Storage Cabinets",
        "Mirrors",
        "Shower Benches",
        "Patio Sets",
        "Outdoor Chairs",
        "Garden Benches",
        "Outdoor Tables",
        "Hammocks",
        "Kids Beds",
        "Study Tables",
        "Storage Units",
        "Play Tables",
        "Bean Bags",
        "Shelving Units",
        "Shoe Racks",
        "Wall Shelves",
        "Coat Racks",
        "Console Tables",
        "Hall Trees",
        "Benches",
        "Key Holders",
        "Umbrella Stands"
      ]
    },
    description: {
      type: String,
      required: false,
    },
    status: {
      type: Boolean, 
      default: true,
    },
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
  },
  {
    timestamps: true,
  }
);

const Category = mongoose.model("Category", categorySchema);
export default Category;
