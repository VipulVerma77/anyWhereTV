import { Router } from "express";
import { allUploadedVideo, uploadVideo } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

//secured route

router.route("/upload").post(
    verifyJWT,
    upload.fields([
        {
            name:"videoFile",
            maxCount: 1
        },
        {
            name:"thumbnail",
            maxCount:1
        }
    ]),
    uploadVideo
)

router.route("/feed").get(allUploadedVideo);



export default router;