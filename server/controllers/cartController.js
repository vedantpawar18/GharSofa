import Cart from "../models/cartModel.js";
import Products from "../models/productModel.js";
import { calculateOfferPrice } from "../utils/calculateOfferPrice.js";

const addToCart = async (req, res) => {
  try {
    const {productId, quantity, color, material, assemblyRequired} = req.body;
    const userId = req.user.id;
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(400).json({message: "Product not found"});
    }
    if (product.stock < quantity) {
      return res.status(400).json({message: "Insufficient stock"});
    }

    let cart = await Cart.findOne({user: userId});

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{productId, quantity, color, material, assemblyRequired}],
      });
    } else {
      const existingItem = cart.items.find(
        (item) => 
          item.productId.toString() === productId && 
          item.color === color && 
          item.material === material &&
          item.assemblyRequired === assemblyRequired
      );
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({productId, quantity, color, material, assemblyRequired});
      }
    }
    await cart.save();
    return res.status(200).json({message: "Added to Cart", cart});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to add to cart"});
  }
};

const getCartDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({user: userId}).populate({
      path: "items.productId",
      populate: [
        {path: "brand"},
        {path: "offer"},
        {
          path: "category",
          model: "Category",
          populate: {
            path: "offer",
            model: "Offer",
          },
        },
      ],
    });
    if (!cart) {
      return res.status(400).json({message: "Cart items not found"});
    }

    const results = cart?.items?.map((product) => {
      const productOffer = product?.productId?.offer?.discountPercentage || 0;
      const categoryOffer = product?.productId?.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product?.productId?.offer?.endDate || product?.productId?.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product?.productId?.salePrice,
        productOffer, 
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res.status(200).json({cart: {
      ...cart.toObject(),
      items: results, 
    }});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const updateCart = async (req, res) => {
  try {
    const {productId} = req.params;
    const {color, material, assemblyRequired, quantity} = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({user: userId});
    if (!cart) {
      return res.status(404).json({message: "Cart not found"});
    }

    const itemIndex = cart.items.findIndex(
      (item) => 
        item.productId.toString() === productId && 
        item.color === color && 
        item.material === material &&
        item.assemblyRequired === assemblyRequired
    );

    if (itemIndex > -1) {
      if (quantity !== undefined) {
        cart.items[itemIndex].quantity = Math.max(1, Number(quantity));
      }
    } else {
      cart.items.push({
        productId,
        color,
        material,
        assemblyRequired,
        quantity: Math.max(1, Number(quantity)),
      });
    }

    await cart.save();

    await cart.populate({
      path: "items.productId",
      populate: [
        {path: "brand"},
        {path: "offer"},
        {
          path: "category",
          model: "Category",
          populate: {
            path: "offer",
            model: "Offer",
          },
        },
      ],
    });

    const results = cart?.items?.map((product) => {
      const productOffer = product?.productId?.offer?.discountPercentage || 0;
      const categoryOffer = product?.productId?.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product?.productId?.offer?.endDate || product?.productId?.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product?.productId?.salePrice,
        productOffer, 
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res.status(200).json({
      message: "Cart updated successfully",
      cart: {
        ...cart.toObject(),
        items: results,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to update cart"});
  }
};

const removeFromCart = async (req, res) => {
  try {
    const {productId} = req.params;
    const userId = req.user.id;

    const cart = await Cart.findOne({user: userId});
    if (!cart) {
      return res.status(404).json({message: "Cart not found"});
    }

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    await cart.save();
    return res.status(200).json({message: "Item removed from cart", cart});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to remove from cart"});
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({user: userId});
    if (!cart) {
      return res.status(404).json({message: "Cart not found"});
    }

    cart.items = [];
    await cart.save();
    return res.status(200).json({message: "Cart cleared successfully", cart});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to clear cart"});
  }
};

const calculateShippingCost = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.productId",
      populate: [
        { path: "brand" },
        { path: "offer" },
        {
          path: "category",
          model: "Category",
          populate: {
            path: "offer",
            model: "Offer",
          },
        },
      ],
    });

    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Base shipping cost
    let baseShippingCost = 0;
    let assemblyCost = 0;
    let totalWeight = 0;

    // Calculate costs for each item
    for (const item of cart.items) {
      const product = item.productId;
      
      // Add base shipping cost for each item
      baseShippingCost += 10; // Base shipping cost per item

      // Add weight-based cost
      if (product.dimensions && product.dimensions.weight) {
        totalWeight += product.dimensions.weight * item.quantity;
      }

      // Add assembly cost if required
      if (item.assemblyRequired) {
        assemblyCost += 25; // Assembly cost per item
      }
    }

    // Add weight-based shipping cost
    const weightBasedCost = totalWeight * 0.5; // $0.50 per kg

    // Calculate total shipping cost
    const totalShippingCost = baseShippingCost + weightBasedCost + assemblyCost;

    return res.status(200).json({
      message: "Shipping cost calculated successfully",
      shippingDetails: {
        baseShippingCost,
        weightBasedCost,
        assemblyCost,
        totalShippingCost
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to calculate shipping cost" });
  }
};

const updateAssemblyPreference = async (req, res) => {
  try {
    const { productId } = req.params;
    const { assemblyRequired } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Update assembly preference
    cart.items[itemIndex].assemblyRequired = assemblyRequired;
    await cart.save();

    // Populate the updated cart with product details
    await cart.populate({
      path: "items.productId",
      populate: [
        { path: "brand" },
        { path: "offer" },
        {
          path: "category",
          model: "Category",
          populate: {
            path: "offer",
            model: "Offer",
          },
        },
      ],
    });

    // Calculate prices with offers
    const results = cart?.items?.map((product) => {
      const productOffer = product?.productId?.offer?.discountPercentage || 0;
      const categoryOffer = product?.productId?.category?.offer?.discountPercentage || 0;
      const offerExpirationDate =
        product?.productId?.offer?.endDate || product?.productId?.category?.offer?.endDate;
      const priceDetails = calculateOfferPrice(
        product?.productId?.salePrice,
        productOffer,
        categoryOffer,
        offerExpirationDate
      );
      return {
        ...product.toObject(),
        ...priceDetails,
        offerValid: priceDetails.offerPercentage > 0,
      };
    });

    return res.status(200).json({
      message: "Assembly preference updated successfully",
      cart: {
        ...cart.toObject(),
        items: results,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Failed to update assembly preference" });
  }
};

export {
  addToCart,
  getCartDetails,
  updateCart,
  removeFromCart,
  clearCart,
  calculateShippingCost,
  updateAssemblyPreference
};
