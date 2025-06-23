import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/generateToken.js';


export const registerUser = async (req, res, next)=>{
    try {
        const {username, password} = req.body;
        if(!username || !password){
            res.status(400);
            throw new Error("username and password are required");
        }

        const userExists = await User.findOne({username});
        if(userExists){
            res.status(409);
            throw new Error("user already exists");
        }

        const user = await User.create({username, password});
        const token = generateToken(user.id);

        res.json({
            message : "Registered successfully",
        });
    } 
    catch (error) {
        console.error("error in registering the user",error.message);
        next(error);
    }
}


export const loginUser = async (req, res, next)=>{
    try {
        const {username, password} = req.body;
        const user = await User.findOne({username});
        if(!user){
            res.status(401);
            throw new Error("invalid credentials");
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            res.status(401);
            throw new Error("invalid credentials");
        }

        const token = generateToken(user.id);

        res.json({
            _id: user._id,
            username: user.username,
            token,
        });
    } 
    catch (error) {
        next(error);
    }
}
