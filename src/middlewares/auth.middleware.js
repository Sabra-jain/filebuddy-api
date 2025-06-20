import jwt from "jsonwebtoken";
import { config } from '../config/env.config.js';


export const protect = (req, res, next)=>{
    const authHeader = req.headers.authorization;

    if(authHeader && authHeader.startsWith("Bearer")){
        const token = authHeader.split(" ")[1];

        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            req.user = decoded;
            next();
        } 
        catch (error) {
            return res.status(401).json({error: "invalid token"});
        }
    }
    else{
        return res.status(401).json({error: "No token provided"});
    }
};
