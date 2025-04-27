import Category from "../models/categoryModel.js";

const createCategory = async (req, res) => {
  try {
    const {categoryName, description, status} = req.body;
    if (!categoryName) {
      return res.status(400).json({message: "categoryName is required"});
    }
    const existingCategory = await Category.findOne({categoryName});
    if (existingCategory) {
      return res.status(400).json({message: "Category already existing"});
    }
    const category = new Category({
      categoryName,
      description,
      status,
    });
    const categoryData = await category.save();
    return res
      .status(200)
      .json({message: "Category added successfully", categoryData});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
}; 

const getAllCategory = async (req, res) => {
  try {
    const categoryData = await Category.find();
    return res
      .status(200)
      .json({message: "data fetched successfully", categoryData});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Failed to get the data"});
  }
};

const updateCategory = async (req, res) => { 
  try {
    const {categoryName, description, status} = req.body;
    const {id} = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(400).json({message: "category not founded"});
    }
    const existingCategory = await Category.findOne({ categoryName, _id: { $ne: id } });
    if (existingCategory) {
      return res.status(400).json({ message: "Existing category" });
    }

    const categoryData = await Category.findByIdAndUpdate(id, {
      categoryName, 
      description,
      status,
    });

    return res
      .status(200)
      .json({message: "Updated successfully", categoryData});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const deletCategoryById = async (req, res) => {
  try {
    const {id} = req.params;
    const category = await Category.findByIdAndDelete(id);
    return res.status(200).json({message: "Deleted successfully"});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "Something went wrong"});
  }
};

const verifyProductInCart = async (req, res) => {
  try{

  }catch(error){
    console.log(error)
  }
}
 
export {createCategory, getAllCategory, updateCategory, deletCategoryById};
