const mongoose = require("mongoose");

const commentSchema = mongoose.Schema({
    user:String,
    time:String,
    cmnt:String,
    img:{
        type:mongoose.Types.ObjectId,
        ref:"images"
    }
})

module.exports = mongoose.model("comments", commentSchema);