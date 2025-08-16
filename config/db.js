const mongoose = require('mongoose');

async function connectDb() {
    try{
        const mongo_url = process.env.MONGO_URI
        if(!mongo_url){
            console.log("Undefind mongo url");
            process.exit(1);
        }
        await mongoose.connect(mongo_url);
        console.log("Db connected successfully");

    }catch(err){
        console.error("DB connection failed:", err);
        process.exit(1);

    }
}

module.exports = connectDb;