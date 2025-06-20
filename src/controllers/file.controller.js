import File from "../models/file.model.js";


export const createFile = async (req, res)=>{
    const {filename, content} = req.body;
    const file = await File.create({filename, content, owner: req.user.id});
    res.status(201).json(file);
}

export const getFiles = async (req, res)=>{
    const files = await File.find({owner: req.user.id});
    res.json(files);
}

export const updateFile = async (req, res)=>{
    const file = await File.findOne({_id: req.params.id, owner: req.user.id});
    if(!file){
        return res.status(404).json({error: "File not found"});
    }
    file.filename = req.body.filename || file.filename;
    file.content = req.body.content || file.content;
    await file.save();
    res.json(file);
}

export const deleteFile = async (req, res)=>{
    const file = await File.findOneAndDelete({_id: req.params.id, owner: req.user.id});
    if(!file){
        return res.status(404).json({error: "File not found"});
    }
    res.json({message: "File deleted successfully"});
};
