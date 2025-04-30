import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, getCloudinaryPublicId, uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = 'createdAt', sortType = 'desc', userId } = req.query;
  
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
    } catch (err) {
      return res.status(400).json(new ApiResponse(400, null, "Invalid userId format"));
    }
  }


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


  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortType === 'asc' ? 1 : -1 }
  };

  const videos = await Video.aggregatePaginate(aggregate, options);


  res.status(200)
    .json(new ApiResponse(200, videos, "All Videos Fetched Successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description, duration } = req.body;
  

  if (!title || !description || !duration) {
    throw new ApiError(400, !title ? "Title is missing" : !duration ? "Duration is missing" : "Description is missing");
  }

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
  
  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, !videoLocalPath ? "Video file is missing" : "Thumbnail is missing");
  }

  const video = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!video || !thumbnail) {
    throw new ApiError(400, !video ? "Video file upload failed" : "Thumbnail upload failed");
  }

  const newVideo = await Video.create({
    title,
    description,
    duration: parseInt(duration),
    videoFile: video.url,
    thumbnail: thumbnail.url,
    owner: req.user._id  
  });

  const createdVideo = await Video.findById(newVideo._id)
    .populate('owner', 'username avatar');  

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