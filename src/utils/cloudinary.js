import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET,
});



const uploadOnCloudinary = async (localFilePath) =>{
    try{
        if(!localFilePath) return null

        // upload the file on cloudinary
    const response =  cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        // file has been uploaded succesfully
        console.log("File is uploades on cloudinary",response.url);
        return response;
    } catch (error){
        fs.unlinkSync(localFilePath) // remove the locally saved temprary file as the uplaod operation got failed
        return null;
    }
}

export {uploadOnCloudinary}
