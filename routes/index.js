const express = require('express');
const crypto = require("crypto");
const http = require('http');
const fs = require("fs");
const mongoose = require("mongoose");
const GoogleStrategy = require('passport-google-oidc');
const promise = require("promise");
const multer = require("multer");
const nodemailer = require('../nodemailer.js')
const path = require("path");
const passport = require("passport");
require('dotenv').config();
const flash = require("connect-flash");
const GridFsStorage = require("multer-gridfs-storage").GridFsStorage;

//models file
const userModel = require("./users.js");
const imageModel = require("./images.js");
const boardModel = require("./board.js");
const commentModel = require("./comment.js");

const router = express.Router();

const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

//database connection
const mongooseUrl = "mongodb+srv://anshitamethi732:6pgbz1ikAavGjntA@cluster0.09h0dl1.mongodb.net/projectupdate?retryWrites=true&w=majority";
const conn = mongoose.createConnection(mongooseUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


//bucket creation
let gfs;
conn.once("open", ()=>{
  gfs = new mongoose.mongo.GridFSBucket(conn.db,{
    bucketName:"uploads",
  });
});

let pgfs
conn.once("open", ()=>{
  pgfs = new mongoose.mongo.GridFSBucket(conn.db,{
    bucketName:"profile",
  });
});

//storate media
let filename;
const storage = new GridFsStorage({
  url:mongooseUrl,
  file:(req,file)=>{
    return new Promise((resolve,reject)=>{
      crypto.randomBytes(16,(err,buf)=>{
        if(err){
          return reject(err);
        }
      
        filename = buf.toString("hex")+path.extname(file.originalname);
        const fileInfo = {
          filename:filename,
          bucketName:"uploads",
        };
        resolve(fileInfo);
        // console.log(filename);
        return filename;
      });
    });
  },
});

let profilefilename;
const profilestorage = new GridFsStorage({
  url:mongooseUrl,
  file:(req,file)=>{
    return new Promise((resolve,reject)=>{
      crypto.randomBytes(16,(err,buf)=>{
        if(err){
          return reject(err);
        }
        profilefilename = buf.toString("hex")+path.extname(file.originalname);
        const fileInfo = {
          filename:profilefilename,
          bucketName:"profile",
        };
        resolve(fileInfo);
        // console.log(profilefilename);
        return profilefilename;
      });
    });
  },
});

function fileFilter (req, file, cb) {

  if(file.mimetype=== 'image/png' || file.mimetype=== 'image/jpg' ||file.mimetype=== 'image/jpeg'||file.mimetype=== 'image/webp' || file.mimetype=== 'image/jfif'|| file.mimetype=== 'image/avif' ){
    cb(null, true)
  }else{
    cb(new Error('Can upload photo only'));
  }
}

const upload = multer({storage:storage, fileFilter: fileFilter});
const profileupload = multer({storage: profilestorage , fileFilter: fileFilter});

/* GET home page. */
//================================authentication routes
router.get('/', function(req, res, next) {
  if(req.isAuthenticated()){
  res.redirect("/uploadStuff")}
  res.render("index");
});

//==================================google auth
passport.use(new GoogleStrategy({
  clientID: process.env['GOOGLE_CLIENT_ID'],
  clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
  callbackURL: '/oauth2/redirect/google',
  scope: [ 'email','profile' ]
}, async function verify(issuer, profile, cb) {
  // console.log(profile);
 var user = await userModel.findOne({username: profile.emails[0].value})
    if(user){
      return cb(null, user);
    }
    var newUser = await userModel.create({username: profile.emails[0].value})
      return cb(null, newUser);
    })
);

//============================ to render login page
router.get('/login', function(req, res, next) {
  res.render("Login")
});

//============================ to render signup page
router.get("/signup",function(req,res){
  res.render("signup");
})

router.get('/login/federated/google', passport.authenticate('google'));

router.get('/oauth2/redirect/google', passport.authenticate('google', {
  successRedirect: '/uploadStuff/1',
  failureRedirect: '/failure'
}));

//========================= to register any user
router.post('/register', async function(req,res,next){
  const{username ,password} = req.body;
  let errors = [];
  if(!username || !password){
    errors.push({msg:"Please fill all the fields"})
  }

  if(password.length<8){
    errors.push({msg:"password should be atleast 8 characters"});
  }
  if(errors.length>0){
    res.render("signup",{
      errors,
      username,
      password
    })
  }
  else{
   var user = await userModel.findOne({username: req.body.username})
  if(user){
     errors.push({msg:"This username already exists!"});
     if(errors.length>0){
      res.render("signup",{
        errors,
        username,
        password
      })
    }
  }else{
  var userDets = new userModel({
    username:req.body.username
  })
  
  userModel.register(userDets, req.body.password)
  .then(function(registeredUser){
    passport.authenticate('local')(req,res,function(){
      req.flash('success_msg',"Successfully registered");
    res.redirect("/uploadStuff/1");
    });
  });
  }
  }
});


//============================login route
router.post("/login", passport.authenticate('local',{
  successRedirect:'/uploadStuff/1',
  failureRedirect:'/login',
  failureFlash:true
}), function(req,res,next){});

//=======================to check whether any user is logged in
function isLoggedIn(req,res,next){
  if(req.isAuthenticated()){
    return next();
  }else{
    req.flash('error_msg', "Please login to view the resource")
    res.redirect('/login');
  }
}

// router.get("/failure", function(req,res){
//   // res.send("fail to login!");
//   var msg = "Incorrect username or password"
//   res.render("login", {msg})
// });

//=========================in case user forgot password
router.get('/forgot' , function(req,res){
  res.render('forgot');
})

//=======================will send email after u enter email
router.post('/forgot' , async function(req,res){
  var user = await userModel.findOne({username: req.body.username});
if(user){
  crypto.randomBytes(17,async function(err,buf){
    var link = buf.toString("hex");
    user.otp = link;
    var curtime = Date.now();
    user.maxtimeotp = curtime + 24*60*60*60;
    await user.save();
    nodemailer(user.username , user.otp, user._id);
    req.flash("success_msg", "Mail sent!")
    res.redirect("/forgot");
   });
  }else{
    req.flash("error_msg", "No such user with this email exists!")
    res.redirect("/forgot");
  }
});


//=========================password resetting link
router.get('/forgot/:userid/otp/:otp' , async function(req,res){
  var user = await userModel.findOne({_id:req.params.userid});
  var presentTime = Date.now();
  // console.log(presentTime)
  if(presentTime <= user.maxtimeotp && user.otp=== req.params.otp){
    user.maxtimeotp = 0;
    user.otp="";
    user.save();
    res.render("reset" , {user});
  }else{
    res.send("wrong or expired link");
  } 
})

//==========================reset password
router.post('/reset/:id' , async function(req,res){
  var user = await userModel.findOne({_id: req.params.id});
  user.setPassword(req.body.password , async function(){
    user.save();
  });
  res.redirect('/login')
})

//=======================logout route
router.get("/logout", function(req,res,next){
  req.logOut(function(err){
    if(err){
      return next(err);
    }
    res.redirect("/");
  });

})

//@secondary routes
//==================================@get route -> to upload pics checked
router.get('/upload', function(req,res){
  res.render("upload");
})

//================================== @post route ->to upload pics checked
router.post("/upload", isLoggedIn, upload.single("file"), async function (req, res) {
  var user = await userModel.findOne({username: req.session.passport.user});
  var img = await imageModel.create({
    name:filename,
    desc:req.body.desc,
    user:user._id,
  })
  user.myUploads.push(img._id);
  await user.save();
  // console.log(filename);

  res.redirect("back");

});

// ===============================@get route -> to display uploaded pics checked
router.get("/uploadStuff/:page", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  // var number = Math.floor(Math.random()*30);
  var total =await imageModel.countDocuments({});
  var pages = parseFloat(total)/30;
  pages = Math.ceil(pages)
  // console.log(total+ " "+ pages);
  var cur = req.params.page; 
  if(cur>pages)cur = pages;
  if(cur<1)cur =1;
  // var imgs = await imageModel.find().populate("user");
   var imgs = await imageModel.find().skip((30*cur) - 30).limit(30).populate("user");
  //  console.log(imgs);
 res.render("uploaded" , {imgs,user,pages,cur})
});


