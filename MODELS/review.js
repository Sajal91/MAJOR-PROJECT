const mongoose = require("mongoose");
const {Schema} = mongoose;

let reviewSchema = new Schema({
    comment: {
        type: String,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
    }
});

const review = mongoose.model('review', reviewSchema);
module.exports = review;