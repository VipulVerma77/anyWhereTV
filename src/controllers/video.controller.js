import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";



const uploadVideo = asyncHandler(async (req, res, next) => {
  try {
    const { title, description, duration, isPublished } = req.body;

    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath || !thumbnailLocalPath) {
      throw new ApiError(400, !videoLocalPath ? "Video file is required" : "Thumbnail is required");
    }

    const uploadedvideo = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!uploadedvideo || !thumbnail) {
      throw new ApiError(400, !uploadedvideo ? "Video is required" : "Thumbnail is required");
    }

    const video = new Video({
      title: title,
      videoFile: uploadedvideo?.url,
      thumbnail: thumbnail?.url,
      description: description,
      duration: parseInt(duration),
      published: isPublished,
      owner: req.user._id,
      views: 0,
    })

    await video.save();

    const createdVideo = await Video.findById(video._id).select('-_v');

    if (!createdVideo) {
      throw new ApiError(500, "Something went wrong while uploading video");
    }

    return res.status(201)
      .json(
        new ApiResponse(200, createdVideo, "Video uploaded successfully")
      )
  } catch (error) {
    console.log("Error while uploading video", error.message)
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


const watchVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Video ID is required");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users", // The collection to join with
        localField: "owner", // Field from the video document
        foreignField: "_id", // Field from the user document
        as: "ownerInfo", // Name of the new field with the joined data
      },
    },
    {
      $unwind: "$ownerInfo", // Unwind the array (since lookup will return an array)
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
        "avatar": "$ownerInfo.avatar",
      },
    },
  ]);

  if (!video || video.length === 0) {
    throw new ApiError(404, "Video not found");
  }

  return res.status(200).json(
    new ApiResponse(200, video[0], "Video details fetched successfully")
  );
})
const countViews = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(401, "Video id not found")
  }

  const video = await Video.findByIdAndUpdate(
    videoId,
    { $inc: { views: 1 } },
    { new: true }
  );

  if(!video){
    throw new ApiError(404,"Video Not Found");
  }

  return res.status(200)
  .json(
    new ApiResponse(200,video,"View Count Updated")
  )
})






export { uploadVideo, allUploadedVideo, countViews,watchVideo };