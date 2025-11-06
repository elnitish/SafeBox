// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SafeBoxStorage {
    struct File {
        string name;
        string CID;
        uint256 uploadedAt;
    }

    struct FileRecord {
        address user;
        string CID;
        string fileName;
        uint256 uploadedAt;
    }

    mapping(address => File[]) private userFiles;
    mapping(bytes32 => FileRecord) private fileCodes; // code => file record
    mapping(address => bytes32[]) private userCodes; // user => array of codes
    address public owner;
    uint256 private nonce;

    event FileAdded(address indexed user, string name, string cid, bytes32 fileCode);
    event FileDeleted(address indexed user, string name);
    event CIDRetrieved(address indexed requester, bytes32 fileCode);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // Generate unique file code
    function _generateFileCode(address _user, string memory _cid, uint256 _timestamp) private view returns (bytes32) {
        return keccak256(abi.encodePacked(_user, _cid, _timestamp, block.timestamp, nonce, blockhash(block.number - 1)));
    }

    function addCID(string memory _cid, string memory _name) external returns (bytes32) {
        uint256 timestamp = block.timestamp;
        bytes32 fileCode = _generateFileCode(msg.sender, _cid, timestamp);
        nonce++;
        
        userFiles[msg.sender].push(File(_name, _cid, timestamp));
        fileCodes[fileCode] = FileRecord(msg.sender, _cid, _name, timestamp);
        userCodes[msg.sender].push(fileCode);
        
        emit FileAdded(msg.sender, _name, _cid, fileCode);
        return fileCode;
    }

    function addCIDForUser(address _user, string memory _cid, string memory _name) external onlyOwner returns (bytes32) {
        uint256 timestamp = block.timestamp;
        bytes32 fileCode = _generateFileCode(_user, _cid, timestamp);
        nonce++;
        
        userFiles[_user].push(File(_name, _cid, timestamp));
        fileCodes[fileCode] = FileRecord(_user, _cid, _name, timestamp);
        userCodes[_user].push(fileCode);
        
        emit FileAdded(_user, _name, _cid, fileCode);
        return fileCode;
    }

    // Retrieve CID by file code (only owner or file owner can retrieve)
    function getCIDByCode(bytes32 _fileCode) external view returns (string memory) {
        FileRecord memory record = fileCodes[_fileCode];
        require(record.user != address(0), "File code not found");
        require(record.user == msg.sender || msg.sender == owner, "Not authorized to access this file");
        return record.CID;
    }

    // Get file details by code (for verification)
    function getFileByCode(bytes32 _fileCode) external view returns (FileRecord memory) {
        FileRecord memory record = fileCodes[_fileCode];
        require(record.user != address(0), "File code not found");
        require(record.user == msg.sender || msg.sender == owner, "Not authorized to access this file");
        return record;
    }

    function getMyFiles() external view returns (File[] memory) {
        return userFiles[msg.sender];
    }

    function getUserFiles(address _user) external view onlyOwner returns (File[] memory) {
        return userFiles[_user];
    }

    function deleteFile(uint index) external {
        require(index < userFiles[msg.sender].length, "Invalid index");
        emit FileDeleted(msg.sender, userFiles[msg.sender][index].name);
        uint lastIndex = userFiles[msg.sender].length - 1;
        userFiles[msg.sender][index] = userFiles[msg.sender][lastIndex];
        userFiles[msg.sender].pop();
    }
}
