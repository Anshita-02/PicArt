const mongoose = require("mongoose");

const imageSchema = mongoose.Schema({
    name:String,
    desc:String,
    user:{
        type:mongoose.Types.ObjectId,
        ref:"user"
    },
    wishlisted:[{
        type:mongoose.Types.ObjectId,
        ref:"user",
        default:[]
    }],
    comments:[{
        type:mongoose.Types.ObjectId,
        ref:"comments"
    }]
});

module.exports = mongoose.model("images", imageSchema);