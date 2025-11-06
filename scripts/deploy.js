let { ethers } = require("hardhat");
let fs = require("fs");
let path = require("path");

async function deploy() {
    let fileContract = await ethers.getContractFactory("SafeBoxStorage");
    let UserStorage = await fileContract.deploy();
    let [owner] = await ethers.getSigners();

    console.log("Safebox deployed by ", owner.address);
    console.log("Contract deployed at ", UserStorage.target);
    const contractsDir = path.resolve(__dirname, '..', 'views', 'contractAddress.json');
    fs.writeFileSync(
        contractsDir,
        JSON.stringify({ Address: UserStorage.target }, null, 2)
    );

}
deploy().catch((e) => {
    console.error("Error in deploying script ", e);
    process.exitCode(1);
})