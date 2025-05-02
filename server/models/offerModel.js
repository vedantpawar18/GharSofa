import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    offerType: {
      type: String,
      enum: ["Category", "Products"],
      required: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 99,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
    },
    targetOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'offerType',
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;