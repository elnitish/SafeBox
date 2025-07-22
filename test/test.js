let { expect } = require("chai");
let { ethers } = require("hardhat");

describe("Storage contract", function () {
  let owner, add1, add2;
  let fileContract, UserStorage;


  beforeEach(async () => {
    [owner, add1, add2] = await ethers.getSigners();
    fileContract = await ethers.getContractFactory("UserStorage");
    UserStorage = await fileContract.deploy();
  })

  it("Should deploy the contract with correct admin", async () => {
    expect(await UserStorage.owner()).to.equal(owner.address);
  })

  it("Should add CIDs to the network correctly", async () => {
    await UserStorage.connect(add1).addCID("QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    await UserStorage.connect(add1).addCID("Ybjdkfbgjskdflgbjdfbgsdklfbglsdjfbgsdfjgbhbhjk");
    let cids1 = await UserStorage.connect(add1).getCIDs();
    expect(cids1[0]).to.equal("QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    console.log(cids1[0]);
    // expect();
    // expect(await UserStorage.connect(add2).addCID("Bbjdfghdfghsdufighsdfjgkllsdhfgjsfdghjsfkdghjh"));
    // expect(await UserStorage.connect(add2).addCID("Tgjdkfbgjsdkfbgsdjfkglbsdfjgklbdgfjksdfbgdsjfk"));
    // let cids2 = await UserStorage.connect(add2).getCIDs();
    // console.log(cids1);
    // console.log(cids2);
  })

  it("Should return the CIDs for a particular address correctly ", async () => {
    let cids1 = await UserStorage.connect(add1).getCIDs();
    let cids2 = await UserStorage.connect(add2).getCIDs();
    console.log(cids1);
    console.log(cids2);
    // expect(cids1).to.equal()
  })

})


