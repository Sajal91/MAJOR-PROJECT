const mongoose = require('mongoose');
const {Schema} = mongoose;

const listingSchema = new Schema({
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    image: {
        type: String,
        set: (v) => v === "" ? "https://images.unsplash.com/photo-1563991655280-cb95c90ca2fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D": v,
        default: "https://images.unsplash.com/photo-1563991655280-cb95c90ca2fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    price: {
        type: Number,
    },
    location: {
        type: String,
    },
    country: {
        type: String,
    },
    propertyType: {
        type: String,
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "review"
        }
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
});

const Listing = mongoose.model('Listing', listingSchema);

module.exports = Listing;