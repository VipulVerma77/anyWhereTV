import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";
import { response } from "express";


const genrateAccessAndRefreshTokens = async(userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.genrateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken,refreshToken}

  } catch (error) {
    throw new ApiError(500,"Something went wrong while genrating refresh and access token")
  }
}

const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullName, password } = req.body
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const passwordValidation = (password) => {
      if (password.length < 7) return false;
      if (!/[a-z]/.test(password)) return false;
      if (!/[A-Z]/.test(password)) return false;
      if (!/\d/.test(password)) return false;
      if (!/[@$!%*?&]/.test(password)) return false;
  
      return true;
  };

  //console.log("password----------------------------",passwordValidation)
   
  if(!passwordValidation(password)){
    throw new ApiError(400,"Password must length must greater than 7 and contain one upper,lower,numeric and special character ")
  }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User Already Exists")
    }

    //console.log("Req", req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
      coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is Required")
    }

  //  console.log("AVATAR PATH -------------", avatarLocalPath)

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
      console.log("This avatar")
        throw new ApiError(400,"Avatar file is Required")
    }

  const user =  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase(),
    })

  const createdUser =  await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if(!createdUser){
    throw new ApiError(500,"Something went wrong while registering user")
  }

  return res.status(201).json(
    new ApiResponse(200,createdUser, "User Registered SuccessFully")
  )



})


// login todo
//username or email
// find user
//password check
//genrate accesstoken  and refresh token
// send cookie

const loginUser = asyncHandler(async (req, res) => {
  const {username,email,password} = req.body

  if(!username && !email){
    throw new ApiError(400,"username or email is required")
  }

 const user = await User.findOne({
    $or:[{username}, {email}]
  })

  if(!user){
    throw new ApiError(404,"User does not exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError(401,"Invalid user credential")
  }

 const {accessToken, refreshToken} = await  genrateAccessAndRefreshTokens(user._id)


 const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

 const options = {
  httpOnly:true,
  secure:true
 }

 return res.status(200)
 .cookie("accessToken",accessToken,options)
 .cookie("refreshToken",refreshToken,options)
 .json(
  new ApiResponse(
    200,
    {
      user:loggedInUser,accessToken,refreshToken
    },
    "User logged In Successfully"
  )
 )

})

const logoutUser = asyncHandler(async (req, res) =>{
 await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken:undefined
      }
    },
    {
      new:true
    }
  )

  const options = {
    httpOnly:true,
    secure:true
   }

   return res
   .status(200)
   .clearCookie("accessToken",options)
   .clearCookie("refreshToken",options)
   .json(new ApiResponse(200,{},"User Logged Out "))

})

const refreshAccessToken = asyncHandler(async (req,res) => {
 const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

 if(!incomingRefreshToken){
  throw new ApiError(401,"unauthorized request")
 }

 try {
  const decodedToken = jwt.verify(
   incomingRefreshToken,
   process.env.RERESH_TOKEN_SECRET
  )
 
 const user =  await User.findById(decodedToken?._id)
 
 if(!user){
   throw new ApiError(401,"Invalid refresh token")
 }
 
 if(incomingRefreshToken !== user?.refreshToken){
   throw new ApiError(401,"Refresh token is expired  or used")
 }
 
 const options = {
   httpOnly:true,
   secure:true
 }
 
 const {accessToken,newRefreshToken}  = await genrateAccessAndRefreshTokens(user._id)
 return res
 .status(200)
 .cookie("accessToken",accessToken,options)
 .cookie("refreshToken",newRefreshToken,options)
 .json(
   new ApiResponse(
     200,{
       accessToken,refreshToken:newRefreshToken
     },
     "Access token refreshed"
   )
 )
 } catch (error) {
  throw new ApiError(401,error?.message || "Invalid refreshToken");
  
 }

})

export { registerUser,loginUser,logoutUser,refreshAccessToken };