router.get("/getImage/:page", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  // var number = Math.floor(Math.random()*30);
  var total =await imageModel.countDocuments({});
  var pages = parseFloat(total)/30;
  pages = Math.ceil(pages)
  // console.log(total+ " "+ pages);
  var cur = req.params.page;
   
  if(cur>pages){
  var imgs = [];
  }
 // var imgs = await imageModel.find().populate("user");
  else{
 var imgs = await imageModel.find().skip((30*cur) - 30).limit(30).populate("user");
  //  console.log(imgs);}
 res.send({imgs})
}});

// ==========================@get route -> to get the image from the backend checked
router.get("/image/:filename", (req, res) => {
  const file = gfs
    .find({
      filename: req.params.filename,
    })
    .toArray((err, files) => {
      if (!files || files.length === 0) {
        return res.status(404).json({
          err: "no files exist",
        });
      }
      gfs.openDownloadStreamByName(req.params.filename).pipe(res);
    });
});

router.get("/profile/image/:filename", (req, res) => {
  const file = pgfs
    .find({
      filename: req.params.filename,
    })
    .toArray((err, files) => {
      if (!files || files.length === 0) {
        return res.status(404).json({
          err: "no files exist",
        });
      }
      pgfs.openDownloadStreamByName(req.params.filename).pipe(res);
    });
});

