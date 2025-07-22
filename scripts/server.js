let express = require("express");
let app = express();
let path = require("path");
let { ethers } = require("ethers");
let mongoose = require("mongoose");
const multer = require("multer");
require("dotenv").config();
let fs = require("fs");
let pinataSDK = require("@pinata/sdk");
let crypto = require("crypto");
const session = require("express-session");
const { type } = require("os");
const { Result } = require("ethers");

app.use(session({
    secret: process.env.SESSION_SECREAT_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));


let pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

let port = process.env.port;
let mongoDbUrl = process.env.MONGODB_URI;

let enrolledUsers = new mongoose.Schema({
    name: {
        type: String,
    },
    contact: {
        type: String,
    },
    email: {
        type: String,
    },
    ethAddress: {
        type: String,
    },
}, { timeStamp: true });

let eachUserData = new mongoose.Schema({
    ethAddress: {
        type: String,
    },
    fileNames: {
        type: [String],
        default: []
    },
    storageUsed: {
        type: Number,
        default: 0
    },
    lastUpload: {
        type: Date,
        default: 0
    }
})

let totalUsers = new mongoose.model("Signed Up users", enrolledUsers);
let totalData = new mongoose.model("Total user data", eachUserData);

mongoose
    .connect(mongoDbUrl)
    .then(() => {
        console.log("DataBase connected");
    })
    .catch(() => {
        console.log("Error in connecting DataBase");
    });


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../uploads")); // make sure this folder exists
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

app.use("/abi", express.static(path.join(__dirname, "../artifacts/contracts/storage.sol")));
app.use(express.static('views'));
app.use(express.json()); // for JSON
app.use(express.urlencoded({ extended: true })); // for form submissions
app.set('view engine', 'ejs');


app.get("/", async (req, res) => {
    res.sendFile("C:\\Users\\nkshu\\OneDrive\\Desktop\\Safebox\\views\\index.html");
});
app.get("/getStarted", async (req, res) => {
    res.sendFile("C:\\Users\\nkshu\\OneDrive\\Desktop\\Safebox\\views\\getStarted.html");
});
app.get("/login", async (req, res) => {
    res.sendFile("C:\\Users\\nkshu\\OneDrive\\Desktop\\Safebox\\views\\login.html");
});

app.post("/signup", async (req, res) => {
    let { name, email, phone, address } = req.body;

    try {
        await totalUsers.create({
            name: name,
            email: email,
            phone: phone,
            ethAddress: address
        });
        await totalData.create({
            ethAddress: address,
        });
        console.log(name, email, phone, address);
        console.log("User added to DB");
    } catch (error) {
        console.log("Error in creating user");
    }
    res.redirect("/login");
})
app.post("/login", async (req, res) => {
    let { address } = req.body;
    try {
        let user = await totalUsers.findOne({
            ethAddress: address
        });
        if (user) {
            req.session.user = {
                address: address
            }
            console.log("User found in DB");
            res.redirect("/home");
        }
        else {
            res.end("hello");
        }
    } catch (error) {
        console.error("Error in finding user ", error);
    }
    // console.log(address);
})
app.get("/home", async (req, res) => {
    if (!req.session.user) {
        console.log("hlulululululul");
        res.redirect("/");
        return;
    }
    res.sendFile("C:\\Users\\nkshu\\OneDrive\\Desktop\\Safebox\\views\\home.html");
});

app.post("/homeData", async (req, res) => {
    let { address } = req.body;
    console.log(address);
    if (!address) {
        console.log("Error in fetching data ie no address found");
    }
    let user = await totalData.findOne({ ethAddress: address });
    if (user) {
        console.log("User found");
    }
    // console.log(user);
    let userData = {
        totalFileNames: user.fileNames,
        totalFiles: user.fileNames.length,
        storageUsed: user.storageUsed,
        lastUpload: user.lastUpload,

    };
    res.json(userData);
})

app.get("/logout", async (req, res) => {
    console.log(req.session.user);
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Unable to logout");
        }
        console.log("User session destroyed");
    })
    res.redirect("/");
})

const secretKey = "nitishapple11";

function encryptFile(inputPath, outputPath, secretKey) {
    let algorithm = "aes-256-cbc";
    const iv = crypto.randomBytes(16); // Initialization vector
    const key = crypto.scryptSync(secretKey, "salt", 32); // Generate 32-byte key
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    input.pipe(cipher).pipe(output);
    return new Promise((resolve, reject) => {
        output.on("finish", () => {
            resolve({
                iv: iv.toString("hex"), // Save this IV for decryption later
                key: key.toString("hex") // Optional: regenerated from password
            });
        });
        output.on("error", reject);
    });
}


app.post("/fileUpload", upload.single("file"), async (req, res) => {
    let userAddress = req.session.user;
    let file = req.file;
    console.log(file);
    let fileName = req.file.originalname;
    let fileSizeInBytes = req.file.size;
    let CID;
    if (!file || !fileName) {
        return res.status(500).end("No file uploaded");
    }
    try {
        await encryptFile(req.file.path, req.file.path, secretKey)
        console.log("File encryption sucessfull")
    }
    catch (e) {
        console.error(e);
        res.end("Encryption failed");
    }
    let result;
    try {
        let fileStream = fs.createReadStream(req.file.path);
        result = await pinata.pinFileToIPFS(fileStream, {
            pinataMetadata: {
                name: req.file.originalname,
            },
            pinataOptions: {
                cidVersion: 0
            }
        });
        CID = result.IpfsHash;
        console.log(CID);

        console.log("IPFS upload successful ", result);
        fs.unlink(req.file.path, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            }
        });

    } catch (error) {
        console.error("Error in pinning file to IPFS network");
        return res.end("Error");
    }

    try {
        await totalData.findOneAndUpdate(
            { ethAddress: userAddress.address },
            {
                $push: { fileNames: fileName },
                $set: { lastUpload: new Date() },
                $inc: { storageUsed: fileSizeInBytes }
            })
    } catch (error) {
        console.log("Error in uploading file ", error);
        return res.status(500).send("error");
    }
    let date = new Date(result.Timestamp);
    let formatted = date.toLocaleString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",

    });
    let successData = {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadTime: formatted,
        ipfsHash: CID,
    }

    res.render("success", successData);
})


app.listen("2000", "0.0.0.0", () => {
    console.log("Server started on port: ", port);
})
