import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // waise acchi baat nhii hai origanl name lena, twerk kr skte hai
    }
  })
  
 export const upload = multer({
     storage, 
    })