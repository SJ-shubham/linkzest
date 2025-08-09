const mongoose=require('mongoose');

const userSchema = new mongoose.Schema({
    shortId: {
        type:String,
        required:true,
        unique:true,
    },
    redirectURL:{
        type:String,
        required:true,
    },
    
    visitHistory : [{timestamp:{type: Number}}], //This is an array of objects, where each object contains a timestamp (stored as a number, typically Unix time).
    
    createdBy: {
        type:mongoose.Schema.Types.ObjectId,    //This means the field will store the _id of a document from another model (or even the same model if needed).
        ref:'users',
    },
    isActive:{
        type:Boolean,
        default:true,
    },
    expirationDate:{
        type: Date, 
        default: null 
    },
    isDeleted: { 
        type: Boolean, 
        default: false 
    },
    deletedAt: { 
        type: Date, 
        default: null 
    },
},
{timestamps:true}
);

const URL=mongoose.model('url',userSchema);  // Model reference for 'urls' collection using userSchema

module.exports={URL};