const Listing = require('../listing.js');
const review = require('../review.js');
const customError = require('../customError.js');
require('dotenv');

module.exports.listingGet = async(request,response,next)=>{
    let {id} = request.params;
    let temp, authenticated = false;
    console.log(id);
    if(id.length < 24) {
        next(new customError(404,'Page not found'));
    } else {
        try {
            let result = await Listing.findById(id).populate({path: "reviews", populate: {path: "author"}}).populate("owner");
            if(!result) {
                request.flash("failure","Listing Not Found");
                response.redirect('/listings');
            } else {
                // console.log(result);
                
                if(request.isAuthenticated()) {
                    authenticated = true;
                    if(request.user.id == result.owner.id) {
                        temp = true;
                    } else {
                        temp = false;
                    }
                } else {
                    temp = false;
                }
                let GEO_CODING_API_KEY = process.env.GEO_CODING_API_KEY;
                let MAPPLS_API_KEY = process.env.MAPPLS_API_KEY;
                response.render('Listings/listing.ejs',{result, temp, authenticated, MAPPLS_API_KEY, GEO_CODING_API_KEY});
            }
        } catch(error) {
            next(new customError(404,'Page not found'));
            console.log(error);
        }
    }
};

module.exports.updateGet = async(request,response)=>{
    if(request.isAuthenticated()) {
        let {id} = request.params;
        // console.log(id);
        let result = await Listing.findById(id).populate("owner");
        // console.log(result);
        response.render('Listings/update.ejs',{result});
    } else {
        request.session.urlPath = request.originalUrl;
        request.flash('noUpdateListing','Please login to update any listing');
        response.redirect('/login');
    }
};

module.exports.newListingGet = async(request,response)=>{
    if(request.isAuthenticated()) {
        // console.log(request.user);
        response.render('Listings/newListing.ejs');
    } else {
        request.session.urlPath = request.originalUrl;
        request.flash('noNewListing','Please login to add a new listing');
        response.redirect('/login');
    }
};

module.exports.deleteListingGet = async(request,response)=>{
    let {id} = request.params;
    let result = await Listing.findById(id).populate("owner");
    if(request.isAuthenticated()) {
        response.render('Listings/delete.ejs',{id});
    } else {
        request.session.urlPath = request.originalUrl;
        request.flash('noDeleteListing','Please login to delete a listing');
        response.redirect('/login');
    }
};

module.exports.filteredListingGet = async(request, response) => {
    let {property} = request.params
    // console.log(property)
    Listing.find({propertyType: property})
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
        response.render('Listings/home.ejs', {result, avgRatingArr})
        // console.log(result)
    })
}

module.exports.updatePost = async(request,response)=>{
    let updatedValues = request.body;
    let {id} = request.params;
    let res = await Listing.findByIdAndUpdate(id, updatedValues);
    console.log('values updated');
    // console.log(res);
    request.flash('updated','Listing Updated');
    response.redirect(`/listings/${id}`);
};

module.exports.deleteListingPost = async(request,response,next)=>{
    if(request.isAuthenticated()) {
        let {id} = request.params;
        Listing.findByIdAndDelete(id)
        .then((result)=>{
            for(let i = 0; i < result.reviews.length; i++) {
                review.findByIdAndDelete(result.reviews[i]._id)
                .then((deletedResult)=>{
                    console.log(deletedResult);
                })
                .catch((error)=>{
                    console.log(error);
                })
            }
            request.flash('deleted','Listing Deleted');
            console.log('listing deleted');
            response.redirect('/listings');
        }).catch((error)=>{
            next(new customError(500,'something went wrong'));
        });
    } else {
        next(new customError(300,'User not Logged in'));
    }
};

module.exports.newListingPost = wrapAsync(async(request,response,next)=>{
    if(request.isAuthenticated()) {
        let newListing = new Listing(request.body);
        newListing.owner = request.user.id;
        // if(request.file.path) {
        //     newListing.image = request.file.path;
        // } else {
        //     newListing.image = process.env.PRIMARY_IMAGE_URL;
        // }
        try {
            newListing.image = request.file.path;
            request.flash('success','New Listing Created');
            newListing.save()
            .then(()=>{
                console.log('new listing created');
                response.redirect('/listings');
            }).catch(()=>{
                next(new customError(400,'something went wrong'));
            });
        } catch(err) {
            next(new customError(200,'Provide an Image'));
        }
    } else {
        next(new customError(300,'User not logged in'));
    }
});

module.exports.addReviewPost = async(request,response)=>{
    if(request.isAuthenticated()) {
        let {id} = request.params;
        let result = request.body;
        let newReview = new review({
            rating: result.rating,
            comment: result.comment.trimEnd(" ").trimStart(" "),
        });
        newReview.author = request.user.id;
        await newReview.save();
        let result2 = await Listing.findById(id);
        result2.reviews.push(newReview);
        result2.save();
        request.flash('review','Review Added Successfully');
        response.redirect(`/listings/${id}`);
    } else {
        request.session.urlPath = request.path.slice(0, 34);
        request.flash('noReview','Please Login to add your feedback');
        response.redirect('/login');
    }
};

module.exports.deleteReviewPost = async(request,response)=>{
    let temp;
    if(request.isAuthenticated()) {
        let {id, reviewId} = request.params;
        let reviewResult = await review.findById(reviewId).populate("author");
        let listingResult = await Listing.findById(id);
        // console.log(listingResult);
        // console.log(reviewResult.author.id);
        if(request.user.id === reviewResult.author.id) {
            let reviews = listingResult.reviews;
            await review.findByIdAndDelete(reviewId);
            let resultObj = await Listing.findByIdAndUpdate(id, {$pull: {reviews:reviewId} });
            response.redirect(`/listings/${id}`);
            // console.log(resultObj);
        } else {
            request.flash('noReviewDeletion', 'You cannot delete this review');
            response.redirect(`/listings/${id}`);
        }
    } else {
        request.session.urlPath = request.path.slice(0, 34);
        request.flash('noDeleteReview','Please Login to delete your feedback');
        response.redirect('/login');
    }
};