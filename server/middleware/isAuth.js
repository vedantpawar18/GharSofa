import jwt from "jsonwebtoken"; 

const isAuth = (req, res, next) => {
    console.log("Incoming cookies: ", req.cookies); 
    
    const token = req.cookies.jwtToken;
    
    console.log("JWT Token from cookies: ", token);

    if(!token){
        return res.status(401).json({ message: "No token provided, authorization denied" });
    }

    try{
        const decoded = jwt.verify(token, process.env.SECRET_KEY)
        // Set the user object with the decoded token data
        req.user = {
            id: decoded.id,
            role: decoded.role,
            username: decoded.username
        }
        console.log("from the isAuth req.user", req.user)
        next()
    }catch(error){
        return res.status(401).json({ message: "Token is not valid" });
    }
}


const isAdminAuth = (req, res, next) => {
    if(req.user && req.user.role){
        next()
    }else{
        res.status(401).json({message: "Not autherized as an admin"})
    }
}
   
export {isAuth, isAdminAuth}