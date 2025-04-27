import Cart from "../models/cartModel.js";
import Products from "../models/productModel.js";

const checkCartItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({user: userId});

    if (!cart) {
      return res.status(400).json({message: "Cart not found"});
    }

    const productIds = cart.items.map((item) => item.productId);
    const products = await Products.find({_id: {$in: productIds}});

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    );

    const stockCheckResults = [];

    for (const cartItem of cart.items) {
      const product = productMap.get(cartItem.productId.toString());

      if (!product) {
        stockCheckResults.push({
          productId: cartItem.productId,
          inStock: false,
          message: "Product not found",
        });
        continue;
      }

      const requestedQuantity = cartItem.quantity;
      const requestedColor = cartItem.color;

      // Check if the requested color is available
      if (!product.colors.includes(requestedColor)) {
        stockCheckResults.push({
          productId: product._id,
          productName: product.productName,
          inStock: false,
          message: `Color ${requestedColor} is not available for this product.`,
          availableColors: product.colors
        });
        continue;
      }

      // Check if there's enough stock
      if (!product.stock || product.stock < requestedQuantity) {
        stockCheckResults.push({
          productId: product._id,
          productName: product.productName,
          inStock: false,
          message: `Insufficient stock. Available: ${product.stock || 0}`,
          availableStock: product.stock || 0
        });
      } else {
        stockCheckResults.push({
          productId: product._id,
          productName: product.productName,
          inStock: true,
          message: "Item is in stock.",
          availableStock: product.stock,
          color: requestedColor,
          materials: product.materials,
          dimensions: product.dimensions,
          assemblyRequired: product.assemblyRequired
        });
      }
    }

    const allItemsInStock = stockCheckResults.every((result) => result.inStock);

    return res.status(200).json({
      message: allItemsInStock
        ? "All items are in stock"
        : "Some items are out of stock",
      allItemsInStock,
      stockCheckResults,
    });

  } catch (error) {
    console.error("Error checking cart items:", error);
    return res.status(500).json({
      message: "Something went wrong while checking cart items",
      error: error.message
    });
  }
};

export {checkCartItems};
