// Added Auth Middlewares
const jwt = require("jsonwebtoken");
const blacklistTokenModel = require("../models/blacklist.model");

async function authUser(req, res, next){
    const token = req.cookies.token;

    if(!token){
        return res.status(401).json({
            message:"Token not Provided"
        })
    }

    const isTokenBlacklisted = await blacklistTokenModel.findOne({token});
    
    if(isTokenBlacklisted){
        return res.status(401).json({
            message:"Invalid Token"
        })
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // FIX: JWT payload only has _id; expose id too so controllers using req.user.id work correctly
        req.user = { ...decoded, id: decoded._id };
        next();
    }catch(error){
        res.status(401).json({
            message: "Invalid Token"
        })
    }
    
}

module.exports = {authUser}