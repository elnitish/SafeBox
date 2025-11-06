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

app.use(session({
    secret: process.env.SESSION_SECREAT_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));


let pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

let port = process.env.port;
let mongoDbUrl = process.env.MONGODB_URI;

// Blockchain setup
let provider;
let signer;
let contract;
let contractAddress;
let contractABI;

// Initialize blockchain connection
async function initBlockchain() {
    try {
        const rpcUrl = process.env.RPC_URL || "http://localhost:8545"; // Default to local Hardhat
        
        if (!process.env.PRIVATE_KEY) {
            console.warn("⚠️  Warning: PRIVATE_KEY not set in environment. Blockchain transactions will fail.");
            return;
        }
        
        // ethers v6 API - use ethers.JsonRpcProvider instead of ethers.providers.JsonRpcProvider
        // Disable automatic retries by providing network config directly
        provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Try to get network info with a timeout
        try {
            const network = await Promise.race([
                provider.getNetwork(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Connection timeout")), 5000)
                )
            ]);
            console.log(`✓ Connected to blockchain network: ${network.name || 'Unknown'} (Chain ID: ${network.chainId})`);
        } catch (networkError) {
            console.error("❌ Error: Cannot connect to blockchain node at", rpcUrl);
            console.error("   Make sure your Hardhat node is running:");
            console.error("   Run: npx hardhat node");
            console.warn("⚠️  Blockchain functionality will be disabled until node is available.");
            provider = null;
            return;
        }
        
        signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        console.log("✓ Blockchain signer initialized with address:", await signer.getAddress());

        // Load contract address and ABI
        const contractAddressPath = path.join(__dirname, "../views/contractAddress.json");
        const contractAddressData = JSON.parse(fs.readFileSync(contractAddressPath, "utf8"));
        contractAddress = contractAddressData.Address;

        const abiPath = path.join(__dirname, "../artifacts/contracts/storage.sol/SafeBoxStorage.json");
        const abiData = JSON.parse(fs.readFileSync(abiPath, "utf8"));
        contractABI = abiData.abi;

        contract = new ethers.Contract(contractAddress, contractABI, signer);
        console.log("✓ Smart contract initialized at:", contractAddress);
    } catch (error) {
        console.error("❌ Error initializing blockchain:", error.message);
        console.warn("⚠️  Blockchain functionality will be disabled.");
        provider = null;
        contract = null;
        signer = null;
    }
}

// Initialize blockchain on server start
initBlockchain();

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
    files: [{
        fileName: String,
        fileCode: String, // bytes32 from blockchain
        uploadDate: Date
    }],
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

app.use(express.json()); // for JSON - must come before routes
app.use(express.urlencoded({ extended: true })); // for form submissions
app.set('view engine', 'ejs');
// Disable ETag to avoid 304 Not Modified on dynamic endpoints
app.set('etag', false);

// API routes should be defined before static middleware
// (viewFile route will be defined after other routes but before static)


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
    
    return new Promise((resolve, reject) => {
        const input = fs.createReadStream(inputPath);
        const chunks = [iv]; // Prepend IV to encrypted data
        
        cipher.on('data', (chunk) => chunks.push(chunk));
        cipher.on('end', () => {
            const encrypted = Buffer.concat(chunks);
            fs.writeFileSync(outputPath, encrypted);
            resolve({
                iv: iv.toString("hex"),
                key: key.toString("hex")
            });
        });
        cipher.on('error', reject);
        
        input.pipe(cipher);
    });
}

// Decrypt file data from buffer
function decryptFileBuffer(encryptedData, secretKey) {
    let algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(secretKey, "salt", 32); // Generate 32-byte key
    
    // For IPFS files, IV is prepended to the encrypted data (first 16 bytes)
    // However, since we encrypt locally and upload, we need to handle IV differently
    // Actually, when we encrypt the file, we write the encrypted data directly
    // We need to prepend IV to the encrypted file or store it separately
    // For now, let's try to decrypt assuming IV is at the start
    
    // Extract IV (first 16 bytes) and encrypted content (rest)
    if (encryptedData.length < 16) {
        throw new Error("Encrypted data too short");
    }
    
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return decrypted;
}


