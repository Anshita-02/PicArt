var express = require('express');
var router = express.Router();
const mongoose = require("mongoose");
var plm = require("passport-local-mongoose");

mongoose.set('strictQuery', true);
mongoose.connect("mongodb+srv://anshitamethi732:6pgbz1ikAavGjntA@cluster0.09h0dl1.mongodb.net/projectupdate?retryWrites=true&w=majority")
.then(function(){
  console.log("connected to db");
})

var userSchema = mongoose.Schema({
  username:String,
  password:String,
  myUploads:[{
    type:mongoose.Types.ObjectId,
    ref:"images"
  }],
  wishlisted:[{
    type:mongoose.Types.ObjectId,
    ref:"images",
    default:[]
  }],
  otp:{
    type:String,
    default:""
  },
  maxtimeotp:{
    type:Number
  },
  profilepic:String,
  board:{
    type:Array,
    default:[]
  },
  follow:[{
    type:mongoose.Types.ObjectId,
    ref:"user",
    default:[]
  }],
  following:[{
    type:mongoose.Types.ObjectId,
    ref:"user",
    default:[]
  }]
})
passwordValidatorAsync = function(password) {
  return someAsyncValidation(password)
    .catch(function(err){
      return Promise.reject(err)
    })
}
userSchema.plugin(plm,passwordValidatorAsync);
module.exports = mongoose.model("user", userSchema);
