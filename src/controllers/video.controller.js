import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, getCloudinaryPublicId, uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = 'createdAt', sortType = 'desc', userId } = req.query;

  // Debug: Log incoming query params
  console.log("Request query:", req.query);

  const match = {};
  
  if (query) {
    match.$or = [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ];
  }

  if (userId) {
    try {
      match.owner = new mongoose.Types.ObjectId(userId);
      console.log("Filtering by owner:", match.owner);
    } catch (err) {
      console.error("Invalid userId format:", userId);
      return res.status(400).json(new ApiResponse(400, null, "Invalid userId format"));
    }
  }

  // Debug: Check match criteria
  console.log("Final match criteria:", match);

  const aggregate = [
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'ownerDetails'
      }
    },
    { 
      $unwind: {
        path: '$ownerDetails',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: 1,
        ownerUsername: '$ownerDetails.username',
        ownerAvatar: '$ownerDetails.avatar'
      }
    }
  ];

  // Debug: Check raw aggregation results
  const rawResults = await Video.aggregate(aggregate);
  console.log("Raw aggregation results:", rawResults);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortType === 'asc' ? 1 : -1 }
  };

  const videos = await Video.aggregatePaginate(aggregate, options);

  // Debug: Check final paginated results
  console.log("Paginated results:", videos);

  res.status(200)
    .json(new ApiResponse(200, videos, "All Videos Fetched Successfully"));
});



const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description, duration } = req.body;
  
  // Validate required fields
  if (!title || !description || !duration) {
    throw new ApiError(400, !title ? "Title is missing" : !duration ? "Duration is missing" : "Description is missing");
  }

  // Get file paths
  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
  
  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, !videoLocalPath ? "Video file is missing" : "Thumbnail is missing");
  }

  // Upload to Cloudinary
  const video = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!video || !thumbnail) {
    throw new ApiError(400, !video ? "Video file upload failed" : "Thumbnail upload failed");
  }

  // Create video with owner
  const newVideo = await Video.create({
    title,
    description,
    duration: parseInt(duration),
    videoFile: video.url,
    thumbnail: thumbnail.url,
    owner: req.user._id  // THIS IS THE CRITICAL LINE YOU'RE MISSING
  });

  const createdVideo = await Video.findById(newVideo._id)
    .populate('owner', 'username avatar');  // Optional: populate owner info

  if (!createdVideo) {
    throw new ApiError(500, "Something went wrong while uploading video");
  }

  res.status(201).json(
    new ApiResponse(201, createdVideo, "Video Uploaded Successfully")
  );
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params

  if (!videoId) {
    throw new ApiError(400, "Video Id is missing");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Something went wrong to get video");
  }

  res.status(200)
    .json(
      new ApiResponse(200, video, "Video found Successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  const { title, description, duration } = req.body;

  if (!videoId) {
    throw new ApiError(400, "Video Id is missing");
  }

  if (!title || !description || !duration) {
    throw new ApiError(400, !title ? "Title is missing" : !duration ? "Duration is missing" : "Description is missing")
  }
  const videoLocalPath = req.files?.videoFile[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is missing")
  }

  const cloudVideo = await uploadOnCloudinary(videoLocalPath);
  const existingVideo = await Video.findById(videoId);
  if (existingVideo && existingVideo?.videoFile) {
    const publicId = getCloudinaryPublicId(existingVideo.videoFile);
    await deleteFromCloudinary(publicId)
  }


  if (!cloudVideo) {
    throw new ApiError(400, "Video is missing")
  }


  const video = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        duration: parseInt(duration),
        videoFile: cloudVideo?.url
      }
    },
    { new: true }
  )

  res.status(200)
    .json(
      new ApiResponse(200, video, "Video Updated Successfully")
    )

})

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  if (!videoId) {
    throw new ApiError(400, "Video Id is missing");
  }

  const video = await Video.findByIdAndDelete(videoId)

  if(!video){
    throw new ApiError(404,"Video not found")
  }

  if (video?.videoFile) {
    const publicId = getCloudinaryPublicId(video.videoFile);
    await deleteFromCloudinary(publicId);
  }

  res
  .status(204)
  .json(
    new ApiResponse(200, video, "Video Deleted Successfully")
  )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params
})

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus
}