//========================== @get router ->to delete the image
// router.get("/files/del/:filename", isLoggedIn, async function(req,res){
//   var uploadedUser = await imageModel.findOne({name: req.params.filename}).populate("user")
//   var user = await userModel.findOne({username: req.session.passport.user});
//   if(uploadedUser.user.username== user.username){
//     const cursor = gfs.find({filename:req.params.filename});
//     cursor.forEach(function(doc){
//     console.log(doc);
//     gfs.delete(new mongoose.Types.ObjectId(doc._id), function (err, data) {
//         if (err) {
//           res.status("404");
//         }
//       });
//     });
//    var deletedImg =  await imageModel.findOneAndDelete({name:req.params.filename});
//    var index = user.myUploads.indexOf(deletedImg._id);
//    user.myUploads.splice(index,1);
//    await user.save();
//   //  res.redirect("back")
//   res.sendStatus(200);
//   }else{
//     res.send("you do not have access to delete it...");
//   }

// })

//====================== @get route -> to upload profile pic checked
router.get("/upload/profile", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  res.render("uploadProfile" , {user})
})


//==========================@post route ->uploading profile pic router checked
router.post("/upload/profile", isLoggedIn, profileupload.single("image"), async function(req,res){
 var user = await userModel.findOne({username: req.session.passport.user});
  if(user.profilepic){
    const cursor = pgfs.find({filename:user.profilepic});
    cursor.forEach(function(doc){
      // console.log(doc);
      pgfs.delete(new mongoose.Types.ObjectId(doc._id), function (err, data) {
        if (err) {
          res.status("404");
        }
      });
    });
  };
  user.profilepic = profilefilename;
  await user.save();
  res.redirect("/uploadStuff/1")
})

//=================================user profile page: checked
router.get("/user/:username" , isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var uploadedUser = await userModel.findOne({username:req.params.username}).populate("myUploads profilepic wishlisted");
  // console.log(uploadedUser.following.length);
  var profileadd;
  var board_arr = [];
  if(uploadedUser.profilepic && uploadedUser.profilepic.length>0){
    profileadd = uploadedUser.profilepic
  }
  if(uploadedUser.board.length>0){
    for(var i=0;i<uploadedUser.board.length;i++){
      console.log(uploadedUser.board[i]);
      var brd=await  boardModel.findOne({name: uploadedUser.board[i], user:uploadedUser.username}).populate("images");
      // console.log(brd.name, brd.images[brd.images.length -1].name);
      board_arr.push({img: brd.images[brd.images.length -1].name, size:brd.images.length })
    }
  }
  res.render("userUpload" , {user,uploadedUser,profileadd , board_arr});
 
 } )
  

