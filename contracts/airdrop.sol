
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Airdrop is ReentrancyGuard {

    bool public airdropStarted;

    mapping (address => bool) public isEligible;
    mapping (address => bool) public claimed;
    address public owner;
    address[] public eligibleAddresses;
    uint public allocation;

    event AirdropClaimed(address indexed user, uint amount);

    modifier onlyOwner {
        require(msg.sender == owner, "Owner-only function");
        _;
    }

    constructor () {
        owner = msg.sender;
    }

    function registerAddress() public {
        require(!airdropStarted, "Airdrop already started");
        require(isEligible[msg.sender] == false, "Already registered");
        require(msg.sender != address(0), "Invalid address");
        require(address(msg.sender).balance >= 1 ether, "You need at least 1 ETH to participate");
        isEligible[msg.sender] = true;
        eligibleAddresses.push(msg.sender);
    }

    function viewAddresses() external view returns (address[] memory) {
        return eligibleAddresses;
    }

    function viewAllocation() external view returns (uint256) {
        return allocation;
    }

    function addFunds() public payable onlyOwner {
    }

    function startAirdrop() public onlyOwner {

        require(eligibleAddresses.length > 0, "No eligible addresses");

        require(!airdropStarted, "Airdrop already started");

        airdropStarted = true;

        allocation = address(this).balance / eligibleAddresses.length;
    }

    function claimAirdrop() public nonReentrant {
        require(airdropStarted, "Claim is not opened yet.");
        require(isEligible[msg.sender], "You are not eligible");
        require(!claimed[msg.sender], "Already claimed");
        
        (bool success, ) = payable(msg.sender).call{value: allocation}("");
        require(success, "Transfer failed");

        claimed[msg.sender] = true;

        emit AirdropClaimed(msg.sender, allocation);

    }

    function changeOwner (address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid Address");
        owner = newOwner;
    }

}