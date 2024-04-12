const mongoose = require('mongoose');
const Listing = require('./listing.js');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/wanderlust');
}

main()
.then(()=>{
    console.log('database connected successfully');
}).catch(()=>{
    console.log('an error occured while connecting to database');
});