//============================= @get route to display all info about the photo
router.get("/file/image/:id",isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var image = await imageModel.findOne({_id:req.params.id}).populate("user comments");
  const cursor = await gfs.find({filename:image.name});
  var upload_Date,filesize;
  await  cursor.forEach(function(doc){
    var d = doc.uploadDate;
    upload_Date = `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`
    filesize = doc.length/(10**6);
    filesize = filesize.toFixed(2);
  });
   res.render("imageInfo", {image, upload_Date, filesize, user});
  // res.send({user})
})

//================================@get route -> for liked photos checked
// ajax call mara jaega isko
router.get("/like/:id", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username: req.session.passport.user});
  var img = await imageModel.findOne({_id: req.params.id});
  // console.log(user._id + " "+img._id );
  var userindex = -1, imgindex=-1;
  if(user.wishlisted) userindex= user.wishlisted.indexOf(img._id);
  if(img.wishlisted)imgindex = img.wishlisted.indexOf(user._id);
  if(userindex ===-1){
    // console.log("inside if");
    user.wishlisted.push(img._id);
    img.wishlisted.push(user._id);
  }else{
    user.wishlisted.splice(userindex,1);
    img.wishlisted.splice(imgindex, 1);
  }
  await user.save();
  await img.save();
  // console.log("router hit");
  // res.redirect("back");
  // res.sendStatus(200);
  var length = img.wishlisted.length;
  res.send({length})
});

//==============================@post route for comments checked
//ajax call mara jaega isko
router.post("/comment/:id" , isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var img = await imageModel.findOne({_id:req.params.id});
  var time = new Date();
  var cmnt = await commentModel.create({
  user:user.username,
  img:img._id,
  cmnt:req.body.comment,
  time: `${time.getDate()}/${time.getMonth()+1}/${time.getFullYear()}`
 })
  img.comments.push(cmnt._id);
  await img.save();
  // res.sendStatus(200);
  res.send({cmnt,user})
})

//========================== to delete a comment checked
router.get("/comment/delete/:id", isLoggedIn, async function(req,res,next){
  var user = await userModel.findOne({username:req.session.passport.user});
  var comment = await commentModel.findOne({_id: req.params.id}).populate("img");

  if(comment.user == user.username){
    commentModel.findOneAndDelete({_id:req.params._id});
    var index =  comment.img.comments.indexOf(comment._id);
    comment.img.comments.splice(index,1);
    await comment.img.save();
  }else{
    res.send("you do not have access to delete it");
  }
  // res.sendStatus(200);
  res.redirect("back");
})

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// board router
// @ post route -> to create new board checked
router.post('/create/board/:imgid', isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var boardName = req.body.board;
  console.log(boardName);
  var index = user.board.indexOf(boardName);
  if(index === -1){
    var newBoard = await boardModel.create({
      name:boardName,
      user:user.username
    });
    user.board.push(boardName);
    newBoard.images.push(req.params.imgid);
    await user.save();
    await newBoard.save();
  }else{
    var board = await boardModel.findOne({user:user.username, name:boardName});
    // console.log(board._id);
    var imgIndex = board.images.indexOf(req.params.imgid);
    if(imgIndex === -1){
      board.images.push(req.params.imgid);
      await board.save();
    }
  }
  res.redirect("back");
})

// @ post route -> to save in old board checked
router.get('/save/:board/:imgid' , isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var boardName = req.params.board;
  boardName = boardName.trim();
  // console.log(boardName);
  var board =  await boardModel.findOne({user:user.username, name:boardName});
  // console.log(board._id);
  var imgIndex = board.images.indexOf(req.params.imgid);
  if(imgIndex === -1){
    board.images.push(req.params.imgid);
    await board.save();
  }
  res.sendStatus(200);
})

// @ get route -> to delete a board checked
router.get("/delete/board/:board", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  await boardModel.findOneAndDelete({user:user.username, name:req.params.board});
  var index = user.board.indexOf(req.params.board);
  user.board.splice(index,1);
  await user.save();
  // res.redirect("back");
  res.sendStatus(200);
})

// @ get route -> to remove image from a board
router.get('/remove/:board/img/:id', isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username: req.session.passport.user});
  var board = await boardModel.findOne({user: user.username , name: req.params.board});
  var imgIndex = board.images.indexOf(req.params.id);
  board.images.splice(imgIndex , 1);
  if(board.images.length===0){
    await boardModel.findOneAndDelete({user: user.username , board: req.params.board});
    var index = user.board.indexOf(req.params.board);
    user.board.splice(index,1);
    user.save();
  }
  else{
  await board.save();
   }
  res.redirect("back");
})

