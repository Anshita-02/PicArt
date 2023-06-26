const mongoose = require("mongoose");

var boardSchema = mongoose.Schema({
    name: String,
    user:String,
    images:[{
        type:mongoose.Types.ObjectId,
        ref:"images",
        default:[]
    }]
});

module.exports = mongoose.model("board" , boardSchema)