
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2;

contract Airdrop {

    mapping (address => bool) public isEligible;
    address public owner;
    address[] public eligibleAddresses;

    modifier onlyOwner {
        require(msg.sender == owner, "Owner-only function");
        _;
    }

    constructor () {
        owner = msg.sender;
    }

    function registerAddress() public {
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
        return address(this).balance / eligibleAddresses.length;
    }

    function addFunds() public payable onlyOwner {
    }

    function startAirdrop() public onlyOwner {

        uint allocation = address(this).balance/eligibleAddresses.length;

        for (uint256 i = 0; i < eligibleAddresses.length; i++) {
            payable(eligibleAddresses[i]).transfer(allocation);
        }
    }

    function changeOwner (address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid Address");
        owner = newOwner;
    }

}