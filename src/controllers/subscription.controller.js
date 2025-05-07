import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const subscriberId = req.user._id; 

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel does not exist");
    }

   
    if (channelId === subscriberId.toString()) {
        throw new ApiError(400, "Cannot subscribe to yourself");
    }

    const existingSubscription = await Subscription.findOne({
        subscriber: subscriberId,
        channel: channelId
    });

    let subscription;
    let message;

    if (existingSubscription) {
        await Subscription.deleteOne({ _id: existingSubscription._id });
        message = "Unsubscribed successfully";
    } else {
        subscription = await Subscription.create({
            subscriber: subscriberId,
            channel: channelId
        });
        message = "Subscribed successfully";
    }

    return res.status(200).json(
        new ApiResponse(200, subscription || null, message)
    );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    // 1. Validate channel ID
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id");
    }

    // 2. Check if channel exists
    const channel = await User.findById(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel does not exist");
    }

    // 3. Fetch subscribers with pagination
    const { page = 1, limit = 10 } = req.query;
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: {
            path: 'subscriber',
            select: 'username fullName avatar' // Only get necessary fields
        }
    };

    // 4. Query subscriptions
    const subscribers = await Subscription.paginate(
        { channel: channelId },
        options
    );

    // 5. Format response
    return res.status(200).json(
        new ApiResponse(200, {
            subscribers: subscribers.docs.map(doc => doc.subscriber), // Extract user details
            pagination: {
                totalSubscribers: subscribers.totalDocs,
                currentPage: subscribers.page,
                totalPages: subscribers.totalPages,
                hasNextPage: subscribers.hasNextPage
            }
        }, "Subscribers fetched successfully")
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    // 1. Validate subscriber ID
    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    // 2. Check if user exists
    const user = await User.findById(subscriberId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 3. Set up pagination
    const { page = 1, limit = 10 } = req.query;
    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        populate: {
            path: 'channel',
            select: 'username fullName avatar subscribersCount' // Include subscriber count
        }
    };

    // 4. Query subscriptions
    const subscriptions = await Subscription.paginate(
        { subscriber: subscriberId },
        options
    );

    // 5. Format response
    return res.status(200).json(
        new ApiResponse(200, {
            channels: subscriptions.docs.map(doc => ({
                ...doc.channel.toObject(), // Convert Mongoose doc to plain object
                isSubscribed: true // Explicit subscription status
            })),
            pagination: {
                totalChannels: subscriptions.totalDocs,
                currentPage: subscriptions.page,
                totalPages: subscriptions.totalPages,
                hasNextPage: subscriptions.hasNextPage
            }
        }, "Subscribed channels fetched successfully")
    );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}