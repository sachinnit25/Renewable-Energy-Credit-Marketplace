// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Reward.sol";

contract Marketplace {
    struct Listing {
        uint256 id;
        address seller;
        uint256 price; // in wei
        string metadata;
        bool sold;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public nextId;
    Reward public rewardToken;
    address public owner;

    event ListingCreated(uint256 indexed id, address indexed seller, uint256 price, string metadata);
    event Purchased(uint256 indexed id, address indexed buyer, uint256 price);

    constructor(address _reward) {
        rewardToken = Reward(_reward);
        owner = msg.sender;
    }

    function createListing(uint256 price, string calldata metadata) external returns (uint256) {
        listings[nextId] = Listing(nextId, msg.sender, price, metadata, false);
        emit ListingCreated(nextId, msg.sender, price, metadata);
        nextId++;
        return nextId - 1;
    }

    function purchase(uint256 id) external payable {
        Listing storage l = listings[id];
        require(!l.sold, "already sold");
        require(msg.value >= l.price, "insufficient payment");
        l.sold = true;

        // transfer ETH to seller
        payable(l.seller).transfer(l.price);
        emit Purchased(id, msg.sender, l.price);

        // reward both parties with tokens (example fixed amount)
        uint256 rewardAmt = 1 ether;
        rewardToken.mint(l.seller, rewardAmt);
        rewardToken.mint(msg.sender, rewardAmt);
    }
}