// @get route ->to remove image from wishlist checked
router.get("/remove/wishlist/:imgid", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var index = user.wishlisted.indexOf(req.params.imgid);
  try {
    user.wishlisted.splice(index,1);
    var image = await imageModel.findOne({_id: req.params.imgid});
    var imgindex = image.wishlisted.indexOf(user._id);
    image.wishlisted.splice(imgindex,1);
    user.save();
    image.save();
    res.redirect("back");
    // res.sendStatus(200);
  } catch (error) {
    req.flash("error_msg", "something went wrong!")
    res.sendStatus(500)
  }
 
})

// @post route -> for search bar
let search;
router.post("/search" ,isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user})
   search = req.body.search; // get the search query from the request
  // perform search using the query in your image database
  search = search.trim();
  if(search.length === 0){
    res.redirect("back");
  }
  let query = search.split(" ");
  var img_arr = new Array();
  // await query.forEach( async function(elem){
    await promise.all(query.map( async function(elem){ 
    // console.log(elem);
    let data = await imageModel.find({
      "$or" :[
        {"desc" :{$regex: elem , $options : 'i'}}
      ]
    }).limit(5).populate("user");
    img_arr.push(...data);
  
}))
//  console.log(img_arr);
  res.render("search", {user, img_arr})
})



router.get("/search/:page", isLoggedIn, async function(req,res){
  var cur = req.params.page;
  let query = search.split(" ");
  var img_arr = new Array();
  // await query.forEach( async function(elem){
    await promise.all(query.map( async function(elem){ 
    // console.log(elem);
    let data = await imageModel.find({
      "$or" :[
        {"desc" :{$regex: elem , $options : 'i'}}
      ]
    }).skip(20*cur).limit(20).populate("user");
    // console.log(data);
    img_arr.push(...data);
}))
res.send({img_arr});
})
// @ get route to display all uploads
router.get("/:username/uploads", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var photos = await userModel.findOne({username:req.params.username}).populate("myUploads");
  var uploadedUser = [];
  var length = Math.min(20, photos.myUploads.length);
  for(var i=0;i<length;i++){
    // console.log(await photos.myUploads[i].populate("user"));
    uploadedUser.push(await photos.myUploads[i].populate("user"));
  }
  res.render("moreuploads", {user, uploadedUser, photos});
})

// to display all the boards of a user
router.get("/:username/boards" , isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var uploadedUser = await userModel.findOne({username:req.params.username});
  var board_arr = [];
  if(uploadedUser.board.length>0){
    var length = Math.min(20,uploadedUser.board.length)
    for(var i=0;i<length;i++){
      // console.log(uploadedUser.board[i]);
      var brd=await  boardModel.findOne({name: uploadedUser.board[i], user:uploadedUser.username}).populate("images");
      board_arr.push({img: brd.images[brd.images.length -1].name, size:brd.images.length,name: uploadedUser.board[i] })
    }
  }
  res.render("moreboard", {user,uploadedUser,board_arr});
})

// to display all the photos liked by a user
router.get("/:username/likes", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var photos = await userModel.findOne({username:req.params.username}).populate("wishlisted");
  var uploadedUser = [];
  var length = Math.min(20, photos.wishlisted.length);
  for(var i=0;i<length;i++){
    // console.log(await photos.wishlisted[i].populate("user"));
    uploadedUser.push(await photos.wishlisted[i].populate("user"));
  }
  res.render("morelikes", {user, uploadedUser,photos});
});

router.get("/morelikes/:username/:cursec", isLoggedIn, async function(req,res){
  var photos = await userModel.findOne({username:req.params.username}).populate("wishlisted");
  var uploadedUser = [];
  var skip = parseInt(req.params.cursec);
  var tl = parseInt(photos.wishlisted.length-(20*skip));
  if(tl>0){
    var length = Math.min(tl, 20);
    // console.log(skip, " ", length," ",(7*skip+length));
    for(var i = 20*skip;i<20*skip+length;i++){
      uploadedUser.push(await photos.wishlisted[i].populate("user"));
    }
    // console.log(uploadedUser);
    res.send({uploadedUser,photos});
  }
  else{
    res.sendStatus(200);
  }
})

