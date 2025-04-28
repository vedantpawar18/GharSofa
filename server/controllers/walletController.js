import Wallet from "../models/walletModel.js"

const getWalletDetials = async (req, res) => {
    try{
        const userId = req.user.id;
        const wallet = await Wallet.findOne({user: userId}).sort({createdAt: 1})

        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found" });
          }
        return res.status(200).json({message: "Success", wallet})
    }catch(error){
        console.log(error)
        return res.status(500).json({message: "Something went wrong"})
    }
}

export {getWalletDetials}