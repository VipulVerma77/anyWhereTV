import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, getCloudinaryPublicId, uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    query, 
    sortBy = 'createdAt', 
    sortType = 'desc', 
    userId 
  } = req.query;

  // 1. Build match stage
  const match = {};
  
  // Search functionality
  if (query) {
    match.$or = [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ];
  }

  // User filter
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user ID format");
    }
    match.owner = new mongoose.Types.ObjectId(userId);
  }

  // 2. Optimized aggregation pipeline
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'users',
        let: { ownerId: '$owner' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$ownerId'] } } },
          { $project: { username: 1, avatar: 1 } }
        ],
        as: 'owner'
      }
    },
    { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
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
        owner: {
          username: '$owner.username',
          avatar: '$owner.avatar'
        }
      }
    },
    { $sort: { [sortBy]: sortType === 'asc' ? 1 : -1 } }
  ];

  // 3. Pagination with custom labels
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    customLabels: {
      docs: 'videos',
      totalDocs: 'totalVideos',
      totalPages: 'pageCount',
      nextPage: 'next',
      prevPage: 'prev',
      hasNextPage: 'hasNext',
      hasPrevPage: 'hasPrev'
    }
  };

  // 4. Execute aggregation
  const result = await Video.aggregatePaginate(pipeline, options);

  // 5. Standardized response
  return res.status(200).json(
    new ApiResponse(200, {
      videos: result.videos,
      pagination: {
        currentPage: result.page,
        itemsPerPage: result.limit,
        totalItems: result.totalVideos,
        totalPages: result.pageCount,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev
      }
    }, "Videos fetched successfully")
  );
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
  const { videoId } = req.params;
  const { title, description, duration } = req.body;

  // Validate inputs
  if (!videoId) {
    throw new ApiError(400, "Video ID is required");
  }

  if (!title || !description || !duration) {
    throw new ApiError(400, "All fields (title, description, duration) are required");
  }

  // Find existing video and verify ownership
  const existingVideo = await Video.findById(videoId);
  if (!existingVideo) {
    throw new ApiError(404, "Video not found");
  }

  // Verify the requesting user owns the video
  if (existingVideo.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to update this video");
  }

  // Handle video file upload if provided
  let cloudVideo;
  if (req.files?.videoFile) {
    try {
      const videoLocalPath = req.files.videoFile[0]?.path;
      if (!videoLocalPath) {
        throw new ApiError(400, "Invalid video file");
      }

      // Delete old video from Cloudinary
      if (existingVideo.videoFile) {
        const publicId = getCloudinaryPublicId(existingVideo.videoFile);
        await deleteFromCloudinary(publicId).catch(err =>
          console.error("Failed to delete old video:", err)
        );
      }

      // Upload new video
      cloudVideo = await uploadOnCloudinary(videoLocalPath);
      if (!cloudVideo) {
        throw new ApiError(500, "Failed to upload video");
      }
    } catch (error) {
      throw new ApiError(500, `Video upload failed: ${error.message}`);
    }
  }

  // Handle thumbnail upload if provided (optional)
  let thumbnailUpdate = {};
  if (req.files?.thumbnail) {
    try {
      const thumbnailLocalPath = req.files.thumbnail[0]?.path;
      if (thumbnailLocalPath) {
        const cloudThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (cloudThumbnail) {
          // Delete old thumbnail if exists
          if (existingVideo.thumbnail) {
            const publicId = getCloudinaryPublicId(existingVideo.thumbnail);
            await deleteFromCloudinary(publicId).catch(console.error);
          }
          thumbnailUpdate.thumbnail = cloudThumbnail.url;
        }
      }
    } catch (error) {
      console.error("Thumbnail update failed:", error);
    }
  }

  // Prepare update data
  const updateData = {
    title,
    description,
    duration: parseInt(duration),
    ...(cloudVideo && { videoFile: cloudVideo.url }),
    ...thumbnailUpdate
  };

  // Update video
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: updateData },
    { new: true }
  ).populate('owner', 'username avatar');

  if (!updatedVideo) {
    throw new ApiError(500, "Failed to update video");
  }

  res.status(200).json(
    new ApiResponse(200, updatedVideo, "Video updated successfully")
  );
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // Validate input
  if (!videoId || !mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Valid video ID is required");
  }

  // Find video first to check ownership and get Cloudinary IDs
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Verify ownership
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to delete this video");
  }

  // Collect all Cloudinary assets to delete
  const deletionPromises = [];

  if (video.videoFile) {
    const videoPublicId = getCloudinaryPublicId(video.videoFile);
    deletionPromises.push(deleteFromCloudinary(videoPublicId).catch(err =>
      console.error("Failed to delete video file:", err)
    ));
  }

  if (video.thumbnail) {
    const thumbnailPublicId = getCloudinaryPublicId(video.thumbnail);
    deletionPromises.push(deleteFromCloudinary(thumbnailPublicId).catch(err =>
      console.error("Failed to delete thumbnail:", err)
    ));
  }

  // Delete from database
  const deletedVideo = await Video.findByIdAndDelete(videoId);

  if (!deletedVideo) {
    throw new ApiError(500, "Failed to delete video from database");
  }

  // Wait for Cloudinary deletions (but don't fail if they fail)
  await Promise.allSettled(deletionPromises);

  // Using 200 OK with success message (alternative to 204 No Content)
  return res.status(200).json(
    new ApiResponse(200, null, "Video deleted successfully")
  );
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // 1. Validate videoId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format");
  }

  // 2. Find the video and verify ownership
  const video = await Video.findOne({
    _id: videoId,
    owner: req.user._id // Ensure only owner can toggle status
  });

  if (!video) {
    throw new ApiError(404, "Video not found or unauthorized");
  }

  // 3. Toggle the publish status
  video.isPublished = !video.isPublished;
  await video.save();

  // 4. Return the updated video
  return res.status(200).json(
    new ApiResponse(200, video, `Video ${video.isPublished ? 'published' : 'unpublished'} successfully`)
  );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus
}