app.post("/fileUpload", upload.array("files"), async (req, res) => {
    let userAddress = req.session.user;
    const files = req.files || [];
    let customNames = req.body["names[]"] || req.body.names || [];
    if (!Array.isArray(customNames)) customNames = [customNames];

    if (!files.length) {
        return res.status(400).end("No files uploaded");
    }

    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const desiredName = customNames[i] || file.originalname;
        let CID;

        try {
            await encryptFile(file.path, file.path, secretKey);
        } catch (e) {
            results.push({
                fileName: desiredName,
                fileSize: file.size,
                error: "Encryption failed"
            });
            continue;
        }

        let pinRes;
        try {
            const fileStream = fs.createReadStream(file.path);
            pinRes = await pinata.pinFileToIPFS(fileStream, {
                pinataMetadata: { name: desiredName },
                pinataOptions: { cidVersion: 0 }
            });
            CID = pinRes.IpfsHash;
            fs.unlink(file.path, () => {});
        } catch (e) {
            results.push({
                fileName: desiredName,
                fileSize: file.size,
                error: "IPFS upload failed"
            });
            continue;
        }

        let txHash = null;
        let blockNumber = null;
        let gasUsed = null;
        let txStatus = "failed";
        let networkName = "Unknown";
        let txError = null;
        let fileCode = null;

        if (contract && signer && userAddress && userAddress.address) {
            try {
                const userAddressHex = userAddress.address;
                const tx = await contract.addCIDForUser(userAddressHex, CID, desiredName);
                txHash = tx.hash;
                const receipt = await tx.wait();

                const eventFilter = contract.filters.FileAdded(userAddressHex, null, null, null);
                const events = await contract.queryFilter(eventFilter, receipt.blockNumber, receipt.blockNumber);
                if (events.length > 0) {
                    const matchingEvent = events.find(e => e.args.name === desiredName && e.args.cid === CID);
                    fileCode = (matchingEvent || events[0]).args.fileCode;
                }

                blockNumber = receipt.blockNumber;
                gasUsed = receipt.gasUsed.toString();
                txStatus = "confirmed";
                const network = await provider.getNetwork();
                networkName = network.name || `Chain ${network.chainId}`;
            } catch (error) {
                txError = error.message || "Transaction failed";
                txStatus = "failed";
            }
        } else {
            txError = !userAddress || !userAddress.address ? "User address not found in session." : "Blockchain not initialized.";
        }

        try {
            const updateData = {
                $push: { fileNames: desiredName },
                $set: { lastUpload: new Date() },
                $inc: { storageUsed: file.size }
            };
            if (fileCode) {
                updateData.$push.files = {
                    fileName: desiredName,
                    fileCode: fileCode,
                    uploadDate: new Date()
                };
            }
            await totalData.findOneAndUpdate({ ethAddress: userAddress.address }, updateData);
        } catch (dbErr) {
            // continue; we still show results
        }

        let uploadedAt = new Date(pinRes.Timestamp);
        let formatted = uploadedAt.toLocaleString("en-IN", { year: "numeric", month: "long", day: "numeric" });

        results.push({
            fileName: desiredName,
            fileSize: file.size,
            uploadTime: formatted,
            ipfsHash: CID,
            txHash,
            blockNumber,
            gasUsed,
            txStatus,
            networkName,
            txError,
            userAddress: userAddress.address
        });
    }

    return res.render("success-batch.ejs", { results });
})

// View file endpoint - retrieves file from IPFS, decrypts and serves it
// MUST be defined BEFORE static middleware
app.get("/viewFile", async (req, res) => {
    // Ensure this dynamic response is never cached
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Session requirement temporarily disabled
    console.log("ViewFile request - File:", req.query.fileName);

    const fileName = req.query.fileName;

    if (!fileName) {
        return res.status(400).json({ error: "File name is required" });
    }

    try {
        // Find the file in database (search across users since session is disabled)
        const userData = await totalData.findOne({ 'files.fileName': fileName });
        if (!userData || !userData.files) {
            return res.status(404).json({ error: "File not found" });
        }

        // Find the file with matching name
        const fileRecord = userData.files.find(f => f.fileName === fileName);
        if (!fileRecord || !fileRecord.fileCode) {
            return res.status(404).json({ error: "File code not found for this file" });
        }

        const fileCode = fileRecord.fileCode;

        // Query blockchain to get CID using file code
        if (!contract || !signer) {
            return res.status(500).json({ error: "Blockchain not initialized" });
        }

        // Query blockchain to get CID using file code
        // fileCode is stored as hex string, need to convert to bytes32 format
        let CID;
        try {
            // Use the server's signer (contract owner) to query
            // The contract allows owner to query any file
            CID = await contract.getCIDByCode(fileCode);
            console.log("CID retrieved from blockchain:", CID);
        } catch (error) {
            console.error("Error retrieving CID from blockchain:", error);
            return res.status(500).json({ error: "Failed to retrieve CID from blockchain: " + error.message });
        }

        // Fetch encrypted file from IPFS
        const axios = require("axios");
        let encryptedData;
        try {
            // Try Pinata gateway first
            const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${CID}`;
            const response = await axios.get(ipfsUrl, { responseType: 'arraybuffer' });
            encryptedData = Buffer.from(response.data);
            console.log("File retrieved from IPFS, size:", encryptedData.length);
        } catch (ipfsError) {
            console.error("Error fetching from IPFS:", ipfsError);
            // Try public IPFS gateway as fallback
            try {
                const publicUrl = `https://ipfs.io/ipfs/${CID}`;
                const response = await axios.get(publicUrl, { responseType: 'arraybuffer', timeout: 30000 });
                encryptedData = Buffer.from(response.data);
            } catch (fallbackError) {
                return res.status(500).json({ error: "Failed to retrieve file from IPFS" });
            }
        }

        // Decrypt the file
        let decryptedData;
        try {
            decryptedData = decryptFileBuffer(encryptedData, secretKey);
        } catch (decryptError) {
            console.error("Decryption error:", decryptError);
            return res.status(500).json({ error: "Failed to decrypt file" });
        }

        // Determine content type based on file extension
        const ext = path.extname(fileName).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.json': 'application/json'
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        // Set headers and send file
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Content-Length', decryptedData.length);
        res.send(decryptedData);

    } catch (error) {
        console.error("Error in viewFile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
})

// Static file middleware - must come AFTER all API routes
app.use("/abi", express.static(path.join(__dirname, "../artifacts/contracts/storage.sol")));
app.use(express.static('views'));

app.listen(port, "0.0.0.0", () => {
    console.log("Server started on port: ", port);
})
