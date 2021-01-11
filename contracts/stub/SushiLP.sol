pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract SushiLP is ERC20, ERC20Detailed("SushiLP Token", "SLP", 18) {
    constructor() public {
        _mint(msg.sender, 10000e18);
    }
}
