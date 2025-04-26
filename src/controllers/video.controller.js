import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";



const uploadVideo = asyncHandler(async (req, res,next) => {
    try {
        const { title, description, duration, isPublished } = req.body;
    
        const videoLocalPath = req.files?.videoFile?.[0]?.path;
        const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    
        if(!videoLocalPath || !thumbnailLocalPath){
            throw new ApiError(400, !videoLocalPath ? "Video file is required" : "Thumbnail is required");
        }
    
        const uploadedvideo = await uploadOnCloudinary(videoLocalPath);
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    
        if(!uploadedvideo || !thumbnail){
            throw new ApiError(400, !uploadedvideo ? "Video is required" : "Thumbnail is required");
        }
    
        const video  = new Video({
            title:title,
            videoFile:uploadedvideo?.url,
            thumbnail:thumbnail?.url,
            description:description,
            duration:parseInt(duration),
            published:isPublished,
            owner:req.user._id,
            views:0,
        })
    
        await video.save();
        
        const createdVideo = await Video.findById(video._id).select('-_v');
    
        if(!createdVideo){
            throw new ApiError(500,"Something went wrong while uploading video" );
        }
    
        return res.status(201)
        .json(
            new ApiResponse(200,createdVideo,"Video uploaded successfully")
        )
    } catch (error) {
        console.log("Error while uploading video",error.message)
        next(error)
    }

})

// GET /api/videos/feed

const allUploadedVideo = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
  
    const result = await Video.aggregate([
      {
        $match: { isPublished: true }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerInfo"
        }
      },
      {
        $unwind: "$ownerInfo"
      },
      {
        $project: {
          title: 1,
          thumbnail: 1,
          videoFile: 1,
          views: 1,
          createdAt: 1,
          duration: 1,
          "owner": "$ownerInfo._id",
          "username": "$ownerInfo.username",
          "avatar": "$ownerInfo.avatar"
        }
      }
    ]);
  
    const total = await Video.countDocuments({ isPublished: true });
  
    res.status(200).json(
      new ApiResponse(200, {
        videos: result,
        page,
        totalPages: Math.ceil(total / limit),
        totalVideos: total
      }, "All Video Fetched Successfully")
    );
  });
  

  




export { uploadVideo,allUploadedVideo };