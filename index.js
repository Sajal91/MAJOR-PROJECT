const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const {sampleListings} = require('./MODELS/sampleListings.js');
const Listing = require('./MODELS/listing.js');
const port = 3000;
const ejsMate = require('ejs-mate');
const customError = require('./MODELS/customError.js');
const review = require('./MODELS/review.js');
const User = require('./MODELS/user.js');
const wrapAsync = require('./MODELS/wrapAsync.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { listingGet, updateGet, newListingGet, deleteListingGet,updatePost, deleteListingPost, newListingPost, addReviewPost, deleteReviewPost } = require('./MODELS/controller/RoutesCallback.js');
const multer = require('multer');
require('dotenv').config();
const { storage } = require('./MODELS/cloud-config.js');
const upload = multer({ storage });
const { request } = require('http');

const mongoSessionOptions = MongoStore.create({
    mongoUrl: process.env.ATLAS_DB_URL,
    crypto: {
      secret: process.env.SECRET,
    },
    touchAfter: 24 * 60 * 60,
});

mongoSessionOptions.on("error", ()=>{
    console.log("error occured in mongo session");
});

const sessionOptions = {
    store: mongoSessionOptions,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 60000,
        maxAge: 60000,
        httpOnly: true
    },
};

app.use(session(sessionOptions));
app.use(flash());

// Username and Password authentication..
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((request,response,next)=>{
    response.locals.detail = request.user;
    next();
});

app.use('/listings',(request,response,next)=>{
    response.locals.success = request.flash('success')[0];
    response.locals.failure = request.flash('failure')[0];
    response.locals.deleted = request.flash('deleted')[0];
    response.locals.registered = request.flash('registered')[0];
    response.locals.validLogin = request.flash('validLogin')[0];
    response.locals.logout = request.flash('logout')[0];
    response.locals.noReviewDeletion = request.flash('noReviewDeletion')[0];
    next();
});
app.use('/listings/:id',(request,response,next)=>{
    response.locals.updated = request.flash('updated')[0];
    response.locals.review = request.flash('review')[0];
    next();
});
app.use('/signup',(request,response,next)=>{
    response.locals.userExists = request.flash('userExists')[0];
    next();
});
app.use('/login',(request,response,next)=>{
    response.locals.noUser = request.flash('noUser')[0];
    response.locals.noNewListing = request.flash('noNewListing')[0];
    response.locals.noUpdateListing = request.flash('noUpdateListing')[0];
    response.locals.noDeleteListing = request.flash('noDeleteListing')[0];
    response.locals.noReview = request.flash('noReview')[0];
    response.locals.noDeleteReview = request.flash('noDeleteReview')[0];
    response.locals.saveUrl = request.session.urlPath;
    next();
});

app.use(express.urlencoded({extended: true}));
app.set("views",path.join(__dirname,"views"));
app.set('view engine','ejs');
app.use(express.static('public'));
app.engine('ejs',ejsMate);

async function main() {
    await mongoose.connect(process.env.ATLAS_DB_URL);
}

main()
.then(()=>{
    console.log('database connected successfully');
}).catch(()=>{
    console.log('an error occured while connecting to database');
});

app.listen(port,()=>{
    console.log(`server is live at ${port}`);
});

app.get('/',(request,response)=>{
    response.redirect('/listings');
});

app.get('/listings',async(request,response,next)=>{
    Listing.find().populate('reviews')
    .then((result)=>{
        let avgRatingArr = [];
        for(let i = 0; i < result.length; i++) {
            let ratingSum = 0;
            for(let j = 0; j < result[i].reviews.length; j++) {
                ratingSum = ratingSum + result[i].reviews[j].rating;
            }
            let avgRating = ratingSum/result[i].reviews.length;
            avgRatingArr.push(avgRating);
        }
        response.render('Listings/home.ejs',{result, avgRatingArr});
    }).catch((error)=>{
        next(error);
    });
});

app.get('/listings/:id',listingGet);

app.get('/listings/:id/update',updateGet);

app.get('/listings/new/listing',newListingGet);

app.get('/listings/:id/delete',deleteListingGet);

app.get('/signup',(request,response)=>{
    response.render('Listings/signup.ejs');
});

app.get('/login',async(request,response)=>{
    response.render('Listings/login.ejs');
});

app.get('/logout',async(request,response,next)=>{
    request.logout((err)=>{
        if(err) {
            next(err);
        } else {
            request.flash('logout','Logged out successfully');
            response.redirect('/listings');
        }
    })
});

app.post('/listings/:id/update/',upload.single('image'),updatePost);

app.post('/listings/new/listing',upload.single('image'),newListingPost);

app.post('/listings/:id/delete',deleteListingPost);

app.post('/listings/:id/reviews',addReviewPost);

app.post("/listings/:id/reviews/:reviewId",deleteReviewPost);

app.post('/signup',async(request,response,next)=>{
    try {
        let {password} = request.body;
        let newUser = new User(request.body);
        newUser.pass = password;
        let result = await User.register(newUser,password);
        console.log(result);
        request.login(result,(err)=>{
            if(err) {
                next(err);
            } else {
                request.flash('registered','Welcome to Wanderlust');
                response.redirect('/listings');
            }
        });
    } catch(error) {
        request.flash('userExists',error.message);
        response.redirect('/signup');
    }
});

app.post('/login',(request,response,next)=>{
    request.flash('noUser','Invalid Username or Password');
    next();
},passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true,
}),async(request,response)=>{
    if(response.locals.saveUrl) {
        response.redirect(response.locals.saveUrl);
    } else {
        request.flash('validLogin', 'Logged in Successfully');
        response.redirect('/listings');
    }
});

// Error Handling

app.all('*',(request,response,next)=>{
    next(new customError(404,'Page not found'));
});

app.use((err,request,response,next)=>{
    let {name,status,message} = err;
    // console.log(name);
    // console.log(status);
    // console.log(message);
    // console.log(err);
    response.render('Listings/error.ejs',{name,status,message});
});

// app.use('*',(err,request,response,next)=>{
//     let {name,status,message} = err;
//     console.log(name);
//     console.log(status);
//     console.log(message);
//     response.render('Listings/error.ejs',{name,status,message});
// });