router.get("/moreuploads/:username/:cursec", isLoggedIn, async function(req,res){
  var photos = await userModel.findOne({username:req.params.username}).populate("myUploads");
  var uploadedUser = [];
  var skip = parseInt(req.params.cursec);
  var tl = parseInt(photos.myUploads.length-(20*skip));
  if(tl>0){
    var length = Math.min(tl, 20);
    // console.log(skip, " ", length," ",(7*skip+length));
    for(var i=20*skip;i<(20*skip)+length;i++){
      uploadedUser.push(await photos.myUploads[i].populate("user"));
    }
    // console.log(uploadedUser);
    res.send({uploadedUser,photos});
  }
  else{
    res.sendStatus(200);
  }
})


router.get("/moreboards/:username/:cursec", isLoggedIn, async function(req,res,next){
  var user = await userModel.findOne({username:req.params.username});
  var board_arr = [];
  var skip = parseInt(req.params.cursec);
  var tl = parseInt(user.board.length-(20*skip));
  if(tl>0){
    var length = Math.min(tl, 20);
    // console.log(skip, " ", length," ",(7*skip+length));
    for(let i=20*skip;i<(20*skip)+length;i++){
      var brd=await  boardModel.findOne({name: user.board[i], user:user.username}).populate("images");
      board_arr.push({img: brd.images[brd.images.length -1].name, size:brd.images.length,name: user.board[i] })
    }
    // console.log(board_arr);
    res.send({board_arr, user});
  }
  else{
    res.sendStatus(200);
  }
})

// to display all the images of a single board
router.get("/:username/:boardname", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var photos = await userModel.findOne({username:req.params.username});
  var board = await boardModel.findOne({user:photos.username, name:req.params.boardname}).populate("images");
  var uploadedUser = [];
  var length = Math.min(20, board.images.length);
  // console.log(length);
  for(let i=0;i<length;i++){
    // console.log(await board.images[i]);
    uploadedUser.push(await board.images[i])
  }
  res.render("boardpage",{user,photos,uploadedUser,board} );
})

router.get("/moresameuploads/:username/:boardname/:cursec", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.params.username});
  var board = await boardModel.findOne({user:user.username, name:req.params.boardname}).populate("images");
  var img_arr = [];
  var skip = parseInt(req.params.cursec);
  var tl = parseInt(board.images.length - (20*skip));
  if(tl>0){
    var length = Math.min(tl,20)
    // console.log(skip, " ", length," ",(7*skip+length));
   for(let i= 20*skip; i<(20*skip)+length;i++){
    img_arr.push(await board.images[i]);
   }
  //  console.log(img_arr);
   res.send({user,img_arr,board});
  }else{
    res.sendStatus(200);
  }
})


// function to download any image in our system
const downloadFolder = path.join(require('os').homedir(), 'Downloads');
async function download(imageUrl){
  http.get(imageUrl, async function(res){
  const filePath =  path.join(downloadFolder, path.basename(imageUrl));
  const writeStream = fs.createWriteStream(filePath);
   res.pipe(writeStream);

  writeStream.on('finish', () => {
    // console.log(`File downloaded to: ${filePath}`);
  });
});
}

router.get("/download/image/:imageurl", isLoggedIn, async function(req,res){
  var imageurl = req.params.imageurl;
 var imageUrl = "http://localhost:3000/image/"+imageurl;
  console.log(imageUrl);
  await download(imageUrl);
  // res.redirect("back")
  res.sendStatus(200)
})

//====================to follow any user
router.post("/follow/:username", isLoggedIn, async function(req,res){
  var user = await userModel.findOne({username:req.session.passport.user});
  var fuser = await userModel.findOne({username: req.params.username});
  var index = user.follow.indexOf(fuser._id);
  if(index === -1){
      user.follow.push(fuser._id);
      fuser.following.push(user._id);
  }else{
    user.follow.splice(index,1);
    fuser.following.splice(index,1);
  }
  user.save();
  fuser.save();
  res.sendStatus(200);
})
module.exports = router;
