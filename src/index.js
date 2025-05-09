// import mongoose, { connect } from "mongoose";

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path:'./.env'
})


connectDB()
.then(() =>{
    app.on("error", (error) => {
        console.log("Error while Opening DB",error)
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log("MonGO DB Connetion failed !!!",err);
})


















// import express from "express";
// const app = express()

// (async () => {
//     try {
//         mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error",(error)=> {
//             console.log("error: ",error);
//             throw error
//         })

//         app.listen(process.env.PORT, () => {
//             console.log(`APP is listening on port ${process.env.PORT}`);
//         })
//     } catch (error) {
//         console.error("ERROR: ",error)
//         throw err
//     }
// })()