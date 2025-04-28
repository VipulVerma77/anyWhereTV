import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


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
    match.owner = userId;
  } else {
    throw new ApiError(400, "UserId is missing");
  }

  const aggregate = Video.aggregate([
    { $match: match },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ]);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortType === 'asc' ? 1 : -1 }
  };

  const videos = await Video.aggregatePaginate(aggregate, options);

  res.status(200)
    .json(new ApiResponse(200, videos, "All Video Fetched Successfully"));
})

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description,duration } = req.body
  if(!title || !description || !duration){
    throw new ApiError(400,!title ? "Title is missing" : !duration ? "Duration is missing"  : "Description is missing")
  }
  const videoLocalPath = req.files?.videoFile[0]?.path ; 
  const thumnailLocalPath = req.files?.thumbnail[0]?.path ; 
  if(!videoLocalPath || !thumnailLocalPath ){
    throw new ApiError(400,!videoLocalPath ? "Video file is missing" : "Thumbnail is missing")
  }

  const video = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumnailLocalPath);

  if(!video || !thumbnail ){
    throw new ApiError(400,!video ? "Video file is missing" : "Thumbnail is missing")
  }

  const newVideo = await Video.create({
    title,
    description,
    duration :parseInt(duration),
    videoFile:video?.url,
    thumbnail:thumbnail?.url
  })

  const createdVideo = await Video.findById(newVideo._id)

  if(!createdVideo) {
    throw new ApiError(500,"Something went wrong while uploading video")
  }

  res.status(201)
  .json(
    new ApiResponse(200,createdVideo,"Video Uploaded Successfully")
  )
})

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params
  //TODO: delete video
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