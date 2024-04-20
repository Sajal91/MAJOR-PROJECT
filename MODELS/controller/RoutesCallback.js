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
            let mapKey = process.env.BING_MAP_API_KEY;
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

                let coordinates;
                fetch(`http://dev.virtualearth.net/REST/v1/Locations?q=${result.location}%20${result.country}&o=&maxResults=1&key=${mapKey}`)
                .then((result1)=>{
                    result1.json()
                    .then((result2)=>{
                        coordinates = result2.resourceSets[0].resources[0].geocodePoints[0].coordinates;
                        console.log(coordinates);
                        response.render('Listings/listing.ejs',{result, temp, authenticated, mapKey, coordinates});
                    }).catch((error)=>{
                        next(new customError(404,'Page not found'));
                        console.log(error);
                    });
                }).catch((error)=>{
                    next(new customError(404,'Page not found'));
                    console.log(error);
                });
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

module.exports.updatePost = async(request,response,next)=>{
    let updatedValues = request.body;
    let {id} = request.params;
    await Listing.findByIdAndUpdate(id, updatedValues);
    console.log('values updated');
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

module.exports.newListingPost = async(request,response,next)=>{
    if(request.isAuthenticated()) {
        let newListing = new Listing(request.body);
        newListing.owner = request.user.id;
        newListing.image = request.file.path;
        request.flash('success','New Listing Created');
        newListing.save()
        .then(()=>{
            console.log('new listing created');
            response.redirect('/listings');
        }).catch(()=>{
            next(new customError(400,'something went wrong'));
        });
    } else {
        next(new customError(300,'User not logged in'));
    }
};

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