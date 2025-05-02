import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "IKEA",
        "Ashley Furniture",
        "Herman Miller",
        "West Elm",
        "Pottery Barn",
        "Crate & Barrel",
        "La-Z-Boy",
        "Ethan Allen",
        "Raymour & Flanigan",
        "Rooms To Go",
        "Wayfair",
        "Article",
        "AllModern",
        "Burrow",
        "Floyd",
        "Joybird",
        "Muji",
        "BoConcept",
        "Natuzzi",
        "Roche Bobois",
        "WoodenStreet"
      ]
    },
    brandTitle: {
      type: String,
      required: false,
    },
    logo: { 
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    countryOfOrigin: {
      type: String,
      required: true,
    },
    yearEstablished: {
      type: Number,
      required: true,
    },
    specialties: [{
      type: String,
      enum: [
        "Modern",
        "Contemporary",
        "Traditional",
        "Industrial",
        "Scandinavian",
        "Mid-Century Modern",
        "Rustic",
        "Minimalist",
        "Luxury",
        "Sustainable",
        "Bohemian",
        "Coastal",
        "Custom Furniture"
      ]
    }],
    status: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

const Brands = mongoose.model("Brands", brandSchema);
export default Brands;
