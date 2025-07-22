// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UserStorage {
    struct File{
        string name;
        string CID;
    }
    mapping(address => File[]) public CIDs;
    address public owner;
    constructor() {
        owner = msg.sender;
    }

    function addCID(string memory _cid,string memory _name) external {
        File memory newFile = File(_name,_cid);
        CIDs[msg.sender].push(newFile);
    }

    function getCIDs() external view returns (File[] memory) {
        return CIDs[msg.sender];
    }
}
